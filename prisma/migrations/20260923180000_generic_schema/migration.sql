-- CreateEnum
CREATE TYPE "ChangeOrderStatus" AS ENUM ('suggested', 'approved', 'in_progress', 'in_review', 'completed', 'deferred', 'declined');

-- AlterEnum
BEGIN;
CREATE TYPE "DocumentType_new" AS ENUM ('storyboard', 'script', 'rundown', 'shot_sheet', 'questions', 'two_d_assets', 'three_d_assets', 'playtest_notes', 'folder', 'other');
ALTER TABLE "document_links" ALTER COLUMN "type" TYPE "DocumentType_new" USING ("type"::text::"DocumentType_new");
ALTER TYPE "DocumentType" RENAME TO "DocumentType_old";
ALTER TYPE "DocumentType_new" RENAME TO "DocumentType";
DROP TYPE "public"."DocumentType_old";
COMMIT;

-- AlterEnum
-- Hand-edited: Prisma would append 'on_hold' with ADD VALUE, but Postgres sorts
-- enums by declaration order, so recreate the type in pipeline order instead.
BEGIN;
CREATE TYPE "ModuleStatus_new" AS ENUM ('on_hold', 'not_started', 'pre_production', 'scripting', 'production', 'post_production', 'building', 'playtesting', 'signed_off', 'deployed');
ALTER TABLE "public"."modules" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "modules" ALTER COLUMN "status" TYPE "ModuleStatus_new" USING ("status"::text::"ModuleStatus_new");
ALTER TYPE "ModuleStatus" RENAME TO "ModuleStatus_old";
ALTER TYPE "ModuleStatus_new" RENAME TO "ModuleStatus";
DROP TYPE "public"."ModuleStatus_old";
ALTER TABLE "modules" ALTER COLUMN "status" SET DEFAULT 'not_started';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TaskPhase_new" AS ENUM ('pre_production', 'scripting', 'production', 'post_production', 'build', 'playtesting', 'sign_off', 'deployment');
ALTER TABLE "tasks" ALTER COLUMN "phase" TYPE "TaskPhase_new" USING ("phase"::text::"TaskPhase_new");
ALTER TYPE "TaskPhase" RENAME TO "TaskPhase_old";
ALTER TYPE "TaskPhase_new" RENAME TO "TaskPhase";
DROP TYPE "public"."TaskPhase_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TaskStatus_new" AS ENUM ('not_started', 'in_progress', 'delayed', 'completed');
ALTER TABLE "public"."tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tasks" ALTER COLUMN "status" TYPE "TaskStatus_new" USING ("status"::text::"TaskStatus_new");
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
DROP TYPE "public"."TaskStatus_old";
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'not_started';
COMMIT;

-- AlterTable
ALTER TABLE "change_orders" ALTER COLUMN "moduleId" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "ChangeOrderStatus" NOT NULL DEFAULT 'suggested';

-- AlterTable
ALTER TABLE "modules" DROP COLUMN "experienceId",
DROP COLUMN "launchUrl",
ADD COLUMN     "audience" TEXT,
ADD COLUMN     "keyConcepts" TEXT,
ADD COLUMN     "sizeMb" DOUBLE PRECISION,
ALTER COLUMN "number" DROP NOT NULL;

-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "activities" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "learningObjectives" TEXT,
ADD COLUMN     "mediaAssets" TEXT;

-- CreateTable
CREATE TABLE "module_versions" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "platform" TEXT,
    "workspace" TEXT,
    "experienceId" TEXT,
    "launchUrl" TEXT,
    "releasedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "module_versions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
