/*
  Hexes belong to a map sheet.

  The Player's Guide ships four separate blank maps of the Stolen Lands rather
  than one, so an axial (q, r) pair only identifies a hex within a single sheet.
  The uniqueness constraint widens to match.
*/

-- AlterTable
ALTER TABLE "hexes" ADD COLUMN "sheet" INTEGER NOT NULL DEFAULT 1;

-- DropIndex
DROP INDEX IF EXISTS "hexes_kingdom_id_q_r_key";

-- CreateIndex
CREATE UNIQUE INDEX "hexes_kingdom_id_sheet_q_r_key" ON "hexes"("kingdom_id", "sheet", "q", "r");
