-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('not_started', 'scripting', 'pre_production', 'production', 'post_production', 'building', 'playtesting', 'signed_off', 'deployed');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('storyboard', 'script', 'rundown', 'shot_sheet', 'two_d_assets', 'playtest_notes', 'box_folder', 'other');

-- CreateEnum
CREATE TYPE "TaskPhase" AS ENUM ('pre_production', 'scripting', 'production', 'post_production', 'uptale_build', 'playtesting', 'sign_off', 'deployment');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('not_started', 'in_progress', 'blocked', 'completed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ModuleStatus" NOT NULL DEFAULT 'not_started',
    "description" TEXT,
    "learningObjectives" TEXT,
    "toolsUsed" TEXT,
    "featuresDiscussed" TEXT,
    "targetCompletion" TEXT,
    "runtimeMinutes" INTEGER,
    "experienceId" TEXT,
    "launchUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT,
    "location" TEXT,
    "talent" TEXT,
    "backgroundMediaType" TEXT,
    "speaker" TEXT,
    "toolUsed" TEXT,
    "interactionHighlighted" TEXT,
    "notes" TEXT,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_links" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "sceneId" TEXT,
    "type" "DocumentType" NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "addedById" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "phase" "TaskPhase" NOT NULL,
    "title" TEXT NOT NULL,
    "owner" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'not_started',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_orders" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "sceneRef" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT,
    "suggestedBy" TEXT,
    "suggestedDate" TIMESTAMP(3),
    "goalDate" TIMESTAMP(3),
    "approvedBy" TEXT,
    "completedDate" TIMESTAMP(3),
    "versionUpdated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "change_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
