-- AlterTable
ALTER TABLE "document_links" ADD COLUMN     "driveFileId" TEXT;

-- AlterTable
ALTER TABLE "modules" ADD COLUMN     "driveFolderId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "googleAccessToken" TEXT,
ADD COLUMN     "googleRefreshToken" TEXT,
ADD COLUMN     "googleTokenExpiresAt" TIMESTAMP(3);
