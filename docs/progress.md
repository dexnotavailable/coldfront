# Progress log

**Current milestone:** 1 · The World
**Current phase:** 1.1 · Foundations complete; 1.2 · World plan next
**Playable link:** [dex.place/coldfront](https://dex.place/coldfront/) · [Interface gallery](https://dex.place/coldfront/?gallery) · [Foundation completion PR #3](https://github.com/dexnotavailable/coldfront/pull/3). Live game commit: `d4c4c49`. The unrelated `coldfront.pages.dev` site is not this game's preview.
**Agent guide:** `AGENTS.md` (Codex and Claude Code both follow it). **Interface:** only what `docs/11-interface-catalogue.md` lists.

## Status board

| Phase | Status | Notes |
|---|---|---|
| 1.1 Foundations | ✓ Complete, with recorded limits | 190 tests, check/build, clean Node22 build, complete UI lint and all-three-browser CI pass; accepted images/tools/save fixes published as d4c4c49. Public-site browser launch remains unavailable. |
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
**8–9 October 2026 · Codex · `codex/phase-1-1-review-tools`**

1. Prove headless Chromium, WebGL2, cross-origin isolation and image capture; open the result before game code.
2. Build roadmap 1.1 in order. Preserve pointwise generation, tested deterministic maths, analytic noise derivatives, measured quantiles, and the enforced Math allowlist.
3. Establish catalogue strings, tokens, lint, gallery and screenshots before the first screen. GPT-6 Astra owns visual, spatial, camera, motion and interface work through dexflow's design route.
4. Publish the first verified playable step-3 build, open a draft PR, then publish verified increments promptly. The owner explicitly authorised merges and live publication on 8 October, superseding the older rule reserving merges to the owner. Do not alter the owner's CI or tool configuration.
5. Finish with tests, check, build, a clean checkout build, inspected terrain and interface images, measured benches and a current report. Later milestones stay subject to their explicit design acceptance gates; technical choices are ours.

Source is `D:\Dex\Projects\coldfront`, cloned from `dexnotavailable/coldfront` at `eced20f`. The existing dex.place checkout contains unrelated edits; hosting integration must use an isolated checkout.

**Screenshot prerequisite passed:** three 0.186.0, Playwright 1.63.0, Chromium 153.0.8010.12 (revision 1243), `--enable-unsafe-swiftshader`. A local HTTP scene with COOP/COEP rendered exactly twice and captured via in-page `toBlob`. WebGL2 and cross-origin isolation were true, context loss false, GL error zero. Both the Astra helper and main agent opened the PNG: a cyan cube with differently lit faces, cast shadow and slate floor. This proves the rendering/capture route only, not terrain or gameplay. Local evidence: `D:\Dex\Temp\coldfront-proof\output\receipt.json` and `three-webgl2-proof.png`.

**Hosting integration:** [dex.place PR #2](https://github.com/dexnotavailable/dex.place/pull/2) merged and deployed as `453aa632a58a9d21490710a7dfcd4aa6687822f3`. Its isolated `/coldfront/` mount passed all 50 origin/deployer tests, 127 site tests, TypeScript checks and the site production build. Public readback confirmed that SHA, a query-preserving 308 redirect, both isolation headers, and healthy site status. It serves only a separately published game distribution; the first game distribution is now published at `/coldfront/` with matching release metadata and isolation headers. Existing site and SP13 routes keep their headers. The normal site puller owns deployment; no extra server, tunnel or scheduled task was created.

**Implementation lanes:** Astra implemented the shared foundation, catalogue pipeline/screens and engine in isolated worktrees. The coordinator integrated exact owned file manifests and source-bound screenshot evidence. A separate Astra reviewer inspected the UI screenshots without reading the implementation, and all reported defects were repaired and rechecked. The catalogue inventory is 91 current rows: 41 controls, 28 texts and 22 bindings.

**Step 1 accepted after recovery:** the canonical checkout passes all 82 tests (including nine distributions sampled at one million points each), TypeScript/Biome checks and the shared build. An independent Astra review found a destructuring escape in the determinism guard; seven failing regression cases proved it, the guard was corrected, and the reviewer closed the finding. The guard also rejects reflection descriptors and reserves forbidden API keys in object literals. The exact pinned fast OpenSimplex2 3D export retains its documented upstream tie-plane limitation; the production 3D/warp path uses the separately tested continuous OpenSimplex2S kernel. Pointwise test terrain, reusable Float64 halos, pond and tree seam checks are in place. That step-1 checkpoint contained no client build; the playable acceptance below covers the subsequent engine and interface.

**Math method:** tested range-reduced degree-16/19 series replace the spec's unverified minimax assumption, preserving the error requirement. Measured maximum power relative error is about 4.09e-14 on Node 22 against the 1e-7 bar. Exact domains, API layouts, sampling provenance and held-out coverage are recorded in `packages/shared/README.md`; terrain §3 now names the implemented method.

**UI prerequisite:** all nine corrected primitive captures passed and were opened by Astra, after preserving three earlier tooltip-wrap failures. Decision 100 resolves the conflicting fixed-width/one-line tooltip rules without changing any row wording or token. The subsequent game screens and their independent acceptance are recorded below.

## First playable checkpoint · steps 1–3

The combined production build passes 155 Node tests, strict TypeScript/Biome checks and the complete UI catalogue lint. The 22 input bindings have a separate exact-coverage test. The production browser pass exercised 12 steps: title/isolation, exact long seed draft, Play, real place/break, movement, fullscreen/keyboard lock, Tools, PNG capture, pause/resume, Quit, seed restoration after reload and same-origin assets. It recorded no page, console or network errors; four software-renderer ReadPixels performance warnings remain in the receipt.

The browser used real controls and the real engine. It confirmed Play enters fullscreen and locks the keyboard where supported; F11 exits; windowed Ctrl does not wrongly sprint. Menus pause both world and display clocks. Long seed text is retained exactly while the deterministic engine uses its normalized seed. The gallery remains a separate sample-data route.

The UI pipeline predates screens. All 53 gallery states are implemented; base screens were captured at 1280×720, 1920×1080 and 150% scale, with additional tooltips, forced component states, scrolling endpoints and extreme values. Independent review closed long-seed clipping, toast clearance, missing tooltip/key evidence, clipped focus outlines, and the ghost/silhouette evidence gaps. Full per-screen A7 details are in [the acceptance report](reports/phase-1-1-ui.md). The world HUD's two JPEGs are tied to actual engine captures and current source hashes.

The release is a creative test world. Kingdoms, multiplayer, civilization simulation and Kaldmark's finished regions are later milestones. This checkpoint does not claim the full phase or terrain quality target is complete.

## Rubric scores (latest; score of record = min(self, blind) when required)

| Postcard | Seed | Self | Blind | Record | Critique |
|---|---|---|---|---|---|
| TEST-1 | 1 | 16/20 | Not required in 1.1 | 16/20 | Rolling grassland, pond/sand bank, varied placeholder trees, long shadows and haze; limited macro relief and material variety. R1–R10: 1,1,2,2,1,1,2,2,2,2. Author and coordinator opened the JPEG. |

## Bench (latest)

| Metric | Median | p95 | Budget |
|---|---|---|---|
| TEST-1 total capture | One observed final run: 3.239 s | Not yet sampled | ≤60 s/shot |
| LOD0 generation | 1.793 ms | 2.596 ms | Median ≤12 ms; p95 ≤40 ms |
| Skylight solve | 19.554 ms | 26.555 ms | Median ≤3 ms; currently over target |
| LOD0 meshing | 4.679 ms | 7.649 ms | Median ≤4 ms; currently over target |
| Neighbourhood preparation | 28.767 ms | 37.933 ms | Separately measured work |
| Complete measured kernel pipeline | 57.729 ms | 68.251 ms | Not a browser/worker/FPS measurement |
| LOD1 voxel generation | 1.840 ms | 3.023 ms | LOD2+ tile budget does not apply |

The kernel benchmark ran alone on Node 24.18.0 / Windows / Ryzen 9 7950X, with five discarded warmups and three passes over 50 distinct LOD0 surface chunks and 20 LOD1 chunks (150 and 60 measured samples). It times the actual shared generator, 96³-neighbourhood skylight solve and mesher, with preparation and extraction separate. Source, harness and sample-set hashes plus all raw measurements are retained in its receipt. Lighting and meshing misses remain work for phase 1.10; feature-dense regions and far tiles do not exist yet. Software-renderer postcard timing is not hardware FPS. Quantile tests recompute nine million samples as a separate correctness check.

**Step 4 tooling:** 150 deterministic chunk baselines cover three seeds, LOD0/1, signed coordinates, vertical bands and world edges. Node, local Chromium 153 and local WebKit 26.6 match all 150. GitHub CI independently passed 150/150 in each of Chromium, Firefox and WebKit; Firefox is absent locally. An independent source review found no consequential golden/benchmark issue. The 2048² test-world height atlas took 877 ms to sample; the full SW→NE overview took 29 ms. All ten atlas/slice raw and annotated images were opened by their author, and the coordinator opened the four main annotated views. They show actual test-world height/material data, with matching metre scales and source hashes. They do not depict the future WorldPlan or cavern layout.

**Phase acceptance:** canonical `npm test` (190), `npm run check`, `npm run build`, `ui:lint -- --complete`, the final `postcards -- --seed 1 --only TEST-1 --commit`, and a clean Node 22.23.3/npm 10.9.8 `npm ci` + build all pass. The final TEST-1 and one-tile HTML-grid contact sheet were opened; the postcard retains its accepted 16/20 score. The new `d4c4c49` site build was published through the checksummed publisher, and public readback confirmed that exact release, unchanged save-cache identity, HTTP200 and COOP/COEP headers. [CI evidence](https://github.com/dexnotavailable/coldfront/actions/runs/37818190065) includes all three actual browser golden passes.

## Known issues and next

- First playable commit f8f9d95 is pushed and published at [dex.place/coldfront](https://dex.place/coldfront/), with [PR #2](https://github.com/dexnotavailable/coldfront/pull/2) merged as the working step-3 increment. GitHub CI and the clean Node 22.23.3/npm 10.9.8 checkout build pass. Public version, HTTP200 and isolation headers are verified.
- Next: phase 1.2 WorldPlan, ring/sector boundaries, drainage, sites and first-pass regional terrain, followed by the catalogue's 1.2 map/teleport screens. Record its detailed approach before implementing.
- Save/transition corrections are published in d4c4c49: 11 targeted regressions, independent source review, and local production checks of a visible placed block through immediate Quit/Play and reload/Play. Reads and writes are ordered; failed reads cannot erase prior saves, storage errors do not poison later writes, and Clear cannot race new edits or another world. Queued Play readiness and postcard Escape routing have regressions too. Existing save keys/schema and worldgen cache identity are unchanged.
- GPU uploads currently cap eight chunk results per frame, rather than eight individual meshes. CPU mesh arrays remain for context restoration; freeing them after upload is still pending. Postcards currently record total duration, not aggregated worker-stage durations.
- Local production browser checks prove exact seed restoration and retained block edits after reload. Automatic approval review rejected launching the public-site browser check without giving a detailed reason. No public browser started; public gameplay verification remains unavailable. That action was not retried through another route.
- The build reports a large main chunk (about 873 kB, 218 kB gzip); optimization follows measurements. Biome has 27 warnings and two information notes, with no errors. Most warnings are controlled test/gallery assertions and motion CSS overrides.
- The documented Pages name was corrected: coldfront.pages.dev belongs to another website. Ordinary build remains compatible with Pages; the actual release uses the owner's existing site mount.

## Try this (first playable build)

1. Open [COLDFRONT](https://dex.place/coldfront/) and press **Play**. Walk with **W A S D**; zoom with the wheel, turn with **← →**, and tilt with **↑ ↓**.
2. Double-tap **Space** to fly. Use **Space** to rise and **Shift** to descend. Double-tap **W** to sprint when playing in a window.
3. Choose a hotbar block with **1–9**. Left-click to break, right-click to place; open the block palette with **E**.
4. Dig below the surface to try the automatic overhead cut. Press **F3** for debug information and **F4** for time of day, fog, shadows and fly speed.
5. Press **Esc** to pause or return to the title; **F2** saves a screenshot and **F11** toggles fullscreen. Browse the [interface gallery](https://dex.place/coldfront/?gallery).
6. Leave a placed block in the world, reload, and press **Play** with the same seed to check your saved edits.

Local development: run **npm ci**, then **npm run dev** and open the printed address.

## Session log (newest first)
*(Date, phase, summary, PR link.)*

- **2026-10-09 · 1.1 complete · [PR #3](https://github.com/dexnotavailable/coldfront/pull/3).** Shipped real atlas/slice tools, 150-case browser goldens and measured benchmarks; fixed save/lifecycle races and regenerated source-bound HUD/postcard proof. 190 tests, checks/build, clean Node22 build and Chromium/Firefox/WebKit CI all pass. Live release d4c4c49 verified by public metadata/headers. Public gameplay automation remains unavailable after the recorded approval-review rejection; local production save/reload behavior passed.

- **2026-10-08 · 1.1 steps 1–3 · [PR #2](https://github.com/dexnotavailable/coldfront/pull/2), merged as 554f71b.** Recovered after the PC crash, accepted deterministic foundation and first engine/interface, published f8f9d95 at dex.place/coldfront. Local production play and inspected screenshots pass; 155 tests, check, build, clean Node22 build and GitHub CI pass. Public HTTP/version/isolation pass; public browser launch was rejected by automatic approval review and remains unverified. Continuing atlas/slice/goldens/bench in isolated Astra lanes.

- **2026-10-08 · docs only · PR #1 (fourth part).** The owner's rules for Calamities, presence, the first days and testing alone. Calamities are now forces a kingdom tries to hold: five natures (Sellsword, Idol, Wildfire, Bastion, Oathsworn), a Hold that falls unless the Calamity is fed what it wants, rogues that roam when it breaks, the Bastion that keeps a kingdom standing, and at most nine in the world, about five on a full server (`docs/13-units-classes-power.md` §15). Great powers have presence (`docs/16-sight.md` §11). The world does the early killing: the Steward's peace, the empty throne, omens (`docs/05-systems.md` §2, §16). New `docs/17-simulation-and-bots.md`: the tally (the simulation of unwatched people, renamed from "the ledger" and moved to Milestone 3), catching up, world speed and skip ahead, the owner's cheats, whole-season runs and bot kings. 57 new catalogue rows (1,198 in all), two new Cataclysms (20 in all), the agent's calls 57–74 in `docs/09-open-questions.md` §2, and question 4 answered. Then, at the owner's request, `docs/18-look-and-feel.md`: one set of motion curves for the interface, cameras and world; what the picture never does (no shake, blur or flashes); night, clouds and their shadows, one wind, weather and each region's air; movement drawn between physics steps; the avatar's and the world's animation; effects (whose first, then which element), danger zones and conditions on the body; the interface's motion, listed in catalogue A4; motion strips for checking. Two more catalogue rows (`mark.ping`, `mark.telegraph`; 1,200 in all), weather in `docs/05-systems.md` §16, and the agent's calls 75–94.
- **2026-10-08 · docs only · PR #1 (third part).** The owner's rules for the camera and for sight: bird's-eye only (the over-the-shoulder camera is gone), a human field of view for every unit and NPC, and you see only what your units see. Added `docs/16-sight.md`: view cones, range by light and height, what the player sees (unseen land a fifth darker; underground drawn only where your people have seen it, total darkness elsewhere; ore inside rock never shown), hiding, people on watch and watchtowers, and the AI's awareness, hearing and memory. Removed the Shoulder camera and pointer lock from doc 13 and the catalogue (seven rows out, eight in: 1,141 rows), moved the cut that follows the avatar into phase 1.1, and brought the other docs in line. A fresh reviewer's 40 findings were applied (the cut's cover rule, the silhouette, looking ahead, who counts as a foe, the dark, and the engineering plan). Decisions 35–56 and questions 17–18 in `docs/09-open-questions.md`.
- **2026-10-08 · docs only · PR #1 (second part).** The owner's new rules for people: no first-person view (units were then played from above or over the shoulder; the third part dropped the shoulder camera), skills for every unit, classes with roles and ranks, and a power ladder up to the Calamity. Added `docs/13-units-classes-power.md` (the rulebook), `docs/14-class-library.md` (65 classes, 28 advanced classes, 342 skills including the office skills and Cataclysms, 21 Trials) and `docs/15-item-library.md` (840 items, 377 of them generated from metal tiers), with `docs/tools/content-check.mjs` to check them and recompute the benchmark ladder. Brought the catalogue (1,140 rows), docs 01, 02, 05–10, `AGENTS.md`, the README and the prompts in line.
- **2026-10-08 · docs only · PR #1.** Added the interface catalogue (`docs/11-interface-catalogue.md`: rules for every screen, input, cameras, 1,002 listed controls, texts and keys, and its checker `docs/tools/ui-catalogue.mjs`), the sessions doc (`docs/12-sessions.md`) and `AGENTS.md` so Codex can build from the same guide. Brought docs 01, 03–09, the README and the prompts in line. No game code yet: phase 1.1 is still the next step.
