-- AlterTable: add Golarion calendar date fields to campaigns
ALTER TABLE "campaigns" ADD COLUMN "golarion_day" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "campaigns" ADD COLUMN "golarion_month" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "campaigns" ADD COLUMN "golarion_year" INTEGER NOT NULL DEFAULT 4710;
