import type { ModuleStatus, TaskPhase, TaskStatus } from "@prisma/client";

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
