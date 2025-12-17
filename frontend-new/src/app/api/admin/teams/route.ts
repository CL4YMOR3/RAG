import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/teams - List all teams (admin only)
 */
export async function GET(req: NextRequest) {
    const session = await auth();

    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const [teams, total] = await Promise.all([
        prisma.team.findMany({
            select: {
                id: true,
                name: true,
                slug: true,
                domain: true,
                createdAt: true,
                _count: { select: { members: true } },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.team.count(),
    ]);

    return NextResponse.json({
        teams: teams.map(t => ({
            ...t,
            memberCount: t._count.members,
            _count: undefined,
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
}

/**
 * POST /api/admin/teams - Create team (admin only)
 */
export async function POST(req: NextRequest) {
    const session = await auth();

    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { name, domain } = body;

    if (!name) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    // Check if slug already exists
    const existing = await prisma.team.findUnique({ where: { slug } });
    if (existing) {
        return NextResponse.json({ error: "Team with this name already exists" }, { status: 409 });
    }

    const team = await prisma.team.create({
        data: {
            name,
            slug,
            domain: domain || null,
            members: {
                create: {
                    userId: session!.user!.id,
                    role: "OWNER",
                },
            },
        },
    });

    return NextResponse.json({ team }, { status: 201 });
}

/**
 * PATCH /api/admin/teams - Update team (admin only)
 */
export async function PATCH(req: NextRequest) {
    const session = await auth();

    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { teamId, name, domain } = body;

    if (!teamId) {
        return NextResponse.json({ error: "teamId is required" }, { status: 400 });
    }

    const updateData: { name?: string; slug?: string; domain?: string | null } = {};

    if (name) {
        updateData.name = name;
        updateData.slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    }

    if (domain !== undefined) {
        updateData.domain = domain || null;
    }

    const team = await prisma.team.update({
        where: { id: teamId },
        data: updateData,
    });

    return NextResponse.json({ team });
}

/**
 * DELETE /api/admin/teams - Delete team (admin only)
 * Also triggers cleanup of associated Qdrant vector collection
 */
export async function DELETE(req: NextRequest) {
    const session = await auth();

    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
        return NextResponse.json({ error: "teamId is required" }, { status: 400 });
    }

    // Get team slug before deletion (needed for Qdrant collection name)
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { slug: true },
    });

    if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Delete from Prisma first
    await prisma.team.delete({ where: { id: teamId } });

    // Cleanup: Delete the Qdrant vector collection in the backend
    // This prevents "zombie data" from accumulating
    try {
        const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
        const response = await fetch(`${backendUrl}/teams/${team.slug}`, {
            method: "DELETE",
        });

        if (response.ok) {
            console.log(`[CLEANUP] Deleted Qdrant collection for team: ${team.slug}`);
        } else {
            // Log warning but don't fail the deletion
            console.warn(`[CLEANUP] Failed to delete Qdrant collection: ${team.slug}`);
        }
    } catch (error) {
        // Log warning but don't fail the deletion
        console.warn(`[CLEANUP] Error connecting to backend for collection cleanup: ${error}`);
    }

    return NextResponse.json({ success: true });
}

