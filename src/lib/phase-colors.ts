import type { CSSProperties } from "react";
import type { ModuleStatus, TaskPhase } from "@prisma/client";
import { STATUS_PHASE } from "@/lib/labels";

/**
 * One color per production phase, used everywhere a phase appears (board columns,
 * task lists, the Tasks tab, Gantt bars, module status pills). The actual colors
 * live in globals.css as --phase-* variables so light and dark mode each get their
 * own validated shades; these are references to them.
 */
export const PHASE_COLORS: Record<TaskPhase, string> = {
  pre_production: "var(--phase-pre_production)",
  scripting: "var(--phase-scripting)",
  production: "var(--phase-production)",
  post_production: "var(--phase-post_production)",
  build: "var(--phase-build)",
  playtesting: "var(--phase-playtesting)",
  sign_off: "var(--phase-sign_off)",
  deployment: "var(--phase-deployment)",
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
  return color
    ? { backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, borderColor: color }
    : undefined;
}
