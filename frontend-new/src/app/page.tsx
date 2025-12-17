"use client";

// IMPORTS

// ADDED IMPORTS
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { SidebarContent } from '@/components/Sidebar';

// Re-importing to ensure scope
import { useState, useRef, useEffect, FormEvent, memo, lazy, Suspense } from 'react';
import { useSession } from 'next-auth/react';
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
  Loader2,
  CheckCircle,
  AlertCircle,
  Building2,
  Shield,
  Search, // Added Search icon if needed
} from 'lucide-react';
import dynamic from 'next/dynamic';
import remarkGfm from 'remark-gfm';
import { useChatManager } from '@/hooks/useChatManager';
import { usePresence } from '@/hooks/usePresence';
import { UserMenu } from '@/components/UserMenu';
import { OnlineUsersCount } from '@/components/ui/PresenceIndicator';
import { cn } from '@/lib/utils';
import type { Message, Citation } from '@/types';
import { APP_NAME, SAMPLE_QUESTIONS, API_BASE_URL } from '@/lib/constants';
import { MessageSkeleton } from '@/components/Skeleton';

// ... (Lazy load remains same)
const ReactMarkdown = dynamic(() => import('react-markdown'), {
  loading: () => <div className="animate-pulse h-4 bg-white/5 rounded w-3/4" />,
  ssr: false,
});

interface Team {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export default function Home() {
  const { data: session, status } = useSession();
  const isMobile = useMediaQuery("(max-width: 1024px)"); // lg breakpoint

  // Sidebar state
  // On desktop: default true. On mobile: default false.
  // Using effect to sync initial state once, or just simple state
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);

