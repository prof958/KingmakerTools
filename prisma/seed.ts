/**
 * Database seed script
 * Run with: npx tsx prisma/seed.ts
 *
 * Seeds the catalog items table with common PF2e items.
 * Also creates the default campaign and treasury wallet.
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { SEED_ITEMS } from "../src/lib/pf2e/seed-items";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("🌱 Seeding database...");

  // 1. Ensure a campaign exists
  let campaign = await prisma.campaign.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!campaign) {
    campaign = await prisma.campaign.create({
      data: { name: "Kingmaker" },
    });
    console.log(`  ✅ Created campaign: ${campaign.name}`);

    // Create party treasury (wallet with no character)
    await prisma.wallet.create({
      data: {
        campaignId: campaign.id,
        cp: 0,
        sp: 0,
        gp: 0,
        pp: 0,
      },
    });
    console.log("  ✅ Created party treasury wallet");
  } else {
    console.log(`  ℹ️  Campaign already exists: ${campaign.name}`);
  }

  // 2. Seed item catalog (upsert by name to be idempotent)
  let created = 0;
  let skipped = 0;

  for (const item of SEED_ITEMS) {
    const existing = await prisma.item.findFirst({
      where: { name: item.name },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.item.create({
      data: {
        name: item.name,
        bulkValue: item.bulkValue,
        isBulkLight: item.isBulkLight,
        level: item.level,
        rarity: item.rarity,
        traits: item.traits,
        category: item.category,
        valueCp: item.valueCp,
        isInvestable: item.isInvestable,
        containerCapacity: item.containerCapacity,
        containerBulkReduction: item.containerBulkReduction,
        description: item.description,
      },
    });
    created++;
  }

  console.log(`  ✅ Items: ${created} created, ${skipped} already existed`);
  console.log("🌱 Seed complete!");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
