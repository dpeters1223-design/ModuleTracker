// Builds the in-app guide (served at /guide, behind sign-in like the rest of the app):
// template.html + steps.json hotspots -> public/guide/index.html, plus the screenshots.
// Run from the repo root: node tools/walkthrough-guide/build.mjs
import fs from "fs";
import path from "path";

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1");
const OUT = path.join(HERE, "..", "..", "public", "guide");

const steps = JSON.parse(fs.readFileSync(path.join(HERE, "steps.json"), "utf8"));
const hot = Object.fromEntries(steps.map((s) => [s.id, [s.hot.x, s.hot.y, s.hot.w, s.hot.h]]));
const body = fs.readFileSync(path.join(HERE, "template.html"), "utf8").replace("/*HOT*/{}", JSON.stringify(hot));

// The page is served at /guide (no trailing slash), so <base> makes shots/… resolve under /guide/.
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<base href="/guide/">
${body}
</html>
`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });
fs.writeFileSync(path.join(OUT, "index.html"), html);
// Only the screenshots the page actually uses.
const used = new Set([...body.matchAll(/shots\/([\w-]+)\.png/g)].map((m) => m[1]).concat(Object.keys(hot)));
for (const id of used) fs.copyFileSync(path.join(HERE, "shots", `${id}.png`), path.join(OUT, "shots", `${id}.png`));
console.log(`public/guide: index.html + ${used.size} screenshots`);
