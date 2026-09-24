"use client";

import { useRef, useState, useTransition } from "react";
import {
  linkExistingScript,
  prepareScriptUpload,
  registerUploadedScript,
  startScript,
  unlinkScript,
  type ScriptActionResult,
} from "@/app/scripts/actions";
import type { ScriptInfo } from "@/lib/scripts";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const btn =
  "rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;
const secondaryBtn = `${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800`;

/** Uploads a Word file straight to Drive (resumable upload), converting it to a Google Doc. */
async function uploadToDrive(
  file: File,
  target: { accessToken: string; folderId?: string; name: string }
): Promise<string> {
  const init = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${target.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.type || "application/octet-stream",
      },
      body: JSON.stringify({
        name: target.name,
        mimeType: GOOGLE_DOC_MIME,
        ...(target.folderId ? { parents: [target.folderId] } : {}),
      }),
    }
  );
  const location = init.headers.get("Location");
  if (!init.ok || !location) throw new Error(`Google Drive refused the upload (${init.status}).`);

  const put = await fetch(location, { method: "PUT", body: file });
  if (!put.ok) throw new Error(`Upload to Google Drive failed (${put.status}).`);
  const { id } = (await put.json()) as { id: string };
  return id;
}

export function ScriptPanel({ moduleId, script }: { moduleId: string; script: ScriptInfo | null }) {
  const [pending, startTransition] = useTransition();
  const [busyLabel, setBusyLabel] = useState("");
  const [result, setResult] = useState<ScriptActionResult>({});
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const act = (label: string, fn: () => Promise<ScriptActionResult>) => {
    setResult({});
    setBusyLabel(label);
    startTransition(async () => {
      try {
        setResult(await fn());
      } catch (e) {
        setResult({ error: e instanceof Error ? e.message : "Something went wrong." });
      }
    });
  };

  const importFile = (file: File) =>
    act("Importing…", async () => {
      const target = await prepareScriptUpload(moduleId);
      if (target.error || !target.accessToken || !target.name) return { error: target.error };
      const fileId = await uploadToDrive(file, {
        accessToken: target.accessToken,
        folderId: target.folderId,
        name: target.name,
      });
      const registered = await registerUploadedScript(moduleId, fileId);
      return { ...registered, warning: registered.warning ?? target.warning };
    });

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      {script ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <a
              href={script.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:hover:decoration-zinc-100"
            >
              {script.label || "Script"} ↗
            </a>
            <p className="mt-0.5 text-sm text-zinc-500">
              {script.lastEdited
                ? `Last edited ${new Date(script.lastEdited).toLocaleString()}${
                    script.lastEditedBy ? ` by ${script.lastEditedBy}` : ""
                  }`
                : "Edit history isn't available for this link."}
            </p>
          </div>
          <button
            type="button"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            disabled={pending}
            onClick={() => {
              if (confirm("Unlink this script from the module? The document itself is not deleted."))
                act("Unlinking…", () => unlinkScript(moduleId, script.id));
            }}
          >
            Unlink
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No script yet. Start one from this module&apos;s Discovery Form, or bring in one that
            already exists. It&apos;s saved as a Google Doc in the module&apos;s Drive folder.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryBtn}
              disabled={pending}
              onClick={() => act("Creating Google Doc…", () => startScript(moduleId))}
            >
              Start script from Discovery Form
            </button>
            <button
              type="button"
              className={secondaryBtn}
              disabled={pending}
              onClick={() => fileInput.current?.click()}
            >
              Import Word file
            </button>
            <button
              type="button"
              className={secondaryBtn}
              disabled={pending}
              onClick={() => setShowLink((v) => !v)}
            >
              Link an existing doc
            </button>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept=".docx,.doc,.odt,.rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) importFile(file);
              }}
            />
          </div>
          {showLink && (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                act("Linking…", () => linkExistingScript(moduleId, linkUrl));
              }}
            >
              <input
                className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                type="url"
                required
                placeholder="https://docs.google.com/document/d/…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
              <button type="submit" className={secondaryBtn} disabled={pending}>
                Save link
              </button>
            </form>
          )}
        </>
      )}

      {pending && <p className="text-sm text-zinc-500">{busyLabel}</p>}
      {result.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {result.error}
        </p>
      )}
      {result.warning && <p className="text-sm text-amber-700 dark:text-amber-400">{result.warning}</p>}
    </div>
  );
}
