const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const count = await prisma.tenants.count();
    console.log('Tenants count:', count);
    await prisma.$disconnect();
    console.log('Connection successful');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
test();