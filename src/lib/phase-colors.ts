import type { TaskPhase } from "@prisma/client";

/**
 * One color per production phase, used everywhere a phase appears (board column
 * headers, task lists, the Tasks tab). Warm lab gold → red for the early,
 * creative phases, through navy for the build, to teal/green at release.
 */
export const PHASE_COLORS: Record<TaskPhase, string> = {
  pre_production: "#e2b04a", // lab gold (deepened for contrast)
  scripting: "#df8a3e", // amber
  production: "#c24a3a", // toward the lab red
  post_production: "#8a6a9c", // plum
  build: "#3d5062", // lab navy
  playtesting: "#4a84b0", // blue
  sign_off: "#5a9e98", // lab teal (deepened)
  deployment: "#5f9357", // green
};
