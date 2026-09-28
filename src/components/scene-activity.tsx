import { cleanInteractions, cleanQuestions, interactionLabel } from "@/lib/interactions";

/** Read-only view of a scene's interactions and quiz questions (module page). */
export function SceneActivity({ interactions, questions }: { interactions: unknown; questions: unknown }) {
  const items = cleanInteractions(interactions);
  const quiz = cleanQuestions(questions);
  if (!items.length && !quiz.length) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      {items.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">What happens</p>
          <ul className="mt-1 space-y-1">
            {items.map((i) => (
              <li key={i.type}>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {interactionLabel(i.type)}
                </span>
                {i.note && <span className="ml-2 text-zinc-600 dark:text-zinc-400">{i.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {quiz.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Quiz ({quiz.length})</p>
          <ol className="mt-1 list-decimal space-y-2 pl-5">
            {quiz.map((q, qi) => (
              <li key={qi}>
                <p className="font-medium">{q.question || <span className="text-zinc-400">No question text yet</span>}</p>
                <ul className="mt-0.5 space-y-0.5">
                  {q.options.map((o, oi) => (
                    <li key={oi} className={o.correct ? "font-medium text-green-800 dark:text-green-300" : "text-zinc-600 dark:text-zinc-400"}>
                      {String.fromCharCode(65 + oi)}. {o.text}
                      {o.correct && <span className="ml-1">✓ correct</span>}
                    </li>
                  ))}
                </ul>
                {q.feedback && <p className="mt-0.5 text-xs text-zinc-500">Feedback: {q.feedback}</p>}
                {q.options.length > 0 && !q.options.some((o) => o.correct) && (
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">No correct answer marked yet</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
