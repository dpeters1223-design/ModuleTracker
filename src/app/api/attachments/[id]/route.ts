import { prisma } from "@/lib/prisma";
import { serveDriveFile } from "@/lib/serve-drive";

// Serves a task's or asset's attachment from the Drive owner's account to signed-in
// team members only (the proxy already blocks everyone else; serveDriveFile re-checks).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attachment = await prisma.taskAttachment.findUnique({ where: { id } });
  if (!attachment) return new Response("Not found", { status: 404 });
  return serveDriveFile(attachment);
}
