-- CreateTable
CREATE TABLE "media_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "driveFileId" TEXT,
    "mimeType" TEXT,
    "bytes" INTEGER,
    "thumbFileId" TEXT,
    "url" TEXT,
    "moduleId" TEXT,
    "sceneId" TEXT,
    "assetId" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_items_moduleId_idx" ON "media_items"("moduleId");

-- CreateIndex
CREATE INDEX "media_items_assetId_idx" ON "media_items"("assetId");

-- CreateIndex
CREATE INDEX "media_items_tags_idx" ON "media_items" USING GIN ("tags");

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "module_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
