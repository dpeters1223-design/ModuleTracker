import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFileMeta, getGoogleAccessToken } from "@/lib/google-drive";

export type ScriptInfo = {
  id: string;
  url: string;
  label: string | null;
  lastEdited: string | null;
  lastEditedBy: string | null;
};

/** The viewer's Drive token, or null if they can't read Drive metadata right now. */
async function viewerDriveToken(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || !session.driveGranted) return null;
  return getGoogleAccessToken(session.user.id).catch(() => null);
}

/**
 * Script link per module id, with live "last edited" info from Drive where the
 * viewer's token can see the file. Modules without a script are absent.
 */
export async function getScripts(moduleIds: string[]): Promise<Map<string, ScriptInfo>> {
  const links = await prisma.documentLink.findMany({
    where: { moduleId: { in: moduleIds }, type: "script" },
    orderBy: { addedAt: "desc" },
  });
  const token = links.some((l) => l.driveFileId) ? await viewerDriveToken() : null;

  const result = new Map<string, ScriptInfo>();
  await Promise.all(
    links.map(async (link) => {
      if (result.has(link.moduleId)) return; // newest link wins
      result.set(link.moduleId, {
        id: link.id,
        url: link.url,
        label: link.label,
        lastEdited: null,
        lastEditedBy: null,
      });
      const meta = token && link.driveFileId ? await getFileMeta(token, link.driveFileId) : null;
      if (meta) {
        result.set(link.moduleId, {
          id: link.id,
          url: link.url,
          label: meta.name,
          lastEdited: meta.modifiedTime,
          lastEditedBy: meta.lastModifyingUser?.displayName ?? null,
        });
      }
    })
  );
  return result;
}

export async function getScript(moduleId: string): Promise<ScriptInfo | null> {
  return (await getScripts([moduleId])).get(moduleId) ?? null;
}
