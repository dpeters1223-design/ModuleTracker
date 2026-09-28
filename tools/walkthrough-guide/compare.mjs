// Pixel-compares desktop-before-* vs desktop-after-* screenshots.
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1");
const dir = path.join(HERE, "shots");
let allSame = true;
for (const f of fs.readdirSync(dir).filter((f) => f.startsWith("desktop-before-")).sort()) {
  const name = f.replace("desktop-before-", "").replace(".png", "");
  const a = PNG.sync.read(fs.readFileSync(path.join(dir, f)));
  const bFile = path.join(dir, `desktop-after-${name}.png`);
  if (!fs.existsSync(bFile)) { console.log(`?  ${name}: no after screenshot`); allSame = false; continue; }
  const b = PNG.sync.read(fs.readFileSync(bFile));
  if (a.width !== b.width || a.height !== b.height) {
    console.log(`✗  ${name}: size changed ${a.width}x${a.height} → ${b.width}x${b.height}`);
    allSame = false;
    continue;
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.05 });
  if (n) fs.writeFileSync(path.join(dir, `diff-${name}.png`), PNG.sync.write(diff));
  console.log(`${n ? "✗" : "✓"}  ${name}: ${n} pixels differ`);
  if (n) allSame = false;
}
console.log(allSame ? "\nDESKTOP IDENTICAL on every page." : "\nSome desktop pages differ — see diff-*.png");
