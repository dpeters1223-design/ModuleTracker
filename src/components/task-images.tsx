"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ACCEPT_ATTR,
  MAX_UPLOAD_BYTES,
  fileKind,
  formatBytes,
  isAllowedMime,
  isImageMime,
} from "@/lib/attachments";
import {
  prepareAttachmentUpload,
  registerAttachment,
  removeAttachment,
  type AttachTarget,
} from "@/app/modules/[id]/attachment-actions";

export type TaskImage = { id: string; name: string; mimeType: string };

const MAX_SIDE = 2400; // px; bigger photos are scaled down before upload
const KEEP_AS_IS_BYTES = 1_500_000;

/** Scales big photos down (JPEG, or PNG for screenshots); small images and GIFs go up unchanged. */
async function shrink(file: File): Promise<File> {
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
    return file; // e.g. HEIC in a browser that can't decode it: upload the original
  }
}

/**
 * Uploads one file straight to Drive (resumable upload) and returns its file id.
 * The PUT goes through XHR rather than fetch so a big video can report progress —
 * fetch has no upload progress event.
 */
async function uploadToDrive(
  file: File,
  target: { accessToken: string; folderId?: string },
  onProgress?: (fraction: number) => void
): Promise<string> {
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
      if (xhr.status < 200 || xhr.status >= 300) {
        return reject(new Error(`Upload to Google Drive failed (${xhr.status}).`));
      }
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

/**
 * A task's attachments: images as thumbnails you can open full size, everything else
 * as a labelled row that downloads. ✕ removes one.
 */
export function TaskImages({ moduleId, images, size = "h-16 w-16" }: { moduleId: string; images: TaskImage[]; size?: string }) {
  const [pending, startTransition] = useTransition();
  if (!images.length) return null;
  const remove = (img: TaskImage) => {
    if (!confirm(`Remove "${img.name}"?`)) return;
    startTransition(async () => {
      await removeAttachment(moduleId, img.id);
    });
  };
  const removeBtn = (img: TaskImage, extra: string) => (
    <button
      type="button"
      aria-label={`Remove ${img.name}`}
      title="Remove"
      disabled={pending}
      onClick={() => remove(img)}
      className={`flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 bg-white text-xs text-zinc-600 shadow-sm hover:text-red-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 ${extra}`}
    >
      ✕
    </button>
  );
  const pictures = images.filter((i) => isImageMime(i.mimeType));
  const files = images.filter((i) => !isImageMime(i.mimeType));

  return (
    <>
      {pictures.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {pictures.map((img) => (
            <li key={img.id} className="group relative">
              <a href={`/api/attachments/${img.id}`} target="_blank" rel="noopener" title={`${img.name} (opens full size)`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- served by our own signed-in route */}
                <img
                  src={`/api/attachments/${img.id}`}
                  alt={img.name}
                  loading="lazy"
                  className={`${size} rounded-md border border-zinc-300 bg-zinc-100 object-cover dark:border-zinc-600 dark:bg-zinc-800`}
                />
              </a>
              {removeBtn(img, "absolute -top-1.5 -right-1.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100")}
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-xs">
              <span className="shrink-0 rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {fileKind(f.mimeType)}
              </span>
              <a
                href={`/api/attachments/${f.id}`}
                className="min-w-0 truncate underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:hover:decoration-zinc-100"
                title={`${f.name} (downloads)`}
              >
                {f.name}
              </a>
              {removeBtn(f, "shrink-0")}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The "Attach file" panel: pick files (several at once) or paste a screenshot. */
export function AttachImagePanel({
  moduleId,
  taskId,
  target = { kind: "task", id: taskId! },
  onDone,
}: {
  moduleId: string;
  /** Shorthand for target = { kind: "task", id: taskId }. */
  taskId?: string;
  target?: AttachTarget;
  onDone: () => void;
}) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Focus the panel once when it opens, so Ctrl+V / ⌘V pastes a screenshot straight in.
  useEffect(() => panel.current?.focus(), []);

  async function attach(picked: File[]) {
    const ok = picked.filter((f) => isAllowedMime(f.type));
    const rejected = picked.filter((f) => !isAllowedMime(f.type));
    const tooBig = ok.filter((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig.length) {
      setError(`${tooBig[0].name} is ${formatBytes(tooBig[0].size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    if (!ok.length) {
      setError(
        rejected.length
          ? `${rejected[0].name || "That file"} isn't a type that can be attached.`
          : "Nothing to attach."
      );
      return;
    }
    setBusy(true);
    setError(rejected.length ? `Skipping ${rejected.length} file${rejected.length === 1 ? "" : "s"} of a type that can't be attached.` : "");
    try {
      const upload = await prepareAttachmentUpload(moduleId, target);
      if (upload.error || !upload.accessToken) throw new Error(upload.error ?? "Couldn't start the upload.");
      for (const [i, original] of ok.entries()) {
        const which = ok.length > 1 ? `${i + 1} of ${ok.length}` : original.name;
        setStatus(`Uploading ${which}…`);
        // Only photos are worth re-encoding; everything else goes up as it is.
        const file = isImageMime(original.type) ? await shrink(original) : original;
        const fileId = await uploadToDrive(
          file,
          { accessToken: upload.accessToken, folderId: upload.folderId },
          (fraction) => setStatus(`Uploading ${which}… ${Math.round(fraction * 100)}%`)
        );
        const res = await registerAttachment(moduleId, target, fileId);
        if (res.error) throw new Error(res.error);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div
      tabIndex={-1}
      ref={panel}
      onPaste={(e) => {
        const files = [...e.clipboardData.files];
        if (files.length) {
          e.preventDefault();
          void attach(files);
        }
      }}
      className="mt-2 space-y-2 rounded-md border border-dashed border-zinc-400 bg-zinc-50 p-3 text-sm outline-none focus:border-zinc-600 dark:border-zinc-500 dark:bg-zinc-900/50"
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Choose files…
        </button>
        <span className="text-xs text-zinc-500">
          {busy ? status : "or paste a screenshot (Ctrl+V) · images, PDFs, docs, audio, video"}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={onDone}
          className="ml-auto text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void attach(files);
        }}
      />
    </div>
  );
}
