"use client";

import {
  emptyQuestion,
  INTERACTION_TYPES,
  INTERACTIVITY_LEVELS,
  type InteractionType,
  type QuizQuestion,
  type SceneInteraction,
} from "@/lib/interactions";

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const linkBtn = "text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100";
const addBtn =
  "rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

type Value = { interactions: SceneInteraction[]; level: string; questions: QuizQuestion[] };

/**
 * A scene's structured activity: interactivity level, which interactions it uses
 * (checkboxes, each with a note), and quiz questions with answers.
 */
export function SceneActivityEditor({
  sceneLabel,
  value,
  onChange,
}: {
  sceneLabel: string;
  value: Value;
  onChange: (patch: Partial<Value>) => void;
}) {
  const checked = (type: InteractionType) => value.interactions.find((i) => i.type === type);

  const toggle = (type: InteractionType, on: boolean) => {
    const next = on
      ? [...value.interactions, { type, note: "" }]
      : value.interactions.filter((i) => i.type !== type);
    // Keep the list in the standard order.
    const ordered = INTERACTION_TYPES.flatMap((t) => next.filter((i) => i.type === t.type));
    const patch: Partial<Value> = { interactions: ordered };
    if (type === "question" && on && !value.questions.length) patch.questions = [emptyQuestion()];
    onChange(patch);
  };
  const setNote = (type: InteractionType, note: string) =>
    onChange({ interactions: value.interactions.map((i) => (i.type === type ? { ...i, note } : i)) });

  const setQuestion = (qi: number, patch: Partial<QuizQuestion>) =>
    onChange({ questions: value.questions.map((q, j) => (j === qi ? { ...q, ...patch } : q)) });

  return (
    <div className="space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="space-y-1">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Interactivity level</span>
        <select className={inputCls} value={value.level} onChange={(e) => onChange({ level: e.target.value })}>
          <option value="">Not sure yet</option>
          {Object.entries(INTERACTIVITY_LEVELS).map(([n, label]) => (
            <option key={n} value={n}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">What happens in this scene?</legend>
        <p className="text-xs text-zinc-500">Tick everything the learner sees or does. Add a note for any that need explaining.</p>
        <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {INTERACTION_TYPES.map(({ type, label }) => (
            <label key={type} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={Boolean(checked(type))}
                onChange={(e) => toggle(type, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        {value.interactions.filter((i) => i.type !== "question").length > 0 && (
          <div className="space-y-2 pt-1">
            {value.interactions
              .filter((i) => i.type !== "question")
              .map((i) => {
                const def = INTERACTION_TYPES.find((t) => t.type === i.type)!;
                return (
                  <label key={i.type} className="block space-y-1">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{def.label}</span>
                    <input
                      className={inputCls}
                      placeholder={def.hint}
                      value={i.note}
                      onChange={(e) => setNote(i.type, e.target.value)}
                    />
                  </label>
                );
              })}
          </div>
        )}
      </fieldset>

      {checked("question") && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Quiz questions</p>
          {value.questions.map((q, qi) => (
            <div key={qi} className="space-y-2 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500">Question {qi + 1}</span>
                <button
                  type="button"
                  className={linkBtn}
                  onClick={() => onChange({ questions: value.questions.filter((_, j) => j !== qi) })}
                >
                  Remove question
                </button>
              </div>
              <input
                className={inputCls}
                aria-label={`${sceneLabel}, question ${qi + 1}`}
                placeholder="e.g. Which power supply do you need for an oxide target?"
                value={q.question}
                onChange={(e) => setQuestion(qi, { question: e.target.value })}
              />
              <div className="space-y-1.5">
                <p className="text-xs text-zinc-500">Answers (tick the correct one or ones)</p>
                {q.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Answer ${oi + 1} is correct`}
                      title="Correct answer"
                      checked={o.correct}
                      onChange={(e) =>
                        setQuestion(qi, {
                          options: q.options.map((x, j) => (j === oi ? { ...x, correct: e.target.checked } : x)),
                        })
                      }
                    />
                    <input
                      className={inputCls}
                      aria-label={`Answer ${oi + 1}`}
                      placeholder={`Answer ${String.fromCharCode(65 + oi)}`}
                      value={o.text}
                      onChange={(e) =>
                        setQuestion(qi, {
                          options: q.options.map((x, j) => (j === oi ? { ...x, text: e.target.value } : x)),
                        })
                      }
                    />
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        className={linkBtn}
                        aria-label={`Remove answer ${oi + 1}`}
                        onClick={() => setQuestion(qi, { options: q.options.filter((_, j) => j !== oi) })}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {q.options.length < 10 && (
                  <button
                    type="button"
                    className={addBtn}
                    onClick={() => setQuestion(qi, { options: [...q.options, { text: "", correct: false }] })}
                  >
                    + Add answer
                  </button>
                )}
              </div>
              <input
                className={inputCls}
                aria-label="Feedback after answering"
                placeholder="Feedback after answering (optional), e.g. Right: RF works for insulating targets"
                value={q.feedback}
                onChange={(e) => setQuestion(qi, { feedback: e.target.value })}
              />
            </div>
          ))}
          <button
            type="button"
            className={addBtn}
            onClick={() => onChange({ questions: [...value.questions, emptyQuestion()] })}
          >
            + Add question
          </button>
        </div>
      )}
    </div>
  );
}
