"use client";

import { useState } from "react";
import { splitOwnerText } from "@/lib/team";

const OTHER = "__other__";

const selectCls =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900";

/**
 * One or more owners, each picked from the team roster rather than typed free text —
 * so "Jay" and "Jay Williamson" can't both end up stored for the same person. An
 * "Other…" option keeps room for the rare name that isn't on the roster (a vendor,
 * "Prof Valla", "TBD"); the stored value is still a comma-joined string, so nothing
 * downstream (matching, Slack, digests) needs to change.
 *
 * Slot text lives in local state (seeded once from `value`, like the forms this is
 * nested in already keep their own form state) rather than being re-derived from
 * `value` on every render — otherwise an empty slot added via "+ Add another owner"
 * would vanish the moment it's blank, since a blank slot contributes nothing to the
 * joined string.
 */
export function OwnerPicker({
  value,
  onChange,
  owners,
}: {
  value: string;
  onChange: (v: string) => void;
  owners: string[];
}) {
  const [rows, setRows] = useState<string[]>(() => {
    const parsed = splitOwnerText(value);
    return parsed.length ? parsed : [""];
  });
  const [otherSlots, setOtherSlots] = useState<Set<number>>(
    () => new Set(rows.map((r, i) => (r && !owners.includes(r) ? i : -1)).filter((i) => i >= 0))
  );

  const commit = (next: string[]) => {
    setRows(next);
    onChange(next.filter(Boolean).join(", "));
  };
  const setSlot = (i: number, text: string) => commit(rows.map((r, j) => (j === i ? text : r)));
  const removeSlot = (i: number) => {
    setOtherSlots((s) => new Set([...s].filter((j) => j !== i).map((j) => (j > i ? j - 1 : j))));
    commit(rows.length > 1 ? rows.filter((_, j) => j !== i) : [""]);
  };

  return (
    <div className="space-y-1.5">
      {rows.map((slot, i) => {
        const isOther = otherSlots.has(i);
        return (
          <div key={i} className="flex items-center gap-1.5">
            {isOther ? (
              <input
                className={selectCls}
                value={slot}
                autoFocus
                placeholder="Name"
                onChange={(e) => setSlot(i, e.target.value)}
              />
            ) : (
              <select
                className={selectCls}
                value={slot}
                onChange={(e) => {
                  if (e.target.value === OTHER) {
                    setOtherSlots((s) => new Set(s).add(i));
                    setSlot(i, "");
                  } else {
                    setSlot(i, e.target.value);
                  }
                }}
              >
                <option value="">{i === 0 ? "No owner" : "Choose…"}</option>
                {owners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
                <option value={OTHER}>Other…</option>
              </select>
            )}
            {(rows.length > 1 || slot) && (
              <button
                type="button"
                aria-label="Remove this owner"
                title="Remove"
                className="shrink-0 text-zinc-400 hover:text-red-700 dark:hover:text-red-400"
                onClick={() => removeSlot(i)}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        onClick={() => setRows((r) => [...r, ""])}
      >
        + Add another owner
      </button>
    </div>
  );
}
