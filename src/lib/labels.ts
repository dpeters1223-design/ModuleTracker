import type { ModuleStatus } from "@prisma/client";

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
