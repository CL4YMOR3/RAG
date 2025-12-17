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

        const body = await req.json();
        const { name, teamId } = body;

        // If teamId is provided, add user to that team
        if (teamId) {
            // Check if user is already a member (to prevent duplicates)
            const existingMembership = await prisma.membership.findUnique({
                where: {
                    userId_teamId: {
                        userId: session.user.id,
                        teamId: teamId
                    }
                }
            });

            if (!existingMembership) {
                await prisma.membership.create({
                    data: {
                        userId: session.user.id,
                        teamId: teamId,
                        role: "MEMBER" // Default role for manual join
                    }
                });
            }
        }

        // Update user record
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                ...(name && { name }),
                onboardingComplete: true,
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "ONBOARDING_COMPLETE",
                resource: "user",
                details: { name: name || null },
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[ONBOARDING_COMPLETE]", error);
        return NextResponse.json(
            { error: "Failed to complete onboarding" },
            { status: 500 }
        );
    }
}
