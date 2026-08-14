import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
const prisma = new PrismaClient();
async function main() {
    console.log('Start seeding...');
    try {
        const sqlString = readFileSync(join(process.cwd(), 'prisma', 'seed.sql'), 'utf8');
        await prisma.$executeRawUnsafe(sqlString);
        console.log('Seeding finished.');
    }
    catch (error) {
        console.error('Error during seeding:', error);
        process.exit(1);
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map