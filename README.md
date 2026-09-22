# ModuleTracker

A tool to track and support the production of Cornell NanoScale Facility (CNF) VR training modules — built by David Peters (personal project, not owned by Cornell, even though the content it helps produce is used for Cornell/CNF work).

## Context: what CNF is building

CNF, in partnership with Cornell's CTI team, produces VR/360° immersive learning modules on the **Uptale** platform that teach semiconductor cleanroom fabrication (gowning, safety, photolithography, etching, hot processing/furnaces, and eventually PVD/CVD/metrology/qubits/etc.). There's a roadmap of ~24 modules; a dozen-plus are complete and licensed to partner schools (NORDTECH, Micron, community colleges, etc.) under Cornell's Uptale license.

Key people: **Tom Pennell** (CNF lead/SME — the domain expert on the tools and processes, and a production bottleneck since nearly everything routes through him), **Jay Williamson** (production/Uptale development lead), **Ksenia** (instructional design), **Catherine** (production), plus various SMEs (Jeremy Clark for etching, Phil for safety/furnaces, etc.). David is involved in production/scheduling support (~10 hrs/week).

## The problem ModuleTracker solves

Right now, module production status is scattered across a pile of disconnected Google Docs/Sheets/Box folders:
- **Project Binder** & **Workflow Doc** — per-module tables (links to storyboard/script/shot-sheet/rundown + dated task timelines with owner & status)
- **Weekly Planning Notes** & "Squirrel Brain" — free-form dated meeting/daily-task logs
- **Working/Playtest Notes** — per-scene, per-tag QA checklists plus dated review feedback
- A spreadsheet with a formal **Change Order log** (edits to "locked" modules) and an **hours/billing log**

There's no single source of truth, and one of the source docs literally contains the note *"Jay: Module dashboard?"* — this project is that dashboard.

Full research notes on the CNF project were synthesized from a folder of source documents at `D:\CNF docs` (not part of this repo) — re-read those if you need to go deeper on domain context.

## What this app needs to do (two core functions)

1. **Full production tracker** — the module-creation pipeline tracker itself: modules move through pre-production → scripting → filming → post-production → Uptale build → playtesting → sign-off → deployment, each with owners, dates, status, and linked artifacts (storyboard, script, rundown, assets, playtest notes). This replaces the sprawl of Docs/Sheets described above.

2. **SME Discovery Form** — an advanced intake form that **Tom** fills out when kicking off a new module, since he's the domain expert and current bottleneck. It should ask, in order:
   - Top-level: what is this module about?
   - Learning objectives
   - What tools will be used
   - What features/aspects of each tool will be discussed
   - Then break the module down **scene by scene**, repeatable/add-another-scene flow, capturing per scene:
     - Who is speaking
     - Which tool is being discussed
     - What's being highlighted/clicked (the interaction)
     - (and whatever else emerges as we design it further)

   This maps closely to patterns already used informally in CNF's own docs (their "Storyboard Template" / "Notes & Categories" per-scene template, and "Uptale Project Discovery Questions"), but structured as a proper guided form instead of a blank Word doc.

## Current status

Engineering is underway. **See `PROGRESS.md` for full status, locked-in architecture
decisions, the data model, and the milestone checklist** — that file is the source of truth
for "where are we and what's next," kept up to date as work proceeds. This README stays
focused on product/domain context and generally won't need updates as often.

Repo remote → `https://github.com/dpeters1223-design/ModuleTracker.git`. Stack: Next.js on
Vercel, Postgres (Neon), Google sign-in, Prisma, Tailwind — rationale for each is in
`PROGRESS.md`.
