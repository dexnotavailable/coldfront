# Progress log

**Current milestone:** 1 · The World
**Current phase:** 1.1 · Foundations (not started)
**Preview link:** `https://<branch-alias>.coldfront.pages.dev`, once Cloudflare Pages is connected (README Part C)
**Agent guide:** `AGENTS.md` (Codex and Claude Code both follow it). **Interface:** only what `docs/11-interface-catalogue.md` lists.

## Status board

| Phase | Status | Notes |
|---|---|---|
| 1.1 Foundations | ☐ not started | begins with the interface foundation: tokens, string table, `ui:lint` (roadmap 1.1, step 2) |
| 1.2 World plan | ☐ | |
| 1.3 Terrain toolkit + Ibara | ☐ | |
| 1.4 Far terrain | ☐ | |
| 1.5 Kurogane + Selva | ☐ | |
| 1.6 Fantasy regions | ☐ | |
| 1.7 Rest of the surface | ☐ | |
| 1.8 Caves + Layer 1 | ☐ | |
| 1.9 The deep | ☐ | |
| 1.10 Polish + performance | ☐ | |

## Current session
*(The agent writes its plan here at the start of each session.)*

## Rubric scores (latest; score of record = min(self, blind))
| Postcard | Seed | Self | Blind | Record | Critique |
|---|---|---|---|---|---|

## Bench (latest)
| Metric | Median | p95 | Budget |
|---|---|---|---|

## Known issues
- (none yet)

## Try this (latest build)
1. (the agent fills this in)

## Session log (newest first)
*(Date, phase, summary, PR link.)*

- **2026-10-08 · docs only · PR #1 (third part).** The owner's rules for the camera and for sight: bird's-eye only (the over-the-shoulder camera is gone), a human field of view for every unit and NPC, and you see only what your units see. Added `docs/16-sight.md`: view cones, range by light and height, what the player sees (unseen land a fifth darker; underground drawn only where your people have seen it, total darkness elsewhere; ore inside rock never shown), hiding, people on watch and watchtowers, and the AI's awareness, hearing and memory. Removed the Shoulder camera and pointer lock from doc 13 and the catalogue (seven rows out, seven sight rows in: still 1,140 rows), moved the cut that follows the avatar into phase 1.1, and brought the other docs in line. Decisions 35–49 and question 17 in `docs/09-open-questions.md`.
- **2026-10-08 · docs only · PR #1 (second part).** The owner's new rules for people: no first-person view (units were then played from above or over the shoulder; the third part dropped the shoulder camera), skills for every unit, classes with roles and ranks, and a power ladder up to the Calamity. Added `docs/13-units-classes-power.md` (the rulebook), `docs/14-class-library.md` (65 classes, 28 advanced classes, 342 skills including the office skills and Cataclysms, 21 Trials) and `docs/15-item-library.md` (840 items, 377 of them generated from metal tiers), with `docs/tools/content-check.mjs` to check them and recompute the benchmark ladder. Brought the catalogue (1,140 rows), docs 01, 02, 05–10, `AGENTS.md`, the README and the prompts in line.
- **2026-10-08 · docs only · PR #1.** Added the interface catalogue (`docs/11-interface-catalogue.md`: rules for every screen, input, cameras, 1,002 listed controls, texts and keys, and its checker `docs/tools/ui-catalogue.mjs`), the sessions doc (`docs/12-sessions.md`) and `AGENTS.md` so Codex can build from the same guide. Brought docs 01, 03–09, the README and the prompts in line. No game code yet: phase 1.1 is still the next step.
