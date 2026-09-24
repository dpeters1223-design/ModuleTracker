// Shared shape + validation for the SME Discovery Form. Imported by both the
// client form and the server action, so it must stay free of server-only code.
import type { Module, Scene } from "@prisma/client";

export type DiscoveryTool = {
  name: string;
  features: string;
};

export type DiscoveryScene = {
  /** Set when editing a scene that already exists */
  id?: string;
  title: string;
  location: string;
  mediaType: string;
  speaker: string;
  tool: string;
  interaction: string;
  activities: string;
  notes: string;
  // Optional storyboard details, tucked under "More details" in the form
  description: string;
  talent: string;
  learningObjectives: string;
  mediaAssets: string;
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
  description: "",
  talent: "",
  learningObjectives: "",
  mediaAssets: "",
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

/**
 * Turns a saved module back into form answers (for editing). Reverses how
 * submitDiscovery stores lists: newline-joined objectives and tool names, and
 * featuresDiscussed as "Tool:\nfeatures" blocks.
 */
export function moduleToDiscovery(mod: Module & { scenes: Scene[] }): DiscoveryInput {
  const lines = (s: string | null) => (s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const toolNames = lines(mod.toolsUsed);

  // Walk featuresDiscussed, starting a new block at each "<known tool name>:" line.
  const features = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of (mod.featuresDiscussed ?? "").split("\n")) {
    const header = toolNames.find((n) => line.trim() === `${n}:`);
    if (header) {
      current = header;
      features.set(header, []);
    } else if (current) {
      features.get(current)!.push(line);
    }
  }

  return {
    name: mod.name,
    number: mod.number ?? "",
    description: mod.description ?? "",
    audience: mod.audience ?? "",
    targetCompletion: mod.targetCompletion ?? "",
    runtimeMinutes: mod.runtimeMinutes?.toString() ?? "",
    objectives: lines(mod.learningObjectives).length ? lines(mod.learningObjectives) : [""],
    tools: toolNames.length
      ? toolNames.map((name) => ({ name, features: (features.get(name) ?? []).join("\n").trim() }))
      : [{ name: "", features: "" }],
    scenes: mod.scenes.length
      ? mod.scenes.map((s) => ({
          id: s.id,
          title: s.title ?? "",
          location: s.location ?? "",
          mediaType: s.backgroundMediaType ?? "",
          speaker: s.speaker ?? "",
          tool: s.toolUsed ?? "",
          interaction: s.interactionHighlighted ?? "",
          activities: s.activities ?? "",
          notes: s.notes ?? "",
          description: s.description ?? "",
          talent: s.talent ?? "",
          learningObjectives: s.learningObjectives ?? "",
          mediaAssets: s.mediaAssets ?? "",
        }))
      : [emptyScene()],
  };
}

/** A scene's text fields (everything but its id). */
const sceneText = (s: DiscoveryScene) =>
  Object.entries(s)
    .filter(([key]) => key !== "id")
    .map(([, value]) => value as string);

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
        ...(typeof s?.id === "string" && /^\w{1,40}$/.test(s.id) ? { id: s.id } : {}),
        title: t(s?.title),
        location: t(s?.location),
        mediaType: t(s?.mediaType),
        speaker: t(s?.speaker),
        tool: t(s?.tool),
        interaction: t(s?.interaction),
        activities: t(s?.activities),
        notes: t(s?.notes),
        description: t(s?.description),
        talent: t(s?.talent),
        learningObjectives: t(s?.learningObjectives),
        mediaAssets: t(s?.mediaAssets),
      }))
      .filter((s) => sceneText(s).some(Boolean)),
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
    ...data.scenes.flatMap(sceneText),
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
