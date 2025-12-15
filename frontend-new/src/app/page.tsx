'use client';

import { useState, useRef, useEffect, FormEvent, memo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  Plus,
  Send,
  Mic,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Hash,
  Bot,
  Trash2,
  X,
  Paperclip,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import remarkGfm from 'remark-gfm';
import { useChatStream } from '@/hooks/useChatStream';
import { cn } from '@/lib/utils';
import type { Message, Citation } from '@/types';
import { APP_NAME, TEAMS as DEFAULT_TEAMS, SAMPLE_QUESTIONS, Team } from '@/lib/constants';
import { MessageSkeleton } from '@/components/Skeleton';

// Lazy load ReactMarkdown (heavy dependency ~50KB)
const ReactMarkdown = dynamic(() => import('react-markdown'), {
  loading: () => <div className="animate-pulse h-4 bg-white/5 rounded w-3/4" />,
  ssr: false,
});

/**
 * Main chat interface component - NEXUS Team-Based RAG
 */
export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [teams, setTeams] = useState<Team[]>(DEFAULT_TEAMS);
  const [selectedTeam, setSelectedTeam] = useState<Team>(DEFAULT_TEAMS[0]);
  const [input, setInput] = useState('');
  const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [chatHistory, setChatHistory] = useState<string[]>([
    'New Chat',
    'hi',
    'how much is our profit?',
    'how much is our profit',
    'what is our revenue',
  ]);
  const { messages, sendMessage, isLoading, clearMessages } = useChatStream(selectedTeam.id);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  const handleNewChat = () => {
    clearMessages();
  };

  const handleTeamSelect = (team: Team) => {
    setSelectedTeam(team);
    clearMessages();
  };

  const handleSuggestionClick = (question: string) => {
    setInput(question);
  };

  const handleAddTeam = () => {
    if (!newTeamName.trim()) return;
    const newTeam: Team = {
      id: newTeamName.toLowerCase().replace(/\s+/g, '-'),
      name: newTeamName.trim(),
    };
    setTeams([...teams, newTeam]);
    setNewTeamName('');
    setIsAddTeamModalOpen(false);
  };

  const handleDeleteTeam = (teamId: string) => {
    if (teams.length <= 1) return; // Keep at least one team
    const filtered = teams.filter((t) => t.id !== teamId);
    setTeams(filtered);
    if (selectedTeam.id === teamId) {
      setSelectedTeam(filtered[0]);
      clearMessages();
    }
  };

  const handleDeleteHistory = (idx: number) => {
    setChatHistory(chatHistory.filter((_, i) => i !== idx));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles([...selectedFiles, ...Array.from(e.target.files)]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleRemoveFile = (idx: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex h-full w-full relative">
      {/* --- LEFT SIDEBAR --- */}
      <motion.aside
        initial={{ width: 260, opacity: 1 }}
        animate={{
          width: isSidebarOpen ? 260 : 0,
          opacity: isSidebarOpen ? 1 : 0,
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="h-full bg-surface border-r border-white-5 flex flex-col overflow-hidden relative z-20 shrink-0"
        aria-label="Sidebar navigation"
      >
        {/* Sidebar Header with Collapse Button */}
        <div className="p-4 flex items-center justify-between border-b border-white-5">
          <span className="text-sm font-semibold text-txt-primary">NEXUS</span>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-txt-tertiary hover:text-txt-secondary cursor-pointer"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 bg-linear-to-r from-brand-primary to-purple-600 hover:from-brand-secondary hover:to-brand-primary text-white font-semibold rounded-lg px-4 py-2.5 transition-all shadow-lg shadow-brand-primary/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* WORKSPACE Section */}
        <div className="px-3">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider">
              Workspace
            </span>
            <button
              type="button"
              onClick={() => setIsAddTeamModalOpen(true)}
              className="p-1 hover:bg-white/10 rounded transition-colors text-txt-tertiary hover:text-brand-primary cursor-pointer"
              aria-label="Add team"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1 mt-1">
            {teams.map((team) => (
              <div
                key={team.id}
                className={cn(
                  'group flex items-center gap-2 text-sm transition-all rounded-lg',
                  selectedTeam.id === team.id
                    ? 'sidebar-item-active'
                    : 'text-txt-secondary hover:bg-white/5'
                )}
              >
                <button
                  type="button"
                  onClick={() => handleTeamSelect(team)}
                  className="flex-1 flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer"
                >
                  <Hash className="w-4 h-4" />
                  {team.name}
                </button>
                {teams.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTeam(team.id)}
                    className="p-1.5 mr-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 rounded transition-all cursor-pointer"
                    aria-label="Delete team"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* HISTORY Section */}
        <div className="px-3 mt-6 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider">
              History
            </span>
          </div>
          <div className="space-y-0.5 mt-1">
            {chatHistory.map((item, idx) => (
              <div
                key={idx}
                className="group flex items-center text-sm text-txt-secondary hover:bg-white/5 hover:text-txt-primary transition-all rounded-lg"
              >
                <button
                  type="button"
                  className="flex-1 flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-txt-tertiary shrink-0" />
                  <span className="truncate">{item}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteHistory(idx)}
                  className="p-1.5 mr-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 rounded transition-all cursor-pointer"
                  aria-label="Delete history item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Systems Operational Status */}
        <div className="p-4 border-t border-white-5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-status-green shadow-lg shadow-status-green/50 animate-pulse" />
            <span className="text-xs text-txt-tertiary">Systems Operational</span>
          </div>
        </div>
      </motion.aside>

      {/* --- MAIN CHAT AREA --- */}
      <main className="flex-1 flex flex-col h-full relative" role="main">
        {/* Toggle Sidebar Button (When Closed) */}
        <AnimatePresence>
          {!isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute top-4 left-4 z-30 flex items-center gap-3"
            >
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 bg-glass backdrop-blur-md border border-white-5 rounded-lg hover:bg-white/10 transition-colors text-txt-secondary cursor-pointer"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
              <span className="text-lg font-bold animated-gradient-text">NEXUS</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 py-12 px-4 md:px-0">
            {/* Empty State */}
            {messages.length === 0 && (
              <EmptyState
                team={selectedTeam}
                onSuggestionClick={handleSuggestionClick}
              />
            )}

            {/* Message List */}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Thinking Indicator */}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <ThinkingIndicator />
            )}

            <div ref={messagesEndRef} className="h-36" />
          </div>
        </div>

        {/* --- FLOATING INPUT BAR --- */}
        <div className="absolute bottom-0 w-full flex justify-center pb-6 pt-24 bg-linear-to-t from-void via-void/80 to-transparent z-10 pointer-events-none">
          <div className="w-full max-w-3xl px-4 pointer-events-auto">
            <form
              onSubmit={handleSubmit}
              className="input-bar rounded-full flex items-center p-1.5"
            >
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.txt,.csv,.md,.pptx,.xlsx"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-txt-tertiary hover:text-txt-primary hover:bg-white/5 rounded-full transition-colors ml-1 cursor-pointer"
                aria-label="Attach file"
              >
                <Plus className="w-5 h-5" />
              </button>

              <button
                type="button"
                className="p-2.5 text-txt-tertiary hover:text-txt-primary hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                aria-label="Voice input"
              >
                <Mic className="w-5 h-5" />
              </button>

              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 bg-transparent text-txt-primary placeholder:text-txt-tertiary focus:outline-none py-3 px-3 text-sm"
                disabled={isLoading}
              />

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="send-button p-2.5 text-white rounded-full mr-1 cursor-pointer"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* Selected Files Display */}
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 px-2">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-glass px-3 py-1.5 rounded-full text-xs text-txt-secondary border border-white-5"
                  >
                    <Paperclip className="w-3 h-3" />
                    <span className="max-w-[120px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="text-center text-[11px] text-txt-tertiary mt-3 font-medium">
              AI-generated content may be inaccurate
            </div>
          </div>
        </div>
      </main>

      {/* --- ADD TEAM MODAL --- */}
      <AnimatePresence>
        {isAddTeamModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setIsAddTeamModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-elevated border border-white-10 rounded-xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-txt-primary">Add New Team</h2>
                <button
                  type="button"
                  onClick={() => setIsAddTeamModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors text-txt-tertiary hover:text-txt-primary cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Enter team name..."
                className="w-full bg-void border border-white-10 rounded-lg px-4 py-3 text-txt-primary placeholder:text-txt-tertiary focus:outline-none focus:border-brand-primary transition-colors"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()}
              />

              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsAddTeamModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-white-10 rounded-lg text-txt-secondary hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddTeam}
                  disabled={!newTeamName.trim()}
                  className="flex-1 px-4 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Add Team
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Empty state with gradient heading and glassmorphism suggestion chips
 */
function EmptyState({
  team,
  onSuggestionClick,
}: {
  team: Team;
  onSuggestionClick: (q: string) => void;
}) {
  const questions = SAMPLE_QUESTIONS[team.id] || [];

  return (
    <div className="flex flex-col items-center justify-center h-[55vh] text-center space-y-8 relative">
      {/* Gradient Heading with Animation */}
      <h1 className="text-5xl md:text-6xl font-bold tracking-tight animated-gradient-text relative z-10">
        How can I help?
      </h1>

      {/* Dynamic Subtitle */}
      <p className="text-txt-secondary text-lg relative z-10">
        Ask questions regarding the{' '}
        <span className="animated-gradient-text font-medium">{team.name}</span>{' '}
        knowledge base.
      </p>

      {/* Suggestion Chips - Glassmorphism */}
      <div className="flex flex-wrap justify-center gap-3 max-w-2xl relative z-20">
        {questions.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSuggestionClick(q)}
            className="suggestion-chip"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Message bubble component with frosted glass for AI responses
 */
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1 w-full">
      {/* User Message */}
      {isUser && (
        <div className="flex justify-end items-start gap-3">
          <div className="max-w-[80%] text-right">
            <span className="text-sm text-txt-primary">{message.content}</span>
            <span className="text-xs text-txt-tertiary ml-3">you</span>
          </div>
        </div>
      )}

      {/* Assistant Message - Frosted Glass */}
      {!isUser && (
        <div className="flex items-start gap-3">
          {/* Bot Icon */}
          <div className="w-8 h-8 rounded-full bg-glass border border-white-5 flex items-center justify-center shrink-0 mt-0.5 backdrop-blur-sm">
            <Bot className="w-4 h-4 text-brand-primary" />
          </div>

          {/* Message Content */}
          <div className="flex-1 max-w-[90%]">
            <div className="assistant-bubble p-4">
              <div className="prose prose-invert prose-sm prose-p:text-txt-primary prose-headings:text-white prose-strong:text-brand-secondary prose-a:text-brand-primary hover:prose-a:underline prose-pre:bg-void/50 prose-pre:border prose-pre:border-white-5 prose-code:text-brand-secondary prose-code:bg-brand-subtle prose-code:px-1 prose-code:rounded max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>

            {/* Debug Panel */}
            {message.citations && message.citations.length > 0 && (
              <div className="mt-3 debug-panel rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsDebugOpen(!isDebugOpen)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-txt-secondary hover:text-txt-primary transition-colors cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  View Debug Info
                  {isDebugOpen ? (
                    <ChevronUp className="w-4 h-4 ml-auto" />
                  ) : (
                    <ChevronDown className="w-4 h-4 ml-auto" />
                  )}
                </button>

                <AnimatePresence>
                  {isDebugOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4">
                        <pre className="text-xs text-txt-secondary bg-void/50 p-3 rounded-lg overflow-x-auto">
                          <code>
                            {JSON.stringify(
                              {
                                name: message.content.substring(0, 30) + '...',
                                provenance: message.citations,
                              },
                              null,
                              2
                            )}
                          </code>
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Thinking/loading indicator
 */
function ThinkingIndicator() {
  return (
    <div className="flex gap-3 w-full items-start">
      <div className="w-8 h-8 rounded-full bg-glass border border-white-5 flex items-center justify-center shrink-0 backdrop-blur-sm">
        <Bot className="w-4 h-4 text-brand-primary animate-pulse" />
      </div>
      <div className="flex items-center gap-1.5 h-8 px-2">
        <div
          className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce"
          style={{ animationDelay: '0.15s' }}
        />
        <div
          className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce"
          style={{ animationDelay: '0.3s' }}
        />
      </div>
    </div>
  );
}
