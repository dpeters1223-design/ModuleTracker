"use client";

import { useRef, useState, useTransition } from "react";
import { ACCEPT_ATTR, MAX_UPLOAD_BYTES, fileKind, formatBytes, isAllowedMime, isImageMime } from "@/lib/attachments";
import {
  prepareFeatureRequestAttachmentUpload,
  registerFeatureRequestAttachment,
  removeFeatureRequestAttachment,
} from "@/app/requests/attachment-actions";

export type FeatureRequestAttachmentRow = { id: string; name: string; mimeType: string };

const MAX_SIDE = 2400;
const KEEP_AS_IS_BYTES = 1_500_000;

/** Same downscale as task images (src/components/task-images.tsx) — kept separate since that one is wired to task/asset actions specifically. */
export async function shrink(file: File): Promise<File> {
  if (file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= KEEP_AS_IS_BYTES) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.85));
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.${type === "image/png" ? "png" : "jpg"}`, { type });
  } catch {
    return file;
  }
}

export async function uploadToDrive(file: File, target: { accessToken: string; folderId?: string }, onProgress?: (fraction: number) => void): Promise<string> {
  const init = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${target.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": file.type || "application/octet-stream",
    },
    body: JSON.stringify({ name: file.name, ...(target.folderId ? { parents: [target.folderId] } : {}) }),
  });
  const location = init.headers.get("Location");
  if (!init.ok || !location) throw new Error(`Google Drive refused the upload (${init.status}).`);
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", location, true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`Upload to Google Drive failed (${xhr.status}).`));
      try {
        resolve((JSON.parse(xhr.responseText) as { id: string }).id);
      } catch {
        reject(new Error("Google Drive didn't say where the file went."));
      }
    };
    xhr.onerror = () => reject(new Error("The upload was interrupted."));
    xhr.send(file);
  });
}

/** Thumbnails for a request's attached images, with a remove (✕) button. */
export function FeatureRequestAttachmentList({ attachments }: { attachments: FeatureRequestAttachmentRow[] }) {
  const [pending, startTransition] = useTransition();
  if (!attachments.length) return null;
  const pictures = attachments.filter((a) => isImageMime(a.mimeType));
  const files = attachments.filter((a) => !isImageMime(a.mimeType));
  const remove = (a: FeatureRequestAttachmentRow) => {
    if (!confirm(`Remove "${a.name}"?`)) return;
    startTransition(async () => void (await removeFeatureRequestAttachment(a.id)));
  };
  return (
    <div className="mt-2 space-y-2">
      {pictures.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {pictures.map((img) => (
            <li key={img.id} className="group relative">
              <a href={`/api/feature-request-attachments/${img.id}`} target="_blank" rel="noopener" title={`${img.name} (opens full size)`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- served by our own signed-in route */}
                <img
                  src={`/api/feature-request-attachments/${img.id}`}
                  alt={img.name}
                  loading="lazy"
                  className="h-16 w-16 rounded-md border border-zinc-300 bg-zinc-100 object-cover dark:border-zinc-600 dark:bg-zinc-800"
                />
              </a>
              <button
                type="button"
                aria-label={`Remove ${img.name}`}
                disabled={pending}
                onClick={() => remove(img)}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 bg-white text-xs text-zinc-600 shadow-sm hover:text-red-700 sm:opacity-0 sm:group-hover:opacity-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-xs">
              <span className="shrink-0 rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {fileKind(f.mimeType)}
              </span>
              <a href={`/api/feature-request-attachments/${f.id}`} className="min-w-0 truncate underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:hover:decoration-zinc-100">
                {f.name}
              </a>
              <button type="button" disabled={pending} onClick={() => remove(f)} className="shrink-0 text-zinc-500 hover:text-red-700">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Pick/paste images for a feature request. Works in two modes: `featureRequestId`
 * set (already saved — uploads immediately) or `onPick` set (not saved yet — holds
 * the files and uploads them once the request exists, see RequestForm).
 */
export function FeatureRequestAttachPanel({
  featureRequestId,
  pickedCount,
  onPick,
  onDone,
}: {
  featureRequestId?: string;
  pickedCount?: number;
  onPick?: (files: File[]) => void;
  onDone?: () => void;
}) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handle(picked: File[]) {
    const ok = picked.filter((f) => isAllowedMime(f.type));
    const rejected = picked.filter((f) => !isAllowedMime(f.type));
    const tooBig = ok.filter((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig.length) {
      setError(`${tooBig[0].name} is ${formatBytes(tooBig[0].size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    if (!ok.length) {
      setError(rejected.length ? `${rejected[0].name || "That file"} isn't a type that can be attached.` : "Nothing to attach.");
      return;
    }
    setError(rejected.length ? `Skipping ${rejected.length} file${rejected.length === 1 ? "" : "s"} of a type that can't be attached.` : "");

    if (!featureRequestId) {
      onPick?.(ok);
      return;
    }
    setBusy(true);
    try {
      const upload = await prepareFeatureRequestAttachmentUpload(featureRequestId);
      if (upload.error || !upload.accessToken) throw new Error(upload.error ?? "Couldn't start the upload.");
      for (const [i, original] of ok.entries()) {
        const which = ok.length > 1 ? `${i + 1} of ${ok.length}` : original.name;
        setStatus(`Uploading ${which}…`);
        const file = isImageMime(original.type) ? await shrink(original) : original;
        const fileId = await uploadToDrive(file, { accessToken: upload.accessToken, folderId: upload.folderId }, (fraction) =>
          setStatus(`Uploading ${which}… ${Math.round(fraction * 100)}%`)
        );
        const res = await registerFeatureRequestAttachment(featureRequestId, fileId);
        if (res.error) throw new Error(res.error);
      }
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div
      onPaste={(e) => {
        const files = [...e.clipboardData.files];
        if (files.length) {
          e.preventDefault();
          void handle(files);
        }
      }}
      className="space-y-1"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {pickedCount ? `${pickedCount} image${pickedCount === 1 ? "" : "s"} attached` : "Attach an image"}
        </button>
        {busy && <span className="text-xs text-zinc-500">{status}</span>}
      </div>
      {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void handle(files);
        }}
      />
    </div>
  );
}
