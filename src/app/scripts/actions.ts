"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  createDocFromHtml,
  createFolder,
  DriveError,
  driveIdFromUrl,
  getFileMeta,
  getGoogleAccessToken,
  shareWithEditors,
} from "@/lib/google-drive";
import { buildScriptHtml, moduleTitle } from "@/lib/script-template";

export type ScriptActionResult = { error?: string; warning?: string };

type User = Awaited<ReturnType<typeof requireUser>>;

async function driveToken(user: User) {
  if (!user.driveGranted) {
    throw new DriveError(
      "Drive access wasn't granted at sign-in. Sign out, sign back in, and tick the Google Drive box."
    );
  }
  return getGoogleAccessToken(user.id);
}

async function assertNoScript(moduleId: string) {
  const existing = await prisma.documentLink.findFirst({ where: { moduleId, type: "script" } });
  if (existing) throw new DriveError("This module already has a script linked. Remove it first.");
}

/**
 * Returns the module's Drive folder, creating it (and sharing it with the rest
 * of the team) on first use. Falls back to the user's My Drive root if the
 * stored folder isn't reachable with this user's token.
 */
async function ensureFolder(token: string, user: User, moduleId: string) {
  const mod = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });
  if (mod.driveFolderId) {
    const meta = await getFileMeta(token, mod.driveFolderId);
    if (meta && !meta.trashed) return { folderId: mod.driveFolderId, warning: undefined };
    return {
      folderId: undefined,
      warning:
        "The module's Drive folder isn't accessible to your account, so the file was created in your My Drive instead.",
    };
  }

  const folder = await createFolder(token, moduleTitle(mod));
  await prisma.module.update({ where: { id: moduleId }, data: { driveFolderId: folder.id } });

  const team = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((e) => e && e !== user.email.toLowerCase());
  const failed = await shareWithEditors(token, folder.id, team);
  return {
    folderId: folder.id,
    warning: failed.length
      ? `Couldn't share the module folder with: ${failed.join(", ")}. Share it from Google Drive.`
      : undefined,
  };
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
    const token = await driveToken(user);

    const mod = await prisma.module.findUniqueOrThrow({
      where: { id: moduleId },
      include: { scenes: { orderBy: { order: "asc" } } },
    });
    const { folderId, warning } = await ensureFolder(token, user, moduleId);
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
 * so hand it a short-lived, drive.file-scoped token and the destination folder.
 */
export async function prepareScriptUpload(moduleId: string): Promise<
  ScriptActionResult & { accessToken?: string; folderId?: string; name?: string }
> {
  try {
    const user = await requireUser();
    await assertNoScript(moduleId);
    const token = await driveToken(user);
    const mod = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });
    const { folderId, warning } = await ensureFolder(token, user, moduleId);
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
    const meta = await getFileMeta(await driveToken(user), fileId);
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
    const meta =
      fileId && user.driveGranted
        ? await getGoogleAccessToken(user.id)
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
