import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";

// Domains allowed to sign in
const ALLOWED_DOMAINS = ["jwtl.in", "jameswarrentea.com"];

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: PrismaAdapter(prisma),
    // Use JWT strategy for lower DB load (Silicon Valley Standard)
    session: { strategy: "jwt" },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
                params: {
                    prompt: "select_account",
                },
            },
        }),
    ],
    pages: {
        signIn: "/login",
        error: "/auth/error",
    },
    callbacks: {
        /**
         * Sign-in Gate: HARD REJECT non-JWTL emails
         */
        async signIn({ account, profile }) {
            if (account?.provider === "google" && profile?.email) {
                const domain = profile.email.split("@")[1];

                // Block any non-JWTL domain
                if (!ALLOWED_DOMAINS.includes(domain)) {
                    console.log(`[AUTH] Blocked sign-in attempt from: ${profile.email}`);
                    return false;
                }

                console.log(`[AUTH] Allowed sign-in from: ${profile.email}`);
                return true;
            }
            return false;
        },

        /**
         * JWT Callback: Encode user data into the token
         */
        async jwt({ token, user, trigger }) {
            // On initial sign-in, user object is available
            if (user) {
                token.id = user.id;

                // Check if this is the FIRST user ever
                const userCount = await prisma.user.count();
                if (userCount === 1) {
                    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
                    if (dbUser && !dbUser.isAdmin) {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { isAdmin: true },
                        });
                        token.isAdmin = true;
                        console.log(`[AUTH] First user made Admin (JWT): ${user.email}`);
                    }
                }
            }

            // Refresh user data on every token refresh or sign-in
            if (token.id && (trigger === "signIn" || trigger === "update")) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    select: { isAdmin: true, onboardingComplete: true },
                });
                token.isAdmin = dbUser?.isAdmin ?? false;
                token.onboardingComplete = dbUser?.onboardingComplete ?? false;

                // Fetch team memberships
                const memberships = await prisma.membership.findMany({
                    where: { userId: token.id as string },
                    include: { team: true },
                });
                token.teams = memberships.map((m: { team: { id: string; name: string; slug: string }; role: string }) => ({
                    id: m.team.id,
                    name: m.team.name,
                    slug: m.team.slug,
                    role: m.role,
                }));
            }

            return token;
        },

        /**
         * Session Enhancement: Read from JWT token (not DB on every request)
         */
        async session({ session, token }) {
            if (session.user && token) {
                session.user.id = token.id as string;
                session.user.isAdmin = token.isAdmin as boolean ?? false;
                session.user.onboardingComplete = token.onboardingComplete as boolean ?? false;
                session.user.teams = (token.teams as Array<{
                    id: string;
                    name: string;
                    slug: string;
                    role: "OWNER" | "ADMIN" | "MEMBER";
                }>) ?? [];
            }
            return session;
        },
    },
    events: {
        /**
         * Magic Auto-Join: Match new user's domain to existing team
         */
        async createUser({ user }) {
            if (user.email && user.id) {
                const domain = user.email.split("@")[1];

                // Find team with matching domain
                const team = await prisma.team.findFirst({
                    where: { domain },
                });

                if (team) {
                    // Auto-add to team as MEMBER
                    await prisma.membership.create({
                        data: {
                            userId: user.id,
                            teamId: team.id,
                            role: "MEMBER",
                        },
                    });
                    console.log(`[AUTH] Auto-joined ${user.email} to team: ${team.name}`);
                }

                // Log the sign-up
                await prisma.auditLog.create({
                    data: {
                        userId: user.id,
                        action: "SIGNUP",
                        resource: "user",
                        details: { email: user.email, autoJoinedTeam: team?.name ?? null },
                    },
                });
            }
        },
    },
});

// Type augmentation for session
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            email: string;
            name?: string | null;
            image?: string | null;
            isAdmin: boolean;
            onboardingComplete: boolean;
            teams: Array<{
                id: string;
                name: string;
                slug: string;
                role: "OWNER" | "ADMIN" | "MEMBER";
            }>;
        };
    }
}
