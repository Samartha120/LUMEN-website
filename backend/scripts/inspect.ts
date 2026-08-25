import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function run() {
  const complaint = await db.complaint.findUnique({
    where: { ref: "CMP-10258" },
    include: { images: true }
  });
  console.log(JSON.stringify(complaint, null, 2));
}

run().finally(() => db.$disconnect());
