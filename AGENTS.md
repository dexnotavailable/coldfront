# COLDFRONT: guide for the coding agent

COLDFRONT is a seasonal, ~100-player voxel civilization builder for the browser. You rule a kingdom from a top-down command view and possess its people on the ground. You push supply lines down a funnel-shaped world of hostile regions to break the strongholds of 29 Wardens and, finally, the King Below. **Current focus: Milestone 1, the world (terrain generation at "Big Globe" quality).**

**The owner's technical TL;DR:** Minecraft, but it extends downwards, with Big Globe installed and a bird's-eye view. Every unit is a Minecraft-player equivalent (breaks blocks, has an inventory, HP and so on) controlled by the game's AI in an optimised way, and playing one moves exactly like a Minecraft player, seen from above (never in first person or over its shoulder). Every unit sees with a human field of view, and the player sees only what their units see (`docs/16-sight.md`). People have classes, levels and skills, up to the Calamity (`docs/13-units-classes-power.md`). Everything must stay light to simulate, on every front, and bot kings play like players (`docs/17-simulation-and-bots.md`).

Every coding agent works from this file: Codex reads it directly, and Claude Code reads it through `CLAUDE.md`. It stays short on purpose (Codex stops reading instructions past 32 KiB): put new detail in `docs/`, not here.

## The owner
- **Doesn't code.** Write every report in plain language, explain any unavoidable jargon in a few words, and give a playable link plus a short "try this" list whenever there is a build.
- **Owns design; you own engineering.** Make every technical decision yourself. If a *design* question isn't answered in `docs/`, pick the option that best fits the pillars in `docs/01-vision.md`, log it in `docs/09-open-questions.md` §2, and keep going. Don't stop work to wait for an answer.
- **Has been burned before.** One earlier attempt produced primitive terrain (the hellscape spikes were plain cones). Agent-built interfaces came padded with subtitles, helper lines and decoration nobody asked for. Quality is proven with screenshots you have opened, not claimed.

## Read first
1. `docs/12-sessions.md` §1, now: it tells you which branch to work on. Read the rest of it before your first render, push or report.
2. `docs/progress.md`: where we are, what's next, known issues.
3. `docs/08-roadmap.md`: the current phase's scope and "Done when".
4. Only the docs that phase needs. For terrain phases: `docs/04-terrain.md`, `docs/02-world.md`, `docs/07-architecture.md`. For anything on screen or under the player's hands: Part A of `docs/11-interface-catalogue.md` and the section for the thing you're building. For people, classes, skills, items or combat: `docs/13-units-classes-power.md` and the rows you need in 14 and 15. For what anyone can see, hiding, or how the AI notices things: `docs/16-sight.md`. For the simulation of unwatched people, bot kings or the owner's test tools: `docs/17-simulation-and-bots.md`. For anything that moves, glows or animates (the cameras' feel, rendering, weather, effects, animation, the interface's motion): `docs/18-look-and-feel.md`.

