// Splits full-page screenshots into phone-screen-height tiles for review.
// node tile.mjs <name> [tileHeight]   e.g. node tile.mjs mobile-module
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1");
const [name, h = "844"] = process.argv.slice(2);
const src = PNG.sync.read(fs.readFileSync(path.join(HERE, "shots", `${name}.png`)));
const tileH = Number(h);
const count = Math.ceil(src.height / tileH);
for (let t = 0; t < count; t++) {
  const y0 = t * tileH;
  const hh = Math.min(tileH, src.height - y0);
  const out = new PNG({ width: src.width, height: hh });
  PNG.bitblt(src, out, 0, y0, src.width, hh, 0, 0);
  fs.writeFileSync(path.join(HERE, "shots", `${name}-t${t + 1}.png`), PNG.sync.write(out));
}
console.log(`${name}: ${count} tiles`);
