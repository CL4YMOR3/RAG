import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Return list of teams (id, name, slug) for selection
        const teams = await prisma.team.findMany({
            select: {
                id: true,
                name: true,
                slug: true,
            },
            orderBy: {
                name: "asc",
            },
        });

        return NextResponse.json(teams);
    } catch (error) {
        console.error("[TEAMS_LIST]", error);
        return NextResponse.json(
            { error: "Failed to fetch teams" },
            { status: 500 }
        );
    }
}
