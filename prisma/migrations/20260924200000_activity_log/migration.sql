-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastSeenActivityAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "moduleId" TEXT,
    "moduleLabel" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "undoneAt" TIMESTAMP(3),
    "undoneBy" TEXT,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_log_createdAt_idx" ON "activity_log"("createdAt");

-- CreateIndex
CREATE INDEX "activity_log_moduleId_createdAt_idx" ON "activity_log"("moduleId", "createdAt");
