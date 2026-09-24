"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  createDocFromHtml,
  createFolder,
  DriveError,
  driveIdFromUrl,
  findOrCreateRootFolder,
  getDriveOwnerToken,
  getFileMeta,
  shareWithEditors,
} from "@/lib/google-drive";
import { buildScriptHtml, moduleTitle } from "@/lib/script-template";

// Every Drive call here runs as the Drive owner (DRIVE_OWNER_EMAIL), not the
// person clicking, so all scripts end up in one Drive under one person's control.

export type ScriptActionResult = { error?: string; warning?: string };

type User = Awaited<ReturnType<typeof requireUser>>;

const ROOT_FOLDER_NAME = "ModuleTracker Scripts";

async function assertNoScript(moduleId: string) {
  const existing = await prisma.documentLink.findFirst({ where: { moduleId, type: "script" } });
  if (existing) throw new DriveError("This module already has a script linked. Remove it first.");
}

/**
 * Shares the owner's root scripts folder (and so every script in it) with the
 * emails in SHARE_SCRIPTS_WITH, as editors, without notification emails. Runs on
 * every create, so people added to the list later still get access to all scripts.
 */
async function shareRootWithTeam(token: string, rootId: string) {
  const owner = process.env.DRIVE_OWNER_EMAIL?.trim().toLowerCase();
  const people = (process.env.SHARE_SCRIPTS_WITH ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((e) => e && e !== owner);
  if (!people.length) return undefined;
  const failed = await shareWithEditors(token, rootId, people);
  return failed.length
    ? `Couldn't share the scripts folder with: ${failed.join(", ")}. Share "${ROOT_FOLDER_NAME}" from Google Drive.`
    : undefined;
}

/** Returns the module's folder inside the owner's root scripts folder, creating either on first use. */
async function ensureFolder(token: string, moduleId: string) {
  const root = await findOrCreateRootFolder(token, ROOT_FOLDER_NAME);
  const warning = await shareRootWithTeam(token, root.id);

  const mod = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });
  if (mod.driveFolderId) {
    const meta = await getFileMeta(token, mod.driveFolderId);
    if (meta && !meta.trashed) return { folderId: mod.driveFolderId, warning };
  }
  const folder = await createFolder(token, moduleTitle(mod), root.id);
  await prisma.module.update({ where: { id: moduleId }, data: { driveFolderId: folder.id } });
  return { folderId: folder.id, warning };
}

async function saveScriptLink(
  user: User,
  moduleId: string,
  link: { url: string; label: string; driveFileId: string | null }
) {
  await prisma.documentLink.create({
    data: { moduleId, type: "script", addedById: user.id, ...link },
  });
  revalidatePath("/", "layout");
}

async function run(fn: () => Promise<ScriptActionResult | void>): Promise<ScriptActionResult> {
  try {
    return (await fn()) ?? {};
  } catch (e) {
    if (e instanceof DriveError) return { error: e.message };
    throw e;
  }
}

/** Creates a Google Doc pre-filled from the module's Discovery Form answers. */
export async function startScript(moduleId: string): Promise<ScriptActionResult> {
  return run(async () => {
    const user = await requireUser();
    await assertNoScript(moduleId);
    const token = await getDriveOwnerToken();

    const mod = await prisma.module.findUniqueOrThrow({
      where: { id: moduleId },
      include: { scenes: { orderBy: { order: "asc" } } },
    });
    const { folderId, warning } = await ensureFolder(token, moduleId);
    const name = `${moduleTitle(mod)} – Script`;
    const doc = await createDocFromHtml(token, {
      name,
      html: buildScriptHtml(mod, mod.scenes),
      parentId: folderId,
    });
    await saveScriptLink(user, moduleId, { url: doc.webViewLink, label: name, driveFileId: doc.id });
    return { warning };
  });
}

/**
 * First half of a Word-file import: the browser uploads the file straight to
 * Drive (Vercel caps request bodies at ~4.5 MB, too small for docs with images),
 * so hand it a short-lived (1 hour), drive.file-scoped owner token and the
 * destination folder. drive.file limits the token to files this app created —
 * the scripts, which everyone signed in can already edit.
 */
export async function prepareScriptUpload(moduleId: string): Promise<
  ScriptActionResult & { accessToken?: string; folderId?: string; name?: string }
> {
  try {
    await requireUser();
    await assertNoScript(moduleId);
    const token = await getDriveOwnerToken();
    const mod = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });
    const { folderId, warning } = await ensureFolder(token, moduleId);
    return { accessToken: token, folderId, name: `${moduleTitle(mod)} – Script`, warning };
  } catch (e) {
    if (e instanceof DriveError) return { error: e.message };
    throw e;
  }
}

/** Second half of an import: verify the uploaded file and link it. */
export async function registerUploadedScript(
  moduleId: string,
  fileId: string
): Promise<ScriptActionResult> {
  return run(async () => {
    const user = await requireUser();
    await assertNoScript(moduleId);
    const meta = await getFileMeta(await getDriveOwnerToken(), fileId);
    if (!meta) throw new DriveError("The uploaded file couldn't be found in Google Drive.");
    await saveScriptLink(user, moduleId, {
      url: meta.webViewLink,
      label: meta.name,
      driveFileId: meta.id,
    });
  });
}

/** Links a script that already lives somewhere else (a Google Doc, Box, etc.). */
export async function linkExistingScript(
  moduleId: string,
  rawUrl: string
): Promise<ScriptActionResult> {
  return run(async () => {
    const user = await requireUser();
    await assertNoScript(moduleId);

    let url: URL;
    try {
      url = new URL(rawUrl.trim());
    } catch {
      throw new DriveError("That doesn't look like a link. Paste the full URL.");
    }
    if (url.protocol !== "https:") throw new DriveError("The link must start with https://");

    // Metadata (name, last edit) is only readable for files this app has opened.
    // Best-effort: a Drive hiccup shouldn't block saving a plain link.
    const fileId = driveIdFromUrl(url.href);
    const meta = fileId
      ? await getDriveOwnerToken()
          .then((token) => getFileMeta(token, fileId))
          .catch(() => null)
      : null;
    await saveScriptLink(user, moduleId, {
      url: url.href,
      label: meta?.name ?? "Script",
      driveFileId: meta?.id ?? null,
    });
  });
}

/** Unlinks the script from the module. The document itself is left untouched. */
export async function unlinkScript(moduleId: string, linkId: string): Promise<ScriptActionResult> {
  return run(async () => {
    await requireUser();
    await prisma.documentLink.deleteMany({ where: { id: linkId, moduleId, type: "script" } });
    revalidatePath("/", "layout");
  });
}
