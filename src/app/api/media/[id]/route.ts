import { prisma } from "@/lib/prisma";
import { serveDriveFile } from "@/lib/serve-drive";

/**
 * Serves a media library file. `?thumb=1` asks for the small copy made at upload time,
 * falling back to the original when there isn't one (a non-image, or an item uploaded
 * before thumbnails existed).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.mediaItem.findUnique({
    where: { id },
    select: { name: true, mimeType: true, driveFileId: true, thumbFileId: true },
  });
  if (!item?.driveFileId || !item.mimeType) return new Response("Not found", { status: 404 });

  const wantsThumb = new URL(request.url).searchParams.get("thumb") === "1";
  const driveFileId = wantsThumb && item.thumbFileId ? item.thumbFileId : item.driveFileId;
  return serveDriveFile({ driveFileId, name: item.name, mimeType: item.mimeType });
}
