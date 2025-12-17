import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Only Admins can create teams
        if (!session.user.isAdmin) {
            return NextResponse.json(
                { error: "Only admins can create new teams" },
                { status: 403 }
            );
        }

        const body = await req.json();
        const { name, slug } = body;

        if (!name || !slug) {
            return NextResponse.json(
                { error: "Team name and slug are required" },
                { status: 400 }
            );
        }

        // Check if slug is already taken
        const existingTeam = await prisma.team.findUnique({
            where: { slug },
        });

        if (existingTeam) {
            return NextResponse.json(
                { error: "Team slug is already taken" },
                { status: 409 }
            );
        }

        // Get user's email domain for auto-join setup
        const userEmail = session.user.email;
        const domain = userEmail?.split("@")[1] || null;

        // Create team and add user as OWNER
        const team = await prisma.team.create({
            data: {
                name,
                slug,
                domain, // Allow others from same domain to auto-join
                members: {
                    create: {
                        userId: session.user.id,
                        role: "OWNER",
                    },
                },
            },
            include: {
                members: true,
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "CREATE",
                resource: "team",
                details: { teamId: team.id, teamName: name, teamSlug: slug },
            },
        });

        return NextResponse.json({
            id: team.id,
            name: team.name,
            slug: team.slug,
        });
    } catch (error) {
        console.error("[TEAMS_CREATE]", error);
        return NextResponse.json(
            { error: "Failed to create team" },
            { status: 500 }
        );
    }
}
