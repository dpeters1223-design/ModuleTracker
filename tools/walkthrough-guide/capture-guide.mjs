// Captures the how-to guide's screenshots from the local app (signed in as David) and
// records each step's hotspot rectangle as % of the screenshot. Nothing is saved to the
// app: the Discovery Form is filled but never submitted. Output: shots/*.png + steps.json in
// GUIDE_DIR (default: this script's folder).
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1");
const OUT = path.join(process.env.GUIDE_DIR ?? HERE, "shots");
fs.mkdirSync(OUT, { recursive: true });
const req = createRequire(process.env.NODE_PATH + "/");
req("dotenv").config({ path: ".env.local", quiet: true });
const { encode } = req("next-auth/jwt");
const { PrismaNeon } = req("@prisma/adapter-neon");
const { PrismaClient } = req("@prisma/client");

const p = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
const david = await p.user.findUnique({ where: { email: "dpp49@cornell.edu" } });
const byCode = async (code) => (await p.module.findFirst({ where: { number: code }, select: { id: true } })).id;
const PVD1 = await byCode("EX-PVD1"), MET1 = await byCode("EX-MET1");
const pvd1HasScript = !!(await p.documentLink.findFirst({ where: { moduleId: PVD1, type: "script" } }));
const met1HasScript = !!(await p.documentLink.findFirst({ where: { moduleId: MET1, type: "script" } }));
await p.$disconnect();
const token = await encode({ salt: "authjs.session-token", secret: process.env.AUTH_SECRET, token: { sub: david.id, email: david.email, uid: david.id, driveGranted: true } });

