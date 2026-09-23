import type { ChangeOrderStatus, DocumentType, ModuleStatus, TaskPhase, TaskStatus } from "@prisma/client";

export const CHANGE_ORDER_STATUS_LABELS: Record<ChangeOrderStatus, string> = {
  suggested: "Suggested",
  approved: "Approved",
  in_progress: "In progress",
  in_review: "In review",
  completed: "Completed",
  deferred: "Deferred",
  declined: "Declined",
};

/** Statuses that mean the change order needs no more work. */
export const CLOSED_CHANGE_ORDER_STATUSES: ChangeOrderStatus[] = ["completed", "deferred", "declined"];

/** Document types for the per-module library (scripts are managed on the Scripts tab). */
export const DOCUMENT_TYPE_LABELS: Record<Exclude<DocumentType, "script">, string> = {
  storyboard: "Storyboard",
  rundown: "Rundown",
  shot_sheet: "Shot sheet",
  questions: "Questions / quiz bank",
  two_d_assets: "2D assets",
  three_d_assets: "3D assets",
  playtest_notes: "Playtest notes",
  folder: "Folder",
  other: "Other",
};

/** In pipeline order — also the display order of task groups. */
export const TASK_PHASE_LABELS: Record<TaskPhase, string> = {
  pre_production: "Pre-production",
  scripting: "Scripting",
  production: "Production (filming)",
  post_production: "Post-production",
  build: "Build",
  playtesting: "Playtesting",
  sign_off: "Sign-off",
  deployment: "Deployment",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  delayed: "Delayed",
  completed: "Done",
};

export const MODULE_STATUS_LABELS: Record<ModuleStatus, string> = {
  on_hold: "On hold",
  not_started: "Not started",
  pre_production: "Pre-production",
  scripting: "Scripting",
  production: "Production",
  post_production: "Post-production",
  building: "Building",
  playtesting: "Playtesting",
  signed_off: "Signed off",
  deployed: "Deployed",
};
