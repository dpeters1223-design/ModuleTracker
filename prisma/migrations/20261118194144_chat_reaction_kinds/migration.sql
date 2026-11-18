-- CreateEnum
CREATE TYPE "ChatReactionKind" AS ENUM ('thumbs_up', 'thumbs_down', 'heart', 'dog');

-- DropIndex
DROP INDEX "chat_message_reactions_messageId_userId_key";

-- AlterTable
ALTER TABLE "chat_message_reactions" ADD COLUMN "kind" "ChatReactionKind" NOT NULL DEFAULT 'thumbs_up';

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_reactions_messageId_userId_kind_key" ON "chat_message_reactions"("messageId", "userId", "kind");
