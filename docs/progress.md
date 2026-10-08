# Progress log

**Current milestone:** 1 · The World
**Current phase:** 1.1 · Foundations (in progress)
**Preview link:** pending the first verified playable build at `https://dex.place/coldfront/`. The documented `coldfront.pages.dev` address belongs to an unrelated site and must not be used as this game's preview.
**Agent guide:** `AGENTS.md` (Codex and Claude Code both follow it). **Interface:** only what `docs/11-interface-catalogue.md` lists.

## Status board

| Phase | Status | Notes |
|---|---|---|
| 1.1 Foundations | In progress | Step 1 accepted: 82 tests, check and shared build pass; UI primitive gate 9/9; engine integration underway |
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
**8 October 2026 · Codex · `codex/phase-1-1-foundations`**

1. Prove headless Chromium, WebGL2, cross-origin isolation and image capture; open the result before game code.
2. Build roadmap 1.1 in order. Preserve pointwise generation, tested deterministic maths, analytic noise derivatives, measured quantiles, and the enforced Math allowlist.
3. Establish catalogue strings, tokens, lint, gallery and screenshots before the first screen. GPT-6 Astra owns visual, spatial, camera, motion and interface work through dexflow's design route.
4. Publish the first verified playable step-3 build, open a draft PR, then publish verified increments promptly. The owner explicitly authorised merges and live publication on 8 October, superseding the older rule reserving merges to the owner. Do not alter the owner's CI or tool configuration.
5. Finish with tests, check, build, a clean checkout build, inspected terrain and interface images, measured benches and a current report. Later milestones stay subject to their explicit design acceptance gates; technical choices are ours.

Source is `D:\Dex\Projects\coldfront`, cloned from `dexnotavailable/coldfront` at `eced20f`. The existing dex.place checkout contains unrelated edits; hosting integration must use an isolated checkout. A banked usage reset is authorised once the remaining main allowance reaches 1–2%; the initial live reading was 83% remaining with one reset available.

**Screenshot prerequisite passed:** three 0.186.0, Playwright 1.63.0, Chromium 153.0.8010.12 (revision 1243), `--enable-unsafe-swiftshader`. A local HTTP scene with COOP/COEP rendered exactly twice and captured via in-page `toBlob`. WebGL2 and cross-origin isolation were true, context loss false, GL error zero. Both the Astra helper and main agent opened the PNG: a cyan cube with differently lit faces, cast shadow and slate floor. This proves the rendering/capture route only, not terrain or gameplay. Local evidence: `D:\Dex\Temp\coldfront-proof\output\receipt.json` and `three-webgl2-proof.png`.

