import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = bcrypt.hashSync('lumen123', 10);
  
  // Administrator
  await prisma.user.upsert({
    where: { email: 'admin@lumen.gov' },
    update: {},
    create: {
      email: 'admin@lumen.gov',
      passwordHash,
      fullName: 'System Admin',
      role: 'ADMINISTRATOR',
    },
  });

  // Supervisor
  await prisma.user.upsert({
    where: { email: 'supervisor@lumen.gov' },
    update: {},
    create: {
      email: 'supervisor@lumen.gov',
      passwordHash,
      fullName: 'District Supervisor',
      role: 'SUPERVISOR',
    },
  });

  // Engineer
  await prisma.user.upsert({
    where: { email: 'engineer@lumen.gov' },
    update: {},
    create: {
      email: 'engineer@lumen.gov',
      passwordHash,
      fullName: 'Field Engineer',
      role: 'ENGINEER',
    },
  });

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
