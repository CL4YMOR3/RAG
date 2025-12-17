import {
    ChevronLeft,
    Plus,
    Building2,
    Hash,
    Clock,
    Trash2,
    Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OnlineUsersCount } from '@/components/ui/PresenceIndicator';
import { UserMenu } from '@/components/UserMenu';
import type { Session } from 'next-auth';

// Define types locally if not exported elsewhere
interface Team {
    id: string;
    name: string;
    slug: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

interface ChatSession {
    id: string;
    title: string;
    // ... other fields not needed for display
}

interface SidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (open: boolean) => void;
    handleNewChat: () => void;
    onlineUsers: string[];
    setIsAddTeamModalOpen: (open: boolean) => void;
    sessionTeams: Team[];
    selectedTeam: Team | null;
    handleTeamSelect: (team: Team) => void;
    sessions: ChatSession[];
    currentSession: ChatSession | null;
    selectChat: (id: string) => void;
    handleDeleteHistory: (id: string) => void;
    session: Session | null;
    isMobile?: boolean; // Prop to adjust layout for mobile
}

export function SidebarContent({
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
    isMobile = false,
}: SidebarProps) {
    return (
        <div className="h-full flex flex-col bg-surface overflow-hidden">
            {/* Sidebar Header with Collapse Button */}
            <div className="p-4 flex items-center justify-between border-b border-white-5 shrink-0">
                <span className="text-sm font-semibold text-txt-primary">NEXUS</span>
                {/* Only show collapse button on Desktop, OR Close button on Mobile */}
                <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-txt-tertiary hover:text-txt-secondary cursor-pointer"
                    aria-label={isMobile ? "Close menu" : "Collapse sidebar"}
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
            </div>

            {/* New Chat Button */}
            <div className="p-4 shrink-0">
                <button
                    type="button"
                    onClick={() => {
                        handleNewChat();
                        if (isMobile) setIsSidebarOpen(false); // Close drawer on mobile
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-linear-to-r from-brand-primary to-purple-600 hover:from-brand-secondary hover:to-brand-primary text-white font-semibold rounded-lg px-4 py-2.5 transition-all shadow-lg shadow-brand-primary/30 cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    New Chat
                </button>
            </div>

            {/* Content Scroll Area */}
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col px-3">
                {/* WORKSPACE Section */}
                <div className="mb-6 shrink-0">
                    <div className="flex items-center justify-between px-2 py-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider">
                                Workspace
                            </span>
                            <OnlineUsersCount count={onlineUsers.length} />
                        </div>
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
                        {sessionTeams.length === 0 ? (
                            <div className="px-3 py-4 text-center text-txt-tertiary text-sm">
                                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No teams yet</p>
                                <p className="text-xs mt-1">Contact admin</p>
                            </div>
                        ) : (
                            sessionTeams.map((team) => (
                                <div
                                    key={team.id}
                                    className={cn(
                                        'group flex items-center gap-2 text-sm transition-all rounded-lg',
                                        selectedTeam?.id === team.id
                                            ? 'sidebar-item-active'
                                            : 'text-txt-secondary hover:bg-white/5'
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleTeamSelect(team);
                                            if (isMobile) setIsSidebarOpen(false);
                                        }}
                                        className="flex-1 flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer"
                                    >
                                        <Hash className="w-4 h-4" />
                                        <span className="truncate">{team.name}</span>
                                        <span className="ml-auto text-[10px] text-txt-tertiary uppercase">{team.role}</span>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* HISTORY Section */}
                <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider">
                            History
                        </span>
                    </div>
                    <div className="space-y-0.5 mt-1">
                        {sessions.map((sessionItem) => (
                            <div
                                key={sessionItem.id}
                                className={cn(
                                    "group flex items-center text-sm transition-all rounded-lg",
                                    currentSession?.id === sessionItem.id
                                        ? "bg-brand-primary/10 text-brand-primary"
                                        : "text-txt-secondary hover:bg-white/5 hover:text-txt-primary"
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        selectChat(sessionItem.id);
                                        if (isMobile) setIsSidebarOpen(false);
                                    }}
                                    className="flex-1 flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer overflow-hidden"
                                >
                                    <Clock className="w-4 h-4 text-txt-tertiary shrink-0" />
                                    <span className="truncate">{sessionItem.title}</span>
                                </button>
                                {sessions.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteHistory(sessionItem.id);
                                        }}
                                        // On mobile, show always/easier access? For now same as desktop
                                        className="p-1.5 mr-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 rounded transition-all cursor-pointer"
                                        aria-label="Delete chat"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer Section: Admin & User Menu */}
            <div className="p-3 border-t border-white-5 space-y-2 shrink-0">
                {/* Admin Panel Button */}
                {session?.user?.isAdmin && (
                    <a
                        href="/admin"
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-brand-primary hover:bg-brand-primary/10 transition-colors cursor-pointer group"
                    >
                        <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center group-hover:bg-brand-primary/30 transition-colors">
                            <Shield className="w-4 h-4" />
                        </div>
                        {/* Always show text in SidebarContent, wrapper handles width */}
                        <span className="text-sm font-medium">Admin Panel</span>
                    </a>
                )}

                {/* User Menu */}
                <UserMenu onOpenCommandPalette={() => { }} />
            </div>
        </div>
    );
}
