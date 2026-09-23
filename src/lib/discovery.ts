// Shared shape + validation for the SME Discovery Form. Imported by both the
// client form and the server action, so it must stay free of server-only code.

export type DiscoveryTool = {
  name: string;
  features: string;
};

export type DiscoveryScene = {
  title: string;
  location: string;
  mediaType: string;
  speaker: string;
  tool: string;
  interaction: string;
  activities: string;
  notes: string;
};

export type DiscoveryInput = {
  name: string;
  number: string;
  description: string;
  audience: string;
  targetCompletion: string;
  runtimeMinutes: string;
  objectives: string[];
  tools: DiscoveryTool[];
  scenes: DiscoveryScene[];
};

export const MEDIA_TYPES = ["360 video", "360 image", "Other"] as const;

export const emptyScene = (): DiscoveryScene => ({
  title: "",
  location: "",
  mediaType: "",
  speaker: "",
  tool: "",
  interaction: "",
  activities: "",
  notes: "",
});

export const emptyDiscovery = (): DiscoveryInput => ({
  name: "",
  number: "",
  description: "",
  audience: "",
  targetCompletion: "",
  runtimeMinutes: "",
  objectives: [""],
  tools: [{ name: "", features: "" }],
  scenes: [emptyScene()],
});

const MAX_SHORT = 200;
const MAX_LONG = 5000;
const MAX_ITEMS = 100;

/** Trims every field and drops blank list rows. Returns field errors, if any. */
export function cleanDiscovery(input: DiscoveryInput): {
  data: DiscoveryInput;
  errors: string[];
} {
  const t = (s: unknown) => (typeof s === "string" ? s.trim() : "");
  const errors: string[] = [];

  const data: DiscoveryInput = {
    name: t(input.name),
    number: t(input.number),
    description: t(input.description),
    audience: t(input.audience),
    targetCompletion: t(input.targetCompletion),
    runtimeMinutes: t(input.runtimeMinutes),
    objectives: (input.objectives ?? []).map(t).filter(Boolean),
    tools: (input.tools ?? [])
      .map((tool) => ({ name: t(tool?.name), features: t(tool?.features) }))
      .filter((tool) => tool.name || tool.features),
    scenes: (input.scenes ?? [])
      .map((s) => ({
        title: t(s?.title),
        location: t(s?.location),
        mediaType: t(s?.mediaType),
        speaker: t(s?.speaker),
        tool: t(s?.tool),
        interaction: t(s?.interaction),
        activities: t(s?.activities),
        notes: t(s?.notes),
      }))
      .filter((s) => Object.values(s).some(Boolean)),
  };

  if (!data.name) errors.push("Module name is required.");
  if (!data.description) errors.push("Describe what the module is about.");
  if (data.runtimeMinutes && !/^\d{1,3}$/.test(data.runtimeMinutes)) {
    errors.push("Runtime must be a whole number of minutes.");
  }
  if (data.tools.some((tool) => !tool.name)) {
    errors.push("Every tool with features listed needs a name.");
  }

  const shortFields = [data.name, data.number, data.audience, data.targetCompletion];
  const longFields = [
    data.description,
    ...data.objectives,
    ...data.tools.flatMap((tool) => [tool.name, tool.features]),
    ...data.scenes.flatMap((s) => Object.values(s)),
  ];
  if (
    shortFields.some((s) => s.length > MAX_SHORT) ||
    longFields.some((s) => s.length > MAX_LONG) ||
    data.objectives.length > MAX_ITEMS ||
    data.tools.length > MAX_ITEMS ||
    data.scenes.length > MAX_ITEMS
  ) {
    errors.push("Some entries are too long.");
  }

  return { data, errors };
}
