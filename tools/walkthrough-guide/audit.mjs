// Headless-Edge audit of the local app, signed in as David via a minted session cookie.
//   node audit.mjs mobile            → phone-size overflow report + screenshots (shots/mobile-*)
//   node audit.mjs desktop <label>   → desktop full-page screenshots (shots/desktop-<label>-*)
// Run with cwd = repo root (for .env.local) and NODE_PATH = repo node_modules.
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1");
const req = createRequire(process.env.NODE_PATH + "/");
req("dotenv").config({ path: ".env.local", quiet: true });
const { encode } = req("next-auth/jwt");
const { PrismaNeon } = req("@prisma/adapter-neon");
const { PrismaClient } = req("@prisma/client");

const [mode, label = "x"] = process.argv.slice(2);
const BASE = "http://localhost:3000";
const OUT = path.join(HERE, "shots");
fs.mkdirSync(OUT, { recursive: true });

const p = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
const david = await p.user.findUnique({ where: { email: "dpp49@cornell.edu" } });
const mods = await p.module.findMany({ where: { name: { startsWith: "[Example]" } }, orderBy: { createdAt: "asc" }, select: { id: true } });
await p.$disconnect();
const token = await encode({ salt: "authjs.session-token", secret: process.env.AUTH_SECRET, token: { sub: david.id, email: david.email, uid: david.id, driveGranted: true } });

const m = mods[0].id;
const pages = [
  ["dashboard", "/"],
  ["modules", "/modules"],
  ["modules-board", "/modules?view=board"],
  ["modules-timeline", "/modules?view=timeline"],
  ["module", `/modules/${m}`],
  ["module-board", `/modules/${m}?tasks=board`],
  ["module-timeline", `/modules/${m}?tasks=timeline`],
  ["module-edit", `/modules/${m}/edit`],
  ["discovery", "/discovery/new"],
  ["scripts", "/scripts"],
  ["script", `/scripts/${m}`],
  ["tasks", "/tasks"],
  ["changes", "/changes"],
  ["activity", "/activity"],
];

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--no-first-run", "--disable-extensions"],
});
const page = await browser.newPage();
await page.setCookie({ name: "authjs.session-token", value: token, domain: "localhost", path: "/", httpOnly: true });
if (mode === "mobile") {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
} else {
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
}
// Stable screenshots: no caret blink / transitions.
await page.evaluateOnNewDocument(() => {
  const s = document.createElement("style");
  s.textContent = "*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
});

/** Elements that stick out past the viewport, ignoring content clipped inside a scroll container that itself fits. */
const findOverflow = () =>
  page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    // Fine if ANY clipping/scrolling ancestor fits on screen (e.g. a board card inside a
    // column inside the board's sideways-scrolling strip).
    const clipped = (el) => {
      for (let a = el.parentElement; a; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if ((ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") && a.getBoundingClientRect().right <= W + 1) {
          return true;
        }
      }
      return false;
    };
    const bad = new Set();
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > W + 1 && !clipped(el)) bad.add(el);
    }
    // Report only the outermost offenders.
    const top = [...bad].filter((el) => !bad.has(el.parentElement));
    return {
      pageScrollsSideways: document.documentElement.scrollWidth > W + 1,
      scrollWidth: document.documentElement.scrollWidth,
      width: W,
      offenders: top.slice(0, 12).map((el) => ({
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute("class") || "").split(/\s+/).slice(0, 8).join(" "),
        text: (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 70),
        right: Math.round(el.getBoundingClientRect().right),
      })),
    };
  });

const clickByText = async (text) => {
  const ok = await page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim().includes(t));
    if (b) b.click();
    return !!b;
  }, text);
  await new Promise((r) => setTimeout(r, 400));
  return ok;
};

const report = [];
for (const [name, url] of pages) {
  await page.goto(BASE + url, { waitUntil: "networkidle0", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 500));
  const shots = [[name, null]];
  // Form pages: also visit each step (the step pills are buttons "1. About" … "5. Review").
  if (name === "discovery" || name === "module-edit") {
    for (const step of ["2. Learning objectives", "3. Tools", "4. Scenes", "5. Review"]) shots.push([`${name}-step${step[0]}`, step]);
  }
  for (const [shotName, step] of shots) {
    if (step) {
      if (name === "discovery" && step.startsWith("2")) {
        // New-module form won't advance without a name + description; fill them.
        await page.evaluate(() => {
          const set = (el, v) => { const s = Object.getOwnPropertyDescriptor(el.__proto__, "value").set; s.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
          const inputs = document.querySelectorAll("main input, main textarea");
          set(inputs[0], "Audit test module");
          const ta = [...document.querySelectorAll("main textarea")][0];
          set(ta, "Audit description");
        });
      }
      await clickByText(step);
      if (step.startsWith("4") && mode === "mobile") {
        // Open the activity checklist + quiz so they're measured too.
        await page.evaluate(() => {
          const q = [...document.querySelectorAll("label")].find((l) => l.innerText.trim() === "Question / quiz");
          const box = q?.querySelector("input[type=checkbox]");
          if (box && !box.checked) box.click();
          const h = [...document.querySelectorAll("label")].find((l) => l.innerText.trim() === "Click a highlighted spot");
          const hb = h?.querySelector("input[type=checkbox]");
          if (hb && !hb.checked) hb.click();
          document.querySelectorAll("details").forEach((d) => (d.open = true));
        });
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    const file = path.join(OUT, mode === "mobile" ? `mobile-${shotName}.png` : `desktop-${label}-${shotName}.png`);
    await page.screenshot({ path: file, fullPage: true });
    if (mode === "mobile") report.push({ page: shotName, ...(await findOverflow()) });
  }
}
await browser.close();

if (mode === "mobile") {
  for (const r of report) {
    const flag = r.pageScrollsSideways || r.offenders.length ? "✗" : "✓";
    console.log(`${flag} ${r.page}${r.pageScrollsSideways ? `  (page is ${r.scrollWidth}px wide on a ${r.width}px screen)` : ""}`);
    for (const o of r.offenders) console.log(`     → <${o.tag} class="${o.cls}"> "${o.text}" ends at ${o.right}px`);
  }
} else {
  console.log(`saved ${fs.readdirSync(OUT).filter((f) => f.startsWith(`desktop-${label}-`)).length} desktop screenshots (${label})`);
}
