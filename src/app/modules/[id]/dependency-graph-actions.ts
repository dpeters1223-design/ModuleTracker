"use server";

import type { DependencyNodeShape } from "@prisma/client";
import { changed } from "@/lib/changed";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canViewDependencyGraph } from "@/lib/dependency-graph";

export type GraphResult = { errors?: string[] };

async function requireBuilder() {
  const user = await requireUser();
  if (!canViewDependencyGraph(user.email)) throw new Error("Not allowed.");
  return user;
}

export async function createDependencyNode(
  moduleId: string,
  input: { label: string; category: string; shape: DependencyNodeShape; assetId: string | null; x: number; y: number }
): Promise<GraphResult> {
  const user = await requireBuilder();
  const label = input.label.trim();
  if (!label) return { errors: ["Give it a name."] };
  const node = await prisma.dependencyNode.create({
    data: {
      moduleId,
      label,
      category: input.category.trim() || null,
      shape: input.shape,
      assetId: input.assetId || null,
      x: input.x,
      y: input.y,
    },
  });
  await logActivity(user, {
    action: "dependencyNode.create",
    summary: `Added "${label}" to the dependency graph`,
    entityType: "dependencyNode",
    entityId: node.id,
    moduleId,
    after: node,
  });
  changed();
  return {};
}

export async function updateDependencyNode(
  moduleId: string,
  nodeId: string,
  input: { label: string; category: string; shape: DependencyNodeShape; assetId: string | null }
): Promise<GraphResult> {
  const user = await requireBuilder();
  const label = input.label.trim();
  if (!label) return { errors: ["Give it a name."] };
  const before = await prisma.dependencyNode.findFirst({ where: { id: nodeId, moduleId } });
  if (!before) return { errors: ["That node no longer exists."] };
  const after = await prisma.dependencyNode.update({
    where: { id: nodeId },
    data: { label, category: input.category.trim() || null, shape: input.shape, assetId: input.assetId || null },
  });
  await logActivity(user, {
    action: "dependencyNode.update",
    summary: `Edited "${label}" in the dependency graph`,
    entityType: "dependencyNode",
    entityId: nodeId,
    moduleId,
    before,
    after,
  });
  changed();
  return {};
}

/** Dragging a node — persists immediately so the layout survives a reload (the one thing Jay asked for). */
export async function moveDependencyNode(moduleId: string, nodeId: string, x: number, y: number): Promise<GraphResult> {
  await requireBuilder();
  const node = await prisma.dependencyNode.findFirst({ where: { id: nodeId, moduleId }, select: { id: true } });
  if (!node) return { errors: ["That node no longer exists."] };
  await prisma.dependencyNode.update({ where: { id: nodeId }, data: { x, y } });
  // No activity log / changed() here — every pixel of drag would otherwise spam
  // the activity feed and refetch every other viewer's page mid-drag.
  return {};
}

export async function deleteDependencyNode(moduleId: string, nodeId: string): Promise<GraphResult> {
  const user = await requireBuilder();
  const node = await prisma.dependencyNode.findFirst({ where: { id: nodeId, moduleId } });
  if (!node) return {};
  await prisma.dependencyNode.delete({ where: { id: nodeId } });
  await logActivity(user, {
    action: "dependencyNode.delete",
    summary: `Removed "${node.label}" from the dependency graph`,
    entityType: "dependencyNode",
    entityId: nodeId,
    moduleId,
    before: node,
  });
  changed();
  return {};
}

export async function createDependencyEdge(moduleId: string, fromNodeId: string, toNodeId: string): Promise<GraphResult> {
  const user = await requireBuilder();
  if (fromNodeId === toNodeId) return { errors: ["A node can't depend on itself."] };
  const [from, to] = await Promise.all([
    prisma.dependencyNode.findFirst({ where: { id: fromNodeId, moduleId } }),
    prisma.dependencyNode.findFirst({ where: { id: toNodeId, moduleId } }),
  ]);
  if (!from || !to) return { errors: ["One of those nodes no longer exists."] };
  const edge = await prisma.dependencyEdge.upsert({
    where: { fromNodeId_toNodeId: { fromNodeId, toNodeId } },
    create: { moduleId, fromNodeId, toNodeId },
    update: {},
  });
  await logActivity(user, {
    action: "dependencyEdge.create",
    summary: `"${from.label}" must happen before "${to.label}"`,
    entityType: "dependencyEdge",
    entityId: edge.id,
    moduleId,
    after: edge,
  });
  changed();
  return {};
}

export async function deleteDependencyEdge(moduleId: string, edgeId: string): Promise<GraphResult> {
  const user = await requireBuilder();
  const edge = await prisma.dependencyEdge.findFirst({ where: { id: edgeId, moduleId } });
  if (!edge) return {};
  await prisma.dependencyEdge.delete({ where: { id: edgeId } });
  await logActivity(user, {
    action: "dependencyEdge.delete",
    summary: "Removed a dependency link",
    entityType: "dependencyEdge",
    entityId: edgeId,
    moduleId,
    before: edge,
  });
  changed();
  return {};
}
