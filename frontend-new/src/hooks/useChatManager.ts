'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Message, Citation } from '@/types';
import { streamQuery } from '@/lib/api/chat';
import { generateId } from '@/lib/utils';
import { DEFAULT_TEAM, API_BASE_URL } from '@/lib/constants';

// Chat session type
export interface ChatSession {
    id: string;
    title: string;
    team: string;
    createdAt: Date;
    messages: Message[];
}

interface UseChatManagerReturn {
    // Current chat
    currentSession: ChatSession | null;
    messages: Message[];
    isLoading: boolean;

    // Actions
    sendMessage: (query: string) => Promise<void>;
    createNewChat: () => void;
    selectChat: (sessionId: string) => void;
    deleteChat: (sessionId: string) => Promise<void>;
    renameChat: (sessionId: string, title: string) => void;

    // All sessions
    sessions: ChatSession[];
}

const STORAGE_KEY = 'nexus-chat-sessions';

/**
 * Hook for managing multiple chat sessions with Redis persistence.
 */
export function useChatManager(team: string = DEFAULT_TEAM): UseChatManagerReturn {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Load sessions from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Convert date strings back to Date objects
                const restoredSessions = parsed.map((s: ChatSession) => ({
                    ...s,
                    createdAt: new Date(s.createdAt),
                    messages: s.messages.map((m: Message) => ({
                        ...m,
                        timestamp: new Date(m.timestamp)
                    }))
                }));
                setSessions(restoredSessions);
                // Select most recent session or create new one
                if (restoredSessions.length > 0) {
                    setCurrentSessionId(restoredSessions[0].id);
                }
            } catch (e) {
                console.error('Failed to parse stored sessions:', e);
            }
        }
    }, []);

    // Save sessions to localStorage whenever they change
    useEffect(() => {
        if (sessions.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
        }
    }, [sessions]);

    // Get current session
    const currentSession = sessions.find(s => s.id === currentSessionId) || null;
    const messages = currentSession?.messages || [];

    // Create a new chat session
    const createNewChat = useCallback(() => {
        const newSession: ChatSession = {
            id: `session-${crypto.randomUUID()}`,
            title: 'New Chat',
            team,
            createdAt: new Date(),
            messages: []
        };
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newSession.id);
    }, [team]);

    // Select an existing chat
    const selectChat = useCallback((sessionId: string) => {
        setCurrentSessionId(sessionId);
    }, []);

    // Delete a chat and clear from Redis
    const deleteChat = useCallback(async (sessionId: string) => {
        // Remove from local state
        setSessions(prev => prev.filter(s => s.id !== sessionId));

        // Clear from Redis backend
        try {
            await fetch(`${API_BASE_URL}/session/${sessionId}`, {
                method: 'DELETE'
            });
        } catch (e) {
            console.error('Failed to clear session from backend:', e);
        }

        // If we deleted the current session, select another or create new
        if (sessionId === currentSessionId) {
            setSessions(prev => {
                if (prev.length > 0) {
                    setCurrentSessionId(prev[0].id);
                } else {
                    // Create a new session if none left
                    const newSession: ChatSession = {
                        id: `session-${crypto.randomUUID()}`,
                        title: 'New Chat',
                        team,
                        createdAt: new Date(),
                        messages: []
                    };
                    setCurrentSessionId(newSession.id);
                    return [newSession];
                }
                return prev;
            });
        }
    }, [currentSessionId, team]);

    // Rename a chat
    const renameChat = useCallback((sessionId: string, title: string) => {
        setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, title } : s
        ));
    }, []);

    // Send a message in the current chat
    const sendMessage = useCallback(async (query: string) => {
        if (!query.trim() || isLoading || !currentSessionId) return;

        // Create user message
        const userMessage: Message = {
            id: generateId(),
            role: 'user',
            content: query,
            timestamp: new Date(),
        };

        // Update session with user message
        setSessions(prev => prev.map(s => {
            if (s.id !== currentSessionId) return s;
            // Auto-rename on first message
            const newTitle = s.messages.length === 0
                ? query.slice(0, 30) + (query.length > 30 ? '...' : '')
                : s.title;
            return {
                ...s,
                title: newTitle,
                messages: [...s.messages, userMessage]
            };
        }));

        setIsLoading(true);

        try {
            const response = await streamQuery({
                query,
                team,
                sessionId: currentSessionId,
            });

            if (!response.body) {
                throw new Error('No response body');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            // Create assistant message placeholder
            const assistantId = generateId();
            const assistantMessage: Message = {
                id: assistantId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
            };

            setSessions(prev => prev.map(s =>
                s.id === currentSessionId
                    ? { ...s, messages: [...s.messages, assistantMessage] }
                    : s
            ));

            let accumulatedText = '';
            let accumulatedJson = '';
            let isCollectingJson = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });

                if (chunk.includes('__PROVENANCE_START__')) {
                    const [text, json] = chunk.split('__PROVENANCE_START__');
                    accumulatedText += text;
                    isCollectingJson = true;
                    if (json) accumulatedJson += json;
                } else if (isCollectingJson) {
                    accumulatedJson += chunk;
                } else {
                    accumulatedText += chunk;
                    // Update UI in real-time
                    setSessions(prev => prev.map(s => {
                        if (s.id !== currentSessionId) return s;
                        const updatedMessages = [...s.messages];
                        const lastIdx = updatedMessages.length - 1;
                        updatedMessages[lastIdx] = {
                            ...updatedMessages[lastIdx],
                            content: accumulatedText
                        };
                        return { ...s, messages: updatedMessages };
                    }));
                }
            }

            // Parse citations
            if (accumulatedJson) {
                try {
                    const cleanJson = accumulatedJson.replace('__PROVENANCE_END__', '');
                    const data = JSON.parse(cleanJson);
                    setSessions(prev => prev.map(s => {
                        if (s.id !== currentSessionId) return s;
                        const updatedMessages = [...s.messages];
                        const lastIdx = updatedMessages.length - 1;
                        updatedMessages[lastIdx] = {
                            ...updatedMessages[lastIdx],
                            content: accumulatedText,
                            citations: data.provenance as Citation[]
                        };
                        return { ...s, messages: updatedMessages };
                    }));
                } catch (e) {
                    console.error('Citation parse error:', e);
                }
            }
        } catch (error) {
            console.error('Stream error:', error);
            const errorMessage: Message = {
                id: generateId(),
                role: 'assistant',
                content: '**Error:** Could not connect to NEXUS. Please ensure the backend is running.',
                timestamp: new Date(),
            };
            setSessions(prev => prev.map(s =>
                s.id === currentSessionId
                    ? { ...s, messages: [...s.messages, errorMessage] }
                    : s
            ));
        } finally {
            setIsLoading(false);
        }
    }, [team, isLoading, currentSessionId]);

    // Create initial session if none exists
    useEffect(() => {
        if (sessions.length === 0 && !currentSessionId) {
            createNewChat();
        }
    }, [sessions.length, currentSessionId, createNewChat]);

    return {
        currentSession,
        messages,
        isLoading,
        sendMessage,
        createNewChat,
        selectChat,
        deleteChat,
        renameChat,
        sessions
    };
}
