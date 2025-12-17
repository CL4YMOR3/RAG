"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type Step = "welcome" | "team" | "complete";

interface TeamInfo {
    id: string;
    name: string;
    slug: string;
    role: string;
}

interface PublicTeam {
    id: string;
    name: string;
    slug: string;
}

export default function OnboardingPage() {
    const { data: session, update: updateSession } = useSession();
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState<Step>("welcome");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [displayName, setDisplayName] = useState("");

    // Team Creation State (Admins)
    const [teamName, setTeamName] = useState("");
    const [teamSlug, setTeamSlug] = useState("");

    // Team Selection State (Users)
    const [availableTeams, setAvailableTeams] = useState<PublicTeam[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState("");

    // Check if user already has a team (auto-joined)
    const userTeams: TeamInfo[] = session?.user?.teams ?? [];
    const hasAutoJoinedTeam = userTeams.length > 0;
    const isAdmin = session?.user?.isAdmin ?? false;

    useEffect(() => {
        if (session?.user?.name) {
            setDisplayName(session.user.name);
        }
    }, [session?.user?.name]);

    // Fetch teams for selection
    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const res = await fetch("/api/teams/list");
                if (res.ok) {
                    const data = await res.json();
                    setAvailableTeams(data);
                }
            } catch (err) {
                console.error("Failed to fetch teams", err);
            }
        };
        fetchTeams();
    }, []);

    // Auto-generate slug from team name (Admins only)
    useEffect(() => {
        setTeamSlug(
            teamName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "")
        );
    }, [teamName]);

    const handleCompleteOnboarding = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Handle Team Step
            if (!hasAutoJoinedTeam) {
                // If Admin and creating a team
                if (isAdmin && teamName.trim()) {
                    const teamRes = await fetch("/api/teams/create", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: teamName.trim(),
                            slug: teamSlug.trim(),
                        }),
                    });

                    if (!teamRes.ok) {
                        const data = await teamRes.json();
                        throw new Error(data.error || "Failed to create team");
                    }
                }
                // If User and selecting a team
                else if (!isAdmin && selectedTeamId) {
                    // Logic to join team would go here (e.g. /api/teams/join)
                    // BUT currently `createUser` auto-joins or we need an API.
                    // IMPORTANT: The backend `createUser` handles auto-join by domain.
                    // If they are selecting a team manually, we need an API to add them as MEMBER.
                    // I'll create a quick `api/teams/join` route or use `api/onboarding/complete` to handle it?
                    // Let's pass `selectedTeamId` to `api/onboarding/complete` and handle it there.
                }
            }

            // Complete onboarding
            const res = await fetch("/api/onboarding/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: displayName.trim() || undefined,
                    teamId: !hasAutoJoinedTeam && !isAdmin ? selectedTeamId : undefined
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to complete onboarding");
            }

            // Update session to reflect changes
            await updateSession();

            // Force hard redirect to ensure middleware sees the new cookie
            window.location.href = "/";
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    const steps: Step[] = ["welcome", "team", "complete"];
    const currentStepIndex = steps.indexOf(currentStep);

    const nextStep = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStep(steps[currentStepIndex + 1]);
        }
    };

    const prevStep = () => {
        if (currentStepIndex > 0) {
            setCurrentStep(steps[currentStepIndex - 1]);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-void relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>

            {/* Sign Out Button (Escape Hatch) */}
            <button
                onClick={() => {
                    import("next-auth/react").then(({ signOut }) => signOut({ callbackUrl: "/login" }));
                }}
                className="absolute top-6 right-6 px-4 py-2 bg-white-5 hover:bg-white-10 text-txt-secondary text-sm font-medium rounded-lg transition-all z-20 cursor-pointer backdrop-blur-md border border-white-5"
            >
                Sign Out
            </button>

            {/* Main Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-lg mx-4"
            >
                <div className="bg-surface border border-white-5 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
                    {/* Progress Indicator */}
                    <div className="flex justify-center gap-2 mb-8">
                        {steps.map((step, index) => (
                            <div
                                key={step}
                                className={`h-2 rounded-full transition-all duration-300 ${index <= currentStepIndex
                                    ? "bg-brand-primary w-8"
                                    : "bg-white-10 w-2"
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg"
                        >
                            <p className="text-red-400 text-sm text-center">{error}</p>
                        </motion.div>
                    )}

                    {/* Step Content */}
                    <AnimatePresence mode="wait">
                        {currentStep === "welcome" && (
                            <WelcomeStep
                                key="welcome"
                                displayName={displayName}
                                setDisplayName={setDisplayName}
                                userEmail={session?.user?.email ?? ""}
                                userImage={session?.user?.image ?? null}
                                onNext={nextStep}
                            />
                        )}

                        {currentStep === "team" && (
                            <TeamStep
                                key="team"
                                isAdmin={isAdmin}
                                hasAutoJoinedTeam={hasAutoJoinedTeam}
                                autoJoinedTeam={userTeams[0]}
                                teamName={teamName}
                                setTeamName={setTeamName}
                                teamSlug={teamSlug}
                                availableTeams={availableTeams}
                                selectedTeamId={selectedTeamId}
                                setSelectedTeamId={setSelectedTeamId}
                                onNext={nextStep}
                                onBack={prevStep}
                            />
                        )}

                        {currentStep === "complete" && (
                            <CompleteStep
                                key="complete"
                                displayName={displayName}
                                teamName={
                                    hasAutoJoinedTeam
                                        ? userTeams[0]?.name
                                        : isAdmin
                                            ? teamName
                                            : availableTeams.find(t => t.id === selectedTeamId)?.name
                                }
                                isLoading={isLoading}
                                onComplete={handleCompleteOnboarding}
                                onBack={prevStep}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

interface WelcomeStepProps {
    displayName: string;
    setDisplayName: (name: string) => void;
    userEmail: string;
    userImage: string | null;
    onNext: () => void;
}

function WelcomeStep({
    displayName,
    setDisplayName,
    userEmail,
    userImage,
    onNext,
}: WelcomeStepProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="text-center">
                <h2 className="text-2xl font-bold text-txt-primary mb-2">
                    Welcome to Nexus 👋
                </h2>
                <p className="text-txt-secondary text-sm">
                    Let&apos;s get you set up in just a few steps
                </p>
            </div>

            {/* Profile Preview */}
            <div className="flex items-center gap-4 p-4 bg-white-5 rounded-xl">
                {userImage ? (
                    <img
                        src={userImage}
                        alt="Profile"
                        className="w-16 h-16 rounded-full border-2 border-brand-primary"
                    />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-brand-primary/20 flex items-center justify-center">
                        <span className="text-2xl text-brand-primary">
                            {displayName?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                    </div>
                )}
                <div className="flex-1">
                    <p className="text-txt-tertiary text-xs">Signed in as</p>
                    <p className="text-txt-secondary text-sm">{userEmail}</p>
                </div>
            </div>

            {/* Display Name Input */}
            <div className="space-y-2">
                <label className="text-txt-secondary text-sm font-medium">
                    Display Name
                </label>
                <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How should we call you?"
                    className="w-full px-4 py-3 bg-white-5 border border-white-10 rounded-lg text-txt-primary placeholder-txt-tertiary focus:outline-none focus:border-brand-primary transition-colors"
                />
            </div>

            {/* Next Button */}
            <button
                onClick={onNext}
                className="w-full py-3 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium rounded-lg transition-all shadow-lg shadow-brand-primary/20 cursor-pointer"
            >
                Continue
            </button>
        </motion.div>
    );
}

interface TeamStepProps {
    isAdmin: boolean;
    hasAutoJoinedTeam: boolean;
    autoJoinedTeam: TeamInfo | undefined;
    teamName: string;
    setTeamName: (name: string) => void;
    teamSlug: string;
    availableTeams: PublicTeam[];
    selectedTeamId: string;
    setSelectedTeamId: (id: string) => void;
    onNext: () => void;
    onBack: () => void;
}

function TeamStep({
    isAdmin,
    hasAutoJoinedTeam,
    autoJoinedTeam,
    teamName,
    setTeamName,
    teamSlug,
    availableTeams,
    selectedTeamId,
    setSelectedTeamId,
    onNext,
    onBack,
}: TeamStepProps) {

    // Helper to determine if Continue is disabled
    const canContinue =
        hasAutoJoinedTeam ||
        (isAdmin && teamName.trim()) ||
        (!isAdmin && selectedTeamId);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="text-center">
                <h2 className="text-2xl font-bold text-txt-primary mb-2">
                    Your Team 🏢
                </h2>
                <p className="text-txt-secondary text-sm">
                    {hasAutoJoinedTeam
                        ? "Good news! We found your team"
                        : isAdmin
                            ? "Create a new team for your organization"
                            : "Select your team to join"}
                </p>
            </div>

            {hasAutoJoinedTeam && autoJoinedTeam ? (
                // Auto-joined team display (Same as before)
                <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                            <span className="text-xl">✓</span>
                        </div>
                        <div>
                            <p className="text-txt-primary font-medium">
                                {autoJoinedTeam.name}
                            </p>
                            <p className="text-txt-tertiary text-xs">
                                You&apos;ve been automatically added as {autoJoinedTeam.role}
                            </p>
                        </div>
                    </div>
                </div>
            ) : isAdmin ? (
                // Admin: Create Team Form
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-txt-secondary text-sm font-medium">
                            Team Name
                        </label>
                        <input
                            type="text"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            placeholder="e.g., Engineering, Marketing"
                            className="w-full px-4 py-3 bg-white-5 border border-white-10 rounded-lg text-txt-primary placeholder-txt-tertiary focus:outline-none focus:border-brand-primary transition-colors"
                        />
                    </div>

                    {teamSlug && (
                        <p className="text-txt-tertiary text-xs">
                            Your team URL will be:{" "}
                            <span className="text-brand-primary">/{teamSlug}</span>
                        </p>
                    )}
                </div>
            ) : (
                // User: Select Team Dropdown
                <div className="space-y-4">
                    {availableTeams.length > 0 ? (
                        <div className="space-y-2">
                            <label className="text-txt-secondary text-sm font-medium">
                                Select Team
                            </label>
                            <select
                                value={selectedTeamId}
                                onChange={(e) => setSelectedTeamId(e.target.value)}
                                className="w-full px-4 py-3 bg-white-5 border border-white-10 rounded-lg text-txt-primary focus:outline-none focus:border-brand-primary transition-colors appearance-none cursor-pointer"
                            >
                                <option value="" disabled>Select a team...</option>
                                {availableTeams.map((team) => (
                                    <option key={team.id} value={team.id} className="bg-surface text-txt-primary">
                                        {team.name} ({team.slug})
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-txt-tertiary">
                                {/* Optional: Add chevron icon here if needed/using custom select */}
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <p className="text-yellow-400 text-sm text-center">
                                No teams found. Please contact your administrator to create a team.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={onBack}
                    className="flex-1 py-3 bg-white-5 hover:bg-white-10 text-txt-secondary font-medium rounded-lg transition-all cursor-pointer"
                >
                    Back
                </button>
                <button
                    onClick={onNext}
                    disabled={!canContinue}
                    className="flex-1 py-3 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium rounded-lg transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    Continue
                </button>
            </div>
        </motion.div>
    );
}

interface CompleteStepProps {
    displayName: string;
    teamName: string | undefined;
    isLoading: boolean;
    onComplete: () => void;
    onBack: () => void;
}

function CompleteStep({
    displayName,
    teamName,
    isLoading,
    onComplete,
    onBack,
}: CompleteStepProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="text-center">
                <h2 className="text-2xl font-bold text-txt-primary mb-2">
                    You&apos;re All Set! 🚀
                </h2>
                <p className="text-txt-secondary text-sm">
                    Here&apos;s a summary of your setup
                </p>
            </div>

            {/* Summary */}
            <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-white-5 rounded-lg">
                    <span className="text-txt-tertiary text-sm">Name</span>
                    <span className="text-txt-primary font-medium">
                        {displayName || "Not set"}
                    </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white-5 rounded-lg">
                    <span className="text-txt-tertiary text-sm">Team</span>
                    <span className="text-txt-primary font-medium">
                        {teamName || "No team selected"}
                    </span>
                </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={onBack}
                    disabled={isLoading}
                    className="flex-1 py-3 bg-white-5 hover:bg-white-10 text-txt-secondary font-medium rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                    Back
                </button>
                <button
                    onClick={onComplete}
                    disabled={isLoading}
                    className="flex-1 py-3 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium rounded-lg transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <svg
                                className="animate-spin h-5 w-5 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                            </svg>
                            Finishing...
                        </>
                    ) : (
                        "Get Started"
                    )}
                </button>
            </div>
        </motion.div>
    );
}
