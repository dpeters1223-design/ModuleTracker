import Link from "next/link";

/** Large icons (full detail), small icons (denser), or one row per item. */
export type GridView = "large" | "small" | "list";

export const VIEW_LABELS: Record<GridView, string> = { large: "Large icons", small: "Small icons", list: "List" };

/**
 * The large/small/list switcher shared by the media library and the albums pages.
 * `hrefFor` builds each option's URL — the caller decides which filters to keep.
 */
export function ViewToggle({ view, hrefFor }: { view: GridView; hrefFor: (v: GridView) => string }) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-md border border-zinc-300 p-0.5 dark:border-zinc-600"
      role="group"
      aria-label="View"
    >
      {(["large", "small", "list"] as const).map((v) => (
        <Link
          key={v}
          href={hrefFor(v)}
          aria-label={VIEW_LABELS[v]}
          title={VIEW_LABELS[v]}
          aria-current={view === v ? "true" : undefined}
          className={`rounded px-2 py-1.5 ${
            view === v
              ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          {v === "large" && (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="3" y="3" width="8" height="8" rx="1" />
              <rect x="13" y="3" width="8" height="8" rx="1" />
              <rect x="3" y="13" width="8" height="8" rx="1" />
              <rect x="13" y="13" width="8" height="8" rx="1" />
            </svg>
          )}
          {v === "small" && (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              {[3, 9.75, 16.5].flatMap((x) =>
                [3, 9.75, 16.5].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="4.5" height="4.5" rx="0.8" />)
              )}
            </svg>
          )}
          {v === "list" && (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          )}
        </Link>
      ))}
    </div>
  );
}

/** Parses a `?view=` param, defaulting to "large" for anything else. */
export function parseView(raw: string): GridView {
  return raw === "small" || raw === "list" ? raw : "large";
}
