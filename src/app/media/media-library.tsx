"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ACCEPT_ATTR,
  MAX_UPLOAD_BYTES,
  fileKind,
  formatBytes,
  isAllowedMime,
  isImageMime,
} from "@/lib/attachments";
import {
  addMediaLink,
  prepareMediaUpload,
  registerMedia,
  removeMedia,
  updateMedia,
  type MediaInput,
} from "./media-actions";

export type MediaRow = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  mimeType: string | null;
  url: string | null;
  hasFile: boolean;
  addedBy: string | null;
  when: string;
  moduleId: string | null;
  moduleLabel: string | null;
  sceneId: string | null;
  assetId: string | null;
};

export type ModuleOption = { id: string; label: string };

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btn = "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;
const secondaryBtn = `${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800`;

const THUMB_SIDE = 480; // px; a grid tile never needs the full-size photo

/** A small copy of an image, uploaded alongside the original so the grid loads fast. */
async function makeThumb(file: File): Promise<File | null> {
  if (!isImageMime(file.type)) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, THUMB_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.75));
    if (!blob) return null;
    return new File([blob], `thumb-${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    return null; // e.g. HEIC the browser can't decode: the grid uses the original
  }
}

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
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve((JSON.parse(xhr.responseText) as { id: string }).id)
        : reject(new Error(`Upload to Google Drive failed (${xhr.status}).`));
    xhr.onerror = () => reject(new Error("The upload was interrupted."));
    xhr.send(file);
  });
}

const blankInput = (): MediaInput => ({ name: "", description: "", tags: [], moduleId: "", sceneId: "", assetId: "" });

/** Name, tags and which module an item belongs to — shared by the add and edit forms. */
function Fields({
  value,
  onChange,
  modules,
  knownTags,
  nameOptional,
}: {
  value: MediaInput;
  onChange: (v: MediaInput) => void;
  modules: ModuleOption[];
  knownTags: string[];
  nameOptional?: boolean;
}) {
  const set = <K extends keyof MediaInput>(k: K, v: MediaInput[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-2">
      <input
        aria-label="Name"
        className={inputCls}
        placeholder={nameOptional ? "Name (optional — the filename is used)" : "Name"}
        value={value.name}
        onChange={(e) => set("name", e.target.value)}
      />
      <input
        aria-label="Tags"
        list="media-tag-options"
        className={inputCls}
        placeholder="Tags, comma separated — e.g. reference, wafer carrier"
        value={value.tags.join(", ")}
        onChange={(e) => set("tags", e.target.value.split(","))}
      />
      <datalist id="media-tag-options">
        {knownTags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <textarea
        aria-label="Description"
        className={`${inputCls} min-h-16`}
        placeholder="Description (optional)"
        value={value.description}
        onChange={(e) => set("description", e.target.value)}
      />
      <select aria-label="Module" className={inputCls} value={value.moduleId} onChange={(e) => set("moduleId", e.target.value)}>
        <option value="">No module</option>
        {modules.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Tile({
  item,
  modules,
  knownTags,
}: {
  item: MediaRow;
  modules: ModuleOption[];
  knownTags: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MediaInput>({
    name: item.name,
    description: item.description ?? "",
    tags: item.tags,
    moduleId: item.moduleId ?? "",
    sceneId: item.sceneId ?? "",
    assetId: item.assetId ?? "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const href = item.url ?? `/api/media/${item.id}`;
  const image = item.hasFile && item.mimeType && isImageMime(item.mimeType);

  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={item.name}
        className="block aspect-square bg-zinc-100 dark:bg-zinc-900"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by our own signed-in route
          <img
            src={`/api/media/${item.id}?thumb=1`}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            {item.url ? "Link" : fileKind(item.mimeType ?? "")}
          </span>
        )}
      </a>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {editing ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await updateMedia(item.id, form);
                if (res.errors?.length) return setErrors(res.errors);
                setErrors([]);
                setEditing(false);
              });
            }}
          >
            {errors.length > 0 && (
              <ul role="alert" className="list-disc pl-5 text-xs text-red-700 dark:text-red-400">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <Fields value={form} onChange={setForm} modules={modules} knownTags={knownTags} />
            <div className="flex gap-2">
              <button type="submit" className={primaryBtn} disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </button>
              <button type="button" className={secondaryBtn} disabled={pending} onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-sm font-medium break-words">{item.name}</p>
            {item.description && (
              <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400" title={item.description}>
                {item.description}
              </p>
            )}
            {item.tags.length > 0 && (
              <ul className="flex flex-wrap gap-1">
                {item.tags.map((t) => (
                  <li key={t}>
                    <Link
                      href={`/media?tag=${encodeURIComponent(t)}`}
                      className="block rounded-full bg-teal-light px-2 py-0.5 text-xs font-medium text-brand hover:underline dark:bg-teal/25 dark:text-teal-light"
                    >
                      {t}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-auto pt-1 text-xs text-zinc-500">
              {item.moduleLabel ? (
                <Link href={`/modules/${item.moduleId}`} className="hover:underline underline-offset-4">
                  {item.moduleLabel}
                </Link>
              ) : (
                "No module"
              )}
              {item.addedBy && ` · ${item.addedBy}`}
            </p>
            <div className="flex gap-3 text-xs text-zinc-500">
              <button type="button" className="hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button
                type="button"
                className="hover:text-red-700 dark:hover:text-red-400"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Remove "${item.name}" from the library? The file stays in Drive.`)) return;
                  startTransition(async () => {
                    await removeMedia(item.id);
                  });
                }}
              >
                Remove
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

