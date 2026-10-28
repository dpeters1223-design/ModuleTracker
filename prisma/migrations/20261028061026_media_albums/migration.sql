-- CreateTable
CREATE TABLE "media_albums" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moduleId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_album_items" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_album_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_albums_moduleId_idx" ON "media_albums"("moduleId");

-- CreateIndex
CREATE INDEX "media_album_items_mediaId_idx" ON "media_album_items"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "media_album_items_albumId_mediaId_key" ON "media_album_items"("albumId", "mediaId");

-- AddForeignKey
ALTER TABLE "media_albums" ADD CONSTRAINT "media_albums_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_albums" ADD CONSTRAINT "media_albums_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_album_items" ADD CONSTRAINT "media_album_items_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "media_albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_album_items" ADD CONSTRAINT "media_album_items_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
