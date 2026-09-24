"use client";

import Link from "next/link";
import { useState } from "react";
import type { TaskPhase } from "@prisma/client";
import { TASK_PHASE_LABELS, TASK_STATUS_LABELS } from "@/lib/labels";
import { PHASE_COLORS } from "@/lib/phase-colors";
import { formatDay } from "@/lib/task-format";

export type GanttTask = {
  id: string;
  moduleId: string;
  moduleLabel: string;
  title: string;
  phase: string;
  status: string;
  owner: string | null;
  start: string; // "YYYY-MM-DD" or ""
  due: string;
};

const DAY = 86_400_000;
const dayNum = (d: string) => Math.round(Date.parse(`${d}T12:00:00Z`) / DAY);
const fromNum = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);

/**
 * Tasks on a calendar: one bar per task from start to due date, colored by phase,
 * with a Today line. `groupByModule` adds a labeled section per module (the
 * all-modules view). Tasks with neither date can't be placed and are counted below.
 */
export function GanttChart({
  tasks,
  today,
  groupByModule = false,
}: {
  tasks: GanttTask[];
  today: string;
  groupByModule?: boolean;
}) {
  const [hover, setHover] = useState<{ task: GanttTask; x: number; y: number } | null>(null);

  const placed = tasks
    .filter((t) => t.start || t.due)
    .map((t) => {
      const a = dayNum(t.start || t.due);
      const b = dayNum(t.due || t.start);
      return { ...t, from: Math.min(a, b), to: Math.max(a, b) };
    })
    .sort((x, y) => x.from - y.from || x.to - y.to);
  const undated = tasks.length - placed.length;

  if (!placed.length) {
    return (
      <p className="text-sm text-zinc-500">
        {tasks.length
          ? "None of these tasks have start or due dates yet. Add dates to see them on the timeline."
          : "No tasks yet."}
      </p>
    );
  }

  // Range: all tasks plus today, padded, at least three weeks wide.
  const todayN = dayNum(today);
  let lo = Math.min(todayN, ...placed.map((t) => t.from)) - 3;
  let hi = Math.max(todayN, ...placed.map((t) => t.to)) + 3;
  if (hi - lo < 21) hi = lo + 21;
  // Start on a Monday so week lines fall on week starts.
  lo -= (new Date(lo * DAY).getUTCDay() + 6) % 7;
  const span = hi - lo + 1;
  const pct = (n: number) => ((n - lo) / span) * 100;

  const weeks: number[] = [];
  for (let n = lo; n <= hi; n += 7) weeks.push(n);
  const months: { n: number; label: string }[] = [];
  for (let n = lo; n <= hi; n++) {
    const d = fromNum(n);
    if (n === lo || d.endsWith("-01")) {
      months.push({
        n,
        label: new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
          month: "short",
          ...(d.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
          timeZone: "UTC",
        }),
      });
    }
  }
  const showWeekDates = span <= 120;

  const phasesUsed = (Object.keys(TASK_PHASE_LABELS) as TaskPhase[]).filter((p) => placed.some((t) => t.phase === p));
  const groups = groupByModule
    ? [...new Map(placed.map((t) => [t.moduleId, t.moduleLabel])).entries()].map(([id, label]) => ({
        id,
        label,
        rows: placed.filter((t) => t.moduleId === id),
      }))
    : [{ id: "", label: "", rows: placed }];

  const gridBg = (
    <>
      {weeks.map((n) => (
        <div
          key={n}
          aria-hidden
          className="absolute inset-y-0 border-l border-zinc-200 dark:border-zinc-800"
          style={{ left: `${pct(n)}%` }}
        />
      ))}
      <div
        aria-hidden
        className="absolute inset-y-0 z-10 border-l-2 border-zinc-800 dark:border-zinc-100"
        style={{ left: `${pct(todayN + 0.5)}%` }}
      />
    </>
  );

  return (
    <div className="space-y-3">
      {/* Legend: phase colors (never color alone — the tooltip and list views name the phase too). */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400" aria-label="Phase colors">
        {phasesUsed.map((p) => (
          <li key={p} className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: PHASE_COLORS[p] }} aria-hidden />
            {TASK_PHASE_LABELS[p]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-3 border-l-2 border-zinc-800 dark:border-zinc-100" aria-hidden /> Today
        </li>
      </ul>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="min-w-[46rem]">
          {/* Header: months, then week-start dates */}
          <div className="grid grid-cols-[13rem_1fr] border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
            <div className="px-3 py-1.5 font-medium">Task</div>
            <div className="relative h-10">
              {months.map((m) => (
                <span key={m.n} className="absolute top-1 font-medium text-zinc-700 dark:text-zinc-300" style={{ left: `calc(${pct(m.n)}% + 4px)` }}>
                  {m.label}
                </span>
              ))}
              {showWeekDates &&
                weeks.map((n) => (
                  <span key={n} className="absolute bottom-1" style={{ left: `calc(${pct(n)}% + 4px)` }}>
                    {Number(fromNum(n).slice(8))}
                  </span>
                ))}
            </div>
          </div>

          {groups.map((g) => (
            <div key={g.id || "all"}>
              {groupByModule && (
                <div className="grid grid-cols-[13rem_1fr] border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                  <Link href={`/modules/${g.id}`} className="truncate px-3 py-1.5 text-sm font-semibold hover:underline">
                    {g.label}
                  </Link>
                  <div className="relative">{gridBg}</div>
                </div>
              )}
              {g.rows.map((t) => {
                const done = t.status === "completed";
                const late = !done && !!t.due && t.due < today;
                return (
                  <div
                    key={t.id}
                    className="grid grid-cols-[13rem_1fr] border-b border-zinc-100 last:border-b-0 dark:border-zinc-900"
                  >
                    <div className="min-w-0 px-3 py-1.5">
                      <p className={`truncate text-sm ${done ? "text-zinc-400 line-through" : ""}`}>{t.title}</p>
                      {t.owner && <p className="truncate text-xs text-zinc-500">{t.owner}</p>}
                    </div>
                    <div className="relative">
                      {gridBg}
                      <button
                        type="button"
                        className={`absolute top-1/2 z-20 h-3.5 -translate-y-1/2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                          done ? "opacity-40" : ""
                        } ${late ? "ring-2 ring-lab-red ring-offset-1 dark:ring-offset-zinc-950" : ""}`}
                        style={{
                          left: `${pct(t.from)}%`,
                          width: `max(8px, ${((t.to - t.from + 1) / span) * 100}%)`,
                          backgroundColor: PHASE_COLORS[t.phase as TaskPhase],
                        }}
                        aria-label={`${t.title}: ${TASK_PHASE_LABELS[t.phase as TaskPhase]}, ${
                          t.start ? `${formatDay(t.start, today)} to ` : ""
                        }${t.due ? formatDay(t.due, today) : ""}${late ? ", overdue" : ""}`}
                        onMouseEnter={(e) => setHover({ task: t, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setHover({ task: t, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setHover(null)}
                        onFocus={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setHover({ task: t, x: r.left, y: r.bottom });
                        }}
                        onBlur={() => setHover(null)}
                      />
                      {late && (
                        <span
                          className="absolute top-1/2 z-20 -translate-y-1/2 pl-1.5 text-[11px] font-medium text-red-700 dark:text-red-400"
                          style={{ left: `calc(${pct(t.to + 1)}% + 4px)` }}
                        >
                          Overdue
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {undated > 0 && (
        <p className="text-xs text-zinc-500">
          {undated} task{undated === 1 ? " has" : "s have"} no start or due date, so {undated === 1 ? "it isn't" : "they aren't"} shown here.
        </p>
      )}

      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 max-w-xs rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{hover.task.title}</p>
          {groupByModule && <p className="text-zinc-500">{hover.task.moduleLabel}</p>}
          <p className="mt-1 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: PHASE_COLORS[hover.task.phase as TaskPhase] }}
              aria-hidden
            />
            {TASK_PHASE_LABELS[hover.task.phase as TaskPhase]} ·{" "}
            {TASK_STATUS_LABELS[hover.task.status as keyof typeof TASK_STATUS_LABELS]}
          </p>
          <p className="text-zinc-700 dark:text-zinc-300">
            {hover.task.start && hover.task.due
              ? `${formatDay(hover.task.start, today)} → ${formatDay(hover.task.due, today)}`
              : hover.task.due
                ? `Due ${formatDay(hover.task.due, today)}`
                : `Starts ${formatDay(hover.task.start, today)}`}
          </p>
          {hover.task.owner && <p className="text-zinc-500">Owner: {hover.task.owner}</p>}
        </div>
      )}
    </div>
  );
}