const W = 1200, H = 760;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const page = await browser.newPage();
await page.setCookie({ name: "authjs.session-token", value: token, domain: "localhost", path: "/", httpOnly: true });
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(() => {
  const s = document.createElement("style");
  // Hide the Next.js dev badge; freeze motion for clean stills.
  s.textContent = "nextjs-portal,[data-nextjs-toast]{display:none!important}*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const go = async (url) => { await page.goto("http://localhost:3000" + url, { waitUntil: "networkidle0", timeout: 90000 }); await sleep(400); };

// Finds an element by a DOM query run in the page (a function body returning the element).
async function rectOf(finder) {
  return page.evaluate((src) => {
    const el = new Function(`return (${src})()`)();
    if (!el) return null;
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, finder.toString());
}
const steps = [];
async function shot(job, id, finder, pad = 6) {
  let r = await rectOf(finder);
  if (!r) throw new Error(`hotspot not found for ${id}`);
  await sleep(250);
  r = await rectOf(finder); // re-measure after scroll settles
  const file = `${id}.png`;
  await page.screenshot({ path: path.join(OUT, file) });
  const pct = (v, of) => +((v / of) * 100).toFixed(2);
  steps.push({ job, id, img: `shots/${file}`, hot: { x: pct(r.x - pad, W), y: pct(r.y - pad, H), w: pct(r.w + pad * 2, W), h: pct(r.h + pad * 2, H) } });
  console.log("captured", id);
}
// Sets a React-controlled input/textarea/select value.
const setVal = (selector, value, index = 0) =>
  page.evaluate((sel, v, i) => {
    const el = document.querySelectorAll(sel)[i];
    const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  }, selector, value, index);
const clickText = (tag, text) =>
  page.evaluate((t, x) => { const el = [...document.querySelectorAll(t)].find((e) => e.innerText.trim() === x); el?.click(); return !!el; }, tag, text);
const byText = (tag, text) => `() => [...document.querySelectorAll(${JSON.stringify(tag)})].find((e) => e.innerText.trim() === ${JSON.stringify(text)})`;
const byLabel = (text) => `() => [...document.querySelectorAll("label")].find((e) => e.innerText.trim().startsWith(${JSON.stringify(text)}))`;

// ── Job: start a new module (Discovery Form) ──
await go("/");
await shot("new-module", "new-1-dashboard", byText("a", "+ New module"));
await go("/discovery/new");
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await go("/discovery/new");
await setVal("main input", "Physical Vapor Deposition 3: Reactive Sputtering", 0);
await setVal("main input", "PVD3", 1);
await setVal("main input", "Fall 2027", 2);
await setVal("main textarea", "Learners deposit a titanium nitride film by adding nitrogen to the sputter plasma, and see how gas flow changes the film.", 0);
await setVal("main input", "Cleanroom users who completed PVD1", 3);
await setVal("main input", "12", 4);
await shot("new-module", "new-2-about", byText("button", "Next"));
await clickText("button", "Next"); await sleep(300);
await setVal("main input", "Explain how reactive gas changes a sputtered film", 0);
await clickText("button", "+ Add objective"); await sleep(150);
await setVal("main input", "Set nitrogen flow for a target film color", 1);
await shot("new-module", "new-3-objectives", byText("button", "+ Add objective"));
await clickText("button", "Next"); await sleep(300);
await setVal("main input", "Magnetron sputter system", 0);
await setVal("main textarea", "Nitrogen mass flow controller\nTarget poisoning indicator\nRecipe screen", 0);
await shot("new-module", "new-4-tools", byText("button", "+ Add tool"));
await clickText("button", "Next"); await sleep(300);

// ── Job: describe scenes + quiz (step 4 of the same form) ──
await setVal("main input", "Adding nitrogen to the plasma", 0);
await setVal("main input", "Deposition bay", 1);
await setVal("main input", "Tom Pennell", 2);
await setVal("main input", "Magnetron sputter system", 3);
await setVal("main select", "360 video", 0);
await shot("scenes", "scene-1-basics", `() => document.querySelector("main select")`);
await page.evaluate(() => {
  const tick = (t) => [...document.querySelectorAll("label")].find((l) => l.innerText.trim() === t)?.querySelector("input")?.click();
  tick("Click a highlighted spot"); tick("Step-by-step click sequence"); tick("Question / quiz");
});
await sleep(300);
await setVal("main select", "2", 1);
await shot("scenes", "scene-2-activities", byLabel("Question / quiz"));
// Click sequence: typed for real, Enter makes the next numbered step.
await page.click('input[aria-label="Step-by-step click sequence, step 1"]');
for (const [n, s] of ["Open the nitrogen valve", "Set the flow to 5 sccm", "Click Start on the recipe screen"].entries()) {
  if (n) await page.keyboard.press("Enter");
  await page.keyboard.type(s);
}
await page.evaluate(() => document.activeElement.blur());
await sleep(200);
await shot("scenes", "scene-2b-steps", `() => document.querySelector('input[aria-label="Step-by-step click sequence, step 1"]').closest("ol").parentElement`, 8);
await page.evaluate(() => {
  const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
  set(document.querySelector('input[placeholder^="e.g. Which power supply"]'), "What color does a good titanium nitride film look like?");
  const answers = document.querySelectorAll('input[aria-label^="Answer "]:not([type=checkbox])');
  set(answers[0], "Gold"); set(answers[1], "Silver");
  document.querySelectorAll('input[aria-label$="is correct"]')[0].click();
  set(document.querySelector('input[aria-label="Feedback after answering"]'), "Right: stoichiometric TiN is gold-colored.");
  const hot = document.querySelector('input[aria-label="Click a highlighted spot"], input[placeholder^="e.g. \\"Click here"]');
  if (hot) set(hot, "Click the nitrogen flow knob");
});
await sleep(300);
await shot("scenes", "scene-3-quiz", `() => document.querySelectorAll('input[aria-label$="is correct"]')[0].closest("div")`, 8);
await shot("scenes", "scene-4-add", byText("button", "+ Add scene"));
await clickText("button", "5. Review"); await sleep(300);
await shot("new-module", "new-5-submit", byText("button", "Submit"));

// ── Job: start the script ──
await go("/scripts");
await shot("script", "script-1-list", `() => [...document.querySelectorAll("main a")].find((a) => a.href.includes(${JSON.stringify(met1HasScript ? PVD1 : MET1)}))`);
await go(`/scripts/${met1HasScript ? PVD1 : MET1}`);
await shot("script", "script-2-start", byText("button", "Start script from Discovery Form"));
if (pvd1HasScript) {
  await go(`/scripts/${PVD1}`);
  await shot("script", "script-3-open", `() => document.querySelector('main a[target="_blank"]')`);
}

// ── Job: update tasks ──
await go(`/modules/${PVD1}`);
await shot("tasks", "tasks-1-status", `() => document.querySelector('select[aria-label^="Status of"]')`);
await go(`/modules/${PVD1}?tasks=board`);
await shot("tasks", "tasks-2-drag", `() => document.querySelector('[aria-roledescription="Draggable task"]')`);
await shot("tasks", "tasks-3-plus", `() => document.querySelector('button[aria-label^="Add a Scripting task"]')`, 8);
await go(`/modules/${PVD1}?tasks=timeline`);
await shot("tasks", "tasks-4-timeline", `() => document.querySelector('button[aria-label*="Scripting"]')`, 8);

// ── Job: see what's due / where things stand ──
await go("/");
await shot("due", "due-1-dashboard", `() => [...document.querySelectorAll("main a")].find((a) => a.getAttribute("href") === "/tasks?due=overdue")`);
await go("/tasks");
await shot("due", "due-2-filters", `() => document.querySelector('select[aria-label="Due"]')`);
await go(`/modules/${PVD1}`);
await shot("due", "due-3-status", `() => document.querySelector('select[aria-label="Module status"]')`);

// ── Job: history & undo ──
await go("/activity");
const hasUndo = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "Undo"));
if (hasUndo) await shot("undo", "undo-1-activity", byText("button", "Undo"));

await browser.close();
fs.writeFileSync(path.join(OUT, "..", "steps.json"), JSON.stringify(steps, null, 2));
console.log(`${steps.length} steps captured`);
