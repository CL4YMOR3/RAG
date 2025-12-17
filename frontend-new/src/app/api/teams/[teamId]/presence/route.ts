import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTeamPresence, updatePresence } from "@/lib/rate-limiter";

/**
 * GET /api/teams/[teamId]/presence - Get online users in a team
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    // Verify user is a member of the team
    const userTeams = session.user.teams || [];
    const isMember = userTeams.some(t => t.id === teamId);

    if (!isMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const onlineUserIds = await getTeamPresence(teamId);

    return NextResponse.json({
        online: onlineUserIds,
        count: onlineUserIds.length
    });
}

/**
 * POST /api/teams/[teamId]/presence - Update own presence (heartbeat)
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    // Verify user is a member of the team
    const userTeams = session.user.teams || [];
    const isMember = userTeams.some(t => t.id === teamId);

    if (!isMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await updatePresence(session.user.id, teamId);

    return NextResponse.json({ success: true });
}
