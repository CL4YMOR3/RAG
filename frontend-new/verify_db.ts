import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    try {
        const userCount = await prisma.user.count()
        const teamCount = await prisma.team.count()
        console.log(`[VERIFICATION] Users: ${userCount}, Teams: ${teamCount}`)
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
