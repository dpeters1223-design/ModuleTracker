"use server";

import { changed } from "@/lib/changed";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  copyFile,
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
import { logActivity } from "@/lib/activity";

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
  link: { url: string; label: string; driveFileId: string | null },
  how: { action: string; summary: string }
) {
  const saved = await prisma.documentLink.create({
    data: { moduleId, type: "script", addedById: user.id, ...link },
  });
  await logActivity(user, { ...how, entityType: "documentLink", entityId: saved.id, moduleId, after: saved });
  changed();
}

async function run(fn: () => Promise<ScriptActionResult | void>): Promise<ScriptActionResult> {
  try {
    return (await fn()) ?? {};
  } catch (e) {
    if (e instanceof DriveError) return { error: e.message };
    throw e;
  }
}

/**
 * Parses a pasted link and best-effort looks up its Drive metadata — shared by
 * "Link an existing doc" and "Link a draft" so the two don't drift apart. A Drive
 * hiccup shouldn't block saving a plain link, so the lookup is swallowed on failure.
 */
async function resolveLinkedDoc(rawUrl: string): Promise<{ url: string; name: string | null; driveFileId: string | null }> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new DriveError("That doesn't look like a link. Paste the full URL.");
  }
  if (url.protocol !== "https:") throw new DriveError("The link must start with https://");

  const fileId = driveIdFromUrl(url.href);
  const meta = fileId
    ? await getDriveOwnerToken()
        .then((token) => getFileMeta(token, fileId))
        .catch(() => null)
    : null;
  return { url: url.href, name: meta?.name ?? null, driveFileId: meta?.id ?? null };
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
    await saveScriptLink(
      user,
      moduleId,
      { url: doc.webViewLink, label: name, driveFileId: doc.id },
      { action: "script.start", summary: "Started the script from the Discovery Form" }
    );
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
    await saveScriptLink(
      user,
      moduleId,
      { url: meta.webViewLink, label: meta.name, driveFileId: meta.id },
      { action: "script.import", summary: `Imported a Word file as the script ("${meta.name}")` }
    );
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
    const doc = await resolveLinkedDoc(rawUrl);
    await saveScriptLink(
      user,
      moduleId,
      { url: doc.url, label: doc.name ?? "Script", driveFileId: doc.driveFileId },
      { action: "script.link", summary: "Linked an existing document as the script" }
    );
  });
}

/** Unlinks the script from the module. The document itself is left untouched. */
export async function unlinkScript(moduleId: string, linkId: string): Promise<ScriptActionResult> {
  return run(async () => {
    const user = await requireUser();
    const link = await prisma.documentLink.findFirst({ where: { id: linkId, moduleId, type: "script" } });
    if (!link) return;
    await prisma.documentLink.delete({ where: { id: linkId } });
    await logActivity(user, {
      action: "script.unlink",
      summary: "Unlinked the script (the document itself is untouched)",
      entityType: "documentLink",
      entityId: linkId,
      moduleId,
      before: link,
    });
    changed();
  });
}

// ── Drafts ──────────────────────────────────────────────────────────────────
// A draft is a separate copy of the script, edited without touching the official
// one. Promoting it swaps it in; the script it replaces becomes a draft itself
// (relabeled, never deleted), so nothing is ever silently lost — closer to a Git
// branch than a backup.

/**
 * Makes a Drive-side copy of the current script to edit separately. Only works
 * when the script is a file this app's token can already see (one it created or
 * imported) — a script linked in from elsewhere can't be auto-copied, so this
 * fails with a message pointing at "Link a draft" instead.
 */
