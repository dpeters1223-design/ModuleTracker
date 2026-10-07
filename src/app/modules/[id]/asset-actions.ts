"use server";

import type { AssetStatus, AssetType, Prisma } from "@prisma/client";
import { changed } from "@/lib/changed";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ASSET_STATUS_LABELS, ASSET_TYPE_LABELS } from "@/lib/assets";
import { fillAssetsFromScenes } from "@/lib/asset-fill";

export type AssetInput = {
  name: string;
  type: string;
  sceneId: string; // "" = not tied to a scene
  owner: string;
  status: string;
  url: string;
  notes: string;
};
export type AssetResult = { errors?: string[] };

async function validate(moduleId: string, input: AssetInput) {
  const t = (s: unknown) => (typeof s === "string" ? s.trim() : "");
  const d = {
    name: t(input.name),
    type: t(input.type),
    sceneId: t(input.sceneId),
    owner: t(input.owner),
    status: t(input.status),
    url: t(input.url),
    notes: t(input.notes),
  };
  const errors: string[] = [];
  if (!d.name) errors.push("Give the asset a name.");
  if (d.name.length > 200 || d.owner.length > 100 || d.url.length > 2000 || d.notes.length > 5000) {
    errors.push("Some entries are too long.");
  }
  if (!(d.type in ASSET_TYPE_LABELS)) errors.push("Pick a type.");
  if (!(d.status in ASSET_STATUS_LABELS)) errors.push("Pick a status.");
  if (d.url && !/^https?:\/\/\S+$/i.test(d.url)) errors.push("The link must start with http:// or https://.");
  if (d.sceneId && !(await prisma.scene.findFirst({ where: { id: d.sceneId, moduleId }, select: { id: true } }))) {
    errors.push("That scene no longer exists.");
  }
  return {
    errors,
    fields: {
      name: d.name,
      type: d.type as AssetType,
      sceneId: d.sceneId || null,
      owner: d.owner || null,
      status: d.status as AssetStatus,
      url: d.url || null,
      notes: d.notes || null,
    },
  };
}

export async function createAsset(moduleId: string, input: AssetInput): Promise<AssetResult> {
  const user = await requireUser();
  const { errors, fields } = await validate(moduleId, input);
  if (errors.length) return { errors };
  const last = await prisma.moduleAsset.findFirst({ where: { moduleId }, orderBy: { order: "desc" }, select: { order: true } });
  const asset = await prisma.moduleAsset.create({ data: { moduleId, order: (last?.order ?? 0) + 1, ...fields } });
  await logActivity(user, {
    action: "asset.create",
    summary: `Added asset "${asset.name}" (${ASSET_TYPE_LABELS[asset.type]})`,
    entityType: "moduleAsset",
    entityId: asset.id,
    moduleId,
    after: asset,
  });
  changed();
  return {};
}

async function changeAsset(
  moduleId: string,
  assetId: string,
  data: Prisma.ModuleAssetUpdateInput,
  action: string,
  summary: (b: { name: string; status: AssetStatus }, a: { name: string; status: AssetStatus }) => string
): Promise<AssetResult> {
  const user = await requireUser();
  const before = await prisma.moduleAsset.findFirst({ where: { id: assetId, moduleId } });
  if (!before) return { errors: ["That asset no longer exists."] };
  const after = await prisma.moduleAsset.update({ where: { id: assetId }, data });
  // updatedAt isn't part of what Undo restores (Prisma sets it).
  const { updatedAt: _b, ...beforeRow } = before;
  void _b;
  await logActivity(user, {
    action,
    summary: summary(before, after),
    entityType: "moduleAsset",
    entityId: assetId,
    moduleId,
    before: beforeRow,
    after,
  });
  changed();
  return {};
}

export async function updateAsset(moduleId: string, assetId: string, input: AssetInput): Promise<AssetResult> {
  await requireUser();
  const { errors, fields } = await validate(moduleId, input);
  if (errors.length) return { errors };
  return changeAsset(moduleId, assetId, fields, "asset.update", (_, a) => `Edited asset "${a.name}"`);
}

/** One-click status change: Needed → Requested → Received → In Uptale. */
export async function setAssetStatus(moduleId: string, assetId: string, status: string): Promise<AssetResult> {
  if (!(status in ASSET_STATUS_LABELS)) return { errors: ["Unknown status."] };
  return changeAsset(
    moduleId,
    assetId,
    { status: status as AssetStatus },
    "asset.status",
    (b, a) => `Marked asset "${a.name}" ${ASSET_STATUS_LABELS[a.status]} (was ${ASSET_STATUS_LABELS[b.status]})`
  );
}

export async function deleteAsset(moduleId: string, assetId: string): Promise<AssetResult> {
  const user = await requireUser();
  const asset = await prisma.moduleAsset.findFirst({ where: { id: assetId, moduleId }, include: { attachments: true } });
  if (!asset) return {};
  // Its images go with it (cascade); they're kept in the history copy so Undo restores them.
  await prisma.moduleAsset.delete({ where: { id: assetId } });
  const { updatedAt: _u, ...row } = asset;
  void _u;
  await logActivity(user, {
    action: "asset.delete",
    summary: `Deleted asset "${asset.name}"`,
    entityType: "moduleAsset",
    entityId: assetId,
    moduleId,
    before: row,
  });
  changed();
  return {};
}

/**
 * Adds a row for each asset the scenes call for that isn't listed yet (see
 * sceneAssetCandidates). Returns how many were added.
 */
export async function addAssetsFromScenes(moduleId: string): Promise<AssetResult & { added?: number }> {
  const user = await requireUser();
  const added = await fillAssetsFromScenes(moduleId);
  if (added.length) {
    await logActivity(user, {
      action: "assets.fromScenes",
      summary: `Added ${added.length} asset${added.length === 1 ? "" : "s"} from the scenes`,
      entityType: "moduleAsset",
      moduleId,
      after: { ids: added },
    });
    changed();
  }
  return { added: added.length };
}
