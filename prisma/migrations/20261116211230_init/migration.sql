-- CreateTable
CREATE TABLE "FacilityReport" (
    "id" SERIAL NOT NULL,
    "facilityId" VARCHAR(64) NOT NULL,
    "problem" VARCHAR(32) NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacilityReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacilityReport_facilityId_createdAt_idx" ON "FacilityReport"("facilityId", "createdAt");
