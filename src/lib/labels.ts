import type {
  ChangeOrderStatus,
  DocumentType,
  FeatureRequestStatus,
  FeedbackCategory,
  ModuleStatus,
  TaskPhase,
  TaskStatus,
} from "@prisma/client";

/** Fixed display order — never re-sorted by count (see feedback-bubble-chart.tsx). */
export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  instructional_design: "ID",
  ui_ux: "UI/UX",
  media: "Media",
  tags: "Tags",
};

export const FEATURE_REQUEST_STATUS_LABELS: Record<FeatureRequestStatus, string> = {
  new: "New",
  planned: "Planned",
  in_progress: "In progress",
  declined: "Declined",
  done: "Done",
};

/** Statuses that mean the request needs no more attention. */
export const CLOSED_FEATURE_REQUEST_STATUSES: FeatureRequestStatus[] = ["declined", "done"];

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
export const DOCUMENT_TYPE_LABELS: Record<Exclude<DocumentType, "script" | "script_draft">, string> = {
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

/** The task phase each production status corresponds to (none for On hold / Not started). */
export const STATUS_PHASE: Partial<Record<ModuleStatus, TaskPhase>> = {
  pre_production: "pre_production",
  scripting: "scripting",
  production: "production",
  post_production: "post_production",
  building: "build",
  playtesting: "playtesting",
  signed_off: "sign_off",
  deployed: "deployment",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  feedback_submitted: "Feedback submitted",
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
