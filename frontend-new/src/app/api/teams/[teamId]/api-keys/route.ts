import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateApiKey, listTeamApiKeys, revokeApiKey } from "@/lib/rate-limiter";

/**
 * GET /api/teams/[teamId]/api-keys - List all API keys for a team
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
    const teamMembership = userTeams.find(t => t.id === teamId);

    if (!teamMembership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiKeys = await listTeamApiKeys(teamId);

    // Mask the actual keys (only show last 4 chars)
    const maskedKeys = apiKeys.map(k => ({
        ...k,
        keyPreview: `sk_jwtl_...${k.id.slice(-4)}`,
    }));

    return NextResponse.json({ apiKeys: maskedKeys });
}

/**
 * POST /api/teams/[teamId]/api-keys - Create a new API key for a team
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
    const body = await req.json();
    const { name } = body;

    if (!name) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // Verify user is OWNER or ADMIN of the team
    const userTeams = session.user.teams || [];
    const teamMembership = userTeams.find(t => t.id === teamId);

    if (!teamMembership || teamMembership.role === "MEMBER") {
        return NextResponse.json({ error: "Only Owners and Admins can create API keys" }, { status: 403 });
    }

    const key = await generateApiKey(teamId, session.user.id, name);

    return NextResponse.json({
        apiKey: key,
        message: "Save this key now - it won't be shown again!"
    }, { status: 201 });
}

/**
 * DELETE /api/teams/[teamId]/api-keys - Revoke an API key
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get("keyId");

    if (!keyId) {
        return NextResponse.json({ error: "keyId is required" }, { status: 400 });
    }

    // Verify user is OWNER or ADMIN of the team
    const userTeams = session.user.teams || [];
    const teamMembership = userTeams.find(t => t.id === teamId);

    if (!teamMembership || teamMembership.role === "MEMBER") {
        return NextResponse.json({ error: "Only Owners and Admins can revoke API keys" }, { status: 403 });
    }

    const success = await revokeApiKey(keyId, session.user.id);

    if (!success) {
        return NextResponse.json({ error: "API key not found or you don't have permission" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