**Hosting integration:** [dex.place PR #2](https://github.com/dexnotavailable/dex.place/pull/2) merged and deployed as `453aa632a58a9d21490710a7dfcd4aa6687822f3`. Its isolated `/coldfront/` mount passed all 50 origin/deployer tests, 127 site tests, TypeScript checks and the site production build. Public readback confirmed that SHA, a query-preserving 308 redirect, both isolation headers, and healthy site status. It serves only a separately published game distribution; the game is not playable yet and `/coldfront/` correctly returns 404 until one is published. Existing site and SP13 routes keep their headers. The normal site puller owns deployment; no extra server, tunnel or scheduled task was created.

**Implementation lanes:** Astra is implementing the deterministic shared foundation, the catalogue pipeline/screens, and the engine/game in three isolated copies. They share explicit typed contracts and disjoint file ownership. Integration accepts the shared foundation before the UI/engine. The UI tooling must pass on primitives before screens are authored. The phase-1.1 catalogue inventory is 91 rows: 41 controls, 28 texts, 22 bindings.

**Step 1 accepted after recovery:** the canonical checkout passes all 82 tests (including nine distributions sampled at one million points each), TypeScript/Biome checks and the shared build. An independent Astra review found a destructuring escape in the determinism guard; seven failing regression cases proved it, the guard was corrected, and the reviewer closed the finding. The guard also rejects reflection descriptors and reserves forbidden API keys in object literals. The exact pinned fast OpenSimplex2 3D export retains its documented upstream tie-plane limitation; the production 3D/warp path uses the separately tested continuous OpenSimplex2S kernel. Pointwise test terrain, reusable Float64 halos, pond and tree seam checks are in place. This checkpoint still has no client build or gameplay acceptance.

**Math method:** tested range-reduced degree-16/19 series replace the spec's unverified minimax assumption, preserving the error requirement. Measured maximum power relative error is about 4.09e-14 on Node 22 against the 1e-7 bar. Exact domains, API layouts, sampling provenance and held-out coverage are recorded in `packages/shared/README.md`; terrain §3 now names the implemented method.

**UI prerequisite:** all nine corrected primitive captures passed and were opened by Astra, after preserving three earlier tooltip-wrap failures. Decision 100 resolves the conflicting fixed-width/one-line tooltip rules without changing any row wording or token. Game screens are now being built; their acceptance is still pending.

## Rubric scores (latest; score of record = min(self, blind))
| Postcard | Seed | Self | Blind | Record | Critique |
|---|---|---|---|---|---|

## Bench (latest)
| Metric | Median | p95 | Budget |
|---|---|---|---|

## Known issues
- No playable game build yet. The first public game release remains the roadmap's step-3 checkpoint.
- The documented `coldfront.pages.dev` name belongs to another website. Live releases use `dex.place/coldfront/`; a separate Pages project would need a verified owned address.

## Try this (latest build)
1. (the agent fills this in)

## Session log (newest first)
*(Date, phase, summary, PR link.)*

- **2026-10-08 · docs only · PR #1 (fourth part).** The owner's rules for Calamities, presence, the first days and testing alone. Calamities are now forces a kingdom tries to hold: five natures (Sellsword, Idol, Wildfire, Bastion, Oathsworn), a Hold that falls unless the Calamity is fed what it wants, rogues that roam when it breaks, the Bastion that keeps a kingdom standing, and at most nine in the world, about five on a full server (`docs/13-units-classes-power.md` §15). Great powers have presence (`docs/16-sight.md` §11). The world does the early killing: the Steward's peace, the empty throne, omens (`docs/05-systems.md` §2, §16). New `docs/17-simulation-and-bots.md`: the tally (the simulation of unwatched people, renamed from "the ledger" and moved to Milestone 3), catching up, world speed and skip ahead, the owner's cheats, whole-season runs and bot kings. 57 new catalogue rows (1,198 in all), two new Cataclysms (20 in all), the agent's calls 57–74 in `docs/09-open-questions.md` §2, and question 4 answered. Then, at the owner's request, `docs/18-look-and-feel.md`: one set of motion curves for the interface, cameras and world; what the picture never does (no shake, blur or flashes); night, clouds and their shadows, one wind, weather and each region's air; movement drawn between physics steps; the avatar's and the world's animation; effects (whose first, then which element), danger zones and conditions on the body; the interface's motion, listed in catalogue A4; motion strips for checking. Two more catalogue rows (`mark.ping`, `mark.telegraph`; 1,200 in all), weather in `docs/05-systems.md` §16, and the agent's calls 75–94.
- **2026-10-08 · docs only · PR #1 (third part).** The owner's rules for the camera and for sight: bird's-eye only (the over-the-shoulder camera is gone), a human field of view for every unit and NPC, and you see only what your units see. Added `docs/16-sight.md`: view cones, range by light and height, what the player sees (unseen land a fifth darker; underground drawn only where your people have seen it, total darkness elsewhere; ore inside rock never shown), hiding, people on watch and watchtowers, and the AI's awareness, hearing and memory. Removed the Shoulder camera and pointer lock from doc 13 and the catalogue (seven rows out, eight in: 1,141 rows), moved the cut that follows the avatar into phase 1.1, and brought the other docs in line. A fresh reviewer's 40 findings were applied (the cut's cover rule, the silhouette, looking ahead, who counts as a foe, the dark, and the engineering plan). Decisions 35–56 and questions 17–18 in `docs/09-open-questions.md`.
- **2026-10-08 · docs only · PR #1 (second part).** The owner's new rules for people: no first-person view (units were then played from above or over the shoulder; the third part dropped the shoulder camera), skills for every unit, classes with roles and ranks, and a power ladder up to the Calamity. Added `docs/13-units-classes-power.md` (the rulebook), `docs/14-class-library.md` (65 classes, 28 advanced classes, 342 skills including the office skills and Cataclysms, 21 Trials) and `docs/15-item-library.md` (840 items, 377 of them generated from metal tiers), with `docs/tools/content-check.mjs` to check them and recompute the benchmark ladder. Brought the catalogue (1,140 rows), docs 01, 02, 05–10, `AGENTS.md`, the README and the prompts in line.
- **2026-10-08 · docs only · PR #1.** Added the interface catalogue (`docs/11-interface-catalogue.md`: rules for every screen, input, cameras, 1,002 listed controls, texts and keys, and its checker `docs/tools/ui-catalogue.mjs`), the sessions doc (`docs/12-sessions.md`) and `AGENTS.md` so Codex can build from the same guide. Brought docs 01, 03–09, the README and the prompts in line. No game code yet: phase 1.1 is still the next step.
