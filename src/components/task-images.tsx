"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  prepareAttachmentUpload,
  registerAttachment,
  removeAttachment,
  type AttachTarget,
} from "@/app/modules/[id]/attachment-actions";

export type TaskImage = { id: string; name: string };

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

/** Uploads one image straight to Drive (resumable upload) and returns its file id. */
async function uploadToDrive(file: File, target: { accessToken: string; folderId?: string }): Promise<string> {
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
  const put = await fetch(location, { method: "PUT", body: file });
  if (!put.ok) throw new Error(`Upload to Google Drive failed (${put.status}).`);
  return ((await put.json()) as { id: string }).id;
}

/** A task's image thumbnails; click one to open it full size, ✕ to remove it. */
export function TaskImages({ moduleId, images, size = "h-16 w-16" }: { moduleId: string; images: TaskImage[]; size?: string }) {
  const [pending, startTransition] = useTransition();
  if (!images.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {images.map((img) => (
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
          <button
            type="button"
            aria-label={`Remove image ${img.name}`}
            title="Remove image"
            disabled={pending}
            onClick={() => {
              if (!confirm("Remove this image?")) return;
              startTransition(async () => {
                await removeAttachment(moduleId, img.id);
              });
            }}
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 bg-white text-xs text-zinc-600 shadow-sm hover:text-red-700 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The "Attach image" panel: pick files (several at once) or paste a screenshot. */
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

  async function attach(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/") && !f.type.includes("svg"));
    if (!images.length) {
      setError("That isn't a photo or screenshot.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const upload = await prepareAttachmentUpload(moduleId, target);
      if (upload.error || !upload.accessToken) throw new Error(upload.error ?? "Couldn't start the upload.");
      for (const [i, original] of images.entries()) {
        setStatus(images.length > 1 ? `Uploading ${i + 1} of ${images.length}…` : "Uploading…");
        const file = await shrink(original);
        const fileId = await uploadToDrive(file, { accessToken: upload.accessToken, folderId: upload.folderId });
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
          Choose images…
        </button>
        <span className="text-xs text-zinc-500">{busy ? status : "or paste a screenshot (Ctrl+V)"}</span>
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
        accept="image/*"
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
