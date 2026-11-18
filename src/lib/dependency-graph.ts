import "server-only";
import { prisma } from "@/lib/prisma";
import { emailList } from "@/lib/activity";
import type { DependencyGraphData } from "@/components/dependency-graph";

/**
 * Who can see a module's dependency graph: UPTALE_BUILDER_USERS, a comma-separated
 * email list — same flat-allowlist pattern as SIGNOFF_USERS (src/lib/signoff.ts).
 * Unset means nobody sees it, same reasoning as sign-off: deliberately never
 * granted by default. This is a visibility gate only, not a write permission —
 * everyone on the list can both view and edit.
 */
export const canViewDependencyGraph = (email: string | null | undefined) =>
  Boolean(email) && emailList(process.env.UPTALE_BUILDER_USERS).includes(email!.toLowerCase());

export async function getDependencyGraph(moduleId: string): Promise<DependencyGraphData> {
  const [nodes, edges] = await Promise.all([
    prisma.dependencyNode.findMany({ where: { moduleId }, orderBy: { createdAt: "asc" } }),
    prisma.dependencyEdge.findMany({ where: { moduleId } }),
  ]);
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      assetId: n.assetId,
      label: n.label,
      category: n.category,
      shape: n.shape,
      x: n.x,
      y: n.y,
    })),
    edges: edges.map((e) => ({ id: e.id, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId })),
  };
}
