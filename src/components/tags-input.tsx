"use client";

import { useState } from "react";

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";

/**
 * A comma-separated tags field. The box shows exactly what was typed, never
 * reformatted from the parsed array — the earlier version rendered `value.tags.join(", ")`
 * back into the input on every keystroke, which fights the browser's cursor: typing a
 * comma made the box re-render with an inserted space, so the caret landed in the wrong
 * place and every further keystroke piled up more whitespace at the wrong spot ("Cad,"
 * turning into "Cad,         " and the field becoming unrecoverable).
 *
 * Fix: the array only flows outward, via onChange. Nothing is ever written back into
 * the box while it's mounted.
 */
export function TagsInput({
  value,
  onChange,
  knownTags,
  listId,
  placeholder,
  ariaLabel = "Tags",
}: {
  /** The committed tags, used only to seed the box when it first appears. */
  value: string[];
  onChange: (tags: string[]) => void;
  knownTags: string[];
  listId: string;
  placeholder: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value.join(", "));
  return (
    <>
      <input
        aria-label={ariaLabel}
        list={listId}
        className={inputCls}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(
            e.target.value
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          );
        }}
      />
      <datalist id={listId}>
        {knownTags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </>
  );
}
