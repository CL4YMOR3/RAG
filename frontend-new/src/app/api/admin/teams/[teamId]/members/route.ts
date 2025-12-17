import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/teams/[teamId]/members - Get team members (admin only)
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const session = await auth();

    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { teamId } = await params;

    const members = await prisma.membership.findMany({
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
            { role: "asc" }, // OWNER first
            { createdAt: "asc" },
        ],
    });

    return NextResponse.json({
        members: members.map(m => ({
            id: m.id,
            role: m.role,
            joinedAt: m.createdAt,
            user: m.user,
        })),
    });
}

/**
 * POST /api/admin/teams/[teamId]/members - Add member to team (admin only)
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const session = await auth();

    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { teamId } = await params;
    const body = await req.json();
    const { email, role = "MEMBER" } = body;

    if (!email) {
        return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already a member
    const existing = await prisma.membership.findUnique({
        where: { userId_teamId: { userId: user.id, teamId } },
    });
    if (existing) {
        return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }

    const membership = await prisma.membership.create({
        data: {
            userId: user.id,
            teamId,
            role: role as "OWNER" | "ADMIN" | "MEMBER",
        },
        include: {
            user: { select: { id: true, name: true, email: true, image: true } },
        },
    });

    return NextResponse.json({
        member: {
            id: membership.id,
            role: membership.role,
            joinedAt: membership.createdAt,
            user: membership.user,
        },
    }, { status: 201 });
}

/**
 * PATCH /api/admin/teams/[teamId]/members - Update member role (admin only)
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const session = await auth();

    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { teamId } = await params;
    const body = await req.json();
    const { userId, role } = body;

    if (!userId || !role) {
        return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
    }

    const membership = await prisma.membership.update({
        where: { userId_teamId: { userId, teamId } },
        data: { role: role as "OWNER" | "ADMIN" | "MEMBER" },
    });

    return NextResponse.json({ membership });
}

/**
 * DELETE /api/admin/teams/[teamId]/members - Remove member from team (admin only)
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const session = await auth();

    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { teamId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    await prisma.membership.delete({
        where: { userId_teamId: { userId, teamId } },
    });

    return NextResponse.json({ success: true });
}
