-- Add new recipe fields: dual DCs (survival & cooking lore) and crit success/crit fail effects
ALTER TABLE "recipes" ADD COLUMN "dc_survival" INTEGER;
ALTER TABLE "recipes" ADD COLUMN "dc_cooking_lore" INTEGER;
ALTER TABLE "recipes" ADD COLUMN "effects_crit_success" TEXT;
ALTER TABLE "recipes" ADD COLUMN "effects_crit_fail" TEXT;

-- Migrate existing dc values to dc_survival
UPDATE "recipes" SET "dc_survival" = "dc" WHERE "dc" IS NOT NULL;
