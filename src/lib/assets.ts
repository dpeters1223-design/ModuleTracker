// Module assets (2D images, 2D videos, 3D objects…): labels, the four status steps, and
// the starter rows made from each scene's Discovery Form activities. Shared by the
// server and the browser.
import type { AssetStatus, AssetType } from "@prisma/client";
import { cleanInteractions } from "@/lib/interactions";

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  image2d: "2D image",
  video2d: "2D video",
  object3d: "3D object",
  audio: "Audio",
  other: "Other",
};

/** Needed → Requested → Received → In Uptale. */
export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  needed: "Needed",
  requested: "Requested",
  received: "Received",
  in_uptale: "In Uptale",
};
export const ASSET_TYPES = Object.keys(ASSET_TYPE_LABELS) as AssetType[];
export const ASSET_STATUSES = Object.keys(ASSET_STATUS_LABELS) as AssetStatus[];

export const ASSET_STATUS_STYLES: Record<AssetStatus, string> = {
  needed: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  requested: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  received: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  in_uptale: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
};

/** "Received" or further along. */
export const isInHand = (s: AssetStatus) => s === "received" || s === "in_uptale";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** A best guess at the type from a free-text line like "Close-up photo of the target". */
export function guessAssetType(text: string): AssetType {
  const t = text.toLowerCase();
  if (/\b(video|clip|footage|animation)\b/.test(t)) return "video2d";
  if (/\b3d\b|\bmodel\b|\bobject\b/.test(t)) return "object3d";
  if (/\b(audio|sound|music|voice ?over|narration)\b/.test(t)) return "audio";
  if (/\b(photo|image|graphic|picture|diagram|screenshot|icon|logo|chart|illustration)s?\b/.test(t)) return "image2d";
  return "other";
}

type SceneLike = { id: string; order: number; title: string | null; interactions: unknown; mediaAssets: string | null };
export type AssetCandidate = { sceneId: string; name: string; type: AssetType; sourceKey: string };

/**
 * The assets a module's scenes call for: each scene's 2D image / 2D video / 3D object
 * activity (named from its note), and each line of its "Media assets needed". The
 * sourceKey says where a row came from, so it's only ever added once.
 */
export function sceneAssetCandidates(scenes: SceneLike[]): AssetCandidate[] {
  const out: AssetCandidate[] = [];
  for (const s of [...scenes].sort((a, b) => a.order - b.order)) {
    for (const i of cleanInteractions(s.interactions)) {
      if (i.type !== "image2d" && i.type !== "video2d" && i.type !== "object3d") continue;
      const name = i.note.trim() || `${ASSET_TYPE_LABELS[i.type]} for scene ${s.order}`;
      out.push({ sceneId: s.id, name: name.slice(0, 200), type: i.type, sourceKey: `${s.id}:${i.type}` });
    }
    for (const line of (s.mediaAssets ?? "").split(/\n|;/).map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim())) {
      if (!line) continue;
      out.push({ sceneId: s.id, name: line.slice(0, 200), type: guessAssetType(line), sourceKey: `${s.id}:media:${norm(line)}` });
    }
  }
  return out;
}
