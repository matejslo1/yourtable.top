const fs = require('fs');
const path = require('path');

const baseDir = './server_patch';

const files = [
  {
    path: 'packages/api/prisma/schema.prisma',
    content: `generator client {\n  provider = "prisma-client-js"\n}\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\nmodel Tenant {\n  id           String        @id @default(cuid())\n  name         String\n  slug         String        @unique\n  users        User[]\n  reservations Reservation[]\n  floorPlans   FloorPlan[]\n  tables       Table[]\n}\n\nmodel User {\n  id             String   @id @default(cuid())\n  email          String   @unique\n  role           String   @default("staff")\n  supabaseUserId String   @unique\n  tenantId       String\n  tenant         Tenant   @relation(fields: [tenantId], references: [id])\n}\n\nmodel FloorPlan {\n  id        String   @id @default(cuid())\n  name      String\n  tenantId  String\n  tenant    Tenant   @relation(fields: [tenantId], references: [id])\n  tables    Table[]\n}\n\nmodel Table {\n  id           String   @id @default(cuid())\n  label        String\n  minCapacity  Int\n  maxCapacity  Int\n  shape        String\n  x            Float\n  y            Float\n  floorPlanId  String\n  floorPlan    FloorPlan @relation(fields: [floorPlanId], references: [id])\n  tenantId     String\n  tenant       Tenant    @relation(fields: [tenantId], references: [id])\n  reservations ReservationTable[]\n}\n\nmodel Guest {\n  id           String        @id @default(cuid())\n  name         String\n  reservations Reservation[]\n}\n\nmodel Reservation {\n  id          String   @id @default(cuid())\n  date        DateTime\n  time        String\n  partySize   Int\n  status      String   @default("CONFIRMED")\n  guestId     String\n  guest       Guest    @relation(fields: [guestId], references: [id])\n  tenantId    String\n  tenant      Tenant   @relation(fields: [tenantId], references: [id])\n  tables      ReservationTable[]\n}\n\nmodel ReservationTable {\n  id            String      @id @default(cuid())\n  reservationId String\n  reservation   Reservation @relation(fields: [reservationId], references: [id])\n  tableId       String\n  table         Table       @relation(fields: [tableId], references: [id])\n  @@unique([reservationId, tableId])\n}`
  },
  {
    path: 'packages/api/src/routes/floorPlans.ts',
    content: `import { Router } from 'express';\nimport prisma from '../lib/prisma.js';\nimport { requireAuth } from '../middleware/auth.js';\n\nconst router = Router();\nrouter.use(requireAuth);\n\nrouter.get('/', async (req: any, res) => {\n  const data = await prisma.floorPlan.findMany({ where: { tenantId: req.user.tenantId }, include: { tables: true } });\n  res.json({ data });\n});\n\nrouter.put('/:id/tables/batch', async (req: any, res) => {\n  const { tables } = req.body;\n  const updates = tables.map((t: any) => prisma.table.updateMany({ where: { id: t.id, tenantId: req.user.tenantId }, data: { x: t.x, y: t.y } }));\n  await prisma.$transaction(updates);\n  res.json({ success: true });\n});\n\nexport default router;`
  }
];

// Execution logic
files.forEach(file => {
  const filePath = path.join(baseDir, file.path);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, file.content);
  console.log(`Created: ${filePath}`);
});

console.log('\n🚀 Patch files generated in ./server_patch folder!');