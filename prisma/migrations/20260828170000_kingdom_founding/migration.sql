/*
  Kingdom founding: onboarding state and free trained-skill picks.

  Added:    kingdoms.skill_picks — the player's free trained-skill choices. The
            skills a charter, heartland, or government grants outright are
            derived from those choices by startingSkills(), so only the picks
            are stored.
            kingdoms.founded — false until the founding wizard is finished;
            decides whether the Kingdom tab shows onboarding or the dashboard.
  Dropped:  kingdoms.xp — this campaign levels the kingdom by milestone, so no
            XP is tracked. The column was never written to by the app.
*/

-- AlterTable
ALTER TABLE "kingdoms"
  ADD COLUMN "skill_picks" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "founded" BOOLEAN NOT NULL DEFAULT false;

-- Existing kingdoms that already picked a government were founded under the
-- pre-wizard UI; leave them on the dashboard rather than sending them back
-- through onboarding.
UPDATE "kingdoms" SET "founded" = true WHERE "government" IS NOT NULL;

-- DropColumn
ALTER TABLE "kingdoms" DROP COLUMN IF EXISTS "xp";