  // Sync state when screen size changes drastically? 
  // Better to let user control, but maybe reset on mode switch
  useEffect(() => {
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  const [input, setInput] = useState('');
  const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  const sessionTeams: Team[] = session?.user?.teams ?? [];
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const selectedTeam = sessionTeams.find(t => t.id === selectedTeamId) || sessionTeams[0];

  useEffect(() => {
    if (sessionTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(sessionTeams[0].id);
    }
  }, [sessionTeams, selectedTeamId]);

  const userContext = session?.user ? {
    userId: session.user.id,
    email: session.user.email ?? undefined,
    teamId: selectedTeam?.id,
  } : undefined;

  const { onlineUsers } = usePresence(selectedTeam?.id ?? null);

  const {
    currentSession,
    messages,
    isLoading: isChatLoading,
    sendMessage,
    createNewChat,
    selectChat,
    deleteChat,
    sessions
  } = useChatManager(selectedTeam?.slug || 'default', userContext);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatLoading]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isChatLoading) return;
    sendMessage(input);
    setInput('');
  };

  const handleNewChat = () => { createNewChat(); };
  const handleTeamSelect = (team: Team) => {
    setSelectedTeamId(team.id);
    createNewChat();
  };
  const handleSuggestionClick = (question: string) => { setInput(question); };

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Use lowercase slug for simplicity if needed, but backend handles it
        body: JSON.stringify({ name: newTeamName }),
      });
      if (res.ok) {
        setNewTeamName('');
        setIsAddTeamModalOpen(false);
        // Refresh to update session/sidebar
        window.location.reload();
      } else {
        console.error("Failed to create team");
      }
    } catch (error) {
      console.error("Error creating team:", error);
    }
  };

  const handleDeleteHistory = async (sessionId: string) => { await deleteChat(sessionId); };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    setIsUploading(true);
    setUploadStatus(null);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('team', selectedTeam.id);
        formData.append('chunking_strategy', 'window');
        const response = await fetch(`${API_BASE_URL}/ingest/`, { method: 'POST', body: formData });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || `Failed to upload ${file.name}`);
        }
      }
      setUploadStatus({ type: 'success', message: `Successfully ingested ${files.length} file(s) to ${selectedTeam.name}` });
      setSelectedFiles([]);
    } catch (error) {
      setUploadStatus({ type: 'error', message: error instanceof Error ? error.message : 'Upload failed' });
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveFile = (idx: number) => { setSelectedFiles(selectedFiles.filter((_, i) => i !== idx)); };

  // Shared props for Sidebar
  const sidebarProps = {
    isSidebarOpen,
    setIsSidebarOpen,
    handleNewChat,
    onlineUsers,
    setIsAddTeamModalOpen,
    sessionTeams,
    selectedTeam,
    handleTeamSelect,
    sessions,
    currentSession,
    selectChat,
    handleDeleteHistory,
    session,
  };

  return (
    <div className="flex h-full w-full relative overflow-hidden bg-void">
      {/* --- DESKTOP SIDEBAR --- */}
      {!isMobile && (
        <motion.aside
          initial={{ width: 260, opacity: 1 }}
          animate={{
            width: isSidebarOpen ? 260 : 0,
            opacity: isSidebarOpen ? 1 : 0,
          }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="h-full border-r border-white-5 relative z-20 shrink-0 hidden lg:block"
        >
          <SidebarContent {...sidebarProps} isMobile={false} />
        </motion.aside>
      )}

      {/* --- MOBILE SIDEBAR (DRAWER/SHEET) --- */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[85%] max-w-xs bg-surface z-50 border-r border-white-10 lg:hidden shadow-2xl"
            >
              <SidebarContent {...sidebarProps} isMobile={true} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col h-full relative min-w-0">
        {/* Header (Mobile & Desktop) */}
        <div className="absolute top-0 left-0 w-full z-30 p-4 flex items-center justify-between pointer-events-none">
          {/* Header Content */}
          <div className="pointer-events-auto flex items-center gap-3">
            {/* Mobile Menu Trigger or Desktop Toggle */}
            {isMobile ? (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 bg-surface/50 backdrop-blur-md border border-white-10 rounded-lg text-txt-primary shadow-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
            ) : (
              !isSidebarOpen && (
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 bg-surface/50 backdrop-blur-md border border-white-10 rounded-lg text-txt-secondary hover:text-white transition-colors cursor-pointer"
                >
                  <Menu className="w-5 h-5" />
                </motion.button>
              )
            )}

            {(!isSidebarOpen || isMobile) && (
              <span className="text-lg font-bold animated-gradient-text">NEXUS</span>
            )}
          </div>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto scroll-smooth pt-16"> {/* added padding-top for header */}
          <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 py-6 px-4 md:px-0 pb-32"> {/* increased pb for input bar */}
            {/* Empty State */}
            {messages.length === 0 && selectedTeam && (
              <EmptyState
                team={selectedTeam}
                onSuggestionClick={handleSuggestionClick}
              />
            )}
            {messages.length === 0 && !selectedTeam && (
              <div className="flex flex-col items-center justify-center h-[55vh] text-center space-y-4">
                <h1 className="text-3xl font-bold text-txt-primary">Welcome</h1>
              </div>
            )}

            {/* Message List */}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {isChatLoading && messages[messages.length - 1]?.role === 'user' && (
              <ThinkingIndicator />
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* --- INPUT BAR --- */}
        <div className="absolute bottom-0 w-full z-20 pointer-events-none pb-[env(safe-area-inset-bottom)]">
          {/* Gradient fade */}
          <div className="absolute bottom-0 inset-x-0 h-48 bg-linear-to-t from-void via-void/90 to-transparent -z-10" />

          <div className="w-full max-w-3xl mx-auto px-2 pb-4 pt-4 pointer-events-auto">
            <form
              onSubmit={handleSubmit}
              className="input-bar rounded-3xl flex items-end p-2 md:p-1.5 gap-2 backdrop-blur-xl bg-surface/80 border border-white-10 shadow-2xl"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.txt,.csv,.md,.pptx,.xlsx"
              />

              {/* Mobile: Compact actions */}
              <div className="flex flex-row md:flex-row gap-1 md:gap-0 shrink-0 pb-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 md:p-2 text-txt-tertiary hover:text-txt-primary hover:bg-white/5 rounded-full transition-colors"
                >
                  <Plus className="w-6 h-6 md:w-5 md:h-5" />
                </button>
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && !isChatLoading) handleSubmit(e);
                  }
                }}
                placeholder="Message NEXUS..."
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
                className="flex-1 bg-transparent text-txt-primary placeholder:text-txt-tertiary focus:outline-none py-2.5 px-2 text-base resize-none overflow-hidden"
                disabled={isChatLoading}
              />

              <button
                type="submit"
                disabled={isChatLoading || !input.trim()}
                className={cn(
                  "p-3 md:p-2.5 rounded-full mb-0.5 transition-all shrink-0",
                  input.trim()
                    ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20"
                    : "bg-white-5 text-txt-tertiary"
                )}
              >
                <Send className="w-5 h-5 md:w-4 md:h-4" />
              </button>
            </form>

            {/* Selected Files & Status */}
            <div className="mt-2 min-h-[20px]">
              {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 px-1">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-surface border border-white-10 px-2 py-1 rounded-md text-xs text-txt-secondary">
                      <span className="truncate max-w-[100px]">{file.name}</span>
                      <button onClick={() => handleRemoveFile(idx)}><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* --- ADD TEAM MODAL (Same as before) --- */}
      <AnimatePresence>
        {isAddTeamModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setIsAddTeamModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-elevated border border-white-10 rounded-xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h2 className="text-lg font-semibold text-txt-primary mb-4">Add Team</h2>
              <input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Team Name"
                className="w-full bg-void border border-white-10 rounded-lg px-4 py-3 text-txt-primary mb-4 focus:border-brand-primary outline-none"
              />
              <div className="flex gap-2">
                <button onClick={() => setIsAddTeamModalOpen(false)} className="flex-1 py-2 rounded-lg hover:bg-white-5">Cancel</button>
                <button onClick={handleAddTeam} className="flex-1 py-2 rounded-lg bg-brand-primary text-white">Add</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ... Keep MessageBubble, EmptyState, ThinkingIndicator as they were (or slightly updated for mobile)
// I will copy them back in.
function EmptyState({ team, onSuggestionClick }: { team: Team; onSuggestionClick: (q: string) => void; }) {
  const questions = SAMPLE_QUESTIONS[team.slug] || SAMPLE_QUESTIONS[team.id] || [];
  return (
    <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-6 relative px-4">
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight animated-gradient-text relative z-10">
        How can I help?
      </h1>
      <p className="text-txt-secondary text-base md:text-lg relative z-10">
        Ask about <span className="animated-gradient-text font-medium">{team.name}</span>
      </p>
      <div className="flex flex-wrap justify-center gap-2 md:gap-3 max-w-2xl relative z-20">
        {questions.map((q, idx) => (
          <button key={idx} onClick={() => onSuggestionClick(q)} className="suggestion-chip text-left md:text-center text-sm">
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  return (
    <div className={cn("flex w-full gap-2 md:gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-glass border border-white-5 items-center justify-center shrink-0 mt-0.5 backdrop-blur-sm hidden md:flex">
          <Bot className="w-4 h-4 text-brand-primary" />
        </div>
      )}
      <div className={cn("flex flex-col gap-1 max-w-[90%] md:max-w-[70%]", isUser ? "items-end" : "items-start")}>
        <div className={cn(
          "p-3 md:p-4 rounded-2xl text-sm md:text-base wrap-break-word",
          isUser ? "bg-brand-primary/10 text-txt-primary rounded-tr-sm" : "assistant-bubble rounded-tl-sm"
        )}>
          {isUser ? (
            message.content
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {/* Simple debug view trigger for now, keeping it minimal */}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-3 w-full items-start">
      <div className="w-8 h-8 rounded-full hidden md:flex bg-glass border border-white-5 items-center justify-center">
        <Bot className="w-4 h-4 text-brand-primary animate-pulse" />
      </div>
      <div className="flex items-center gap-1.5 h-8 px-2">
        <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
        <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
        <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
      </div>
    </div>
  );
}
