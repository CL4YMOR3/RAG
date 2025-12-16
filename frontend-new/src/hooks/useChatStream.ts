'use client';

import { useState, useCallback } from 'react';
import type { Message, Citation } from '@/types';
import { streamQuery } from '@/lib/api/chat';
import { generateId } from '@/lib/utils';
import { DEFAULT_TEAM } from '@/lib/constants';

interface UseChatStreamReturn {
    messages: Message[];
    isLoading: boolean;
    sendMessage: (query: string) => Promise<void>;
    clearMessages: () => void;
}

/**
 * Custom hook for managing chat with streaming responses.
 * Handles the streaming protocol from the backend including provenance markers.
 */
export function useChatStream(team = DEFAULT_TEAM): UseChatStreamReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    // Generate unique session ID per browser session (persists for tab lifetime)
    const [sessionId] = useState(() => `session-${crypto.randomUUID()}`);

    const sendMessage = useCallback(
        async (query: string) => {
            if (!query.trim() || isLoading) return;

            // Add user message immediately for responsive UI
            const userMessage: Message = {
                id: generateId(),
                role: 'user',
                content: query,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, userMessage]);
            setIsLoading(true);

            try {
                const response = await streamQuery({
                    query,
                    team,
                    sessionId,
                });

                if (!response.body) {
                    throw new Error('No response body');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                // Add assistant message placeholder
                const assistantId = generateId();
                setMessages((prev) => [
                    ...prev,
                    {
                        id: assistantId,
                        role: 'assistant',
                        content: '',
                        timestamp: new Date(),
                    },
                ]);

                let accumulatedText = '';
                let accumulatedJson = '';
                let isCollectingJson = false;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });

                    // Handle the split between text stream and JSON provenance
                    if (chunk.includes('__PROVENANCE_START__')) {
                        const [text, json] = chunk.split('__PROVENANCE_START__');
                        accumulatedText += text;
                        isCollectingJson = true;
                        if (json) accumulatedJson += json;
                    } else if (isCollectingJson) {
                        accumulatedJson += chunk;
                    } else {
                        accumulatedText += chunk;
                        // Update UI in real-time with streamed text
                        setMessages((prev) => {
                            const updated = [...prev];
                            const lastIdx = updated.length - 1;
                            updated[lastIdx] = { ...updated[lastIdx], content: accumulatedText };
                            return updated;
                        });
                    }
                }

                // Parse and attach citations from the JSON provenance data
                if (accumulatedJson) {
                    try {
                        const cleanJson = accumulatedJson.replace('__PROVENANCE_END__', '');
                        const data = JSON.parse(cleanJson);
                        setMessages((prev) => {
                            const updated = [...prev];
                            const lastIdx = updated.length - 1;
                            updated[lastIdx] = {
                                ...updated[lastIdx],
                                content: accumulatedText,
                                citations: data.provenance as Citation[],
                            };
                            return updated;
                        });
                    } catch (e) {
                        console.error('Citation parse error:', e);
                    }
                }
            } catch (error) {
                console.error('Stream error:', error);
                setMessages((prev) => [
                    ...prev,
                    {
                        id: generateId(),
                        role: 'assistant',
                        content: '**Error:** Could not connect to the Engineering Brain. Please ensure the backend is running.',
                        timestamp: new Date(),
                    },
                ]);
            } finally {
                setIsLoading(false);
            }
        },
        [team, isLoading]
    );

    const clearMessages = useCallback(() => setMessages([]), []);

    return { messages, isLoading, sendMessage, clearMessages };
}
