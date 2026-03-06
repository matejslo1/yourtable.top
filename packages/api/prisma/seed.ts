import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Create the Tenant (The Restaurant)
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'my-restaurant' },
    update: {},
    create: {
      name: 'My Restaurant',
      slug: 'my-restaurant',
    },
  });

  // 2. Create the User linked to Supabase
  // REPLACE 'YOUR_SUPABASE_UID_HERE' with the ID you copied from Supabase
  const user = await prisma.user.upsert({
    where: { email: 'admin@restavracija.si' }, // Use your login email
    update: {},
    create: {
      email: 'admin@restavracija.si',
      role: 'admin',
      tenantId: tenant.id,
      supabaseUserId: '7e0bba47-e328-412f-a8e9-d87f70bfce04', 
    },
  });

  console.log('✅ Seed successful:', { tenantId: tenant.id, userId: user.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });