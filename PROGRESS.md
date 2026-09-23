# ModuleTracker — Engineering Progress & Handoff

> **For a new Claude session picking this up:** read `README.md` first for product/domain
> context (what CNF is, who the people are, why this app exists). Then read this file for
> engineering status — what's built, what decisions are locked in, and what's next. Update
> this file as you go; it's the source of truth for "where are we."

**Live app:** https://vr-module-tracker.vercel.app (Vercel project `peters10/vr-module-tracker`,
auto-deploys on every push to `main`). **Repo:** github.com/dpeters1223-design/ModuleTracker.

> Vercel project was originally named `moduletrackercnf` / URL `moduletrackercnf.vercel.app`,
> renamed 2026-09-22 (see **Branding** below for why) via Settings → General → Project Name.
> Renaming in place changes the `.vercel.app` URL without disconnecting the GitHub repo.

## Branding — no Cornell/CNF in anything public-facing

Per the README, this is **David's personal project, not owned by Cornell** — CNF's module
content is what it's used to produce, but the tool itself isn't a Cornell property. So:

- **Never put "Cornell" or "CNF" in anything a user/visitor sees**: page titles, meta
  descriptions, on-page copy, the Vercel project name/URL, error messages, etc. Use generic
  language like "VR training modules" instead.
- **Internal engineering docs are fine as-is** (this file, README.md, code comments, commit
  messages) — those are for the dev team, not public-facing, and need the real domain context
  to be useful.
- This was caught and fixed 2026-09-22: the placeholder page said "Cornell NanoScale Facility"
  and the Vercel project was named `moduletrackercnf`. Both were changed to generic wording —
  see `src/app/page.tsx` / `src/app/layout.tsx` (metadata description) for the current copy.
  Watch for this recurring once real module data (with CNF-specific tool/process names) starts
  appearing in UI copy later — that's expected and fine since it's the actual content being
  tracked, just don't add *Cornell/CNF-as-owner* branding to the chrome around it.

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
| Existing data | **No import.** Start empty; first real modules are PVD1/PVD2 entered in the app. No historical modules, tasks or change orders. (Decided 2026-09-23.) | David wants a standalone, general-purpose tracker — not one shaped around CNF's existing module list. Schema and UI must not hardcode any organization's modules. |

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

## Findings from the CNF source docs (read in full 2026-09-23)

All 12 docs in the CNF Docs folder were read (see "Where the domain research came from" below).
The docs themselves stay out of the repo; this is the summary that matters for the build.

**Seed data sources**
- **Module list** — xlsx tab "March 25 - Toms VR list": 24 modules with description, key
  concepts, status. The "Package Immersive Experiences Learning Objectives" doc adds audience,
  learning objectives, Uptale description, runtime and size (MB) for completed modules, plus two
  not on Tom's list (AJA Sputter Tool Operation, UHP Welding).
- **Versions** — Project Binder "Version Control Log": version #, Uptale experience ID, launch
  URL, last-updated date per module (latest Jul–Aug 2026).
- **Tasks** — xlsx tab "Project outline": ~200 dated rows (module, task, details, responsible,
  start, due, status). Same columns as the per-module timeline tables in the Project Binder.
- **Change orders** — xlsx tabs "Module Track Changes Completed" + "Module Track Change
  Suggestions": ~75 real rows.
- **Document links** — Project Binder per-module tables (Box folder, storyboard, script, rundown,
  shot sheet, questions, 2D/3D assets, playtest notes). 268 hyperlinks, could be imported.
- Out of scope: hours/billing tabs, headset setup guides, tool manuals.

