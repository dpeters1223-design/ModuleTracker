import type { Module, Scene } from "@prisma/client";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const multiline = (s: string) => esc(s).replace(/\n/g, "<br>");

export function moduleTitle(mod: Pick<Module, "number" | "name">) {
  return mod.number ? `${mod.number} – ${mod.name}` : mod.name;
}

/**
 * Starting script as HTML (Drive converts it to a Google Doc): the module's
 * Discovery Form answers up top, then one section per scene with a narration
 * placeholder for the writer to fill in.
 */
export function buildScriptHtml(mod: Module, scenes: Scene[]): string {
  const parts: string[] = [`<h1>${esc(moduleTitle(mod))}: Script</h1>`];

  const facts: [string, string | null][] = [
    ["Audience", mod.audience],
    ["Target completion", mod.targetCompletion],
    ["Estimated runtime", mod.runtimeMinutes ? `${mod.runtimeMinutes} minutes` : null],
    ["Tools", mod.toolsUsed?.split("\n").join(", ") ?? null],
  ];
  for (const [k, v] of facts) if (v) parts.push(`<p><b>${k}:</b> ${esc(v)}</p>`);
  if (mod.description) parts.push(`<p>${multiline(mod.description)}</p>`);

  const objectives = mod.learningObjectives?.split("\n").filter(Boolean) ?? [];
  if (objectives.length) {
    parts.push("<h2>Learning objectives</h2><ol>");
    for (const o of objectives) parts.push(`<li>${esc(o)}</li>`);
    parts.push("</ol>");
  }

  parts.push("<h2>Scenes</h2>");
  if (!scenes.length) {
    parts.push("<p><i>No scenes were outlined in the Discovery Form yet.</i></p>");
  }
  for (const s of scenes) {
    parts.push(`<h3>Scene ${s.order}${s.title ? `: ${esc(s.title)}` : ""}</h3>`);
    const meta = [
      s.location && `Location: ${s.location}`,
      s.backgroundMediaType && `Background: ${s.backgroundMediaType}`,
      s.toolUsed && `Tool: ${s.toolUsed}`,
      s.speaker && `Speaker: ${s.speaker}`,
    ].filter(Boolean) as string[];
    if (meta.length) parts.push(`<p><i>${esc(meta.join(" · "))}</i></p>`);
    if (s.interactionHighlighted) {
      parts.push(`<p><b>Highlighted / clicked:</b> ${multiline(s.interactionHighlighted)}</p>`);
    }
    if (s.activities) parts.push(`<p><b>Activities:</b> ${multiline(s.activities)}</p>`);
    if (s.notes) parts.push(`<p><b>Notes:</b> ${multiline(s.notes)}</p>`);
    parts.push(`<p><b>Narration${s.speaker ? ` (${esc(s.speaker)})` : ""}:</b></p>`);
    parts.push(`<p style="color:#888888"><i>[Write the narration for this scene here]</i></p>`);
  }

  return `<html><body>${parts.join("\n")}</body></html>`;
}
