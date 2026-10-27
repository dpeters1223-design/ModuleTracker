// What can be attached to a task or an asset. Shared by the browser (which filters
// before uploading) and the server action (which re-checks after the upload).

/**
 * An explicit allowlist, not "anything that isn't dangerous". The file is served back
 * from our own domain, so a type the browser will run — SVG and HTML both carry
 * scripts — must never be on it.
 */
const IMAGE_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];

const FILE_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

const ALLOWED = new Set([...IMAGE_MIME, ...FILE_MIME]);

export const isImageMime = (mime: string) => IMAGE_MIME.includes(mime);
export const isAllowedMime = (mime: string) => ALLOWED.has(mime);

/** For the file input's accept attribute. */
export const ACCEPT_ATTR = [...ALLOWED].join(",");

/**
 * A single PUT with no resume, going through one Drive account, so a huge file is a
 * bad bet. Big enough for a module's video, small enough to fail fast and clearly.
 */
export const MAX_UPLOAD_BYTES = 300_000_000;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

/** A short word for the kind of file, for the icon-less file rows. */
export function fileKind(mime: string): string {
  if (isImageMime(mime)) return "Image";
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("video/")) return "Video";
  if (mime.startsWith("audio/")) return "Audio";
  if (mime.includes("word")) return "Word";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime === "text/csv") return "Sheet";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "Slides";
  if (mime === "application/zip") return "Zip";
  if (mime.startsWith("text/")) return "Text";
  return "File";
}
