-- CreateEnum
CREATE TYPE "ChatNotifyLevel" AS ENUM ('all', 'mentions', 'none');

-- AlterTable
ALTER TABLE "chat_channel_members" ADD COLUMN     "notifyLevel" "ChatNotifyLevel";

-- CreateTable
CREATE TABLE "chat_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT,
    "emoji" TEXT,
    "useGooglePhoto" BOOLEAN NOT NULL DEFAULT true,
    "notifyLevel" "ChatNotifyLevel" NOT NULL DEFAULT 'all',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_profiles_userId_key" ON "chat_profiles"("userId");

-- AddForeignKey
ALTER TABLE "chat_profiles" ADD CONSTRAINT "chat_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
