# ModuleTracker — Engineering Progress & Handoff

> **For a new Claude session picking this up:** read `README.md` first for product/domain
> context (what CNF is, who the people are, why this app exists). Then read this file for
> engineering status — what's built, what decisions are locked in, and what's next. Update
> this file as you go; it's the source of truth for "where are we."

**Live app:** https://moduletrackercnf.vercel.app (Vercel project `peters10/moduletrackercnf`,
auto-deploys on every push to `main`). **Repo:** github.com/dpeters1223-design/ModuleTracker.

## Locked-in architecture decisions (don't re-litigate these)

Decided with the project owner (David) on 2026-09-22:

| Decision | Choice | Why |
|---|---|---|
| Script/document editing | Link out to Google Docs. App stores a plain URL per artifact, no in-app editor. | Most collaborators (esp. Tom) won't adopt a new editor. Google Docs already gives multi-user editing, comments, version history for free. |
| Hosting | Next.js on Vercel, git-push-to-deploy | Matches the "online app running from git" requirement directly. |
| Database | Hosted Postgres (Neon, via Vercel's Postgres integration) | Native Vercel integration, generous free tier. |
| Auth | Google sign-in (NextAuth/Auth.js), restricted to an email allowlist | Reuses accounts people already have; this is a small private team tool, not open registration. |
| Document library depth | Plain link fields only for v1 (no Google Picker, no Drive API sync) | Cheapest to ship; revisit only if plain links prove insufficient. |
| ORM | Prisma | Prisma Studio doubles as a spreadsheet-like data browser, which suits a team coming from spreadsheets. |
| UI | Tailwind CSS + shadcn/ui | Fast to build a clean internal dashboard without custom design work. |

Full original plan (context/rationale in more detail) is also saved at
`C:\Users\David\.claude\plans\eventual-munching-sutherland.md` on David's machine, but treat
**this file as canonical** since the plan file isn't part of the repo and won't travel with it.

## Data model (target — see `prisma/schema.prisma` once M1 lands)

- **User** — id, email, name, image (from NextAuth/Google)
- **Module** — id, number (e.g. "M5", "Youth Outreach"), name, status enum (not_started,
  scripting, pre_production, production, post_production, building, playtesting, signed_off,
  deployed), description, learningObjectives, toolsUsed, featuresDiscussed, targetCompletion
  (string — CNF's own data uses loose values like "Fall 2025"), runtimeMinutes, experienceId
  (Uptale experience ID), launchUrl
- **Scene** — id, moduleId, order, title, location, talent, backgroundMediaType, speaker,
  toolUsed, interactionHighlighted, notes. Doubles as the Discovery Form's per-scene capture
  (filled early, sparse) and the general scene list (filled in over production).
- **DocumentLink** — id, moduleId, sceneId (nullable), type enum (storyboard, script, rundown,
  shot_sheet, two_d_assets, playtest_notes, box_folder, other), label, url, addedById, addedAt
- **Task** — id, moduleId, phase enum (pre_production, scripting, production, post_production,
  uptale_build, playtesting, sign_off, deployment), title, owner, status enum (not_started,
  in_progress, blocked, completed), startDate, dueDate, notes, order
- **ChangeOrder** — id, moduleId, sceneRef (text, not FK), description, status, suggestedBy,
  suggestedDate, goalDate, approvedBy, completedDate, versionUpdated (bool), notes

These mirror the schemas CNF already uses in their own Track-Changes sheet and Working/Playtest
Notes doc (verified against the source files in `D:\CNF Docs`, which is **not** part of this
repo — see README.md "Context" section for what's in there).

## Build sequence & status

- [x] **M0 — Scaffold & prove the pipeline** — DONE
  - [x] `create-next-app` scaffolded: Next.js 16 (Turbopack), TypeScript, Tailwind v4, App
        Router, `src/` dir, `@/*` import alias, npm
      - Scaffolded into a temp lowercase-named dir first (npm rejects capital letters in
        `package.json` "name" — the repo folder is `ModuleTracker`) then copied into place,
        keeping the existing `README.md`. `package.json` "name" manually set to `moduletracker`.
  - [x] Placeholder home page (`src/app/page.tsx`) and metadata (`src/app/layout.tsx`)
        replaced with ModuleTracker-specific content instead of the create-next-app default
  - [x] `npm run build` passes cleanly
  - [x] `git add` + first commit of the scaffold (commit `d0a964e`)
  - [x] `git push` to `origin/main` (github.com/dpeters1223-design/ModuleTracker)
  - [x] Connect the repo to a Vercel project — done. Vercel project: `peters10/moduletrackercnf`.
  - [x] Confirm the placeholder page renders at the live Vercel URL — confirmed at
        **https://moduletrackercnf.vercel.app** ("ModuleTracker — Production tracker for
        Cornell NanoScale Facility VR training modules. Scaffolding in progress.")
        Every push to `main` auto-deploys here going forward.
- [~] **M1 — Database** (in progress): add Prisma, write `prisma/schema.prisma` per the data
      model above, add Postgres via Vercel's Neon integration, run initial migration, add a
      `/api/health` route that queries the DB to confirm connectivity in production.
- [ ] **M2 — Auth**: Auth.js + Google provider, email allowlist via env var, gate all routes.
- [ ] **M3 — Modules**: seed script (24-module roadmap from CNF's "Toms VR list" spreadsheet
      data, already extracted once this session — see note below) + dashboard list page +
      module detail page (read-only).
- [ ] **M4 — Document Library**: CRUD UI for `DocumentLink`, grouped by type, on the module
      detail page.
- [ ] **M5 — Tasks & Timeline**: CRUD UI for `Task` per module (table grouped by phase) —
      replaces CNF's Project Binder per-module timeline tables.
- [ ] **M6 — Discovery Form**: guided multi-step form (top-level questions, then repeatable
      "add a scene" blocks) writing to `Module` + `Scene`.
- [ ] **M7 — Change Orders**: CRUD UI for `ChangeOrder` mirroring CNF's existing log schema.
- [ ] **M8 — Real rollout**: add Tom/Ksenia/Jay to the allowlist, final QA pass.

## Repo layout (as of M0)

```
D:\ModuleTracker\
├── README.md          Product/domain context — read this first
├── PROGRESS.md         This file — engineering status
├── src/app/            Next.js App Router pages (page.tsx, layout.tsx, globals.css)
├── public/             Static assets
├── package.json        name: "moduletracker"
├── tsconfig.json, eslint.config.mjs, postcss.config.mjs, next.config.ts
└── .gitignore           standard create-next-app ignores (node_modules, .next, .env*, ...)
```

Not yet present: `prisma/` (arrives in M1), `src/app/api/`, `src/app/modules/`, auth config.

## How to run locally

```
npm install
npm run dev      # http://localhost:3000
npm run build    # production build check
```

## Where the domain research came from

`D:\CNF Docs` (outside this repo) holds the original CNF planning documents — Word docs and
an Excel workbook exported from Google Drive. Earlier this session those were converted to
plain text (docx/xlsx have no native reader on this machine — no pandoc/python available, so
small one-off Node scripts were written to unzip and parse the raw XML) and read in full to
inform the data model and product context in README.md. That extraction isn't preserved
anywhere permanent — if deeper domain detail is needed again, re-run the same approach against
`D:\CNF Docs`, or just re-read `README.md`, which already summarizes the key findings.

## Next action for a fresh session

Pick up at the first unchecked box under **Build sequence & status** above. As of this
writing that's: commit the M0 scaffold, push it, and (with David) connect the repo to Vercel.