export async function startScriptDraft(moduleId: string): Promise<ScriptActionResult> {
  return run(async () => {
    const user = await requireUser();
    const script = await prisma.documentLink.findFirst({ where: { moduleId, type: "script" } });
    if (!script) throw new DriveError("There's no script yet to draft from.");
    if (!script.driveFileId) {
      throw new DriveError(
        'This script isn\'t a file the app can copy automatically. Duplicate it yourself in Drive (File → Make a copy), then use "Link a draft" below.'
      );
    }
    const token = await getDriveOwnerToken();
    const { folderId, warning } = await ensureFolder(token, moduleId);
    const stamp = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const name = `${script.label ?? "Script"} — draft ${stamp}`;
    let copy;
    try {
      copy = await copyFile(token, script.driveFileId, { name, parentId: folderId });
    } catch (e) {
      // Keep Google's own message (rate limits, a real outage) rather than always
      // blaming drive.file scope — that's a likely cause, not the only one.
      const reason = e instanceof Error ? e.message : "Drive wouldn't copy that file";
      throw new DriveError(
        `${reason}. If it's because this isn't a file the app created, duplicate it yourself (File → Make a copy) and use "Link a draft" below.`
      );
    }
    const draft = await prisma.documentLink.create({
      data: { moduleId, type: "script_draft", addedById: user.id, url: copy.webViewLink, label: copy.name, driveFileId: copy.id },
    });
    await logActivity(user, {
      action: "script.draft.start",
      summary: `Started a draft ("${copy.name}")`,
      entityType: "documentLink",
      entityId: draft.id,
      moduleId,
      after: draft,
    });
    changed();
    return { warning };
  });
}

/** Links a draft someone already made a copy of by hand, rather than one the app copied itself. */
export async function linkScriptDraft(moduleId: string, rawUrl: string): Promise<ScriptActionResult> {
  return run(async () => {
    const user = await requireUser();
    const doc = await resolveLinkedDoc(rawUrl);
    const draft = await prisma.documentLink.create({
      data: {
        moduleId,
        type: "script_draft",
        addedById: user.id,
        url: doc.url,
        label: doc.name ?? "Draft",
        driveFileId: doc.driveFileId,
      },
    });
    await logActivity(user, {
      action: "script.draft.link",
      summary: "Linked a draft script",
      entityType: "documentLink",
      entityId: draft.id,
      moduleId,
      after: draft,
    });
    changed();
  });
}

/**
 * Swaps a draft in as the official script. The script it replaces isn't deleted —
 * it becomes a labeled draft itself, so promoting the wrong one is never a real
 * mistake, only a detour.
 */
export async function promoteScriptDraft(moduleId: string, draftId: string): Promise<ScriptActionResult> {
  return run(async () => {
    const user = await requireUser();
    // The read that decides what to demote lives inside the transaction too, so
    // two people promoting different drafts at once can't both read the same
    // "current" script and each demote it — the second transaction sees what the
    // first one already committed.
    const { draft, current } = await prisma.$transaction(async (tx) => {
      const draft = await tx.documentLink.findFirst({ where: { id: draftId, moduleId, type: "script_draft" } });
      if (!draft) throw new DriveError("That draft isn't there anymore.");
      const current = await tx.documentLink.findFirst({ where: { moduleId, type: "script" } });

      if (current) {
        const stamp = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        await tx.documentLink.update({
          where: { id: current.id },
          data: { type: "script_draft", label: `Superseded ${stamp} — ${current.label ?? "Script"}` },
        });
      }
      // Dropping the label only makes sense when there's a driveFileId to re-derive
      // it from live Drive metadata (getScript does that lookup) — otherwise a
      // hand-typed/linked draft's name would be wiped with nothing to replace it.
      await tx.documentLink.update({
        where: { id: draft.id },
        data: { type: "script", label: draft.driveFileId ? null : draft.label },
      });
      return { draft, current };
    });

    await logActivity(user, {
      action: "script.draft.promote",
      summary: `Promoted "${draft.label ?? "a draft"}" to be the script`,
      entityType: "documentLink",
      entityId: draft.id,
      moduleId,
      before: current,
      after: draft,
    });
    changed();
  });
}

/** Discards a draft. The Drive file itself is left untouched. */
export async function discardScriptDraft(moduleId: string, draftId: string): Promise<ScriptActionResult> {
  return run(async () => {
    const user = await requireUser();
    const draft = await prisma.documentLink.findFirst({ where: { id: draftId, moduleId, type: "script_draft" } });
    if (!draft) return;
    // Guard the delete with the same type check, in one query: if someone promoted
    // this exact draft a moment ago, it's no longer type script_draft and this
    // deletes nothing instead of blindly removing whatever the id now points to.
    const { count } = await prisma.documentLink.deleteMany({ where: { id: draftId, moduleId, type: "script_draft" } });
    if (!count) return;
    await logActivity(user, {
      action: "script.draft.remove",
      summary: `Discarded the draft "${draft.label ?? "Draft"}"`,
      entityType: "documentLink",
      entityId: draftId,
      moduleId,
      before: draft,
    });
    changed();
  });
}
