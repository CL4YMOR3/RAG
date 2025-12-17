import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type AuditAction =
    | "SIGNUP"
    | "LOGIN"
    | "LOGOUT"
    | "QUERY"
    | "UPLOAD"
    | "DELETE"
    | "DOWNLOAD"
    | "CREATE_TEAM"
    | "JOIN_TEAM"
    | "LEAVE_TEAM"
    | "INVITE_MEMBER"
    | "REMOVE_MEMBER"
    | "CREATE_API_KEY"
    | "REVOKE_API_KEY";

export type AuditResource =
    | "user"
    | "session"
    | "document"
    | "team"
    | "membership"
    | "api_key";

interface AuditLogParams {
    userId: string;
    action: AuditAction;
    resource: AuditResource;
    details?: Record<string, unknown>;
}

/**
 * Log an action to the audit trail.
 * This is used for compliance and security tracking.
 */
export async function logAudit({
    userId,
    action,
    resource,
    details,
}: AuditLogParams): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                action,
                resource,
                details: details as Prisma.InputJsonValue ?? undefined,
            },
        });
        console.log(`[AUDIT] ${action} on ${resource} by ${userId}`);
    } catch (error) {
        // Don't throw - audit logging should never break the main flow
        console.error("[AUDIT] Failed to log audit event:", error);
    }
}

/**
 * Get audit logs for a user with pagination.
 */
export async function getUserAuditLogs(
    userId: string,
    limit = 50,
    offset = 0
) {
    return prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
    });
}

/**
 * Get all audit logs (admin only) with pagination.
 */
export async function getAllAuditLogs(
    limit = 100,
    offset = 0,
    filters?: {
        action?: AuditAction;
        resource?: AuditResource;
        userId?: string;
    }
) {
    return prisma.auditLog.findMany({
        where: filters,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });
}
