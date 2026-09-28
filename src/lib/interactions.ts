// Scene activity vocabulary, taken from the team's Uptale workflow doc (tag types,
// scene types) and Interactivity Matrix. Shared by the form, the server and displays.

/** Scene types, in Uptale's terms (stored in Scene.backgroundMediaType). */
export const SCENE_TYPES = ["360 video", "360 photo", "Void", "Spatial (3D)"] as const;

export const INTERACTIVITY_LEVELS: Record<number, string> = {
  1: "Level 1: standard tags (360 video, doors, pop-ups, quizzes)",
  2: "Level 2: adds custom 2D/3D elements",
  3: "Level 3: fully custom multi-step activity",
};

/** Interaction types a scene can use. `hint` is the placeholder for the note box. */
export const INTERACTION_TYPES = [
  { type: "hotspot", label: "Click a highlighted spot", hint: 'e.g. "Click here to vent the load lock" (green highlight)' },
  { type: "sequence", label: "Step-by-step click sequence", hint: "List the steps in order" },
  { type: "text", label: "Text pop-up", hint: "What the text says or covers" },
  { type: "info", label: "Info panel", hint: "What it explains" },
  { type: "narration", label: "Narration / audio", hint: "Text-to-speech or recorded? What's said?" },
  { type: "question", label: "Question / quiz", hint: "Write the questions below" },
  { type: "image2d", label: "2D image pop-up", hint: "e.g. close-up of the recipe screen" },
  { type: "video2d", label: "2D video pop-up", hint: "What the clip shows" },
  { type: "object3d", label: "3D object", hint: "Drag-and-drop, movable or stationary? e.g. drag the wafer onto the load lock" },
  { type: "door", label: "Door (go to next scene)", hint: "Where it goes: next scene, another module, or exit" },
  { type: "timer", label: "Timer / score", hint: "What's timed or scored" },
  { type: "voice", label: "Voice response (microphone)", hint: "What the learner says" },
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number]["type"];
export type SceneInteraction = { type: InteractionType; note: string };
export type QuizOption = { text: string; correct: boolean };
export type QuizQuestion = { question: string; options: QuizOption[]; feedback: string };

export const interactionLabel = (type: string) =>
  INTERACTION_TYPES.find((i) => i.type === type)?.label ?? type;

export const emptyQuestion = (): QuizQuestion => ({
  question: "",
  options: [
    { text: "", correct: false },
    { text: "", correct: false },
  ],
  feedback: "",
});

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Keeps known types in list order, one entry each, notes trimmed. */
export function cleanInteractions(value: unknown): SceneInteraction[] {
  const list = Array.isArray(value) ? value : [];
  return INTERACTION_TYPES.flatMap(({ type }) => {
    const found = list.find((i) => i && typeof i === "object" && (i as SceneInteraction).type === type);
    return found ? [{ type, note: str((found as SceneInteraction).note, 1000) }] : [];
  });
}

/** Drops blank questions and blank options; keeps up to 50 questions × 10 options. */
export function cleanQuestions(value: unknown): QuizQuestion[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .slice(0, 50)
    .map((q) => ({
      question: str(q?.question, 1000),
      options: (Array.isArray(q?.options) ? q.options : [])
        .slice(0, 10)
        .map((o: QuizOption) => ({ text: str(o?.text, 500), correct: Boolean(o?.correct) }))
        .filter((o: QuizOption) => o.text),
      feedback: str(q?.feedback, 1000),
    }))
    .filter((q) => q.question || q.options.length);
}