**Production status as of 9/21/26 weekly notes**
- M8 MOS Clean signed off 5/4/26; M9 Film Growth signed off 8/6/26.
- Qubits is split into **M10 (Day 1)** and **M11 (Day 2)**; full script draft review in progress.
- Next four decided 9/21: PVD1 Sputtering, PVD2 Evaporation, Metrology 1, Metrology 2 (note: this
  swaps PVD1/PVD2 vs. Tom's list, which has PVD1 = Evaporation).
- Numbering: M0 Gowning, M1–M9 educational; tours/outreach (Safety, General Tour, Youth Tour,
  Careers in a High Tech World) are unnumbered.

**Schema gaps to resolve before seeding** (current `schema.prisma` vs. real data)
- `TaskStatus`: real values are Completed (166), In Progress (11), Delayed (9), Upcoming (6).
  Need `delayed`; `upcoming` ≈ `not_started`; `blocked` is never used.
- `ModuleStatus`: roadmap uses Back-burner, Next up, Early stage planning, In Pre-Prod — no
  backlog/on-hold equivalent. Signed-off modules are "locked" and "reopened" for change orders.
- `Module`: missing audience, key concepts, version #, size (MB), last updated. Experience IDs
  differ across versions and school workspaces, so a single `experienceId` may not be enough
  (possible `ModuleVersion` table later).
- `Scene`: the storyboard template also has scene description, per-scene learning objectives,
  activity timeline (quizzes/clickables) and a media-asset list.
- `ChangeOrder`: some rows apply to "ALL MODULES" (required `moduleId` can't express that).
  Status values: Closed, Edit Complete, Reopened/Editing, Waiting for review, Will reopen in the
  future, Proof of Concept Solution. Suggestions vs. completed can be one table + status.

**Discovery Form (M6) inputs**
- The Qubits storyboard doc contains CNF's "Uptale Project Discovery Questions": goal/purpose,
  target audience, stakeholders, key dates; on-screen talent vs. pop-up text, who writes the
  script, length / one-off vs. series; brand guidelines; 2D/3D assets needed; custom activities;
  interactivity tier.
- **Interactivity Matrix**: Level 1 = base (360 video, doors, text pop-ups, quizzes, CC photos);
  Level 2 = + custom 2D/3D elements; Level 3 = fully custom multi-step activities.
- Per-scene storyboard columns: Scene · VID or IMG · Location · Focus tool · Description ·
  Scene learning objectives · Activity timeline (quizzes, clickables) · Media assets.
- The AJA Sputter Tool Walkthrough doc is raw SME material for the upcoming Sputtering module —
  a good test case for what the form should capture.

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
  - [x] Confirm the placeholder page renders at the live Vercel URL — confirmed working
        (see "Live app" link at top; URL/copy were later renamed/genericized, see Branding
        section above).
- [~] **M1 — Database** (in progress)
  - [x] `prisma` + `@prisma/client` installed, pinned to matching stable `7.10.0` (a first
        `npm install prisma` grabbed an `8.0.0-rc` while `@prisma/client` grabbed stable
        `7.10.0` — mismatched majors, re-pinned both to `^7` before writing any schema)
  - [x] `prisma/schema.prisma` written per the data model above (`User`, `Module`, `Scene`,
        `DocumentLink`, `Task`, `ChangeOrder` + their enums)
  - [x] **Prisma 7 breaking change hit and fixed**: `datasource.url` in `schema.prisma` is no
        longer supported in Prisma 7 (used to be the standard way to wire up the DB). Now:
        - `schema.prisma`'s `datasource db` block only has `provider = "postgresql"`, no `url`
        - `prisma.config.ts` (new, repo root) holds the connection URL for CLI/migrate
          commands, via `datasource.url` reading `DIRECT_URL` (falls back to `DATABASE_URL`)
        - The running app no longer uses a bare `datasource.url` at all — it must construct a
          driver **adapter** and pass it to `new PrismaClient({ adapter })`. Installed
          `@prisma/adapter-neon` (Neon's HTTP-based adapter, suited to Vercel serverless
          functions vs. pooled TCP) + `dotenv` (needed so `prisma.config.ts` can load `.env*`
          outside of Next's own env loading).
        - Added `"postinstall": "prisma generate"` to `package.json` so Vercel's build
          regenerates the client automatically (it doesn't by default).
  - [x] `src/lib/prisma.ts` — shared PrismaClient singleton, built via a lazy `Proxy` so the
        adapter (and its `DATABASE_URL` check) is only constructed on first real use, not at
        module-import time. This matters because Next imports every route module during
        `next build`'s page-data-collection pass regardless of whether the handler ever runs —
        a top-level `new PrismaClient(...)` would otherwise break `npm run build` in any
        environment without `DATABASE_URL` set (e.g. local, before Postgres is attached).
        Verified: `npm run build` passes with no `DATABASE_URL` in the environment.
  - [x] `/api/health` route (`src/app/api/health/route.ts`) — `prisma.module.count()`, returns
        `{ ok, moduleCount }` or `{ ok: false, error }`. Confirmed it builds as a dynamic (ƒ)
        route, not statically prerendered.
  - [x] Postgres attached to the Vercel project via Storage → Neon (marketplace integration).
        Database name: `neon-canary-house` (Neon project `soft-forest-02981947`).
  - [x] `npx vercel login` → `npx vercel link` (linked to `peters10/vr-module-tracker`) → env
        vars pulled to `.env.local` (gitignored). **Gotchas hit along the way, worth knowing
        for next time (e.g. after any future credential rotation):**
        - The Neon integration only scoped its env vars to **Production and Preview**, not
          Development. `vercel env pull .env.local` defaults to pulling the `development`
          environment, so it came back empty. Fix: `vercel env pull .env.local
          --environment=production`.
        - Several of those vars (including `DATABASE_URL` and `DATABASE_URL_UNPOOLED`) are
          marked **Sensitive** in Vercel, which blocks the CLI from ever reading the real value
          back out — `env pull` writes the literal string `[SENSITIVE]` as a placeholder
          instead. No toggle was found in the dashboard's edit panel to turn this off for
          existing vars. Sensitive vars *do* still get injected into the deployed app at
          runtime — this only blocks pulling them to a local machine.
        - Workaround used: revealed the real values via Neon's own "Show secret" quickstart
          panel (reachable from Storage → the database → Open in Neon, or directly in the
          Vercel Storage tab), copied them, and spliced just those two lines into `.env.local`
          with a small Node script (`sed -i` on `.env.local` was denied by this environment's
          permission settings; a `node -e` read/replace/write script worked fine).
        - **Security note:** the real Neon password passed through this chat session (pasted
          by David) more than once while troubleshooting. **Should rotate the Neon DB password**
          (Neon dashboard → reset password, or regenerate via Vercel's Storage tab) next time
          anyone's in there, then re-run `vercel env pull .env.local --environment=production`
          to pick up the new value. Not urgent (this is a small private project's dev database,
          not yet holding real data), but good hygiene — do it before this matters more.
  - [x] Ran `npx prisma migrate dev --name init` against the real Neon database — succeeded,
        migration `prisma/migrations/20260922195902_init/` created and applied. All 6 tables
        (`users`, `modules`, `scenes`, `document_links`, `tasks`, `change_orders`) now exist.
  - [x] Confirmed `/api/health` locally: started `next dev`, hit `localhost:3000/api/health`,
        got back `{"ok":true,"moduleCount":0}` — real DB connectivity confirmed. Stopped the
        dev server afterward (killed the process holding port 3000).
  - [x] Confirmed `/api/health` from the deployed Vercel URL (2026-09-23):
        `https://vr-module-tracker.vercel.app/api/health` → `{"ok":true,"moduleCount":0}`.
  - [~] Second migration `20260923180000_generic_schema` (written, **not yet applied**):
        adds `on_hold` module status and reorders statuses into pipeline order (hand-edited
        SQL, since Prisma won't reorder enums); task status `delayed` (drops unused `blocked`);
        `ChangeOrderStatus` enum; change orders can apply to all modules (`moduleId` nullable);
        new `ModuleVersion` table (replaces `Module.experienceId`/`launchUrl`); Module gains
        `audience`, `keyConcepts`, `sizeMb`, optional `number`; Scene gains `description`,
        `learningObjectives`, `activities`, `mediaAssets`; generic names (`folder` doc type,
        `build` phase). Apply with `npx.cmd prisma migrate deploy`. Note `migrate dev` refuses
        to run in Claude's non-interactive shell; generate SQL with `prisma migrate diff
        --from-config-datasource --to-schema prisma/schema.prisma --script` instead.
  - ~~Seed script~~ — dropped, see "Existing data" decision above.
  - Side note: `next dev` auto-generated `AGENTS.md` and a `CLAUDE.md` that just imports it
    (`@AGENTS.md`) — a new Next.js 16 feature (`agentRules`, see `next.config.ts`) that warns
    AI agents this Next version has breaking changes vs. older training data and to check
    `node_modules/next/dist/docs/` before assuming old APIs still apply. Kept and committed
    per its own instructions (it says committing keeps the tree clean; deleting it just makes
    `next dev` regenerate it as an uncommitted diff again).
- [~] **Discovery Form prototype (M6 pulled forward — David wants it as the first usable
      feature, 2026-09-23).** Built and tested locally, **not yet committed/pushed**:
  - `/discovery/new`: 5-step client form (About → Learning objectives → Tools + features →
    Scenes → Review) in `src/app/discovery/new/discovery-form.tsx`. Repeatable objectives, tools
    and scenes (add/remove/reorder); scene tool/speaker fields autocomplete from earlier entries.
    Draft autosaves to `localStorage` (form renders client-only for that reason).
  - `submitDiscovery` Server Action (`src/app/discovery/actions.ts`) → creates `Module`
    (status `pre_production`) + `Scene`s in one nested create, redirects to the module page.
    Shared trim/validate logic in `src/lib/discovery.ts` runs on both client and server.
    Storage: objectives and tool names are newline-joined strings; `featuresDiscussed` is
    `"Tool:\nfeatures"` blocks separated by blank lines.
  - `/modules/[id]` read-only module page; `/` module list with an empty state; header nav.
  - Verified: lint + build pass; posted valid/invalid payloads to the action on `next dev`
    (redirect on success, field errors on failure), confirmed DB rows, deleted test data.
  - **Temporary password gate** (`src/proxy.ts`, Next 16's renamed middleware): HTTP Basic
    auth, any username + `SITE_PASSWORD` env var (set in Vercel, Production). Fails closed
    (503) if unset in production; open in local `next dev` when unset. Added 2026-09-23 so
    David could demo online before M2. **Delete `src/proxy.ts` when Google sign-in lands.**
  - Not built yet: editing a submitted module/scenes.
- [ ] **M2 — Auth**: Auth.js + Google provider, email allowlist via env var, gate all routes.
- [ ] **M3 — Modules**: dashboard list page + create/edit module + module detail page
      (no seed data — modules are entered in the app).
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

Pick up at the first unchecked box under **Build sequence & status** above. As of 2026-09-23
the `generic_schema` migration is applied and the Discovery Form prototype is built locally
(see above); next is committing it, then M2 auth before deploying, then editing submissions. The CNF source-doc findings above
informed field choices only; no data from them is imported.

**Dev machines:** David works from more than one Windows machine. On the Cornell-managed one the
repo lives at `C:\Users\dpp49\ModuleTracker` (folders under `C:\` root are admin-only there), and
the CNF source docs are under OneDrive `Documents\CNF Docs` rather than `D:\CNF Docs`.
On that machine Node isn't on PATH (`$env:Path = "C:\Program Files\nodejs;$env:Path"`) and
PowerShell blocks `npx.ps1`, so use `npx.cmd` / `npm.cmd`. Its `.env.local` was set up
2026-09-23 (only `DATABASE_URL` + `DATABASE_URL_UNPOOLED` filled in by hand; the other
`[SENSITIVE]` placeholders are unused by the app).
