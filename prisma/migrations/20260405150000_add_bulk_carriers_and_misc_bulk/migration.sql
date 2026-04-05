-- CreateEnum
CREATE TYPE "BulkCarrierType" AS ENUM ('MOUNT', 'PACK_ANIMAL', 'VEHICLE', 'MAGICAL_STORAGE', 'CUSTOM');

-- CreateTable
CREATE TABLE "bulk_carriers" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BulkCarrierType" NOT NULL,
    "bulk_capacity" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "assigned_character_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulk_carriers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bulk_carriers" ADD CONSTRAINT "bulk_carriers_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_carriers" ADD CONSTRAINT "bulk_carriers_assigned_character_id_fkey" FOREIGN KEY ("assigned_character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: add misc_bulk to characters
ALTER TABLE "characters" ADD COLUMN "misc_bulk" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable: add bulk_carrier_id to inventory_items
ALTER TABLE "inventory_items" ADD COLUMN "bulk_carrier_id" TEXT;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_bulk_carrier_id_fkey" FOREIGN KEY ("bulk_carrier_id") REFERENCES "bulk_carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
