import type { FeedbackCategory } from "@prisma/client";
import { FEEDBACK_CATEGORY_LABELS } from "@/lib/labels";

/**
 * Fixed slot order AND fixed colors, from the validated categorical palette
 * (dataviz skill, palette.md, documented default order). A circle-pack where
 * bubbles float next to whichever neighbor is biggest needs every PAIR to be
 * colorblind-distinguishable ("all-pairs"); checked with the skill's validator,
 * no 4-color subset of that palette clears that bar in both light and dark. A
 * FIXED, never-reordered-by-count row only ever puts *adjacent* slots next to
 * each other, which the documented default does clear (worst adjacent CVD ΔE
 * 9.1 light / 8.4 dark) — so the order below must never change based on counts,
 * and each bubble always carries its own text label rather than relying on a
 * legend (color here is a secondary cue, not the sole identity channel).
 */
const SLOTS: { category: FeedbackCategory; light: string; dark: string }[] = [
  { category: "instructional_design", light: "#2a78d6", dark: "#3987e5" }, // slot 1 blue
  { category: "ui_ux", light: "#eb6834", dark: "#d95926" }, // slot 2 orange
  { category: "media", light: "#1baf7a", dark: "#199e70" }, // slot 3 aqua
  { category: "tags", light: "#eda100", dark: "#c98500" }, // slot 4 yellow
];

// Aqua and yellow sit under 3:1 contrast on the light surface by design (palette.md) —
// the always-visible label is the required relief, so it must stay dark-on-light there.
const DARK_LABEL: Set<FeedbackCategory> = new Set(["media", "tags"]);

const MIN_DIAMETER = 56;
const MAX_DIAMETER = 128;

export function FeedbackBubbleChart({ counts }: { counts: Record<FeedbackCategory, number> }) {
  const total = SLOTS.reduce((sum, s) => sum + counts[s.category], 0);
  const maxCount = Math.max(1, ...SLOTS.map((s) => counts[s.category]));

  return (
    <div className="fb-bubble-chart flex flex-wrap items-end justify-center gap-4 rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
      <style>{`
        .fb-bubble-chart { --fb-id-light: #2a78d6; --fb-ui-light: #eb6834; --fb-media-light: #1baf7a; --fb-tags-light: #eda100; }
        @media (prefers-color-scheme: dark) {
          .fb-bubble-chart { --fb-id-light: #3987e5; --fb-ui-light: #d95926; --fb-media-light: #199e70; --fb-tags-light: #c98500; }
        }
      `}</style>
      {total === 0 ? (
        <p className="text-sm text-zinc-500">Nothing categorized yet — click &quot;AI Sort&quot; on a write-up below.</p>
      ) : (
        SLOTS.map(({ category }) => {
          const count = counts[category];
          const diameter = count === 0 ? MIN_DIAMETER : MIN_DIAMETER + (MAX_DIAMETER - MIN_DIAMETER) * Math.sqrt(count / maxCount);
          const varName = `--fb-${category === "instructional_design" ? "id" : category === "ui_ux" ? "ui" : category}-light`;
          return (
            <div key={category} className="flex flex-col items-center gap-1.5">
              <div
                className="flex items-center justify-center rounded-full text-center transition-all"
                style={{
                  width: diameter,
                  height: diameter,
                  backgroundColor: `var(${varName})`,
                  opacity: count === 0 ? 0.35 : 1,
                }}
              >
                <span className={`text-sm font-semibold ${DARK_LABEL.has(category) ? "text-zinc-900" : "text-white"}`}>
                  {count}
                </span>
              </div>
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {FEEDBACK_CATEGORY_LABELS[category]}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
