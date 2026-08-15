import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LAT0 = 12.9;
const LAT1 = 13.04;
const LNG0 = 77.53;
const LNG1 = 77.69;

async function main() {
  const engineers = await prisma.user.findMany({ where: { role: 'ENGINEER' } });
  console.log(`Found ${engineers.length} engineers to update.`);

  for (let i = 0; i < engineers.length; i++) {
    const e = engineers[i];
    const lat = LAT0 + Math.random() * (LAT1 - LAT0);
    const lng = LNG0 + Math.random() * (LNG1 - LNG0);
    const employeeCode = `ENG-${1000 + i}`;
    
    await prisma.user.update({
      where: { id: e.id },
      data: { latitude: lat, longitude: lng, employeeCode }
    });
  }
  
  // Let's also ensure some complaints have coordinates so they show on the map!
  const complaints = await prisma.complaint.findMany({ where: { latitude: null } });
  for (let i = 0; i < complaints.length; i++) {
    const c = complaints[i];
    const lat = LAT0 + Math.random() * (LAT1 - LAT0);
    const lng = LNG0 + Math.random() * (LNG1 - LNG0);
    
    await prisma.complaint.update({
      where: { id: c.id },
      data: { latitude: lat, longitude: lng, severity: c.severity || Math.floor(Math.random() * 100) }
    });
  }
  
  console.log('GIS Seed Complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