| Doc | Contents |
|---|---|
| `docs/01-vision.md` | core selling point, pillars, tone, **decision log** (settled; don't re-open), glossary |
| `docs/02-world.md` | Kaldmark's layout, regions, underground, descents, resources, the Wardens |
| `docs/03-lore.md` | story, the Stewards, naming rules, secrets |
| `docs/04-terrain.md` | the Milestone 1 spec: pipeline, region recipes, rendering, **postcards, rubric and review loop** |
| `docs/05-systems.md` | gameplay systems for later milestones |
| `docs/06-ui-art.md` | UI principles, design tokens, art direction, audio |
| `docs/07-architecture.md` | stack, repo layout, determinism, data model, server plan, testing |
| `docs/08-roadmap.md` | milestones and phases |
| `docs/09-open-questions.md` | open design questions; log your own design calls here |
| `docs/10-prior-art.md` | open-source code and techniques to reuse, **licence rules**, and sources that are off-limits |
| `docs/11-interface-catalogue.md` | **the interface bible:** rules for every screen, input, cameras, and every control, key and word on screen |
| `docs/12-sessions.md` | how a session runs: branches, browsers for screenshots, pushes, previews, CI, notes per tool |
| `docs/13-units-classes-power.md` | **people's rules:** playing a unit (from above only), the sheet, fighting, conditions, levels, proficiency, grades up to the Calamity, roles, ranks and offices |
| `docs/14-class-library.md` | every class and every skill, as data tables |
| `docs/15-item-library.md` | every item, as data tables, and the rules items follow |
| `docs/16-sight.md` | **sight:** view cones and ranges, what the player sees (unseen land, the underground under the cut), hiding, watchtowers, and how the AI notices, remembers and searches; **presence** (§11) |
| `docs/17-simulation-and-bots.md` | **the light simulation:** the tally (unwatched people as numbers), catching up, world speed and skip ahead, the owner's cheats, whole-season runs, bot kings |
| `docs/18-look-and-feel.md` | **the look and feel:** motion curves, the camera's feel, rendering and shaders, wind and weather, how movement is drawn, animation, effects, the interface's motion, motion strips |
| `docs/diagrams/*.svg` | world layout (top view), funnel (side view); regenerate with `python3 docs/diagrams/make_diagrams.py` after renames |

## Golden rules
1. **The docs are the source of truth.** If you find a doc is wrong or impossible, fix the doc in the same pull request and say why in the report.
2. **Shared code is pure and deterministic.** `packages/shared` has no DOM and no Node APIs. Deterministic code uses only the **allowlist** in `docs/04-terrain.md` §3; a test enforces it. Whenever generated output changes, regenerate the golden hashes (`npm run golden:update`) in the same commit, so every push is green, and bump `WORLDGEN_VERSION` at most once per pull request (§3, §14.7).
3. **Look at your work.** After any change to terrain, rendering or the interface, re-render the affected postcards or screens and **open each image file with your image viewer** (Codex: `view_image`; Claude Code: Read) before you grade or describe it (`docs/04-terrain.md` §14.6; `docs/11-interface-catalogue.md` A7). Listing a file or reading its size is not opening it. Describe what the image shows, not what the code should do.
4. **A phase is done when it meets its "Done when"** in `docs/08-roadmap.md`. From phase 1.3 on, that includes the rubric bars in `docs/04-terrain.md` §14.4 and a blind review by a fresh helper agent. (If your tool has no helper agents, do that review yourself in a separate pass from the images alone, mark it "self only", and say so first in the report.) Don't loop forever on one shot: after 4 fix-and-re-render cycles without a +2 gain, the timebox rule applies (§14.6). A postcard within 2 points of its bar, with no 0 on R1–R4, then stops blocking, and the phase is "done with known issues", which phase 1.10 clears. **HELL-1 and HELL-2 must always pass.**
5. **Budgets are targets for phase 1.10** (`docs/04-terrain.md` §15). Measure them every session with `npm run bench:gen`, report the numbers and log misses under Known issues, but don't stall a phase to hit a number early.
6. **Everything is generated by code or comes from npm.** Textures and models are generated in code; fonts come from `@fontsource` packages. Nothing is downloaded from other websites, and nothing loads from a CDN at runtime.
7. **Small, working steps, pushed often.** Commit after each working step with a clear message and push after every commit, on your own branch. `main` must always build, and it is the owner's: NEVER commit to it, push it or merge into it. Never force-push or rewrite commits that are already pushed. Start the message of in-between commits with `[skip ci]` and leave it off the first playable push and the last push of a session (`docs/12-sessions.md` §4).
8. **Owner-facing tools ship in every build through Milestone 4:** F3, the Tools panel, fly, teleports, the time slider, view modes, postcard mode and the interface gallery. Only `lil-gui` hides behind `?dev`.
9. **The interface is built only from `docs/11-interface-catalogue.md`.** See "Interface work" below.
10. **Use the design's words in code:** Warden, Seat, Descent, Shelf, Coverage, Reeve, and so on. Regions and layers are referred to by their **stable IDs** (`hellscape`, `upper_deep`; `docs/02-world.md` §2), never by display names, which may change.
11. **Reuse before you reinvent, within the licence rules.** Check `docs/10-prior-art.md` before building a system. Copy or port only permissive code (MIT, BSD, ISC, Apache-2.0, Zlib, CC0, Unlicense), record it in `THIRD_PARTY_NOTICES.md`, and keep MPL files separate. Study, never copy, anything else.
12. **Hands off the owner's config.** NEVER edit `.claude/settings.json`, anything in `.github/workflows/`, or a `.codex/` folder. If one needs a change, write the proposed file to `docs/proposed/` and flag it in the report; the owner applies it.
13. **Blocked means blocked.** If the environment refuses an action (a denied command, a rejected push, a blocked download), don't try to get around it with a different command or tool. Two things are not "getting around": asking the owner through your tool's own approval prompt, once per action (a refusal is final for that action this session), and using a route that `docs/12-sessions.md` names. Otherwise carry on with what you can do, and say in the report what was blocked.
14. **Do the task and nothing else.** No refactors, renames, restyling, upgrades or extra features the task didn't ask for. If you see something worth doing, put it under "Known issues and next" in the report.

## Interface work
This covers every screen, panel, control, key binding, camera move and word the player sees.

- **Before you start,** read Part A of `docs/11-interface-catalogue.md` and the section for the thing you're building. Parts B–E are reference; don't read them end to end.
- **Build only what is listed,** and only rows marked with the current phase or an earlier one. If a task seems to need something else, reuse a listed row. If it can't work without an unlisted control or message, add one row to the catalogue's Part G as its A1 allows, build exactly that, and name it in the report. Never reword a listed row unless the owner asked: report the gap. A `--complete` failure caused only by a row you reported as impossible to build is a known issue, not a blocker.
- **Every word on screen is a catalogue row,** shown through the string table (`npm run ui:strings`), or game content (names, numbers, lore lines). NEVER add a subtitle, tagline, helper line, section note, caption, tip, stand-in text or "coming soon", whether typed into the interface code or brought in as content. If something needs explaining, the explanation is that row's tooltip.
- **Use only the components and tokens the catalogue names,** and nothing on its "Never" list (A3). No colour outside `tokens.css`, and no size that isn't a token or a dimension the catalogue gives. When in doubt, leave it out: an empty area is correct.
- **A screen is done when** `npm run ui:lint` and `npm run ui:shots` pass, you have opened the screenshots written for that screen, every line of the checklist in A7 holds in them, and the report gives, for that screen, the files you opened, the words you read in them, and pass or fail for each line. If you couldn't take or open the screenshots, the screen is not done: say so first.

## Commands (create them in phase 1.1; keep this list current)
| Command | Does |
|---|---|
| `npm install` / `npm ci` | install dependencies |
| `npm run dev` | local dev server (with COOP/COEP headers) |
| `npm test` | unit, golden-determinism and forbidden-token tests. **Node only:** it must not need a browser, because CI runs it on a plain runner |
| `npm run check` | TypeScript, Biome and `ui:lint`. Node only, like `npm test` |
| `npm run build` | production build into `packages/client/dist` (used by Cloudflare Pages) |
| `npm run build:site` | production build for the owner's `dex.place/coldfront/` mount |
| `npm run publish:site -- --dist packages/client/dist --expected-sha <sha>` | publish a verified site build, preserving release checksums and rollback receipts |
| `npm run atlas -- --seed 1 --layer surface --mode regions` | top-down map PNGs → `out/atlas/`. Phase 1.1 has no WorldPlan yet: run it on the test world in `height` mode |
| `npm run slice -- --seed 1 --from -15556,15556 --to 15556,-15556` | the SW→NE cross-section (overview + windows) → `out/slices/`. Phase 1.1: on the test world |
| `npm run postcards -- --seed 1 [--only ID,ID] [--phase 1.3] [--commit]` | headless screenshots → `out/postcards/`; `--commit` writes phase-end renders to `docs/postcards/m1/`. Slow: up to ~60 s a shot |
| `npm run terrain-report -- --seed 1 --region hellscape` | coverage, slopes, walkable share, crumbs, feature statistics |
| `npm run bench:gen` | generation, lighting and meshing timings. Run it on its own, never alongside renders |
| `npm run golden:update` | regenerate the golden hashes (whenever generated output changes) |
| `npm run test:golden:browsers` | the golden hashes computed inside Chromium, Firefox and WebKit. CI runs it; locally it uses whichever of those browsers are installed |
| `npm run ui:strings` | rebuild the interface's string table from the catalogue |
| `npm run ui:lint [-- --complete]` | check the catalogue, and fail on on-screen text, colours or controls that aren't in it. `--complete` also fails when a row of the current phase isn't built yet: run it at phase end |
| `npm run ui:shots [-- --sheet <screens>] [-- --strip <state>]` | screenshots of every interface state in the gallery → `out/ui/`, with checks on the real page (unlisted text, clipping, overlaps, Tab order). `--sheet` also writes a contact sheet of the named screens for the report; `--strip` a motion strip of one animation (`docs/18-look-and-feel.md` §12) |
| `npm run test:browser` | the tests that need a real browser: the smoke test, the camera drive, the keyboard walk. Not part of `npm test`, so run it yourself before you finish |
| `node docs/tools/ui-catalogue.mjs` | the catalogue check on its own. Works before any game code exists |
| `node docs/tools/content-check.mjs [--ladder]` | checks the content tables of docs 13–15 and recomputes the benchmark ladder. Works before any game code exists |
| `npm run content:build` | (from Milestone 2) writes the game's content data from docs 13–15 |
| `npm run bench:sim` | (from Milestone 3) tally events a second, catch-up and look-ahead timings (`docs/17-simulation-and-bots.md` §2.4). On its own, like `bench:gen` |
| `npm run season -- --seed 1 --kings 100` | (from Milestone 5) a whole season with bot kings and no screen; report → `out/season/` |

Run postcards, `ui:shots`, `bench:gen`, `bench:sim`, `season` and the browser golden test in the background with a log in `out/` (`docs/12-sessions.md` §7).

## Session workflow
1. **Start.** Settle your branch (`docs/12-sessions.md` §1). Read `progress.md` and the roadmap. Write a short plan for this session under "Current session" in `progress.md`.
2. **Work.** Build in small verified steps. Run tests often. For anything visual, render and look. Open a draft pull request after the first playable push, and keep its description current.
3. **Protect your context.** Grade from contact sheets. Give seed-2/3 grading and blind reviews to fresh helper agents that return text. Keep iteration renders in `out/`.
4. **Before finishing** (always, even if the phase isn't complete):
   - `npm test`, `npm run check` and `npm run build` all pass, and so does the clean-checkout build (`docs/12-sessions.md` §5).
   - Postcards for touched regions are re-rendered, reviewed and scored. Screenshots for touched screens are re-taken, opened and checked against A7. At phase end, run `postcards --commit` and `ui:lint -- --complete`.
   - `progress.md` is updated: status board, what was done, scores, bench numbers, known issues, exact next steps, and the **"Try this"** list.
   - Commit and push **without** `[skip ci]`. Put the **report** below into the pull request's description, and mark it ready when the phase is done. Check CI once it has run, and put the preview link in the report.
   - End the session with a final message that repeats the report, or a short summary with the pull-request and preview links.
5. **A phase done with room to spare:** write that phase's report into the pull request first. Only then start the next phase, on the same branch, and extend the report to cover both at the end.
6. **Running low on context mid-phase:** stop at a clean, working point, update `progress.md` with exact next steps, and push. The next session continues from there.
7. **Resuming after an interruption, or after your context was compacted:** run `git log --oneline -15` and `git status`, re-read `progress.md`, this file's Golden rules, Interface work and Never, and `docs/12-sessions.md`, and continue from the last pushed step. Don't redo work that is already committed.

## Helper agents
If your tool can start helper agents (subagents), use them where independent eyes help:
- **Reviews:** blind reviews and seed-2/3 grading, one agent per region's contact sheet; a fresh agent that checks interface screenshots against the catalogue's A7 checklist; adversarial pairs for scores near a pass bar.
- **Audits:** determinism scans, licence checks, doc-versus-code consistency, "done when" checks.
- **Independent features in disjoint files:** at most 3 implementers at once, each in its own isolated copy of the repo. Only the main session merges, runs the tests, commits and pushes.

Don't parallelise rendering, benchmarks or other CPU-heavy work: render once, in one process, then fan reviewers out over the images. Give each helper only the doc sections, rubric and files it needs. Helpers spend the owner's usage limit; mention unusually large runs in the report.

## Report template (the pull request's description)
```
## What you can try
<preview link>
1. <try-this step>
2. ...

## What changed
<3–6 plain-language bullets>

## How it looks
<contact sheets + 4–6 best postcards, as absolute GitHub image URLs>
<interface work: the gallery link; per screen, the screenshot files opened, the words read in them, pass or fail per A7 line; the contact sheet>
Rubric (score of record): <postcard: score/20, ...> · Blind review: <summary>

## Numbers
Generation median/p95 · lighting · meshing · postcard s/shot · FPS note if known

## Known issues and next
<bullets>

## Decisions you may want to check
<links to docs/09-open-questions.md §2 entries, and any rows added to Part G of the interface catalogue>
```

## Never
- Never claim a visual result you haven't seen in a rendered image.
- Never put text or a control on screen that isn't in `docs/11-interface-catalogue.md`.
- Never weaken a test, a lint or the golden file to make it pass without saying so in the report.
- Never add runtime network dependencies (CDNs, remote assets, analytics).
- Never re-open a decision from `docs/01-vision.md` §6 on your own. Log a question instead.
- Never commit to, push or merge into `main`; never edit the owner's config (golden rule 12); never work around a blocked action (golden rule 13).
- Never open, clone or read the source of the off-limits projects in `docs/10-prior-art.md` §1 (Big Globe, Voxy, Sodium, Distant Horizons, Veloren, Baritone, Mindustry, Luanti), and never paste GPL, LGPL, non-commercial or "all rights reserved" code into your context.
- Never commit `out/`, secrets or large binary files. Committed images are 1280 × 720 JPEGs, and the work-in-progress sheets stay under 1 MB in total (`docs/12-sessions.md` §6).
