import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { streamQueryRAG, ingestFile } from "./api";
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from "framer-motion";
import {
  HashIcon,
  ClockIcon,
  InfoIcon,
  BotIcon,
  PlusIcon,
  MicIcon,
  ChevronDownIcon,
  ArrowRightIcon,
  Trash2Icon
} from "lucide-react";

import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- Memoized Markdown Components (prevents re-creation on each render) ---
const markdownComponents = {
  p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
  code: ({ node, inline, children, ...props }) => (
    inline
      ? <code className="bg-white/10 rounded px-1.5 py-0.5 text-sm font-mono text-purple-200" {...props}>{children}</code>
      : <code className="block bg-[#0f0f11] rounded-lg p-3 text-sm font-mono text-gray-300 overflow-x-auto border border-white/5 my-2" {...props}>{children}</code>
  )
};

// --- Memoized Message Bubble Component ---
const MessageBubble = memo(({ sender, text }) => {
  const [showDebug, setShowDebug] = useState(false);

  // Memoize expensive regex operation
  const { isError, cleanText } = useMemo(() => {
    const isErr = text.startsWith("Error:") || text.includes("[Error: Failed to fetch]");
    const clean = text.replace(/__PROVENANCE_START__[\s\S]*?__PROVENANCE_END__/g, "").trim();
    return { isError: isErr, cleanText: clean };
  }, [text]);

  const toggleDebug = useCallback(() => setShowDebug(prev => !prev), []);

  if (isError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto w-full mb-6"
      >
        <div className="bg-[#1f1f23] border border-white/5 rounded-xl overflow-hidden mt-4">
          <button
            onClick={toggleDebug}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <div className="size-6 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 text-purple-400">
              <InfoIcon className="size-4" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-gray-200">View Debug Info</div>
            </div>
            <ChevronDownIcon className={`size-4 text-gray-500 transition-transform ${showDebug ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showDebug && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-[#18181b] font-mono text-xs text-green-400 overflow-x-auto border-t border-white/5">
                  {text}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-4 py-4 w-full max-w-3xl mx-auto",
        sender === "user" ? "justify-end" : "justify-start"
      )}
    >
      {/* AI Icon */}
      {sender === "ai" && (
        <div className="size-8 flex items-start justify-center shrink-0 mt-1">
          <BotIcon className="size-6 text-white" strokeWidth={1.5} />
        </div>
      )}

      {/* Content */}
      <div className={cn(
        "flex max-w-[85%] items-baseline gap-3",
        sender === "user" ? "flex-row-reverse" : "flex-row"
      )}>
        <div className={cn(
          "text-[16px] leading-relaxed",
          sender === "user" ? "text-right text-[#d4d4d8] font-normal" : "text-white text-left"
        )}>
          <ReactMarkdown components={markdownComponents}>
            {cleanText}
          </ReactMarkdown>
        </div>

        {/* User Label */}
        {sender === "user" && (
          <span className="text-xs text-[#52525b] font-medium self-center">you</span>
        )}
      </div>
    </motion.div>
  );
});

MessageBubble.displayName = 'MessageBubble';

// --- RAG Layout Component ---
const RAGLayout = () => {
  const { state } = useSidebar();

  const [teams, setTeams] = useState(() => {
    const saved = localStorage.getItem("rag_teams");
    return saved ? JSON.parse(saved) : ["Finance", "Hr", "Engineering", "Admin", "Marketing"];
  });
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem("rag_chat_history");
    return saved ? JSON.parse(saved) : [];
  });

  const [activeChatId, setActiveChatId] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState("Finance");
  const [queryInput, setQueryInput] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const chatContainerRef = useRef(null);
  const scrollViewportRef = useRef(null);
  const fileInputRef = useRef(null);
  const isAutoScrollingRef = useRef(true);
  const lastScrollTimeRef = useRef(0);

  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  // Memoize activeChat lookup
  const activeChat = useMemo(
    () => chatHistory.find(c => c.id === activeChatId),
    [chatHistory, activeChatId]
  );

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem("rag_teams", JSON.stringify(teams));
  }, [teams]);

  useEffect(() => {
    localStorage.setItem("rag_chat_history", JSON.stringify(chatHistory));
  }, [chatHistory]);

  // Improved auto-scroll with smooth behavior and throttling
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (scrollViewportRef.current && isAutoScrollingRef.current) {
      const now = Date.now();
      // Throttle scroll calls to max once per 100ms
      if (now - lastScrollTimeRef.current < 100) return;
      lastScrollTimeRef.current = now;

      requestAnimationFrame(() => {
        if (scrollViewportRef.current) {
          scrollViewportRef.current.scrollTo({
            top: scrollViewportRef.current.scrollHeight,
            behavior
          });
        }
      });
    }
  }, []);

  // Handle user scroll to detect if they scrolled up
  const handleScroll = useCallback((e) => {
    const el = e.target;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    isAutoScrollingRef.current = isAtBottom;
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom('instant');
    isAutoScrollingRef.current = true;
  }, [activeChatId, scrollToBottom]);

  // Auto-scroll during streaming (when last message changes)
  const lastMessage = activeChat?.messages?.[activeChat.messages.length - 1];
  useEffect(() => {
    if (lastMessage?.sender === 'ai' && isQuerying) {
      scrollToBottom('smooth');
    }
  }, [lastMessage?.text, lastMessage?.sender, isQuerying, scrollToBottom]);

  // Memoized handlers to prevent child re-renders
  const selectTeam = useCallback((team) => {
    setSelectedTeam(team);
    setActiveChatId(null);
  }, []);

  const selectChat = useCallback((chatId) => {
    setChatHistory(prev => {
      const chat = prev.find(c => c.id === chatId);
      if (chat) {
        setSelectedTeam(chat.team);
        setActiveChatId(chatId);
      }
      return prev;
    });
  }, []);

  const createNewChatInCurrentTeam = useCallback(() => {
    setActiveChatId(null);
  }, []);

  const handleAddTeam = useCallback(() => {
    if (!newTeamName.trim()) return;
    const name = newTeamName.trim();
    setTeams(prev => {
      if (prev.includes(name)) return prev;
      return [...prev, name];
    });
    setSelectedTeam(name);
    setActiveChatId(null);
    setNewTeamName("");
    setIsAddTeamOpen(false);
  }, [newTeamName]);

  const deleteChat = useCallback((chatId) => {
    setChatHistory(prev => prev.filter(c => c.id !== chatId));
    setActiveChatId(prev => prev === chatId ? null : prev);
  }, []);

  const handleInputChange = useCallback((e) => {
    setQueryInput(e.target.value);
  }, []);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTeam) return;

    let currentChatId = activeChatId;
    if (!currentChatId) {
      // Create chat if doesn't exist to show the upload status
      const newChatId = uuidv4();
      const newChat = {
        id: newChatId,
        title: "File Upload",
        team: selectedTeam,
        messages: [],
        createdAt: new Date().toISOString()
      };
      setChatHistory(prev => [newChat, ...prev]);
      setActiveChatId(newChatId);
      currentChatId = newChatId;
    }

    setIsUploading(true);

    // Add system message about upload start
    setChatHistory(prev => prev.map(c =>
      c.id === currentChatId
        ? { ...c, messages: [...c.messages, { sender: 'ai', text: `*Uploading ${file.name}...*` }] }
        : c
    ));

    try {
      await ingestFile(file, selectedTeam);

      // Update message to success
      setChatHistory(prev => prev.map(c => {
        if (c.id === currentChatId) {
          const msgs = [...c.messages];
          msgs[msgs.length - 1] = { sender: 'ai', text: `✅ Successfully uploaded and ingested **${file.name}** into **${selectedTeam}** knowledge base.` };
          return { ...c, messages: msgs };
        }
        return c;
      }));

    } catch (err) {
      console.error(err);
      // Update message to error
      setChatHistory(prev => prev.map(c => {
        if (c.id === currentChatId) {
          const msgs = [...c.messages];
          msgs[msgs.length - 1] = { sender: 'ai', text: `❌ Error uploading **${file.name}**: ${err.message}` };
          return { ...c, messages: msgs };
        }
        return c;
      }));
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [selectedTeam, activeChatId]);

  const handleQuery = useCallback(async (e) => {
    e.preventDefault();
    if (!queryInput.trim() || !selectedTeam) return;

    let currentChatId = activeChatId;
    const q = queryInput;
    setQueryInput("");

    if (!currentChatId) {
      const newChatId = uuidv4();
      const newChat = {
        id: newChatId,
        title: q.substring(0, 30),
        team: selectedTeam,
        messages: [],
        createdAt: new Date().toISOString()
      };
      setChatHistory(prev => [newChat, ...prev]);
      setActiveChatId(newChatId);
      currentChatId = newChatId;
    }

    setIsQuerying(true);

    // Add user message
    setChatHistory(prev => prev.map(c =>
      c.id === currentChatId
        ? { ...c, messages: [...c.messages, { sender: 'user', text: q }] }
        : c
    ));

    // Add AI placeholder
    setChatHistory(prev => prev.map(c =>
      c.id === currentChatId
        ? { ...c, messages: [...c.messages, { sender: 'ai', text: '' }] }
        : c
    ));

    try {
      const stream = streamQueryRAG(q, selectedTeam, currentChatId);

      // Use a ref-like approach to avoid closure issues
      const updateMessage = (newText) => {
        setChatHistory(prev => prev.map(c => {
          if (c.id === currentChatId) {
            const msgs = [...c.messages];
            msgs[msgs.length - 1] = { sender: 'ai', text: newText };
            return { ...c, messages: msgs };
          }
          return c;
        }));
      };

      let fullText = "";
      for await (const chunk of stream) {
        fullText += chunk;
        updateMessage(fullText);
        // Auto-scroll during streaming
        scrollToBottom('smooth');
      }
    } catch (err) {
      setChatHistory(prev => prev.map(c => {
        if (c.id === currentChatId) {
          const msgs = [...c.messages];
          msgs[msgs.length - 1] = { sender: 'ai', text: `Error: ${err.message}` };
          return { ...c, messages: msgs };
        }
        return c;
      }));
    } finally {
      setIsQuerying(false);
    }
  }, [queryInput, selectedTeam, activeChatId, scrollToBottom]);

  // Memoize suggestion prompts
  const suggestionPrompts = useMemo(() => [
    "how much is our profit?",
    "Who is responsible for the servers?",
    "what is our revenue?"
  ], []);

  return (
    <div className="flex w-full h-screen overflow-hidden bg-[#0d0118] text-gray-200 font-sans selection:bg-purple-500/30">

      <Sidebar variant="sidebar" collapsible="icon" className="border-r border-white/5 bg-[#121214]">

        {/* Sidebar Trigger */}
        <div className={cn(
          "pt-6 pb-2 shrink-0",
          state === 'collapsed' ? "flex justify-center px-2" : "px-6"
        )}>
          <SidebarTrigger className="size-9 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/10 hover:border-white/20 shadow-lg" />
        </div>

        <SidebarContent className="flex flex-col h-full overflow-hidden">
          {/* NEW CHAT BUTTON */}
          <div className="px-4 pt-4 pb-4 shrink-0 flex justify-center">
            {state === 'expanded' ? (
              <Button
                onClick={createNewChatInCurrentTeam}
                className="w-full h-11 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-medium shadow-lg shadow-purple-900/20"
              >
                <PlusIcon className="size-5 mr-2" />
                New Chat
              </Button>
            ) : (
              <Button
                onClick={createNewChatInCurrentTeam}
                size="icon"
                className="h-10 w-10 rounded-full bg-[#7c3aed] text-white"
              >
                <PlusIcon className="size-5" />
              </Button>
            )}
          </div>

          {state === 'expanded' && (
            <>
              {/* WORKSPACE SECTION */}
              <div className="px-4 shrink-0">
                <SidebarGroup className="p-0">
                  <div className="flex items-center justify-between mb-2 px-1 group/label">
                    <SidebarGroupLabel className="text-[#71717a] text-[11px] font-semibold tracking-wider uppercase flex items-center gap-1 cursor-pointer">
                      Workspace
                      <ChevronDownIcon className="size-3" />
                    </SidebarGroupLabel>

                    <Dialog open={isAddTeamOpen} onOpenChange={setIsAddTeamOpen}>
                      <DialogTrigger asChild>
                        <PlusIcon className="size-3.5 text-[#71717a] hover:text-white cursor-pointer" />
                      </DialogTrigger>
                      <DialogContent className="bg-[#18181b] border border-white/10 sm:max-w-[400px]">
                        <DialogHeader>
                          <DialogTitle className="text-white">Create Workspace</DialogTitle>
                        </DialogHeader>
                        <Input
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          placeholder="e.g. Finance"
                          className="bg-black/50 border-white/10 text-white"
                        />
                        <DialogFooter>
                          <Button onClick={handleAddTeam} className="bg-purple-600 text-white">Create</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <SidebarMenu className="space-y-1">
                    {teams.map(team => {
                      const isActive = selectedTeam === team && !activeChatId;
                      return (
                        <SidebarMenuItem key={team}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => selectTeam(team)}
                            className={cn(
                              "h-9 text-[14px] font-medium transition-all rounded-full pl-4",
                              isActive
                                ? "bg-[#5b21b6] text-white"
                                : "text-[#a1a1aa] hover:text-white hover:bg-white/5"
                            )}
                          >
                            <HashIcon className="size-3.5 opacity-50 mr-2 shrink-0" />
                            <span>{team}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroup>
              </div>

              {/* HISTORY SECTION */}
              <div className="px-4 mt-4 flex-1 min-h-0 flex flex-col">
                <SidebarGroup className="p-0 flex-1 min-h-0 flex flex-col">
                  <SidebarGroupLabel className="text-[#71717a] text-[11px] font-semibold tracking-wider uppercase mb-2 px-1 flex items-center gap-1 shrink-0">
                    History
                    <ChevronDownIcon className="size-3" />
                  </SidebarGroupLabel>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ScrollArea className="h-full" orientation="vertical">
                      <SidebarMenu className="space-y-1 pr-2 pb-16">
                        {chatHistory.map(chat => {
                          const isActive = activeChatId === chat.id;
                          return (
                            <SidebarMenuItem key={chat.id} className="group/item relative">
                              <SidebarMenuButton
                                isActive={isActive}
                                onClick={() => selectChat(chat.id)}
                                className={cn(
                                  "h-9 text-[13px] transition-all rounded-full pl-4 pr-10",
                                  isActive
                                    ? "bg-white/10 text-white"
                                    : "text-[#a1a1aa] hover:text-white hover:bg-white/5"
                                )}
                              >
                                <ClockIcon className="size-3.5 opacity-50 mr-2 shrink-0" />
                                <span className="truncate">{chat.title || "New Chat"}</span>
                              </SidebarMenuButton>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteChat(chat.id);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 size-6 rounded-md flex items-center justify-center opacity-0 group-hover/item:opacity-100 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
                                aria-label="Delete chat"
                              >
                                <Trash2Icon className="size-3.5" />
                              </button>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </ScrollArea>
                  </div>
                </SidebarGroup>
              </div>
            </>
          )}
        </SidebarContent>

      </Sidebar>

      <SidebarInset className="bg-transparent overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0b2e] via-[#0d0118] to-[#0d0118] z-[-1]" />
        <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[600px] bg-purple-900/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-900/5 rounded-full blur-[120px] pointer-events-none" />

        <main className="flex-1 flex flex-col min-h-0 relative items-center justify-center">

          <ScrollArea
            className="flex-1 p-8 w-full"
            ref={chatContainerRef}
            viewportRef={scrollViewportRef}
            onScroll={handleScroll}
          >
            <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-20">
              <AnimatePresence mode="wait">
                {/* EMPTY STATE */}
                {!activeChatId || (activeChat && activeChat.messages.length === 0) ? (
                  <motion.div
                    key="empty-state"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-col items-center justify-center min-h-[60vh] text-center"
                  >
                    <h2 className="text-6xl font-bold tracking-tight text-gradient-animated mb-4 pb-1">
                      How can I help?
                    </h2>

                    <p className="text-lg mb-12">
                      Ask questions regarding the <span className="text-gradient-animated font-medium">{selectedTeam.toLowerCase()}</span> knowledge base.
                    </p>

                    <div className="flex flex-wrap justify-center gap-4 w-full">
                      {suggestionPrompts.map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => setQueryInput(prompt)}
                          className="px-6 py-3 rounded-full bg-[#131316] border border-white/5 shadow-[0_0_20px_rgba(124,58,237,0.1)] hover:shadow-[0_0_25px_rgba(124,58,237,0.3)] hover:border-purple-500/30 transition-all group"
                        >
                          <span className="text-sm text-gray-300 group-hover:text-white">{prompt}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  // MESSAGES
                  activeChat?.messages.map((m, i) => (
                    <MessageBubble key={`${activeChatId}-${i}`} sender={m.sender} text={m.text} />
                  ))
                )}
              </AnimatePresence>

              {/* LOADING */}
              {isQuerying && (
                <div className="flex items-center gap-3 pl-0 max-w-3xl mx-auto w-full opacity-50">
                  <BotIcon className="size-6 text-white" />
                  <span className="text-sm text-gray-400">...</span>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* INPUT BAR */}
          <div className="absolute bottom-8 left-0 right-0 px-8 z-20">
            <div className="max-w-3xl mx-auto relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/50 to-pink-600/50 rounded-full blur opacity-30 group-hover:opacity-50 transition duration-500" />

              <form onSubmit={handleQuery} className="relative flex items-center bg-[#18181b] rounded-full border border-purple-500/20 shadow-2xl overflow-hidden h-14 pl-4 pr-2">
                <div className="flex items-center gap-3 text-[#a1a1aa] border-r border-white/10 pr-3 mr-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.docx,.txt,.csv,.md,.pptx,.xlsx,.epub,.html,.rtf" // Supported formats
                  />
                  <PlusIcon
                    className={`size-5 hover:text-white cursor-pointer transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed animate-pulse' : ''}`}
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                  />
                  <MicIcon className="size-5 hover:text-white cursor-pointer transition-colors" />
                </div>

                <input
                  value={queryInput}
                  onChange={handleInputChange}
                  placeholder="Ask a question..."
                  className="flex-1 h-full border-none outline-none focus:ring-0 text-[15px] text-white placeholder:text-[#52525b] bg-transparent p-0"
                  disabled={!selectedTeam}
                  autoComplete="off"
                  id="chat-input"
                  name="chat-input"
                />

                <Button
                  type="submit"
                  size="icon"
                  className="size-10 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white transition-all ml-2 flex items-center justify-center shrink-0"
                  disabled={!queryInput.trim()}
                >
                  <ArrowRightIcon className="size-5" />
                </Button>
              </form>
              <div className="text-center mt-3 text-[11px] text-[#52525b]">
                AI-generated content may be inaccurate
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
};

export default function App() {
  return (
    <SidebarProvider>
      <RAGLayout />
    </SidebarProvider>
  );
}
