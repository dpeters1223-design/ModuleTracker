-- AlterTable
ALTER TABLE "modules" ADD COLUMN     "signedOffAt" TIMESTAMP(3),
ADD COLUMN     "signedOffById" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "isPlaythrough" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "playthrough_feedback" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playthrough_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "playthrough_feedback_taskId_createdAt_idx" ON "playthrough_feedback"("taskId", "createdAt");

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_signedOffById_fkey" FOREIGN KEY ("signedOffById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playthrough_feedback" ADD CONSTRAINT "playthrough_feedback_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playthrough_feedback" ADD CONSTRAINT "playthrough_feedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
