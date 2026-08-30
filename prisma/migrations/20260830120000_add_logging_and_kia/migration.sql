-- CreateEnum
CREATE TYPE "CharacterStatus" AS ENUM ('ACTIVE', 'FALLEN');

-- CreateEnum
CREATE TYPE "LogCategory" AS ENUM ('PARTY', 'INVENTORY', 'CAMPSITE', 'KINGDOM', 'SESSION', 'NOTE', 'DEATH');

-- CreateEnum
CREATE TYPE "LogSource" AS ENUM ('MANUAL', 'SYSTEM');

-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "status" "CharacterStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "kia_at" TIMESTAMP(3),
ADD COLUMN     "kia_note" TEXT;

-- CreateTable
CREATE TABLE "log_entries" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "category" "LogCategory" NOT NULL DEFAULT 'NOTE',
    "source" "LogSource" NOT NULL DEFAULT 'MANUAL',
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "entity_name" TEXT,
    "meta" JSONB,
    "golarion_day" INTEGER,
    "golarion_month" INTEGER,
    "golarion_year" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "log_entries_campaign_id_created_at_idx" ON "log_entries"("campaign_id", "created_at");

-- AddForeignKey
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
