import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import AdminDashboard from "./AdminDashboard";

export default async function AdminPage() {
    const session = await auth();

    // Redirect to login if not authenticated
    if (!session?.user) {
        redirect("/login");
    }

    // Check if user is super admin
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
        redirect("/");
    }

    // Fetch admin dashboard data
    const [userCount, teamCount, recentLogs] = await Promise.all([
        prisma.user.count(),
        prisma.team.count(),
        prisma.auditLog.findMany({
            take: 20,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: { name: true, email: true },
                },
            },
        }),
    ]);

    return (
        <AdminDashboard
            stats={{
                users: userCount,
                teams: teamCount,
            }}
            recentLogs={recentLogs}
        />
    );
}
