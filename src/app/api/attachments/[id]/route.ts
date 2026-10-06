import { auth } from "@/auth";
import { isAllowedEmail } from "@/lib/allowlist";
import { prisma } from "@/lib/prisma";
import { fetchFileContent, getDriveOwnerToken } from "@/lib/google-drive";

// Serves a task image from the Drive owner's account to signed-in team members only
// (the proxy already blocks everyone else; this re-checks). Images never change once
// attached, so the browser may keep them for a day.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAllowedEmail(session?.user?.email)) return new Response("Not signed in", { status: 401 });

  const { id } = await params;
  const attachment = await prisma.taskAttachment.findUnique({ where: { id } });
  if (!attachment) return new Response("Not found", { status: 404 });
  try {
    const file = await fetchFileContent(await getDriveOwnerToken(), attachment.driveFileId);
    return new Response(file.body, {
      headers: {
        "Content-Type": attachment.mimeType,
        // Headers only allow plain ASCII; accents and emoji in the name become "_".
        "Content-Disposition": `inline; filename="${attachment.name.replace(/[^\x20-\x7e]|["\\]/g, "_")}"`,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        // Even if something other than a plain image slipped through, it can't run anything.
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (e) {
    console.error("[attachments] couldn't fetch", id, e instanceof Error ? e.message : e);
    return new Response("The image couldn't be loaded from Google Drive.", { status: 502 });
  }
}
