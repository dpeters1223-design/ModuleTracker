import type { TaskPhase } from "@prisma/client";
import { PHASE_COLORS } from "@/lib/phase-colors";

/** Small colored dot marking a task phase. */
export function PhaseDot({ phase }: { phase: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: PHASE_COLORS[phase as TaskPhase] }}
    />
  );
}
