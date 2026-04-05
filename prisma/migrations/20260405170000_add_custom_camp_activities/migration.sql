-- CreateTable
CREATE TABLE "custom_camp_activities" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "skill" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_camp_activities_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "custom_camp_activities" ADD CONSTRAINT "custom_camp_activities_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
