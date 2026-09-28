# Walkthrough guide (source)

Source for the "Meet ModuleTracker" / walkthroughs page published as a Claude artifact:
https://claude.ai/artifact/LA9Pk3dpPqSkgydLtuGjib (private; share from its Share menu).

- `template.html` — the page. `/*HOT*/{}` is replaced with hotspot data from `steps.json`
  to produce the published `index.html` (see "Rebuild" below).
- `steps.json` — each step's screenshot and hotspot rectangle (% of a 1200×760 shot).
- `shots/` — screenshots of the local app using the `[Example]` modules.
- `capture-guide.mjs`, `capture-extra.mjs` — regenerate the screenshots + `steps.json` with
  headless Microsoft Edge (puppeteer-core), signed in via a locally minted session cookie.
  `capture-extra.mjs` also exports the example script Doc from Drive and renders it.
- `audit.mjs`, `tile.mjs`, `compare.mjs` — the phone-layout audit and desktop pixel-diff
  used for the mobile pass.

These scripts expect: the dev server on :3000, cwd = repo root (for `.env.local`),
`NODE_PATH=<repo>/node_modules`, and `puppeteer-core`, `pngjs`, `pixelmatch` installed next
to them (they are not app dependencies). Output paths point at `../guide/shots` relative to
the script; adjust when running from here.

Rebuild `index.html`: replace `/*HOT*/{}` in `template.html` with
`{ "<id>": [x, y, w, h], … }` built from `steps.json`, then publish it with `shots/` alongside.
