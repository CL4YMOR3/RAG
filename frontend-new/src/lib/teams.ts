import prisma from "@/lib/prisma";

/**
 * Get all teams the user is a member of.
 */
export async function getUserTeams(userId: string) {
    const memberships = await prisma.membership.findMany({
        where: { userId },
        include: {
            team: true,
        },
        orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
        id: m.team.id,
        name: m.team.name,
        slug: m.team.slug,
        role: m.role,
        domain: m.team.domain,
    }));
}

/**
 * Create a new team and add the creator as OWNER.
 */
export async function createTeam(
    userId: string,
    name: string,
    domain?: string
) {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const team = await prisma.team.create({
        data: {
            name,
            slug,
            domain,
            members: {
                create: {
                    userId,
                    role: "OWNER",
                },
            },
        },
        include: {
            members: true,
        },
    });

    return team;
}

/**
 * Add a user to a team.
 */
export async function addUserToTeam(
    userId: string,
    teamId: string,
    role: "ADMIN" | "MEMBER" = "MEMBER"
) {
    return prisma.membership.create({
        data: {
            userId,
            teamId,
            role,
        },
    });
}

/**
 * Remove a user from a team.
 */
export async function removeUserFromTeam(userId: string, teamId: string) {
    return prisma.membership.delete({
        where: {
            userId_teamId: {
                userId,
                teamId,
            },
        },
    });
}

/**
 * Update a user's role in a team.
 */
export async function updateMemberRole(
    userId: string,
    teamId: string,
    role: "OWNER" | "ADMIN" | "MEMBER"
) {
    return prisma.membership.update({
        where: {
            userId_teamId: {
                userId,
                teamId,
            },
        },
        data: { role },
    });
}

/**
 * Get all members of a team.
 */
export async function getTeamMembers(teamId: string) {
    const memberships = await prisma.membership.findMany({
        where: { teamId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                },
            },
        },
        orderBy: [
            { role: "asc" }, // OWNER first, then ADMIN, then MEMBER
            { createdAt: "asc" },
        ],
    });

    return memberships.map((m) => ({
        ...m.user,
        role: m.role,
        joinedAt: m.createdAt,
    }));
}

/**
 * Check if a user has a specific permission in a team.
 */
export async function hasTeamPermission(
    userId: string,
    teamId: string,
    requiredRole: "OWNER" | "ADMIN" | "MEMBER"
): Promise<boolean> {
    const membership = await prisma.membership.findUnique({
        where: {
            userId_teamId: {
                userId,
                teamId,
            },
        },
    });

    if (!membership) return false;

    const roleHierarchy = { OWNER: 3, ADMIN: 2, MEMBER: 1 };
    return roleHierarchy[membership.role] >= roleHierarchy[requiredRole];
}
