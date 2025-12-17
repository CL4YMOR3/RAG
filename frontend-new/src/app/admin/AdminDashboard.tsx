"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users,
    Building2,
    FileText,
    Activity,
    Shield,
    Clock,
    ChevronRight,
    Plus,
    Trash2,
    Edit2,
    X,
    Loader2,
    UserPlus,
    Crown,
    Settings,
    Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface User {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    isAdmin: boolean;
    createdAt: string;
    memberships: Array<{
        team: { id: string; name: string; slug: string };
        role: string;
    }>;
}

interface Team {
    id: string;
    name: string;
    slug: string;
    domain: string | null;
    memberCount: number;
    createdAt: string;
}

interface TeamMember {
    id: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    joinedAt: string;
    user: {
        id: string;
        name: string | null;
        email: string;
        image: string | null;
    };
}

interface AuditLog {
    id: string;
    action: string;
    resource: string;
    details: unknown;
    createdAt: Date;
    user: {
        name: string | null;
        email: string;
    };
}

interface AdminDashboardProps {
    stats: {
        users: number;
        teams: number;
    };
    recentLogs: AuditLog[];
}

export default function AdminDashboard({ stats, recentLogs }: AdminDashboardProps) {
    const [activeTab, setActiveTab] = useState<"overview" | "users" | "teams" | "logs">("overview");
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Close mobile menu when tab changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [activeTab]);

    const navItems = [
        { id: "overview", label: "Overview", icon: Activity },
        { id: "users", label: "Users", icon: Users },
        { id: "teams", label: "Teams", icon: Building2 },
        { id: "logs", label: "Audit Logs", icon: FileText },
    ];

    return (
        <div className="min-h-screen bg-void flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-white-5 bg-surface/80 backdrop-blur-xl">
                <div className="flex items-center justify-between px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-brand-primary/20">
                            <Shield className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-txt-primary">Admin Console</h1>
                            <p className="text-xs text-txt-tertiary hidden sm:block">NEXUS Enterprise Management</p>
                        </div>
                    </div>
                    {/* Mobile Menu Toggle */}
                    <button
                        className="lg:hidden p-3 hover:bg-white/5 rounded-lg text-txt-secondary"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {/* Mobile Navigation (Collapsible) */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <motion.nav
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="lg:hidden border-t border-white-5 overflow-hidden"
                        >
                            <div className="p-2 space-y-1 bg-surface">
                                {navItems.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveTab(item.id as typeof activeTab)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors cursor-pointer",
                                            activeTab === item.id
                                                ? "bg-brand-primary/10 text-brand-primary"
                                                : "text-txt-secondary hover:bg-white/5 hover:text-txt-primary"
                                        )}
                                    >
                                        <item.icon className="w-4 h-4" />
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </motion.nav>
                    )}
                </AnimatePresence>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row">
                {/* Desktop Sidebar */}
                <aside className="hidden lg:block w-64 border-r border-white-5 p-4 shrink-0">
                    <nav className="space-y-1 sticky top-24">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as typeof activeTab)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer",
                                    activeTab === item.id
                                        ? "bg-brand-primary/10 text-brand-primary"
                                        : "text-txt-secondary hover:bg-white/5 hover:text-txt-primary"
                                )}
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                                {activeTab === item.id && (
                                    <ChevronRight className="w-4 h-4 ml-auto" />
                                )}
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-4 sm:p-6 min-w-0">
                    {activeTab === "overview" && (
                        <OverviewTab stats={stats} recentLogs={recentLogs} />
                    )}
                    {activeTab === "users" && <UsersTab />}
                    {activeTab === "teams" && <TeamsTab />}
                    {activeTab === "logs" && <LogsTab recentLogs={recentLogs} />}
                </main>
            </div>
        </div>
    );
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================

