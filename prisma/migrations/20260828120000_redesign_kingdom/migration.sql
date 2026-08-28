/*
  Warning: Phase 5 (Kingdom) schema redesign.

  The original Phase-0 Kingdom models were placeholder scaffolding and never
  carried real data. This migration drops them and rebuilds the Kingdom
  subsystem around the PF2e Kingmaker rules (founding choices, skills, feats,
  ruin tracks, fame, size) with support for the Vance & Kerenshara ruleset.

  Dropped:  blocks, lots, structures, and the old shapes of kingdoms, hexes,
            settlements, leadership_roles, kingdom_turns.
  Added:    kingdom_skills, kingdom_feats, kingdom_structures.
  Changed:  "HexState" enum values; new "KingdomRuleset" and "FameType" enums.
*/

-- DropForeignKey
ALTER TABLE "hexes" DROP CONSTRAINT IF EXISTS "hexes_kingdom_id_fkey";
ALTER TABLE "settlements" DROP CONSTRAINT IF EXISTS "settlements_kingdom_id_fkey";
ALTER TABLE "settlements" DROP CONSTRAINT IF EXISTS "settlements_hex_id_fkey";
ALTER TABLE "blocks" DROP CONSTRAINT IF EXISTS "blocks_settlement_id_fkey";
ALTER TABLE "lots" DROP CONSTRAINT IF EXISTS "lots_block_id_fkey";
ALTER TABLE "lots" DROP CONSTRAINT IF EXISTS "lots_structure_id_fkey";
ALTER TABLE "leadership_roles" DROP CONSTRAINT IF EXISTS "leadership_roles_kingdom_id_fkey";
ALTER TABLE "leadership_roles" DROP CONSTRAINT IF EXISTS "leadership_roles_character_id_fkey";
ALTER TABLE "kingdom_turns" DROP CONSTRAINT IF EXISTS "kingdom_turns_kingdom_id_fkey";
ALTER TABLE "kingdoms" DROP CONSTRAINT IF EXISTS "kingdoms_campaign_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "lots";
DROP TABLE IF EXISTS "blocks";
DROP TABLE IF EXISTS "structures";
DROP TABLE IF EXISTS "kingdom_turns";
DROP TABLE IF EXISTS "leadership_roles";
DROP TABLE IF EXISTS "settlements";
DROP TABLE IF EXISTS "hexes";
DROP TABLE IF EXISTS "kingdoms";

-- DropEnum
DROP TYPE IF EXISTS "HexState";

-- CreateEnum
CREATE TYPE "KingdomRuleset" AS ENUM ('RAW', 'VK');

-- CreateEnum
CREATE TYPE "FameType" AS ENUM ('FAME', 'INFAMY');

-- CreateEnum
CREATE TYPE "HexState" AS ENUM ('UNCLAIMED', 'RECONNOITERED', 'CLAIMED');