export function MediaLibrary({
  items,
  modules,
  knownTags,
}: {
  items: MediaRow[];
  modules: ModuleOption[];
  knownTags: string[];
}) {
  const [adding, setAdding] = useState<"file" | "link" | null>(null);
  const [form, setForm] = useState<MediaInput>(blankInput());
  const [linkUrl, setLinkUrl] = useState("");
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (adding === "file") panel.current?.focus();
  }, [adding]);

  async function upload(picked: File[]) {
    const ok = picked.filter((f) => isAllowedMime(f.type));
    if (!ok.length) return setErrors(["None of those files can go in the library."]);
    const tooBig = ok.find((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig) {
      return setErrors([`${tooBig.name} is ${formatBytes(tooBig.size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`]);
    }
    setBusy(true);
    setErrors([]);
    try {
      const prep = await prepareMediaUpload();
      if (prep.errors?.length || !prep.accessToken) throw new Error(prep.errors?.[0] ?? "Couldn't start the upload.");
      for (const [i, file] of ok.entries()) {
        const which = ok.length > 1 ? `${i + 1} of ${ok.length}` : file.name;
        setStatus(`Uploading ${which}…`);
        const fileId = await uploadToDrive(file, { accessToken: prep.accessToken, folderId: prep.folderId }, (p) =>
          setStatus(`Uploading ${which}… ${Math.round(p * 100)}%`)
        );
        const thumb = await makeThumb(file);
        const thumbId = thumb
          ? await uploadToDrive(thumb, { accessToken: prep.accessToken, folderId: prep.folderId })
          : null;
        // Several files share the tags and module, but each keeps its own filename
        // unless exactly one was picked and a name was typed.
        const res = await registerMedia(fileId, thumbId, {
          ...form,
          name: ok.length === 1 ? form.name : "",
        });
        if (res.errors?.length) throw new Error(res.errors[0]);
      }
      setAdding(null);
      setForm(blankInput());
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {adding === null && (
          <>
            <button type="button" className={primaryBtn} onClick={() => setAdding("file")}>
              + Upload files
            </button>
            <button type="button" className={secondaryBtn} onClick={() => setAdding("link")}>
              + Add a link
            </button>
          </>
        )}
      </div>

      {adding === "file" && (
        <div
          tabIndex={-1}
          ref={panel}
          onPaste={(e) => {
            const files = [...e.clipboardData.files];
            if (files.length) {
              e.preventDefault();
              void upload(files);
            }
          }}
          className="mb-6 space-y-3 rounded-lg border border-dashed border-zinc-400 bg-zinc-50 p-4 outline-none focus:border-zinc-600 dark:border-zinc-500 dark:bg-zinc-900/50"
        >
          {errors.length > 0 && (
            <ul role="alert" className="list-disc pl-5 text-sm text-red-700 dark:text-red-400">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <Fields value={form} onChange={setForm} modules={modules} knownTags={knownTags} nameOptional />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={primaryBtn} disabled={busy} onClick={() => fileInput.current?.click()}>
              Choose files…
            </button>
            <span className="text-xs text-zinc-500">{busy ? status : "or paste a screenshot (Ctrl+V)"}</span>
            <button
              type="button"
              className="ml-auto text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              disabled={busy}
              onClick={() => {
                setAdding(null);
                setErrors([]);
              }}
            >
              Cancel
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT_ATTR}
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              if (files.length) void upload(files);
            }}
          />
        </div>
      )}

      {adding === "link" && (
        <form
          className="mb-6 space-y-3 rounded-lg border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await addMediaLink(linkUrl, form);
              if (res.errors?.length) return setErrors(res.errors);
              setErrors([]);
              setLinkUrl("");
              setForm(blankInput());
              setAdding(null);
            });
          }}
        >
          {errors.length > 0 && (
            <ul role="alert" className="list-disc pl-5 text-sm text-red-700 dark:text-red-400">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <input
            aria-label="Link"
            type="url"
            required
            className={inputCls}
            placeholder="https://… a Drive file, a stock photo page, anything"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
          <Fields value={form} onChange={setForm} modules={modules} knownTags={knownTags} />
          <div className="flex gap-2">
            <button type="submit" className={primaryBtn} disabled={pending}>
              {pending ? "Saving…" : "Add to library"}
            </button>
            <button
              type="button"
              className={secondaryBtn}
              disabled={pending}
              onClick={() => {
                setAdding(null);
                setErrors([]);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-600">
          <p className="font-medium">Nothing in the library yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Upload images, video, documents or audio — tag them so they can be found again.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <Tile key={item.id} item={item} modules={modules} knownTags={knownTags} />
          ))}
        </ul>
      )}
    </>
  );
}
