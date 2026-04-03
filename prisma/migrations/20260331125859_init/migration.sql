-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'UNIQUE');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('WEAPON', 'ARMOR', 'SHIELD', 'GEAR', 'CONSUMABLE', 'WORN', 'HELD', 'MATERIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "HexState" AS ENUM ('UNEXPLORED', 'EXPLORED', 'CLAIMED', 'CLEARED');

-- CreateEnum
CREATE TYPE "SettlementType" AS ENUM ('VILLAGE', 'TOWN', 'CITY', 'METROPOLIS');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "str_modifier" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bulk_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_bulk_light" BOOLEAN NOT NULL DEFAULT false,
    "level" INTEGER NOT NULL DEFAULT 0,
    "rarity" "Rarity" NOT NULL DEFAULT 'COMMON',
    "traits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" "ItemCategory" NOT NULL DEFAULT 'GEAR',
    "value_cp" INTEGER NOT NULL DEFAULT 0,
    "is_investable" BOOLEAN NOT NULL DEFAULT false,
    "container_capacity" DOUBLE PRECISION,
    "container_bulk_reduction" DOUBLE PRECISION,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "character_id" TEXT,
    "container_inventory_item_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "is_invested" BOOLEAN NOT NULL DEFAULT false,
    "is_worn" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "character_id" TEXT,
    "cp" INTEGER NOT NULL DEFAULT 0,
    "sp" INTEGER NOT NULL DEFAULT 0,
    "gp" INTEGER NOT NULL DEFAULT 0,
    "pp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wish_list_items" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "character_id" TEXT,
    "item_id" TEXT,
    "custom_name" TEXT,
    "custom_price_cp" INTEGER,
    "notes" TEXT,
    "is_acquired" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wish_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objectives" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_links" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quick_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campsite_layouts" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "elements" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campsite_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watch_shifts" (
    "id" TEXT NOT NULL,
    "campsite_layout_id" TEXT NOT NULL,
    "shift_number" INTEGER NOT NULL,
    "character_ids" TEXT[],

    CONSTRAINT "watch_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camping_activities" (
    "id" TEXT NOT NULL,
    "campsite_layout_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "activity_type" TEXT NOT NULL,
    "skill" TEXT,
    "result" TEXT,

    CONSTRAINT "camping_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ingredients" TEXT,
    "dc" INTEGER,
    "effects_success" TEXT,
    "effects_fail" TEXT,
    "is_discovered" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kingdoms" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "culture" INTEGER NOT NULL DEFAULT 10,
    "economy" INTEGER NOT NULL DEFAULT 10,
    "loyalty" INTEGER NOT NULL DEFAULT 10,
    "stability" INTEGER NOT NULL DEFAULT 10,
    "unrest" INTEGER NOT NULL DEFAULT 0,
    "corruption" INTEGER NOT NULL DEFAULT 0,
    "crime" INTEGER NOT NULL DEFAULT 0,
    "decay" INTEGER NOT NULL DEFAULT 0,
    "strife" INTEGER NOT NULL DEFAULT 0,
    "rp" INTEGER NOT NULL DEFAULT 0,
    "food" INTEGER NOT NULL DEFAULT 0,
    "lumber" INTEGER NOT NULL DEFAULT 0,
    "luxuries" INTEGER NOT NULL DEFAULT 0,
    "ore" INTEGER NOT NULL DEFAULT 0,
    "stone" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "kingdoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hexes" (
    "id" TEXT NOT NULL,
    "kingdom_id" TEXT NOT NULL,
    "q" INTEGER NOT NULL,
    "r" INTEGER NOT NULL,
    "terrain" TEXT NOT NULL DEFAULT 'plains',
    "state" "HexState" NOT NULL DEFAULT 'UNEXPLORED',
    "improvement" TEXT,

    CONSTRAINT "hexes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "kingdom_id" TEXT NOT NULL,
    "hex_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SettlementType" NOT NULL DEFAULT 'VILLAGE',

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "structure_id" TEXT,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structures" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lots_required" INTEGER NOT NULL DEFAULT 1,
    "cost_rp" INTEGER NOT NULL DEFAULT 0,
    "costs" JSONB,
    "build_time" INTEGER NOT NULL DEFAULT 1,
    "item_bonus" INTEGER,
    "effects" JSONB,
    "description" TEXT,

    CONSTRAINT "structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_roles" (
    "id" TEXT NOT NULL,
    "kingdom_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "character_id" TEXT,
    "ability" TEXT,

    CONSTRAINT "leadership_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kingdom_turns" (
    "id" TEXT NOT NULL,
    "kingdom_id" TEXT NOT NULL,
    "turn_number" INTEGER NOT NULL,
    "phase_log" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kingdom_turns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_campaign_id_character_id_key" ON "wallets"("campaign_id", "character_id");

-- CreateIndex
CREATE UNIQUE INDEX "watch_shifts_campsite_layout_id_shift_number_key" ON "watch_shifts"("campsite_layout_id", "shift_number");

-- CreateIndex
CREATE UNIQUE INDEX "kingdoms_campaign_id_key" ON "kingdoms"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "hexes_kingdom_id_q_r_key" ON "hexes"("kingdom_id", "q", "r");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_hex_id_key" ON "settlements"("hex_id");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_settlement_id_position_key" ON "blocks"("settlement_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "lots_block_id_position_key" ON "lots"("block_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "leadership_roles_kingdom_id_role_key" ON "leadership_roles"("kingdom_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "kingdom_turns_kingdom_id_turn_number_key" ON "kingdom_turns"("kingdom_id", "turn_number");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_container_inventory_item_id_fkey" FOREIGN KEY ("container_inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wish_list_items" ADD CONSTRAINT "wish_list_items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wish_list_items" ADD CONSTRAINT "wish_list_items_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wish_list_items" ADD CONSTRAINT "wish_list_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_links" ADD CONSTRAINT "quick_links_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campsite_layouts" ADD CONSTRAINT "campsite_layouts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_shifts" ADD CONSTRAINT "watch_shifts_campsite_layout_id_fkey" FOREIGN KEY ("campsite_layout_id") REFERENCES "campsite_layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camping_activities" ADD CONSTRAINT "camping_activities_campsite_layout_id_fkey" FOREIGN KEY ("campsite_layout_id") REFERENCES "campsite_layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camping_activities" ADD CONSTRAINT "camping_activities_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kingdoms" ADD CONSTRAINT "kingdoms_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hexes" ADD CONSTRAINT "hexes_kingdom_id_fkey" FOREIGN KEY ("kingdom_id") REFERENCES "kingdoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_kingdom_id_fkey" FOREIGN KEY ("kingdom_id") REFERENCES "kingdoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_hex_id_fkey" FOREIGN KEY ("hex_id") REFERENCES "hexes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_roles" ADD CONSTRAINT "leadership_roles_kingdom_id_fkey" FOREIGN KEY ("kingdom_id") REFERENCES "kingdoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_roles" ADD CONSTRAINT "leadership_roles_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kingdom_turns" ADD CONSTRAINT "kingdom_turns_kingdom_id_fkey" FOREIGN KEY ("kingdom_id") REFERENCES "kingdoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
