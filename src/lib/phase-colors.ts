import type { CSSProperties } from "react";
import type { ModuleStatus, TaskPhase } from "@prisma/client";
import { STATUS_PHASE } from "@/lib/labels";

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

/** The phase color for a module status, or null for On hold / Not started. */
export function statusColor(status: string): string | null {
  const phase = STATUS_PHASE[status as ModuleStatus];
  return phase ? PHASE_COLORS[phase] : null;
}

/**
 * Pill style for a module status: a light tint of its phase color with a solid
 * border, keeping dark text readable on every color (gold included).
 */
export function statusPillStyle(status: string): CSSProperties | undefined {
  const color = statusColor(status);
  return color ? { backgroundColor: `${color}26`, borderColor: color } : undefined;
}
