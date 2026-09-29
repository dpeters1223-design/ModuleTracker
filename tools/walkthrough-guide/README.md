# Walkthrough guide (source)

Source for the "Meet ModuleTracker" / walkthroughs page. It is served inside the app at
`/guide` (behind sign-in; the ? icon in the header opens it). An older copy was published as
a Claude artifact (https://claude.ai/artifact/LA9Pk3dpPqSkgydLtuGjib) and is out of date.

- `template.html` — the page. `/*HOT*/{}` is replaced with hotspot data from `steps.json`
  by `build.mjs`.
- `build.mjs` — writes `public/guide/index.html` + the screenshots it uses. Run from the repo
  root after changing the template or recapturing, and commit `public/guide/`.
- `steps.json` — each step's screenshot and hotspot rectangle (% of a 1200×760 shot).
- `shots/` — screenshots of the local app using the `[Example]` modules.
- `capture-guide.mjs`, `capture-extra.mjs` — regenerate the screenshots + `steps.json` with
  headless Microsoft Edge (puppeteer-core), signed in via a locally minted session cookie.
  `capture-extra.mjs` also exports the example script Doc from Drive and renders it.
- `audit.mjs`, `tile.mjs`, `compare.mjs` — the phone-layout audit and desktop pixel-diff
  used for the mobile pass.

The capture scripts expect: the dev server on :3000, cwd = repo root (for `.env.local`),
`NODE_PATH=<repo>/node_modules`, and `puppeteer-core` (+ `pngjs`, `pixelmatch` for the audit
tools) installed next to them — they are not app dependencies, so copy the scripts to a scratch
folder that has them. They write to `GUIDE_DIR` (default: the script's own folder), so set
`GUIDE_DIR=<repo>/tools/walkthrough-guide` when running a copy. Run `capture-guide.mjs`, then
`capture-extra.mjs` (it appends to `steps.json`), then `build.mjs`.
