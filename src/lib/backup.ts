import "server-only";
import { prisma } from "@/lib/prisma";
import {
  findOrCreateRootFolder,
  getGoogleAccessToken,
  listFilesInFolder,
  saveJsonFile,
  shareWithEditors,
  trashFile,
} from "@/lib/google-drive";

// Backups: a full JSON copy of all app data, kept in a Drive folder OUTSIDE the
// database. `latest.json` is replaced after every change; the nightly job also
// writes `backup-YYYY-MM-DD.json` and trashes dated copies past the retention.
//   BACKUP_OWNER_EMAIL  — whose Drive holds the folder (must have signed in once)
//   BACKUP_SHARE_WITH   — comma-separated emails given edit access to the folder

export const BACKUP_FOLDER_NAME = "ModuleTracker Backups";
const RETENTION_DAYS = 30;

/** Everything needed to rebuild the app's data. Google tokens are deliberately left out. */
export async function buildSnapshot() {
  const [users, modules, scenes, tasks, documentLinks, moduleVersions, changeOrders] = await Promise.all([
    prisma.user.findMany({ select: { id: true, email: true, name: true, image: true, createdAt: true } }),
    prisma.module.findMany(),
    prisma.scene.findMany(),
    prisma.task.findMany(),
    prisma.documentLink.findMany(),
    prisma.moduleVersion.findMany(),
    prisma.changeOrder.findMany(),
  ]);
  return {
    format: "moduletracker-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    counts: {
      modules: modules.length,
      scenes: scenes.length,
      tasks: tasks.length,
      documentLinks: documentLinks.length,
      moduleVersions: moduleVersions.length,
      changeOrders: changeOrders.length,
    },
    data: { users, modules, scenes, tasks, documentLinks, moduleVersions, changeOrders },
  };
}

async function backupTarget() {
  const email = process.env.BACKUP_OWNER_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("BACKUP_OWNER_EMAIL isn't configured.");
  const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!owner) throw new Error(`Backup owner ${email} has never signed in to ModuleTracker.`);
  const token = await getGoogleAccessToken(owner.id);
  const folder = await findOrCreateRootFolder(token, BACKUP_FOLDER_NAME);
  const shareWith = (process.env.BACKUP_SHARE_WITH ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((e) => e && e !== email);
  const failed = await shareWithEditors(token, folder.id, shareWith);
  if (failed.length) console.warn(`[backup] couldn't share backup folder with ${failed.join(", ")}`);
  return { token, folderId: folder.id };
}

/**
 * Writes the current data to the backup folder. `latest` replaces latest.json;
 * `daily` also writes today's dated copy and trashes dated copies older than
 * RETENTION_DAYS. Returns what was written.
 */
export async function saveBackup(kind: "latest" | "daily") {
  const snapshot = await buildSnapshot();
  const json = JSON.stringify(snapshot, null, 2);
  const { token, folderId } = await backupTarget();

  const written = ["latest.json"];
  await saveJsonFile(token, { folderId, name: "latest.json", json });

  let trashed = 0;
  if (kind === "daily") {
    const name = `backup-${snapshot.exportedAt.slice(0, 10)}.json`;
    await saveJsonFile(token, { folderId, name, json });
    written.push(name);
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10);
    for (const f of await listFilesInFolder(token, folderId, "backup-")) {
      const day = f.name.match(/^backup-(\d{4}-\d{2}-\d{2})\.json$/)?.[1];
      if (day && day < cutoff) {
        await trashFile(token, f.id);
        trashed++;
      }
    }
  }
  return { written, trashed, counts: snapshot.counts, bytes: json.length };
}
