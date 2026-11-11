import "server-only";
import { auth } from "@/auth";
import { isAllowedEmail } from "@/lib/allowlist";
import { fetchFileContent, getDriveOwnerToken } from "@/lib/google-drive";
import { extensionForMime, isImageMime } from "@/lib/attachments";

/**
 * Streams one of the app's own Drive files back to a signed-in team member. Shared by
 * the task/asset attachment route and the media library route — the only difference
 * between them is which table the id is looked up in.
 *
 * Images render in the page; everything else downloads, because this route has no
 * range support, so a video served inline could not be seeked anyway.
 */
export async function serveDriveFile(file: {
  driveFileId: string;
  name: string;
  mimeType: string;
}): Promise<Response> {
  const session = await auth();
  if (!isAllowedEmail(session?.user?.email)) return new Response("Not signed in", { status: 401 });
  try {
    const bytes = await fetchFileContent(await getDriveOwnerToken(), file.driveFileId);
    const disposition = isImageMime(file.mimeType) ? "inline" : "attachment";
    // Headers only allow plain ASCII; accents and emoji in the name become "_".
    const safeName = file.name.replace(/[^\x20-\x7e]|["\\]/g, "_");
    const ext = extensionForMime(file.mimeType);
    const filename = ext && !safeName.toLowerCase().endsWith(`.${ext}`) ? `${safeName}.${ext}` : safeName;
    return new Response(bytes.body, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        // Even if something other than a plain image slipped through, it can't run anything.
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (e) {
    console.error("[drive] couldn't fetch", file.driveFileId, e instanceof Error ? e.message : e);
    return new Response("The file couldn't be loaded from Google Drive.", { status: 502 });
  }
}
