"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { AlbumSummary } from "@/lib/media";
import type { ModuleOption } from "../media-library";
import { createAlbum, deleteAlbum, updateAlbum, type AlbumInput } from "../album-actions";
import { AlbumCoverMosaic } from "./album-cover";

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btn = "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;
const secondaryBtn = `${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800`;

const blank = (): AlbumInput => ({ name: "", description: "", tags: [], moduleId: "" });

/** Name, tag rule and module — the whole of an album besides what's pinned into it. */
function Fields({
  value,
  onChange,
  modules,
  knownTags,
}: {
  value: AlbumInput;
  onChange: (v: AlbumInput) => void;
  modules: ModuleOption[];
  knownTags: string[];
}) {
  const set = <K extends keyof AlbumInput>(k: K, v: AlbumInput[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-2">
      <input
        aria-label="Album name"
        className={inputCls}
        placeholder="Album name — e.g. Reference images, Shots for review"
        value={value.name}
        onChange={(e) => set("name", e.target.value)}
      />
      <input
        aria-label="Tags that fill the album"
        list="album-tag-options"
        className={inputCls}
        placeholder="Fill automatically from tags, comma separated (optional)"
        value={value.tags.join(", ")}
        onChange={(e) => set("tags", e.target.value.split(","))}
      />
      <datalist id="album-tag-options">
        {knownTags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <p className="text-xs text-zinc-500">
        Anything carrying one of those tags joins the album on its own. You can also add items by hand from the
        library — both end up in the same album.
      </p>
      <textarea
        aria-label="Description"
        className={`${inputCls} min-h-16`}
        placeholder="What this album is for (optional)"
        value={value.description}
        onChange={(e) => set("description", e.target.value)}
      />
      <select
        aria-label="Module"
        className={inputCls}
        value={value.moduleId}
        onChange={(e) => set("moduleId", e.target.value)}
      >
        <option value="">Not tied to a module</option>
        {modules.map((m) => (
          <option key={m.id} value={m.id}>
            Show on {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Errors({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <ul role="alert" className="list-disc pl-5 text-xs text-red-700 dark:text-red-400">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}

function Card({
  album,
  modules,
  knownTags,
}: {
  album: AlbumSummary;
  modules: ModuleOption[];
  knownTags: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<AlbumInput>({
    name: album.name,
    description: album.description ?? "",
    tags: album.tags,
    moduleId: album.moduleId ?? "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
      <Link href={`/media/albums/${album.id}`} title={album.name} className="block">
        <AlbumCoverMosaic covers={album.covers} className="aspect-square" />
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {editing ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await updateAlbum(album.id, form);
                if (res.errors?.length) return setErrors(res.errors);
                setErrors([]);
                setEditing(false);
              });
            }}
          >
            <Errors errors={errors} />
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
            <Link href={`/media/albums/${album.id}`} className="text-sm font-medium break-words hover:underline underline-offset-4">
              {album.name}
            </Link>
            <p className="text-xs text-zinc-500">
              {album.count} item{album.count === 1 ? "" : "s"}
              {album.matched > 0 && ` · ${album.matched} by tag`}
            </p>
            {album.description && (
              <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400" title={album.description}>
                {album.description}
              </p>
            )}
            {album.tags.length > 0 && (
              <ul className="flex flex-wrap gap-1">
                {album.tags.map((t) => (
                  <li
                    key={t}
                    className="rounded-full bg-teal-light px-2 py-0.5 text-xs font-medium text-brand dark:bg-teal/25 dark:text-teal-light"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-auto pt-1 text-xs text-zinc-500">
              {album.moduleLabel ? (
                <Link href={`/modules/${album.moduleId}`} className="hover:underline underline-offset-4">
                  {album.moduleLabel}
                </Link>
              ) : (
                "No module"
              )}
            </p>
            <div className="flex gap-3 text-xs text-zinc-500">
              <button
                type="button"
                className="hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <button
                type="button"
                className="hover:text-red-700 dark:hover:text-red-400"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Delete the album "${album.name}"? The media in it stays in the library.`)) return;
                  startTransition(async () => {
                    await deleteAlbum(album.id);
                  });
                }}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

export function AlbumGrid({
  albums,
  modules,
  knownTags,
}: {
  albums: AlbumSummary[];
  modules: ModuleOption[];
  knownTags: string[];
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<AlbumInput>(blank());
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  return (
    <>
      {adding ? (
        <form
          className="mb-6 space-y-3 rounded-lg border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await createAlbum(form);
              if (res.errors?.length) return setErrors(res.errors);
              setErrors([]);
              setForm(blank());
              setAdding(false);
            });
          }}
        >
          <Errors errors={errors} />
          <Fields value={form} onChange={setForm} modules={modules} knownTags={knownTags} />
          <div className="flex gap-2">
            <button type="submit" className={primaryBtn} disabled={pending}>
              {pending ? "Creating…" : "Create album"}
            </button>
            <button
              type="button"
              className={secondaryBtn}
              disabled={pending}
              onClick={() => {
                setAdding(false);
                setErrors([]);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-4">
          <button type="button" className={primaryBtn} onClick={() => setAdding(true)}>
            + New album
          </button>
        </div>
      )}

      {albums.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-600">
          <p className="font-medium">No albums yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            An album gathers media by tag and by hand — a reference set, the shots for one review, whatever the
            team needs to look at together.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {albums.map((a) => (
            <Card key={a.id} album={a} modules={modules} knownTags={knownTags} />
          ))}
        </ul>
      )}
    </>
  );
}
