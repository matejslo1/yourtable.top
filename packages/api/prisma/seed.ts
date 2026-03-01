import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-restavracija' },
    update: {},
    create: {
      name: 'Demo Restavracija',
      slug: 'demo-restavracija',
      address: 'Prešernova ulica 1, 3000 Celje',
      phone: '+38631234567',
      email: 'info@demo-restavracija.si',
      timezone: 'Europe/Ljubljana',
      settings: {
        languages: ['sl', 'en'],
        currency: 'EUR',
        notificationsEnabled: true,
        bookingWidgetEnabled: true,
      },
    },
  });

  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.slug})`);

  // Create seating config
  await prisma.seatingConfig.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      holdTtlSeconds: 420,
      maxJoinTables: 3,
      autoConfirm: true,
      noShowTimeoutMin: 15,
      cancellationFeeHours: 24,
      scoringWeights: { waste: 1.0, join: 1.0, vip: 1.0, zone: 0.5 },
      defaultDurationMin: 90,
      maxPartySize: 12,
      minAdvanceHours: 2,
      maxAdvanceDays: 60,
    },
  });

  console.log('  ✓ Seating config');

  // Create operating hours (Mon-Sat open, Sun closed)
  for (let day = 0; day < 7; day++) {
    await prisma.operatingHours.upsert({
      where: { tenantId_dayOfWeek: { tenantId: tenant.id, dayOfWeek: day } },
      update: {},
      create: {
        tenantId: tenant.id,
        dayOfWeek: day,
        openTime: '11:00',
        closeTime: day === 4 || day === 5 ? '24:00' : '23:00', // Fri-Sat till midnight
        lastReservation: day === 4 || day === 5 ? '22:00' : '21:00',
        isClosed: day === 6, // Sunday closed
        slotDurationMin: 30,
      },
    });
  }

  console.log('  ✓ Operating hours (Mon-Sat)');

  // Create floor plans
  const mainFloor = await prisma.floorPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: tenant.id,
      name: 'Notranjost',
      layoutConfig: { width: 800, height: 600, background: '#1a1a2e' },
      sortOrder: 0,
    },
  });

  const terrace = await prisma.floorPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      tenantId: tenant.id,
      name: 'Terasa',
      layoutConfig: { width: 600, height: 400, background: '#1a1a2e' },
      sortOrder: 1,
    },
  });

  console.log(`  ✓ Floor plans: ${mainFloor.name}, ${terrace.name}`);

  // Create tables for main floor
  const mainTables = [
    { label: '1_1', minSeats: 2, maxSeats: 4, x: 100, y: 100, joinGroup: 'main-A', shape: 'square' as const },
    { label: '1_2', minSeats: 2, maxSeats: 4, x: 200, y: 100, joinGroup: 'main-A', shape: 'square' as const },
    { label: '2_1', minSeats: 2, maxSeats: 4, x: 400, y: 100, joinGroup: 'main-B', shape: 'square' as const },
    { label: '2_2', minSeats: 2, maxSeats: 4, x: 500, y: 100, joinGroup: 'main-B', shape: 'square' as const },
    { label: '3_1', minSeats: 2, maxSeats: 4, x: 100, y: 300, joinGroup: null, shape: 'round' as const },
    { label: '4', minSeats: 6, maxSeats: 8, x: 300, y: 400, joinGroup: null, shape: 'rectangle' as const, width: 160, height: 80 },
    { label: 'VIP1', minSeats: 4, maxSeats: 6, x: 600, y: 400, joinGroup: null, shape: 'round' as const, isVip: true },
  ];

  for (const t of mainTables) {
    await prisma.restaurantTable.upsert({
      where: { floorPlanId_label: { floorPlanId: mainFloor.id, label: t.label } },
      update: {},
      create: {
        floorPlanId: mainFloor.id,
        label: t.label,
        minSeats: t.minSeats,
        maxSeats: t.maxSeats,
        positionX: t.x,
        positionY: t.y,
        width: t.width || 80,
        height: t.height || 80,
        shape: t.shape,
        joinGroup: t.joinGroup,
        isCombinable: !!t.joinGroup,
        isVip: t.isVip || false,
      },
    });
  }

  // Create adjacency for joinable tables
  const table1_1 = await prisma.restaurantTable.findFirst({ where: { floorPlanId: mainFloor.id, label: '1_1' } });
  const table1_2 = await prisma.restaurantTable.findFirst({ where: { floorPlanId: mainFloor.id, label: '1_2' } });
  const table2_1 = await prisma.restaurantTable.findFirst({ where: { floorPlanId: mainFloor.id, label: '2_1' } });
  const table2_2 = await prisma.restaurantTable.findFirst({ where: { floorPlanId: mainFloor.id, label: '2_2' } });

  if (table1_1 && table1_2) {
    const [aId, bId] = [table1_1.id, table1_2.id].sort();
    await prisma.tableAdjacency.upsert({
      where: { tableAId_tableBId: { tableAId: aId, tableBId: bId } },
      update: {},
      create: { tableAId: aId, tableBId: bId, canJoin: true, joinMaxSeats: 8 },
    });
  }

  if (table2_1 && table2_2) {
    const [aId, bId] = [table2_1.id, table2_2.id].sort();
    await prisma.tableAdjacency.upsert({
      where: { tableAId_tableBId: { tableAId: aId, tableBId: bId } },
      update: {},
      create: { tableAId: aId, tableBId: bId, canJoin: true, joinMaxSeats: 8 },
    });
  }

  console.log(`  ✓ Tables: ${mainTables.length} tables + adjacency rules`);

  // Create terrace tables
  const terraceTables = [
    { label: 'T1', minSeats: 2, maxSeats: 4, x: 50, y: 50, shape: 'round' as const },
    { label: 'T2', minSeats: 2, maxSeats: 4, x: 200, y: 50, shape: 'round' as const },
    { label: 'T3', minSeats: 4, maxSeats: 6, x: 350, y: 50, shape: 'rectangle' as const, width: 120, height: 80 },
    { label: 'T4', minSeats: 2, maxSeats: 2, x: 50, y: 200, shape: 'round' as const },
    { label: 'T5', minSeats: 2, maxSeats: 2, x: 200, y: 200, shape: 'round' as const },
  ];

  for (const t of terraceTables) {
    await prisma.restaurantTable.upsert({
      where: { floorPlanId_label: { floorPlanId: terrace.id, label: t.label } },
      update: {},
      create: {
        floorPlanId: terrace.id,
        label: t.label,
        minSeats: t.minSeats,
        maxSeats: t.maxSeats,
        positionX: t.x,
        positionY: t.y,
        width: t.width || 80,
        height: t.height || 80,
        shape: t.shape,
        isCombinable: false,
      },
    });
  }

  console.log(`  ✓ Terrace tables: ${terraceTables.length}`);

  // Create sample guests
  const guests = [
    { name: 'Blaž Hočevar', email: 'blaz@email.com', phone: '+38641123456', tags: ['VIP', 'redna stranka'] },
    { name: 'Ana Novak', email: 'ana.novak@email.com', phone: '+38651234567', tags: [] },
    { name: 'Janez Kranjc', email: 'janez.k@email.com', phone: null, tags: ['alergija-gluten'] },
    { name: 'Maja Kovač', email: 'maja.kovac@email.com', phone: '+38670111222', tags: ['VIP'] },
  ];

  for (const g of guests) {
    await prisma.guest.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: g.email } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: g.name,
        email: g.email,
        phone: g.phone,
        tags: g.tags,
        visitCount: Math.floor(Math.random() * 10),
      },
    });
  }

  console.log(`  ✓ Guests: ${guests.length} sample guests`);

  console.log('\n✅ Seeding complete!');
  console.log(`\n📋 Tenant slug: ${tenant.slug}`);
  console.log('   Use this to test the booking widget API\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