-- CreateTable
CREATE TABLE "kingdoms" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Unnamed Kingdom',
    "ruleset" "KingdomRuleset" NOT NULL DEFAULT 'VK',
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "size" INTEGER NOT NULL DEFAULT 1,
    "fame" INTEGER NOT NULL DEFAULT 1,
    "fameType" "FameType" NOT NULL DEFAULT 'FAME',
    "fame_max" INTEGER NOT NULL DEFAULT 3,
    "at_war" BOOLEAN NOT NULL DEFAULT false,
    "charter" TEXT,
    "charter_free_boost" TEXT,
    "heartland" TEXT,
    "government" TEXT,
    "government_free_boost" TEXT,
    "finalize_boosts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "culture" INTEGER NOT NULL DEFAULT 10,
    "economy" INTEGER NOT NULL DEFAULT 10,
    "loyalty" INTEGER NOT NULL DEFAULT 10,
    "stability" INTEGER NOT NULL DEFAULT 10,
    "unrest" INTEGER NOT NULL DEFAULT 0,
    "corruption_points" INTEGER NOT NULL DEFAULT 0,
    "corruption_threshold" INTEGER NOT NULL DEFAULT 10,
    "corruption_penalty" INTEGER NOT NULL DEFAULT 0,
    "crime_points" INTEGER NOT NULL DEFAULT 0,
    "crime_threshold" INTEGER NOT NULL DEFAULT 10,
    "crime_penalty" INTEGER NOT NULL DEFAULT 0,
    "decay_points" INTEGER NOT NULL DEFAULT 0,
    "decay_threshold" INTEGER NOT NULL DEFAULT 10,
    "decay_penalty" INTEGER NOT NULL DEFAULT 0,
    "strife_points" INTEGER NOT NULL DEFAULT 0,
    "strife_threshold" INTEGER NOT NULL DEFAULT 10,
    "strife_penalty" INTEGER NOT NULL DEFAULT 0,
    "rp" INTEGER NOT NULL DEFAULT 0,
    "resource_dice_bonus" INTEGER NOT NULL DEFAULT 0,
    "food" INTEGER NOT NULL DEFAULT 0,
    "lumber" INTEGER NOT NULL DEFAULT 0,
    "luxuries" INTEGER NOT NULL DEFAULT 0,
    "ore" INTEGER NOT NULL DEFAULT 0,
    "stone" INTEGER NOT NULL DEFAULT 0,
    "current_turn" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kingdoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kingdom_skills" (
    "id" TEXT NOT NULL,
    "kingdom_id" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "kingdom_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kingdom_feats" (
    "id" TEXT NOT NULL,
    "kingdom_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taken_at_level" INTEGER,
    "is_bonus" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kingdom_feats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_roles" (
    "id" TEXT NOT NULL,
    "kingdom_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "character_id" TEXT,
    "npc_name" TEXT,
    "invested" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "leadership_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hexes" (
    "id" TEXT NOT NULL,
    "kingdom_id" TEXT NOT NULL,
    "q" INTEGER NOT NULL,
    "r" INTEGER NOT NULL,
    "terrain" TEXT NOT NULL DEFAULT 'plains',
    "state" "HexState" NOT NULL DEFAULT 'UNCLAIMED',
    "reconnoitered" BOOLEAN NOT NULL DEFAULT false,
    "has_roads" BOOLEAN NOT NULL DEFAULT false,
    "fortified" BOOLEAN NOT NULL DEFAULT false,
    "work_site" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "label" TEXT,
    "notes" TEXT,

    CONSTRAINT "hexes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "kingdom_id" TEXT NOT NULL,
    "hex_id" TEXT,
    "name" TEXT NOT NULL,
    "type" "SettlementType" NOT NULL DEFAULT 'VILLAGE',
    "is_capital" BOOLEAN NOT NULL DEFAULT false,
    "level" INTEGER NOT NULL DEFAULT 1,
    "overcrowded" BOOLEAN NOT NULL DEFAULT false,
    "grid" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kingdom_structures" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "lots" INTEGER NOT NULL DEFAULT 1,
    "cost_rp" INTEGER NOT NULL DEFAULT 0,
    "cost_lumber" INTEGER NOT NULL DEFAULT 0,
    "cost_luxuries" INTEGER NOT NULL DEFAULT 0,
    "cost_ore" INTEGER NOT NULL DEFAULT 0,
    "cost_stone" INTEGER NOT NULL DEFAULT 0,
    "item_bonus" INTEGER,
    "item_bonus_to" TEXT,
    "traits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "effects" TEXT,
    "description" TEXT,
    "is_vk_addition" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "kingdom_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kingdom_turns" (
    "id" TEXT NOT NULL,
    "kingdom_id" TEXT NOT NULL,
    "turn_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "phase_data" JSONB NOT NULL DEFAULT '{}',
    "rp_rolled" INTEGER,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kingdom_turns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kingdoms_campaign_id_key" ON "kingdoms"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "kingdom_skills_kingdom_id_skill_key" ON "kingdom_skills"("kingdom_id", "skill");

-- CreateIndex
CREATE UNIQUE INDEX "leadership_roles_kingdom_id_role_key" ON "leadership_roles"("kingdom_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "hexes_kingdom_id_q_r_key" ON "hexes"("kingdom_id", "q", "r");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_hex_id_key" ON "settlements"("hex_id");

-- CreateIndex
CREATE UNIQUE INDEX "kingdom_turns_kingdom_id_turn_number_key" ON "kingdom_turns"("kingdom_id", "turn_number");

-- AddForeignKey
ALTER TABLE "kingdoms" ADD CONSTRAINT "kingdoms_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kingdom_skills" ADD CONSTRAINT "kingdom_skills_kingdom_id_fkey" FOREIGN KEY ("kingdom_id") REFERENCES "kingdoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kingdom_feats" ADD CONSTRAINT "kingdom_feats_kingdom_id_fkey" FOREIGN KEY ("kingdom_id") REFERENCES "kingdoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_roles" ADD CONSTRAINT "leadership_roles_kingdom_id_fkey" FOREIGN KEY ("kingdom_id") REFERENCES "kingdoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_roles" ADD CONSTRAINT "leadership_roles_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hexes" ADD CONSTRAINT "hexes_kingdom_id_fkey" FOREIGN KEY ("kingdom_id") REFERENCES "kingdoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_kingdom_id_fkey" FOREIGN KEY ("kingdom_id") REFERENCES "kingdoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_hex_id_fkey" FOREIGN KEY ("hex_id") REFERENCES "hexes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kingdom_turns" ADD CONSTRAINT "kingdom_turns_kingdom_id_fkey" FOREIGN KEY ("kingdom_id") REFERENCES "kingdoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
