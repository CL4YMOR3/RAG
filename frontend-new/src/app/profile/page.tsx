"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Shield, Users, Building2, User as UserIcon } from "lucide-react";

export default function ProfilePage() {
    const { data: session } = useSession();
    const router = useRouter();
    const user = session?.user;

    // Loading state handling could be better, but session usually loads fast or is cached
    if (!user) {
        return <div className="min-h-screen bg-void flex items-center justify-center text-txt-secondary">Loading...</div>;
    }

    const initials = user.name
        ? user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : "?";

    return (
        <div className="min-h-screen bg-void relative overflow-hidden text-txt-primary">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
            </div>

            <main className="relative z-10 container mx-auto px-4 py-8 max-w-3xl">
                {/* Header */}
                <div className="mb-8 flex items-center gap-4">
                    <button
                        onClick={() => router.push("/")}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-txt-secondary hover:text-white"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-2xl font-bold">User Profile</h1>
                </div>

                {/* Profile Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="bg-surface border border-white-5 rounded-2xl p-8 backdrop-blur-md shadow-xl"
                >
                    {/* Header: Avatar & Basic Info */}
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8">
                        <div className="relative">
                            {user.image ? (
                                <img
                                    src={user.image}
                                    alt="Profile"
                                    className="w-24 h-24 rounded-full border-4 border-surface shadow-2xl"
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-brand-primary/20 flex items-center justify-center text-3xl font-bold text-brand-primary border-4 border-surface">
                                    {initials}
                                </div>
                            )}
                            {user.isAdmin && (
                                <div className="absolute -bottom-2 -right-2 bg-brand-secondary text-white p-1.5 rounded-full shadow-lg border border-surface" title="Administrator">
                                    <Shield className="w-4 h-4 fill-current" />
                                </div>
                            )}
                        </div>

                        <div className="text-center md:text-left flex-1 space-y-2">
                            <h2 className="text-2xl font-bold">{user.name || "Anonymous User"}</h2>
                            <div className="flex items-center justify-center md:justify-start gap-2 text-txt-secondary">
                                <Mail className="w-4 h-4" />
                                <span>{user.email}</span>
                            </div>
                            <div className="flex items-center justify-center md:justify-start gap-2 text-txt-tertiary text-sm">
                                <Shield className="w-4 h-4" />
                                <span>{user.isAdmin ? "System Administrator" : "Standard User"}</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full h-px bg-white-5 my-8" />

                    {/* Team Memberships */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Building2 className="w-5 h-5 text-brand-primary" />
                            <h3 className="text-lg font-semibold">Team Memberships</h3>
                        </div>

                        {(!user.teams || user.teams.length === 0) ? (
                            <div className="bg-white-5/50 border border-white-5 rounded-xl p-6 text-center text-txt-tertiary">
                                Use the dashboard to join or create teams.
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {user.teams.map((team) => (
                                    <div
                                        key={team.id}
                                        className="flex items-center justify-between p-4 bg-white-5/50 border border-white-5 rounded-xl hover:bg-white-5 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                                                <Users className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-txt-primary">{team.name}</p>
                                                <p className="text-xs text-txt-tertiary font-mono">/{team.slug}</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${team.role === 'OWNER' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                team.role === 'ADMIN' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    'bg-white-5 text-txt-secondary border-white-10'
                                            }`}>
                                            {team.role}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
