-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('instructional_design', 'ui_ux', 'media', 'tags');

-- CreateEnum
CREATE TYPE "FeatureRequestStatus" AS ENUM ('new', 'planned', 'in_progress', 'declined', 'done');

-- CreateEnum
CREATE TYPE "DependencyNodeShape" AS ENUM ('circle', 'square', 'diamond', 'hexagon');

-- AlterTable
ALTER TABLE "playthrough_feedback" ADD COLUMN     "categories" "FeedbackCategory"[] DEFAULT ARRAY[]::"FeedbackCategory"[];

-- CreateTable
CREATE TABLE "feature_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "submittedById" TEXT,
    "submittedByName" TEXT,
    "status" "FeatureRequestStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dependency_nodes" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "assetId" TEXT,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "shape" "DependencyNodeShape" NOT NULL DEFAULT 'circle',
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dependency_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dependency_edges" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dependency_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feature_requests_createdAt_idx" ON "feature_requests"("createdAt");

-- CreateIndex
CREATE INDEX "dependency_nodes_moduleId_idx" ON "dependency_nodes"("moduleId");

-- CreateIndex
CREATE INDEX "dependency_edges_moduleId_idx" ON "dependency_edges"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "dependency_edges_fromNodeId_toNodeId_key" ON "dependency_edges"("fromNodeId", "toNodeId");

-- AddForeignKey
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependency_nodes" ADD CONSTRAINT "dependency_nodes_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependency_nodes" ADD CONSTRAINT "dependency_nodes_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "module_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependency_edges" ADD CONSTRAINT "dependency_edges_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependency_edges" ADD CONSTRAINT "dependency_edges_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "dependency_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependency_edges" ADD CONSTRAINT "dependency_edges_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "dependency_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