function OverviewTab({ stats, recentLogs }: { stats: { users: number; teams: number }; recentLogs: AuditLog[] }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard title="Total Users" value={stats.users} icon={Users} />
                <StatsCard title="Active Teams" value={stats.teams} icon={Building2} />
                <StatsCard title="Documents" value="—" icon={FileText} />
                <StatsCard title="API Keys" value="—" icon={Shield} />
            </div>

            <div className="bg-surface rounded-xl border border-white-5 p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-txt-primary mb-4">Recent Activity</h2>
                <div className="space-y-3">
                    {recentLogs.slice(0, 10).map((log) => (
                        <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-void/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-brand-primary/10 shrink-0">
                                    <Activity className="w-4 h-4 text-brand-primary" />
                                </div>
                                <p className="text-xs text-txt-tertiary flex sm:hidden items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(log.createdAt).toLocaleString()}
                                </p>
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-txt-primary">
                                    <span className="font-medium">{log.user.name || log.user.email}</span>
                                    {" "}performed{" "}
                                    <span className="text-brand-primary">{log.action}</span>
                                    {" "}on{" "}
                                    <span className="text-txt-secondary">{log.resource}</span>
                                </p>
                                <p className="text-xs text-txt-tertiary hidden sm:flex items-center gap-1 mt-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(log.createdAt).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    ))}
                    {recentLogs.length === 0 && (
                        <p className="text-center text-txt-tertiary py-8">No activity yet</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// USERS TAB
// ============================================================================

function UsersTab() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}`);
            const data = await res.json();
            setUsers(data.users || []);
        } catch (e) {
            console.error("Failed to fetch users:", e);
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const toggleAdmin = async (userId: string, isAdmin: boolean) => {
        await fetch("/api/admin/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, isAdmin: !isAdmin }),
        });
        fetchUsers();
    };

    const deleteUser = async (userId: string) => {
        if (!confirm("Are you sure you want to delete this user?")) return;
        await fetch(`/api/admin/users?userId=${userId}`, { method: "DELETE" });
        fetchUsers();
    };

    return (
        <div className="bg-surface rounded-xl border border-white-5">
            <div className="p-4 border-b border-white-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-txt-primary">User Management</h2>
                <input
                    type="text"
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-void border border-white-10 rounded-lg px-3 py-1.5 text-sm text-txt-primary placeholder:text-txt-tertiary focus:outline-none focus:border-brand-primary w-full sm:w-64"
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                </div>
            ) : (
                <div className="divide-y divide-white-5">
                    {users.map((user) => (
                        <div key={user.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="flex items-center gap-4 flex-1 w-full min-w-0">
                                <img
                                    src={user.image || `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`}
                                    alt={user.name || "User"}
                                    className="w-10 h-10 rounded-full shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-txt-primary truncate">
                                            {user.name || "No name"}
                                        </p>
                                        {user.isAdmin && (
                                            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded font-medium shrink-0">
                                                ADMIN
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-txt-tertiary truncate">{user.email}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t border-white-5 sm:border-t-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                                <button
                                    onClick={() => toggleAdmin(user.id, user.isAdmin)}
                                    className={cn(
                                        "p-2 rounded-lg transition-colors cursor-pointer",
                                        user.isAdmin
                                            ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                                            : "bg-white/5 text-txt-tertiary hover:bg-white/10 hover:text-txt-primary"
                                    )}
                                    title={user.isAdmin ? "Remove admin" : "Make admin"}
                                >
                                    <Crown className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => deleteUser(user.id)}
                                    className="p-2 rounded-lg bg-white/5 text-txt-tertiary hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer"
                                    title="Delete user"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {users.length === 0 && (
                        <p className="text-center text-txt-tertiary py-8">No users found</p>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// TEAMS TAB
// ============================================================================

function TeamsTab() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newTeamName, setNewTeamName] = useState("");
    const [newTeamDomain, setNewTeamDomain] = useState("");
    const [creating, setCreating] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

    const fetchTeams = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/teams");
            const data = await res.json();
            setTeams(data.teams || []);
        } catch (e) {
            console.error("Failed to fetch teams:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);

    const createTeam = async () => {
        if (!newTeamName.trim()) return;
        setCreating(true);
        try {
            await fetch("/api/admin/teams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newTeamName, domain: newTeamDomain || undefined }),
            });
            setNewTeamName("");
            setNewTeamDomain("");
            setShowCreate(false);
            fetchTeams();
            // Refresh session to update sidebar
            await document.location.reload();
        } finally {
            setCreating(false);
        }
    };

    const deleteTeam = async (teamId: string) => {
        if (!confirm("Are you sure you want to delete this team? All members will be removed.")) return;
        await fetch(`/api/admin/teams?teamId=${teamId}`, { method: "DELETE" });
        fetchTeams();
    };

    return (
        <div className="space-y-4">
            {/* Create Team Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className="bg-surface border border-white-10 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-txt-primary">Create Team</h3>
                            <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer">
                                <X className="w-5 h-5 text-txt-tertiary" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Team name"
                                value={newTeamName}
                                onChange={(e) => setNewTeamName(e.target.value)}
                                className="w-full bg-void border border-white-10 rounded-lg px-4 py-3 text-txt-primary placeholder:text-txt-tertiary focus:outline-none focus:border-brand-primary"
                            />
                            <input
                                type="text"
                                placeholder="Auto-join domain (e.g., jwtl.in)"
                                value={newTeamDomain}
                                onChange={(e) => setNewTeamDomain(e.target.value)}
                                className="w-full bg-void border border-white-10 rounded-lg px-4 py-3 text-txt-primary placeholder:text-txt-tertiary focus:outline-none focus:border-brand-primary"
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowCreate(false)}
                                    className="flex-1 px-4 py-2.5 border border-white-10 rounded-lg text-txt-secondary hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={createTeam}
                                    disabled={!newTeamName.trim() || creating}
                                    className="flex-1 px-4 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-lg font-medium transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                                >
                                    {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Create Team
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Team Members Modal */}
            {selectedTeam && (
                <TeamMembersModal team={selectedTeam} onClose={() => setSelectedTeam(null)} />
            )}

            {/* Teams List */}
            <div className="bg-surface rounded-xl border border-white-5">
                <div className="p-4 border-b border-white-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold text-txt-primary">Team Management</h2>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-lg text-sm font-medium transition-colors cursor-pointer w-full sm:w-auto justify-center"
                    >
                        <Plus className="w-4 h-4" />
                        Create Team
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                    </div>
                ) : (
                    <div className="divide-y divide-white-5">
                        {teams.map((team) => (
                            <div key={team.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className="flex items-center gap-4 flex-1 w-full min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-brand-primary/20 flex items-center justify-center shrink-0">
                                        <Building2 className="w-5 h-5 text-brand-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-txt-primary truncate">{team.name}</p>
                                            <span className="text-xs text-txt-tertiary">/{team.slug}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-txt-tertiary mt-0.5">
                                            <span>{team.memberCount} members</span>
                                            {team.domain && <span>Auto-join: @{team.domain}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t border-white-5 sm:border-t-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                                    <button
                                        onClick={() => setSelectedTeam(team)}
                                        className="p-2 rounded-lg bg-white/5 text-txt-tertiary hover:bg-white/10 hover:text-txt-primary transition-colors cursor-pointer"
                                        title="Manage members"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => deleteTeam(team.id)}
                                        className="p-2 rounded-lg bg-white/5 text-txt-tertiary hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer"
                                        title="Delete team"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {teams.length === 0 && (
                            <p className="text-center text-txt-tertiary py-8">No teams yet</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// TEAM MEMBERS MODAL
// ============================================================================

function TeamMembersModal({ team, onClose }: { team: Team; onClose: () => void }) {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [addEmail, setAddEmail] = useState("");
    const [addRole, setAddRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
    const [adding, setAdding] = useState(false);

    const fetchMembers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/teams/${team.id}/members`);
            const data = await res.json();
            setMembers(data.members || []);
        } catch (e) {
            console.error("Failed to fetch members:", e);
        } finally {
            setLoading(false);
        }
    }, [team.id]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const addMember = async () => {
        if (!addEmail.trim()) return;
        setAdding(true);
        try {
            const res = await fetch(`/api/admin/teams/${team.id}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: addEmail, role: addRole }),
            });
            if (res.ok) {
                setAddEmail("");
                fetchMembers();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to add member");
            }
        } finally {
            setAdding(false);
        }
    };

    const updateRole = async (userId: string, role: string) => {
        await fetch(`/api/admin/teams/${team.id}/members`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, role }),
        });
        fetchMembers();
    };

    const removeMember = async (userId: string) => {
        if (!confirm("Remove this member from the team?")) return;
        await fetch(`/api/admin/teams/${team.id}/members?userId=${userId}`, { method: "DELETE" });
        fetchMembers();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="bg-surface border border-white-10 rounded-xl w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b border-white-5 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-lg font-semibold text-txt-primary">{team.name}</h3>
                        <p className="text-xs text-txt-tertiary">Manage team members</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer">
                        <X className="w-5 h-5 text-txt-tertiary" />
                    </button>
                </div>

                {/* Add Member */}
                <div className="p-4 border-b border-white-5 shrink-0">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="email"
                            placeholder="Email address"
                            value={addEmail}
                            onChange={(e) => setAddEmail(e.target.value)}
                            className="flex-1 bg-void border border-white-10 rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-tertiary focus:outline-none focus:border-brand-primary"
                        />
                        <div className="flex gap-2">
                            <select
                                value={addRole}
                                onChange={(e) => setAddRole(e.target.value as "MEMBER" | "ADMIN")}
                                className="bg-void border border-white-10 rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:border-brand-primary cursor-pointer flex-1 sm:flex-none"
                            >
                                <option value="MEMBER">Member</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                            <button
                                onClick={addMember}
                                disabled={!addEmail.trim() || adding}
                                className="px-3 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Members List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                        </div>
                    ) : (
                        <div className="divide-y divide-white-5">
                            {members.map((member) => (
                                <div key={member.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                    <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                                        <img
                                            src={member.user.image || `https://api.dicebear.com/7.x/initials/svg?seed=${member.user.email}`}
                                            alt={member.user.name || "User"}
                                            className="w-8 h-8 rounded-full shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-txt-primary truncate">{member.user.name || member.user.email}</p>
                                            <p className="text-xs text-txt-tertiary truncate">{member.user.email}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t border-white-5 sm:border-t-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
                                        <select
                                            value={member.role}
                                            onChange={(e) => updateRole(member.user.id, e.target.value)}
                                            className="bg-void border border-white-10 rounded px-2 py-1 text-xs text-txt-primary focus:outline-none cursor-pointer"
                                        >
                                            <option value="OWNER">Owner</option>
                                            <option value="ADMIN">Admin</option>
                                            <option value="MEMBER">Member</option>
                                        </select>
                                        <button
                                            onClick={() => removeMember(member.user.id)}
                                            className="p-1.5 rounded hover:bg-red-500/20 hover:text-red-400 text-txt-tertiary transition-colors cursor-pointer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {members.length === 0 && (
                                <p className="text-center text-txt-tertiary py-8">No members yet</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// LOGS TAB
// ============================================================================

function LogsTab({ recentLogs }: { recentLogs: AuditLog[] }) {
    return (
        <div className="bg-surface rounded-xl border border-white-5 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-txt-primary mb-4">Audit Logs</h2>
            <div className="space-y-2">
                {recentLogs.map((log) => (
                    <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg bg-void/50 text-sm">
                        <span className="text-txt-tertiary w-full sm:w-40 shrink-0 text-xs sm:text-sm">
                            {new Date(log.createdAt).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="px-2 py-0.5 rounded bg-brand-primary/20 text-brand-primary text-xs shrink-0">
                                {log.action}
                            </span>
                            <span className="text-txt-secondary truncate">{log.resource}</span>
                        </div>
                        <span className="text-txt-primary sm:ml-auto w-full sm:w-auto text-xs sm:text-sm truncate">
                            {log.user.email}
                        </span>
                    </div>
                ))}
                {recentLogs.length === 0 && (
                    <p className="text-center text-txt-tertiary py-8">No audit logs yet</p>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// STATS CARD
// ============================================================================

function StatsCard({ title, value, icon: Icon }: { title: string; value: number | string; icon: React.ElementType }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-xl border border-white-5 p-6"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-brand-primary/10">
                    <Icon className="w-5 h-5 text-brand-primary" />
                </div>
            </div>
            <p className="text-3xl font-bold text-txt-primary">{value}</p>
            <p className="text-sm text-txt-tertiary mt-1">{title}</p>
        </motion.div>
    );
}
