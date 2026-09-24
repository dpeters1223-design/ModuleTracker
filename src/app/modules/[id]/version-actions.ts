"use server";

import { changed } from "@/lib/changed";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { logActivity } from "@/lib/activity";

export type VersionInput = {
  version: string;
  platform: string;
  workspace: string;
  experienceId: string;
  launchUrl: string;
  releasedAt: string; // "YYYY-MM-DD" or ""
  notes: string;
};

export type VersionResult = { errors?: string[] };

export async function addVersion(moduleId: string, input: VersionInput): Promise<VersionResult> {
  const user = await requireUser();
  const t = (s: unknown) => (typeof s === "string" ? s.trim() : "");
  const d = {
    version: t(input.version),
    platform: t(input.platform),
    workspace: t(input.workspace),
    experienceId: t(input.experienceId),
    launchUrl: t(input.launchUrl),
    releasedAt: t(input.releasedAt),
    notes: t(input.notes),
  };

  const errors: string[] = [];
  if (!d.version) errors.push("Version is required, e.g. v3.");
  if ([d.version, d.platform, d.workspace, d.experienceId].some((s) => s.length > 200) || d.notes.length > 5000) {
    errors.push("Some entries are too long.");
  }
  if (d.launchUrl) {
    try {
      if (new URL(d.launchUrl).protocol !== "https:") errors.push("The launch link must start with https://");
    } catch {
      errors.push("The launch link isn't a valid link.");
    }
  }
  if (d.releasedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(d.releasedAt) || isNaN(Date.parse(d.releasedAt)))) {
    errors.push("The release date isn't a valid date.");
  }
  if (errors.length) return { errors };

  const version = await prisma.moduleVersion.create({
    data: {
      moduleId,
      version: d.version,
      platform: d.platform || null,
      workspace: d.workspace || null,
      experienceId: d.experienceId || null,
      launchUrl: d.launchUrl || null,
      // Calendar day: noon UTC so no timezone shifts it.
      releasedAt: d.releasedAt ? new Date(`${d.releasedAt}T12:00:00Z`) : null,
      notes: d.notes || null,
    },
  });
  await logActivity(user, {
    action: "version.add",
    summary: `Logged version ${version.version}`,
    entityType: "moduleVersion",
    entityId: version.id,
    moduleId,
    after: version,
  });
  changed();
  return {};
}

export async function deleteVersion(moduleId: string, versionId: string): Promise<VersionResult> {
  const user = await requireUser();
  const version = await prisma.moduleVersion.findFirst({ where: { id: versionId, moduleId } });
  if (!version) return {};
  await prisma.moduleVersion.delete({ where: { id: versionId } });
  await logActivity(user, {
    action: "version.delete",
    summary: `Deleted version ${version.version}`,
    entityType: "moduleVersion",
    entityId: versionId,
    moduleId,
    before: version,
  });
  changed();
  return {};
}
