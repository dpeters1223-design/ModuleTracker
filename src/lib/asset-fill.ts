import "server-only";
import { prisma } from "@/lib/prisma";
import { sceneAssetCandidates } from "@/lib/assets";

// Server-only (not an action): called by "Add from scenes" and when a Discovery Form is
// submitted, both of which check the user first.

/** The scene assets not listed yet, created as "Needed" rows. Returns the new ids. */
export async function fillAssetsFromScenes(moduleId: string): Promise<string[]> {
  const [scenes, existing, last] = await Promise.all([
    prisma.scene.findMany({ where: { moduleId }, select: { id: true, order: true, title: true, interactions: true, mediaAssets: true } }),
    prisma.moduleAsset.findMany({ where: { moduleId, sourceKey: { not: null } }, select: { sourceKey: true } }),
    prisma.moduleAsset.findFirst({ where: { moduleId }, orderBy: { order: "desc" }, select: { order: true } }),
  ]);
  const have = new Set(existing.map((e) => e.sourceKey));
  const missing = sceneAssetCandidates(scenes).filter((c) => !have.has(c.sourceKey));
  const ids: string[] = [];
  let order = last?.order ?? 0;
  for (const c of missing) {
    const a = await prisma.moduleAsset.create({ data: { moduleId, order: ++order, ...c }, select: { id: true } });
    ids.push(a.id);
  }
  return ids;
}
