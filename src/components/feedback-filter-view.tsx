"use client";

import { useMemo, useState } from "react";
import type { FeedbackCategory } from "@prisma/client";
import { FeedbackList, type FeedbackRow } from "@/components/feedback-list";
import { FeedbackBubbleChart } from "@/components/feedback-bubble-chart";
import { FEEDBACK_CATEGORY_LABELS } from "@/lib/labels";

const CATEGORY_ORDER: FeedbackCategory[] = ["instructional_design", "ui_ux", "media", "tags"];

const selectCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";

/** All playthrough feedback, filterable by module and category — client-side, since this list is small. */
export function FeedbackFilterView({
  rows,
  modules,
}: {
  rows: FeedbackRow[];
  modules: { id: string; label: string }[];
}) {
  const [moduleId, setModuleId] = useState("");
  const [category, setCategory] = useState<FeedbackCategory | "">("");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => (!moduleId || r.moduleId === moduleId) && (!category || r.categories.includes(category))
      ),
    [rows, moduleId, category]
  );
  const counts = useMemo(() => {
    const c: Record<FeedbackCategory, number> = { instructional_design: 0, ui_ux: 0, media: 0, tags: 0 };
    for (const r of filtered) for (const cat of r.categories) c[cat]++;
    return c;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className={selectCls} value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
          <option value="">All modules</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select className={selectCls} value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory | "")}>
          <option value="">All categories</option>
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {FEEDBACK_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <FeedbackBubbleChart counts={counts} />
      <FeedbackList rows={filtered} showModule />
    </div>
  );
}
