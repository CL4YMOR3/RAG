import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding database...");

    // Create default teams with auto-join domains
    const teams = await Promise.all([
        prisma.team.upsert({
            where: { slug: "head-office" },
            update: {},
            create: {
                name: "Head Office",
                slug: "head-office",
                domain: "jwtl.in", // Auto-join for @jwtl.in emails
            },
        }),
        prisma.team.upsert({
            where: { slug: "engineering" },
            update: {},
            create: {
                name: "Engineering",
                slug: "engineering",
            },
        }),
        prisma.team.upsert({
            where: { slug: "finance" },
            update: {},
            create: {
                name: "Finance",
                slug: "finance",
            },
        }),
        prisma.team.upsert({
            where: { slug: "hr" },
            update: {},
            create: {
                name: "HR",
                slug: "hr",
            },
        }),
        prisma.team.upsert({
            where: { slug: "marketing" },
            update: {},
            create: {
                name: "Marketing",
                slug: "marketing",
            },
        }),
    ]);

    console.log(`✅ Created ${teams.length} teams`);
    teams.forEach((team) => {
        console.log(`   - ${team.name} (${team.slug})${team.domain ? ` [auto-join: @${team.domain}]` : ""}`);
    });

    console.log("\n🎉 Seeding complete!");
    console.log("\n📝 Next steps:");
    console.log("   1. Set up Google OAuth credentials");
    console.log("   2. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env");
    console.log("   3. Run `npm run dev` and sign in with your @jwtl.in email");
    console.log("   4. After signing in, run this SQL to make yourself admin:");
    console.log('      UPDATE "User" SET "isAdmin" = true WHERE email = \'your-email@jwtl.in\';');
}

main()
    .catch((e) => {
        console.error("❌ Seeding failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
