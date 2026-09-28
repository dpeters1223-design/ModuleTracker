// Extra guide captures: the List/Board/Timeline toggles, the all-modules timeline, and the
// real script Doc's content (exported from Drive as HTML, rendered on a plain "page").
// Appends to guide/steps.json. Read-only against the app and Drive.
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1");
const GUIDE = path.join(HERE, "..", "guide");
const OUT = path.join(GUIDE, "shots");
const req = createRequire(process.env.NODE_PATH + "/");
req("dotenv").config({ path: ".env.local", quiet: true });
const { encode } = req("next-auth/jwt");
const { PrismaNeon } = req("@prisma/adapter-neon");
const { PrismaClient } = req("@prisma/client");

const p = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
const david = await p.user.findUnique({ where: { email: "dpp49@cornell.edu" } });
const PVD1 = (await p.module.findFirst({ where: { number: "EX-PVD1" }, select: { id: true } })).id;
const script = await p.documentLink.findFirst({ where: { moduleId: PVD1, type: "script" } });

async function tokenFor(email) {
  const u = await p.user.findUnique({ where: { email } });
  if (!u?.googleRefreshToken) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: process.env.AUTH_GOOGLE_ID, client_secret: process.env.AUTH_GOOGLE_SECRET, grant_type: "refresh_token", refresh_token: u.googleRefreshToken }),
  });
  return r.ok ? (await r.json()).access_token : null;
}
// Export the script Doc as HTML with whichever owner's token can read it.
let docHtml = null, docName = "";
for (const email of ["dpp49@cornell.edu", "jgw226@cornell.edu"]) {
  const t = await tokenFor(email);
  if (!t || !script?.driveFileId) continue;
  const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${script.driveFileId}?fields=name`, { headers: { Authorization: `Bearer ${t}` } });
  if (!meta.ok) continue;
  docName = (await meta.json()).name;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${script.driveFileId}/export?mimeType=text/html`, { headers: { Authorization: `Bearer ${t}` } });
  if (res.ok) { docHtml = await res.text(); console.log(`exported script Doc "${docName}" via ${email}`); break; }
}
await p.$disconnect();
if (!docHtml) throw new Error("Could not export the example script Doc from Drive");
const token = await encode({ salt: "authjs.session-token", secret: process.env.AUTH_SECRET, token: { sub: david.id, email: david.email, uid: david.id, driveGranted: true } });

const W = 1200, H = 760;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const page = await browser.newPage();
await page.setCookie({ name: "authjs.session-token", value: token, domain: "localhost", path: "/", httpOnly: true });
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(() => {
  const s = document.createElement("style");
  s.textContent = "nextjs-portal,[data-nextjs-toast]{display:none!important}*,*::before,*::after{transition:none!important;animation:none!important}";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const go = async (url) => { await page.goto("http://localhost:3000" + url, { waitUntil: "networkidle0", timeout: 90000 }); await sleep(400); };
const steps = JSON.parse(fs.readFileSync(path.join(GUIDE, "steps.json"), "utf8")).filter((s) => !["views", "doc"].includes(s.job));
async function shot(job, id, finderSrc, pad = 6) {
  const measure = () => page.evaluate((src) => {
    const el = new Function(`return (${src})()`)();
    if (!el) return null;
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, finderSrc);
  if (!(await measure())) throw new Error(`hotspot not found: ${id}`);
  await sleep(250);
  const r = await measure();
  await page.screenshot({ path: path.join(OUT, `${id}.png`) });
  const pct = (v, of) => +((v / of) * 100).toFixed(2);
  steps.push({ job, id, img: `shots/${id}.png`, hot: { x: pct(r.x - pad, W), y: pct(r.y - pad, H), w: pct(r.w + pad * 2, W), h: pct(r.h + pad * 2, H) } });
  console.log("captured", id);
}
const toggle = (label) => `() => [...document.querySelectorAll('nav[aria-label="Task view"] a, nav[aria-label="View"] a')].find((a) => a.innerText.trim() === ${JSON.stringify(label)})`;

// ── Three ways to see tasks ──
await go(`/modules/${PVD1}`);
await shot("views", "views-1-list", toggle("List"));
await go(`/modules/${PVD1}?tasks=board`);
await shot("views", "views-2-board", toggle("Board"));
await go(`/modules/${PVD1}?tasks=timeline`);
await shot("views", "views-3-timeline", toggle("Timeline"));
await go("/modules?view=timeline");
await shot("views", "views-4-all", toggle("Timeline"));
await go("/modules?view=board");
await shot("views", "views-5-allboard", toggle("Board"));

// ── The script Doc itself: exported HTML on a plain page, like it looks when opened ──
const body = docHtml.replace(/^[\s\S]*?<body[^>]*>/i, "").replace(/<\/body>[\s\S]*$/i, "");
const styles = (docHtml.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []).join("\n");
await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${styles}
<style>
  html,body{margin:0;background:#eef0f2;font-family:Arial,sans-serif}
  .top{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid #dadce0;padding:12px 24px;display:flex;align-items:center;gap:12px;font:14px Arial}
  .icon{width:22px;height:28px;border-radius:3px;background:#4285f4;position:relative}
  .icon::after{content:"";position:absolute;left:5px;right:5px;top:9px;height:2px;background:#fff;box-shadow:0 5px 0 #fff,0 10px 0 #fff}
  .name{font-size:18px;color:#202124}
  .paper{width:816px;margin:24px auto 60px;background:#fff;box-shadow:0 1px 3px rgba(60,64,67,.3);padding:72px 80px;box-sizing:border-box;min-height:1000px}
  .paper > * { max-width: 100% !important; }
  .doc-content{padding:0!important;max-width:none!important}
  .paper p,.paper li{line-height:1.5!important;margin:0 0 6px!important;font-size:15px!important}
  .paper h1{margin:0 0 16px!important;font-size:26px!important}
  .paper h2{margin:22px 0 10px!important}
  .paper h3{margin:22px 0 8px!important}
</style></head><body><div class="top"><span class="icon"></span><span class="name">${docName.replace(/</g, "&lt;")}</span></div><div class="paper">${body}</div></body></html>`, { waitUntil: "load" });
await sleep(300);
const firstScene = `() => [...document.querySelectorAll(".paper h3, .paper h2, .paper p")].find((e) => /^Scene 1/.test(e.innerText.trim()))`;
await shot("doc", "doc-1-top", `() => document.querySelector(".paper h1") || document.querySelector(".paper p")`, 8);
await shot("doc", "doc-2-scene", firstScene, 8);
const narration = `() => [...document.querySelectorAll(".paper p")].find((e) => e.innerText.includes("Write the narration"))`;
await shot("doc", "doc-3-narration", narration, 8);

await browser.close();
fs.writeFileSync(path.join(GUIDE, "steps.json"), JSON.stringify(steps, null, 2));
console.log(`steps.json now has ${steps.length} steps`);
