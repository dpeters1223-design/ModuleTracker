-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('image2d', 'video2d', 'object3d', 'audio', 'other');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('needed', 'requested', 'received', 'in_uptale');

-- AlterTable
ALTER TABLE "task_attachments" ADD COLUMN     "assetId" TEXT,
ALTER COLUMN "taskId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "module_assets" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "sceneId" TEXT,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL DEFAULT 'other',
    "owner" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'needed',
    "url" TEXT,
    "notes" TEXT,
    "sourceKey" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "module_assets_moduleId_idx" ON "module_assets"("moduleId");

-- CreateIndex
CREATE INDEX "task_attachments_assetId_idx" ON "task_attachments"("assetId");

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "module_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_assets" ADD CONSTRAINT "module_assets_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_assets" ADD CONSTRAINT "module_assets_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

