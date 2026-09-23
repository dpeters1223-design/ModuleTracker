"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { submitDiscovery } from "../actions";
import {
  cleanDiscovery,
  emptyDiscovery,
  emptyScene,
  MEDIA_TYPES,
  type DiscoveryInput,
  type DiscoveryScene,
} from "@/lib/discovery";

const STEPS = ["About", "Learning objectives", "Tools", "Scenes", "Review"] as const;
const DRAFT_KEY = "discovery-draft-v1";

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm " +
  "focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800";
const btnCls =
  "rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btnCls} bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300`;
const secondaryBtn = `${btnCls} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800`;
const linkBtn = "text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      {children}
    </label>
  );
}

function loadDraft(): DiscoveryInput {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) return { ...emptyDiscovery(), ...JSON.parse(saved) };
  } catch {}
  return emptyDiscovery();
}

const noopSubscribe = () => () => {};

// The draft lives in localStorage, which the server can't see — so render the
// form only in the browser, where it can start from the saved draft directly.
export function DiscoveryForm() {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
  if (!isClient) return <p className="text-sm text-zinc-500">Loading form…</p>;
  return <DiscoveryFormInner />;
}

function DiscoveryFormInner() {
  const [form, setForm] = useState<DiscoveryInput>(loadDraft);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  // Persist a local draft so a long form survives a refresh or closed tab.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {}
  }, [form]);

  const set = <K extends keyof DiscoveryInput>(key: K, value: DiscoveryInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const updateScene = (i: number, patch: Partial<DiscoveryScene>) =>
    set(
      "scenes",
      form.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s))
    );

  const moveScene = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= form.scenes.length) return;
    const next = [...form.scenes];
    [next[i], next[j]] = [next[j], next[i]];
    set("scenes", next);
  };

  const toolNames = form.tools.map((t) => t.name.trim()).filter(Boolean);
  const speakers = [...new Set(form.scenes.map((s) => s.speaker.trim()).filter(Boolean))];

  const goNext = () => {
    if (step === 0) {
      const missing = [];
      if (!form.name.trim()) missing.push("Module name is required.");
      if (!form.description.trim()) missing.push("Describe what the module is about.");
      if (missing.length) return setErrors(missing);
    }
    setErrors([]);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0 });
  };
  const goBack = () => {
    setErrors([]);
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0 });
  };

  const submit = () => {
    const { errors: clientErrors } = cleanDiscovery(form);
    if (clientErrors.length) return setErrors(clientErrors);
    startTransition(async () => {
      // On success the action redirects (unmounting this form), so clear the draft
      // up front and put it back if the server returns errors instead.
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      const result = await submitDiscovery(form);
      if (result?.errors.length) {
        setErrors(result.errors);
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
        } catch {}
      }
    });
  };

  const resetDraft = () => {
    if (!confirm("Clear everything entered so far?")) return;
    setForm(emptyDiscovery());
    setStep(0);
    setErrors([]);
  };

  const { data: review } = cleanDiscovery(form);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => {
                if (i < step || (form.name.trim() && form.description.trim())) setStep(i);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                i === step
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : i < step
                    ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900"
              }`}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <ul className="list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-5 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        {step === 0 && (
          <>
            <h2 className="text-lg font-semibold">What is this module about?</h2>
            <Field label="Module name *">
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Physical Vapor Deposition 1: Sputtering"
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Short code" hint="Optional, e.g. PVD1">
                <input
                  className={inputCls}
                  value={form.number}
                  onChange={(e) => set("number", e.target.value)}
                />
              </Field>
              <Field label="Target completion" hint="Loose is fine, e.g. Spring 2027">
                <input
                  className={inputCls}
                  value={form.targetCompletion}
                  onChange={(e) => set("targetCompletion", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Description *" hint="The big picture: what learners will see and do.">
              <textarea
                className={`${inputCls} min-h-32`}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Audience" hint="Who is this for?">
                <input
                  className={inputCls}
                  value={form.audience}
                  onChange={(e) => set("audience", e.target.value)}
                  placeholder="e.g. New cleanroom users"
                />
              </Field>
              <Field label="Estimated runtime (minutes)">
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={form.runtimeMinutes}
                  onChange={(e) => set("runtimeMinutes", e.target.value)}
                />
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">Learning objectives</h2>
              <p className="text-sm text-zinc-500">
                What should a learner be able to do after finishing? One per line.
              </p>
            </div>
            {form.objectives.map((obj, i) => (
              <div key={i} className="flex gap-2">
                <span className="pt-2 text-sm text-zinc-400">{i + 1}.</span>
                <input
                  className={inputCls}
                  value={obj}
                  onChange={(e) =>
                    set(
                      "objectives",
                      form.objectives.map((o, j) => (j === i ? e.target.value : o))
                    )
                  }
                  placeholder="e.g. Explain the difference between DC and RF sputtering"
                />
                {form.objectives.length > 1 && (
                  <button
                    type="button"
                    className={linkBtn}
                    onClick={() => set("objectives", form.objectives.filter((_, j) => j !== i))}
                    aria-label={`Remove objective ${i + 1}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => set("objectives", [...form.objectives, ""])}
            >
              + Add objective
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">Tools</h2>
              <p className="text-sm text-zinc-500">
                Which tools will be used, and which features or aspects of each will be
                discussed?
              </p>
            </div>
            {form.tools.map((tool, i) => (
              <div
                key={i}
                className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-500">Tool {i + 1}</span>
                  {form.tools.length > 1 && (
                    <button
                      type="button"
                      className={linkBtn}
                      onClick={() => set("tools", form.tools.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <Field label="Tool name">
                  <input
                    className={inputCls}
                    value={tool.name}
                    onChange={(e) =>
                      set(
                        "tools",
                        form.tools.map((t, j) => (j === i ? { ...t, name: e.target.value } : t))
                      )
                    }
                    placeholder="e.g. AJA Sputter System"
                  />
                </Field>
                <Field label="Features / aspects discussed">
                  <textarea
                    className={`${inputCls} min-h-24`}
                    value={tool.features}
                    onChange={(e) =>
                      set(
                        "tools",
                        form.tools.map((t, j) =>
                          j === i ? { ...t, features: e.target.value } : t
                        )
                      )
                    }
                    placeholder="e.g. Load lock, target selection, gas flow controls, recipe screen"
                  />
                </Field>
              </div>
            ))}
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => set("tools", [...form.tools, { name: "", features: "" }])}
            >
              + Add tool
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">Scene by scene</h2>
              <p className="text-sm text-zinc-500">
                Break the module into scenes in the order learners will see them. Rough is fine.
              </p>
            </div>
            <datalist id="tool-options">
              {toolNames.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <datalist id="speaker-options">
              {speakers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {form.scenes.map((scene, i) => (
              <div
                key={i}
                className="space-y-4 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">Scene {i + 1}</span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className={linkBtn}
                      disabled={i === 0}
                      onClick={() => moveScene(i, -1)}
                    >
                      ↑ Up
                    </button>
                    <button
                      type="button"
                      className={linkBtn}
                      disabled={i === form.scenes.length - 1}
                      onClick={() => moveScene(i, 1)}
                    >
                      ↓ Down
                    </button>
                    {form.scenes.length > 1 && (
                      <button
                        type="button"
                        className={linkBtn}
                        onClick={() => set("scenes", form.scenes.filter((_, j) => j !== i))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Scene title">
                    <input
                      className={inputCls}
                      value={scene.title}
                      onChange={(e) => updateScene(i, { title: e.target.value })}
                      placeholder="e.g. Loading the wafer"
                    />
                  </Field>
                  <Field label="Location">
                    <input
                      className={inputCls}
                      value={scene.location}
                      onChange={(e) => updateScene(i, { location: e.target.value })}
                      placeholder="e.g. Deposition bay"
                    />
                  </Field>
                  <Field label="Who is speaking?">
                    <input
                      className={inputCls}
                      list="speaker-options"
                      value={scene.speaker}
                      onChange={(e) => updateScene(i, { speaker: e.target.value })}
                      placeholder="Name or role, or 'text pop-ups only'"
                    />
                  </Field>
                  <Field label="Which tool is discussed?">
                    <input
                      className={inputCls}
                      list="tool-options"
                      value={scene.tool}
                      onChange={(e) => updateScene(i, { tool: e.target.value })}
                    />
                  </Field>
                  <Field label="Background media">
                    <select
                      className={inputCls}
                      value={scene.mediaType}
                      onChange={(e) => updateScene(i, { mediaType: e.target.value })}
                    >
                      <option value="">Not sure yet</option>
                      {MEDIA_TYPES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field
                  label="What is highlighted or clicked?"
                  hint="The part of the tool the learner's attention goes to, and what they interact with."
                >
                  <textarea
                    className={`${inputCls} min-h-20`}
                    value={scene.interaction}
                    onChange={(e) => updateScene(i, { interaction: e.target.value })}
                  />
                </Field>
                <Field label="Activities" hint="Quizzes, clickables, pop-ups, etc.">
                  <textarea
                    className={`${inputCls} min-h-16`}
                    value={scene.activities}
                    onChange={(e) => updateScene(i, { activities: e.target.value })}
                  />
                </Field>
                <Field label="Other notes">
                  <textarea
                    className={`${inputCls} min-h-16`}
                    value={scene.notes}
                    onChange={(e) => updateScene(i, { notes: e.target.value })}
                  />
                </Field>
              </div>
            ))}
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => set("scenes", [...form.scenes, emptyScene()])}
            >
              + Add scene
            </button>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-lg font-semibold">Review</h2>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-zinc-500">Module</dt>
              <dd>
                {review.number && <span className="text-zinc-500">{review.number} · </span>}
                {review.name || <em className="text-red-600">missing</em>}
              </dd>
              <dt className="text-zinc-500">Description</dt>
              <dd className="whitespace-pre-wrap">
                {review.description || <em className="text-red-600">missing</em>}
              </dd>
              {review.audience && (
                <>
                  <dt className="text-zinc-500">Audience</dt>
                  <dd>{review.audience}</dd>
                </>
              )}
              {review.targetCompletion && (
                <>
                  <dt className="text-zinc-500">Target completion</dt>
                  <dd>{review.targetCompletion}</dd>
                </>
              )}
              {review.runtimeMinutes && (
                <>
                  <dt className="text-zinc-500">Runtime</dt>
                  <dd>{review.runtimeMinutes} min</dd>
                </>
              )}
              <dt className="text-zinc-500">Objectives</dt>
              <dd>{review.objectives.length}</dd>
              <dt className="text-zinc-500">Tools</dt>
              <dd>{review.tools.map((t) => t.name).join(", ") || "None"}</dd>
              <dt className="text-zinc-500">Scenes</dt>
              <dd>
                {review.scenes.length ? (
                  <ol className="list-decimal pl-5">
                    {review.scenes.map((s, i) => (
                      <li key={i}>{s.title || <span className="text-zinc-400">Untitled</span>}</li>
                    ))}
                  </ol>
                ) : (
                  "None"
                )}
              </dd>
            </dl>
            <p className="text-sm text-zinc-500">
              Submitting creates the module. Scenes and details can be filled in further later.
            </p>
          </>
        )}
      </section>

      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          {step > 0 && (
            <button type="button" className={secondaryBtn} onClick={goBack} disabled={pending}>
              Back
            </button>
          )}
          <button type="button" className={linkBtn} onClick={resetDraft} disabled={pending}>
            Clear form
          </button>
        </div>
        {step < STEPS.length - 1 ? (
          <button type="button" className={primaryBtn} onClick={goNext}>
            Next
          </button>
        ) : (
          <button type="button" className={primaryBtn} onClick={submit} disabled={pending}>
            {pending ? "Submitting…" : "Submit"}
          </button>
        )}
      </div>
      <p className="text-xs text-zinc-400">Your progress is saved in this browser as you type.</p>
    </div>
  );
}
