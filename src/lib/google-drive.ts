import "server-only";
import { prisma } from "@/lib/prisma";

// Thin wrapper over the Drive v3 REST API using the signed-in user's own OAuth
// token, so files are created in (and owned by) that user's Drive.

export class DriveError extends Error {}

const RECONNECT =
  "Google Drive isn't connected. Sign out, sign back in, and allow Drive access when Google asks.";

/**
 * All scripts live in one account's Drive (DRIVE_OWNER_EMAIL), whoever clicks
 * the button, so a single person controls them. Returns that account's token.
 */
export async function getDriveOwnerToken(): Promise<string> {
  const email = process.env.DRIVE_OWNER_EMAIL?.trim().toLowerCase();
  if (!email) throw new DriveError("DRIVE_OWNER_EMAIL isn't configured on the server.");
  const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!owner) {
    throw new DriveError(
      `The Drive owner (${email}) needs to sign in to ModuleTracker once to connect their Google Drive.`
    );
  }
  try {
    return await getGoogleAccessToken(owner.id);
  } catch {
    throw new DriveError(
      `The Drive owner's Google connection has expired. ${email} needs to sign out and back in.`
    );
  }
}

export async function getGoogleAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleAccessToken: true, googleRefreshToken: true, googleTokenExpiresAt: true },
  });
  if (!user) throw new DriveError(RECONNECT);

  const fresh =
    user.googleAccessToken &&
    user.googleTokenExpiresAt &&
    user.googleTokenExpiresAt.getTime() > Date.now() + 60_000;
  if (fresh) return user.googleAccessToken!;
  if (!user.googleRefreshToken) throw new DriveError(RECONNECT);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: user.googleRefreshToken,
    }),
  });
  if (!res.ok) throw new DriveError(RECONNECT);
  const json = (await res.json()) as { access_token: string; expires_in: number };

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: json.access_token,
      googleTokenExpiresAt: new Date(Date.now() + json.expires_in * 1000),
    },
  });
  return json.access_token;
}

async function driveFetch<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new DriveError(`Google Drive error (${res.status}): ${body?.error?.message ?? res.statusText}`);
  }
  return res.json() as Promise<T>;
}

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
export const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

export type DriveFile = { id: string; name: string; webViewLink: string };
export type DriveFileMeta = DriveFile & {
  modifiedTime: string;
  lastModifyingUser?: { displayName?: string };
  trashed: boolean;
};

export async function createFolder(
  token: string,
  name: string,
  parentId?: string
): Promise<DriveFile> {
  return driveFetch(token, `${API}/files?fields=id,name,webViewLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
  });
}

/**
 * Finds a top-level folder with this name that this app created (drive.file only
 * lists the app's own files), or creates it.
 */
export async function findOrCreateRootFolder(token: string, name: string): Promise<DriveFile> {
  const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`;
  const found = await driveFetch<{ files: DriveFile[] }>(
    token,
    `${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&pageSize=1`
  );
  return found.files[0] ?? createFolder(token, name);
}

/** Uploads HTML and lets Drive convert it into a Google Doc. */
export async function createDocFromHtml(
  token: string,
  opts: { name: string; html: string; parentId?: string }
): Promise<DriveFile> {
  const boundary = `mt${crypto.randomUUID()}`;
  const metadata = {
    name: opts.name,
    mimeType: GOOGLE_DOC_MIME,
    ...(opts.parentId ? { parents: [opts.parentId] } : {}),
  };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${opts.html}\r\n` +
    `--${boundary}--`;
  return driveFetch(token, `${UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

/** Returns null when the file is gone or this app can't see it (drive.file scope). */
export async function getFileMeta(token: string, fileId: string): Promise<DriveFileMeta | null> {
  try {
    return await driveFetch(
      token,
      `${API}/files/${encodeURIComponent(fileId)}?fields=id,name,webViewLink,modifiedTime,lastModifyingUser(displayName),trashed`
    );
  } catch {
    return null;
  }
}

/** Gives each email edit access, without Google's notification email. Best-effort. */
export async function shareWithEditors(token: string, fileId: string, emails: string[]) {
  const failed: string[] = [];
  for (const email of emails) {
    try {
      await driveFetch(
        token,
        `${API}/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=false`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "user", role: "writer", emailAddress: email }),
        }
      );
    } catch {
      failed.push(email);
    }
  }
  return failed;
}

/** Pulls a Drive file ID out of a Docs/Drive URL, if it is one. */
export function driveIdFromUrl(url: string): string | null {
  const m = url.match(/\/d\/([\w-]{20,})/) ?? url.match(/[?&]id=([\w-]{20,})/);
  return m?.[1] ?? null;
}
