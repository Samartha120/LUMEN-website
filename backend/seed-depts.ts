import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const depts = [
    { name: 'Public Works' },
    { name: 'Electrical' },
    { name: 'Water Supply' }
  ];

  for (const d of depts) {
    await prisma.department.upsert({
      where: { name: d.name },
      update: {},
      create: { name: d.name }
    });
  }
  
  const publicWorks = await prisma.department.findUnique({ where: { name: 'Public Works' }});
  const electrical = await prisma.department.findUnique({ where: { name: 'Electrical' }});
  const waterSupply = await prisma.department.findUnique({ where: { name: 'Water Supply' }});

  if (!publicWorks || !electrical || !waterSupply) throw new Error("Departments not created");

  const engineers = await prisma.user.findMany({ where: { role: 'ENGINEER' } });
  console.log(`Assigning ${engineers.length} engineers to departments...`);

  const deps = [publicWorks.id, electrical.id, waterSupply.id];
  const defaultSkills = [
    'Potholes, Road Cracks, Paving',
    'Streetlights, Transformers, Cables',
    'Pipe Leaks, Flooding, Sewage'
  ];

  for (let i = 0; i < engineers.length; i++) {
    const e = engineers[i];
    const deptIdx = i % 3;
    
    // Mix statuses
    let status = 'AVAILABLE';
    if (i % 3 === 1) status = 'ON_TASK';
    else if (i % 3 === 2) status = 'OFF_DUTY';

    await prisma.user.update({
      where: { id: e.id },
      data: {
        departmentId: deps[deptIdx],
        skills: defaultSkills[deptIdx],
        status: status,
        resolvedJobs: Math.floor(Math.random() * 50)
      }
    });
  }
  
  console.log('Department Seed Complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
