import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Ustvari Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'my-restaurant' },
    update: {},
    create: {
      name: 'My Restaurant',
      slug: 'my-restaurant',
      address: 'Slovenska cesta 1, Ljubljana',
      phone: '+386 1 234 5678',
      email: 'info@restavracija.si',
      timezone: 'Europe/Ljubljana',
    },
  });

  // 2. Ustvari User
  // ⚠️  Zamenjaj supabaseUserId z resničnim UID iz Supabase → Authentication → Users
  const user = await prisma.user.upsert({
    where: { supabaseUserId: '7e0bba47-e328-412f-a8e9-d87f70bfce04' },
    update: {},
    create: {
      email: 'admin@restavracija.si',
      name: 'Admin',
      role: 'owner',
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