-- CreateEnum
CREATE TYPE "AssignmentKind" AS ENUM ('QUEST', 'STATION', 'RECOVERING', 'MISSING');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED', 'RECALLED');

-- CreateTable
CREATE TABLE "companion_assignments" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "kind" "AssignmentKind" NOT NULL DEFAULT 'QUEST',
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location_name" TEXT,
    "hex_id" TEXT,
    "settlement_id" TEXT,
    "depart_day" INTEGER NOT NULL,
    "depart_month" INTEGER NOT NULL,
    "depart_year" INTEGER NOT NULL,
    "return_day" INTEGER,
    "return_month" INTEGER,
    "return_year" INTEGER,
    "outcome" TEXT,
    "resolved_day" INTEGER,
    "resolved_month" INTEGER,
    "resolved_year" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_assignment_members" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,

    CONSTRAINT "companion_assignment_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "companion_assignments_campaign_id_status_idx" ON "companion_assignments"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "companion_assignment_members_character_id_idx" ON "companion_assignment_members"("character_id");

-- CreateIndex
CREATE UNIQUE INDEX "companion_assignment_members_assignment_id_character_id_key" ON "companion_assignment_members"("assignment_id", "character_id");

-- AddForeignKey
ALTER TABLE "companion_assignments" ADD CONSTRAINT "companion_assignments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_assignments" ADD CONSTRAINT "companion_assignments_hex_id_fkey" FOREIGN KEY ("hex_id") REFERENCES "hexes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_assignments" ADD CONSTRAINT "companion_assignments_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_assignment_members" ADD CONSTRAINT "companion_assignment_members_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "companion_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_assignment_members" ADD CONSTRAINT "companion_assignment_members_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
