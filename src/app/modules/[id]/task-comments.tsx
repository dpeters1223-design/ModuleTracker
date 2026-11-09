"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { addTaskComment, deleteTaskComment, updateTaskComment } from "./comment-actions";

export type CommentRow = {
  id: string;
  authorName: string | null;
  /** Already formatted server-side, in the team's time zone. */
  when: string;
  body: string;
  /** Whether the person reading this is the one who wrote it. */
  mine: boolean;
};

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btn = "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-brand text-white hover:bg-brand-hover dark:bg-gold dark:text-brand dark:hover:bg-gold-dark`;
const secondaryBtn = `${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800`;

/** Highlights "@Full Name" tokens so a mention reads as one even in plain text. */
function withMentions(body: string, names: string[]) {
  if (!names.length) return body;
  const pattern = names
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const re = new RegExp(`@(${pattern})\\b`, "gi");
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m.index > last) parts.push(body.slice(last, m.index));
    parts.push(
      <span key={m.index} className="font-medium text-brand dark:text-gold">
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  parts.push(body.slice(last));
  return parts;
}

/** A plain textarea where typing "@" opens a dropdown of team names to mention. */
function MentionTextarea({
  value,
  onChange,
  names,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  names: string[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [start, setStart] = useState(0);

  const matches = useMemo(
    () => (open ? names.filter((n) => n.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : []),
    [open, names, query]
  );

  const checkTrigger = (text: string, caret: number) => {
    const upTo = text.slice(0, caret);
    const at = upTo.lastIndexOf("@");
    if (at === -1 || /\s/.test(upTo.slice(at + 1)) || (at > 0 && /\S/.test(upTo[at - 1]) && upTo[at - 1] !== "\n")) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setQuery(upTo.slice(at + 1));
    setStart(at);
  };

  const pick = (name: string) => {
    const caret = ref.current?.selectionStart ?? value.length;
    const next = `${value.slice(0, start)}@${name} ${value.slice(caret)}`;
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => {
      const pos = start + name.length + 2;
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        aria-label="Comment"
        className={`${inputCls} min-h-20`}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
          checkTrigger(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyUp={(e) => checkTrigger(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-56 overflow-hidden rounded-md border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {matches.map((n) => (
            <li key={n}>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(n)}
              >
                {n}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-zinc-500">Type @ to mention someone — they&apos;ll get a Slack ping.</p>
    </div>
  );
}

function Entry({ moduleId, entry, names }: { moduleId: string; entry: CommentRow; names: string[] }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(entry.body);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <form
        className="space-y-2 rounded-md border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await updateTaskComment(moduleId, entry.id, body);
            if (res.errors?.length) return setErrors(res.errors);
            setErrors([]);
            setEditing(false);
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
        <MentionTextarea value={body} onChange={setBody} names={names} autoFocus />
        <div className="flex gap-2">
          <button type="submit" className={primaryBtn} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className={secondaryBtn}
            disabled={pending}
            onClick={() => {
              setBody(entry.body);
              setEditing(false);
              setErrors([]);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <article className="rounded-md border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
      <header className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">{entry.authorName ?? "Someone"}</p>
        <div className="flex shrink-0 items-baseline gap-3">
          <span className="text-xs text-zinc-500">{entry.when}</span>
          {entry.mine && (
            <>
              <button type="button" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button
                type="button"
                className="text-xs text-zinc-500 hover:text-red-700 dark:hover:text-red-400"
                disabled={pending}
                onClick={() => {
                  if (!confirm("Delete this comment?")) return;
                  startTransition(async () => void (await deleteTaskComment(moduleId, entry.id)));
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </header>
      <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{withMentions(entry.body, names)}</p>
    </article>
  );
}

/** Comments on a task, with @mentions that Slack-ping the person named. */
export function TaskComments({
  moduleId,
  taskId,
  entries,
  names,
}: {
  moduleId: string;
  taskId: string;
  entries: CommentRow[];
  /** Team names offered in the @mention dropdown. */
  names: string[];
}) {
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Comments{entries.length > 0 && ` · ${entries.length}`}
      </h2>
      {entries.length === 0 && !writing && <p className="text-sm text-zinc-500">No comments yet.</p>}
      {entries.map((e) => (
        <Entry key={e.id} moduleId={moduleId} entry={e} names={names} />
      ))}

      {writing ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await addTaskComment(moduleId, taskId, body);
              if (res.errors?.length) return setErrors(res.errors);
              setErrors([]);
              setBody("");
              setWriting(false);
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
          <MentionTextarea
            value={body}
            onChange={setBody}
            names={names}
            placeholder="Add a comment… type @ to tag someone"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="submit" className={primaryBtn} disabled={pending || !body.trim()}>
              {pending ? "Posting…" : "Post comment"}
            </button>
            <button
              type="button"
              className={secondaryBtn}
              disabled={pending}
              onClick={() => {
                setWriting(false);
                setErrors([]);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className={secondaryBtn} onClick={() => setWriting(true)}>
          + Add comment
        </button>
      )}
    </section>
  );
}
