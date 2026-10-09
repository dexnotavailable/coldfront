# Progress log

**Current milestone:** 1 · The World
**Current phase:** 1.2 · World plan (in progress)
**Playable link:** [dex.place/coldfront](https://dex.place/coldfront/) · [Interface gallery](https://dex.place/coldfront/?gallery) · [World-plan PR #4](https://github.com/dexnotavailable/coldfront/pull/4). Live game commit: `5a9f26b`. The unrelated `coldfront.pages.dev` site is not this game's preview.
**Agent guide:** `AGENTS.md` (Codex and Claude Code both follow it). **Interface:** only what `docs/11-interface-catalogue.md` lists.

## Status board

| Phase | Status | Notes |
|---|---|---|
| 1.1 Foundations | ✓ Complete, with recorded limits | 190 tests, check/build, clean Node22 build, complete UI lint and all-three-browser CI pass; accepted images/tools/save fixes published as d4c4c49. Public-site browser launch remains unavailable. |
| 1.2 World plan | Final publication | Runtime, three-seed geography, atlas/slice, all-region travel and sixteen first-pass postcards accepted; 310 tests, check/build and complete UI lint pass. Clean checkout and CI precede release. [Phase plan](plans/phase-1-2.md). |
| 1.3 Terrain toolkit + Ibara | ☐ | |
| 1.4 Far terrain | ☐ | |
| 1.5 Kurogane + Selva | ☐ | |
| 1.6 Fantasy regions | ☐ | |
| 1.7 Rest of the surface | ☐ | |
| 1.8 Caves + Layer 1 | ☐ | |
| 1.9 The deep | ☐ | |
| 1.10 Polish + performance | ☐ | |

## Current session
**9 October 2026 · Codex · `codex/phase-1-2-postcards`**

The published phase 1.2 increment makes Kaldmark explorable: the full WorldPlan, first-pass surface terrain and owned water, main/test selection, real map, region travel and discovery cards. The [phase plan](plans/phase-1-2.md) defines the shared context and world/session boundaries. Decisions 102–108 cover missing Frost content, separate world identity, first-entry memory, map/water travel and readable discovery text. Release `5a9f26b` and final documentation revision `a99de83` passed the clean Node 22.23.3/npm 10.9.8 install/build and CI, including 300 actual golden chunks in each of Chromium, Firefox and WebKit. PR #4 merged as `058775e`; the live runtime remains `5a9f26b`. Public HTTP200, exact version/build identity, entry assets and COOP/COEP headers pass. Public gameplay remains unverified after the earlier browser-action rejection.

**Published-runtime checks:** `npm test` passes 292 tests across 49 files; `npm run check`, `npm run build` and the local browser smoke/drive pass. Complete UI lint covers 96 gallery states with zero current rows missing and 23 input bindings. All 300 chunk baselines match in Node, Chromium and WebKit; the original 150 test-world records are byte-for-byte unchanged. Firefox is absent locally and passed in CI. The full UI capture produced 288 profiles; its one failure was an old palette test expecting three stone names while the real registry supplies eight. The assertion now checks the exact ordered registry names; all three repaired palette profiles pass. The original failed receipt remains available.

**Postcard follow-up:** all sixteen regional postcards and TEST-1 have been regenerated from the integrated production renderer, with fresh HUD proof. The coordinator opened every full image and the combined sheet. Current `npm test` passes 310 tests across 51 files; check, complete UI lint, build and local browser smoke/drive pass. The capture-only camera override preserves normal play, and an exposed teleport-glide clock bug has a red/green regression and independent closure. Blackwater now searches suitable viewpoints away from the bridge/escarpment while retaining all geometry checks; previously valid cameras are revalidated and preserved. A water rendering defect exposed in the first full run is repaired: transparent faces no longer overlap at chunk edges, and actual opaque-scene depth controls transmission, retaining shallow beds and removing the pale deep-water plane. The controlled comparisons, failed private harness attempt and corrected retry are retained. Final clean checkout, image acceptance, CI and publication remain. The [phase 1.3 integration plan](plans/phase-1-3.md) covers the next phase's terrain, lava, lighting and strict HELL gates.

**World evidence:** eighteen full invariant checks cover seeds 1–3, including independent drainage accounting, owned water, sites, all spawn candidates, voxel seams and conservative bounds. The independent atlas census places every one of the twelve ring regions inside 90–110 km² on all three seeds (observed range 97.388060–103.097808 km²). Seed 1 shows 30 Seats, 106 forts, 46 descents covering all 20 types, three broken causeways and 256 spawns. Minimum spawn radius is 16,030.016 m and minimum Seat clearance 3,027.858 m. The author opened all 22 atlas/slice images; a separate Astra reviewer checked the required views and found no consequential mismatch. Underground colours show planned footprints and shelves within solid rock; cavern carving comes later. Persistent numeric WorldPlan buffers occupy 17,892,900 bytes.

**Actual play evidence:** the production browser tour visited all sixteen surface regions, opened the real map and returned to the test world: 19 cases passed, zero application errors, peak six workers, all closed afterward. Independent Astra review opened all nineteen JPEGs plus both fresh HUD captures. Actual snow discovery text is readable with the approved glyph edge, map labels are separate, arrivals show terrain and the avatar, and outline/ghost/silhouette proof is current. Runtime review closed failure-path worker cleanup and stale discovery-card findings using focused regressions. Earlier failed attempts are preserved rather than relabelled.

**Map response:** skipping 3D draws behind the opaque map reduced an observed 541² raster request from 25.054 s to 2.791 s under SwiftShader, with identical resolution. Sampling took 2.178 s and yield waits 0.612 s in the repaired run. World clocks and map input continue; this is a local software-renderer observation, not a hardware-FPS benchmark.

The all-region main-world benchmark passed; measured generation meets its target, while lighting and meshing remain work for phase 1.10. The sixteen first-pass postcards remain explicitly ungraded: placeholder trees, basic landforms, strong haze and a finite near-field boundary are visible. They do not claim the later thorns, giant trees, crystals, floating islands, fortress or cavern quality bars. The final sixteen-shot run reuses the plan in fifteen shots, records no application errors and closes its browser. UI review covers 294 freshly opened images plus explicitly reused unchanged primitives; subsequent changes affect the capture/runtime path and carry refreshed actual HUD evidence. The sky follows distant cameras, with spatial regressions and opened proof. [Postcard report and full sheet](reports/phase-1-2-postcards.md).

**Parallel content work requested by the owner:** isolated Ibara thorn/arch, Hearthlands house and Selva giant-tree studies have passed bounded independent image reviews. Ibara's small-post ambiguity and provisional materials remain explicit limits; none has a final regional terrain score or live placement yet. The [terrain reference audit](reports/terrain-reference-audit.md) compares seven primary mod projects and maps their useful ideas to our underground plan. Decisions 109–111 record the research boundary and future topology rules. A completed Astra scouting wave supplied the [King](plans/assets/king.md), [Frostwolf](plans/assets/frost-wolf.md) and [smithy](plans/assets/smithy.md) briefs; three separate implementation lanes are now authoring those assets. Renders and benchmarks remain serialized.
The following startup/recovery record describes the completed foundation work.

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
| TEST-1 | 1 | 15/20 (fresh Astra review) | Not required for this foundation view | 15/20 | Shallow stepped pond bed remains visible through repaired water; trees, grass/sand banks and shadows read clearly. Limited macro relief/material variety remains. This supersedes the historical 16/20 capture; coordinator and independent Astra reviewer opened the final JPEG. |
| P12 surface set | 1 | Ungraded by phase 1.2 design | Independent image review passed | Ungraded | All sixteen regions captured and opened; full feature-quality terrain and far LOD remain later work. |

## Bench (latest)

Main world, all sixteen surface regions, seed 1; Node 24.18.0 / Windows / Ryzen 9 7950X. Five warmups were discarded before three passes over 800 distinct LOD0 chunks and 320 LOD1 chunks: 2,400 measured full pipelines and 960 LOD1 generations. The run took 326.074 s alone, with no renderer or other sampler running.

| Metric | Median | p95 | Budget |
|---|---|---|---|
| LOD0 generation | 10.115 ms | 12.075 ms | ≤12 / ≤40 ms; passes |
| Skylight solve | 18.022 ms | 25.479 ms | Median ≤3 ms; over target |
| LOD0 meshing | 6.372 ms | 8.735 ms | Median ≤4 ms; over target |
| Neighbourhood preparation | 97.552 ms | 113.165 ms | Separately measured work |
| Halo light extraction | 0.208 ms | 0.258 ms | Separately measured work |
| Complete measured kernel pipeline | 132.713 ms | 149.398 ms | Not browser/worker/FPS timing |
| LOD1 voxel generation | 10.032 ms | 11.790 ms | LOD2+ tile budget does not apply |
| WorldPlan cold build | One observed build: 1.409 s | Not sampled | ≤3 s target |

Context hydration took 31.858 ms and sample selection 38.952 ms, separately from the cold plan. The report retains raw observations and per-region summaries, exact sample/source/harness hashes and physical evidence for dark submerged cases. Lighting and meshing remain above their phase 1.10 targets. Terrain is first-pass; detailed Ibara features, later LOD tiles, relighting, transfers, GPU uploads and FPS are not represented by these Node measurements.

Single atlas timings: seed 1 regions 2.010 s, height 21.538 s and sites 2.216 s at 2048²; all below the 30 s target. The SW–NE overview took 0.147 s to sample. Final phase 1.2 postcard median/p95/max: **8.634 / 14.809 / 21.104 s**, with 305–1,204 requested chunks and all ready before each shot. Sixteen images plus sheets took 187.622 s including cached-camera validation and browser setup. Camera search is separate: the repaired Blackwater search took 92.952 s for fifty candidates. These are software-renderer capture timings, not FPS. Private kernel benchmark receipt: `out/step4/bench-gen-2026-10-08T21-12-50.522Z.json`.

The following records describe the completed phase 1.1 tooling and acceptance.
**Step 4 tooling:** 150 deterministic chunk baselines cover three seeds, LOD0/1, signed coordinates, vertical bands and world edges. Node, local Chromium 153 and local WebKit 26.6 match all 150. GitHub CI independently passed 150/150 in each of Chromium, Firefox and WebKit; Firefox is absent locally. An independent source review found no consequential golden/benchmark issue. The 2048² test-world height atlas took 877 ms to sample; the full SW→NE overview took 29 ms. All ten atlas/slice raw and annotated images were opened by their author, and the coordinator opened the four main annotated views. They show actual test-world height/material data, with matching metre scales and source hashes. They do not depict the future WorldPlan or cavern layout.

**Phase acceptance:** canonical `npm test` (190), `npm run check`, `npm run build`, `ui:lint -- --complete`, the final `postcards -- --seed 1 --only TEST-1 --commit`, and a clean Node 22.23.3/npm 10.9.8 `npm ci` + build all pass. The final TEST-1 and one-tile HTML-grid contact sheet were opened; the postcard retains its accepted 16/20 score. The new `d4c4c49` site build was published through the checksummed publisher, and public readback confirmed that exact release, unchanged save-cache identity, HTTP200 and COOP/COEP headers. [CI evidence](https://github.com/dexnotavailable/coldfront/actions/runs/37818190065) includes all three actual browser golden passes.

## Known issues and next

- First playable commit f8f9d95 is pushed and published at [dex.place/coldfront](https://dex.place/coldfront/), with [PR #2](https://github.com/dexnotavailable/coldfront/pull/2) merged as the working step-3 increment. GitHub CI and the clean Node 22.23.3/npm 10.9.8 checkout build pass. Public version, HTTP200 and isolation headers are verified.
- Next: publish the completed postcard/water increment after final release gates, then integrate the full Ibara toolkit and terrain under the phase 1.3 plan. Continue isolated asset reviews before integration.
- The current main-world release uses generation version 2. As specified for Milestone 1, generation/registry changes invalidate prior saves: old phase 1.1 records remain stored but will not load into the new generation. Within version 2, main/test worlds, seeds and discovery memory are kept separate; Clear my edits affects only the current world's edits.
- Save/transition corrections are published in d4c4c49: 11 targeted regressions, independent source review, and local production checks of a visible placed block through immediate Quit/Play and reload/Play. Reads and writes are ordered; failed reads cannot erase prior saves, storage errors do not poison later writes, and Clear cannot race new edits or another world. Queued Play readiness and postcard Escape routing have regressions too. Existing save keys/schema and worldgen cache identity are unchanged.
- GPU uploads currently cap eight chunk results per frame, rather than eight individual meshes. CPU mesh arrays remain for context restoration; freeing them after upload is still pending. Postcards currently record total duration, not aggregated worker-stage durations.
- Local production browser checks prove exact seed restoration and retained block edits after reload. Automatic approval review rejected launching the public-site browser check without giving a detailed reason. No public browser started; public gameplay verification remains unavailable. That action was not retried through another route.
- The build reports a large main chunk (about 944 kB, 243 kB gzip); optimization follows measurements. Biome has 54 warnings and two information notes, with no errors. Most warnings are controlled test/gallery assertions and motion CSS overrides.
- The documented Pages name was corrected: coldfront.pages.dev belongs to another website. Ordinary build remains compatible with Pages; the actual release uses the owner's existing site mount.

## Try this (current world-plan build)

1. Open [COLDFRONT](https://dex.place/coldfront/), choose **Kaldmark** and press **Play**. Walk with **W A S D**; zoom with the wheel, turn with **← →**, and tilt with **↑ ↓**.
2. Double-tap **Space** to fly. Use **Space** to rise and **Shift** to descend. Double-tap **W** to sprint when playing in a window.
3. Choose a hotbar block with **1–9**. Left-click to break, right-click to place; open the block palette with **E**.
4. Dig below the surface to try the automatic overhead cut. Press **F3** for debug information and **F4** for time of day, fog, shadows and fly speed.
5. Press **Esc** to pause or return to the title; **F2** saves a screenshot and **F11** toggles fullscreen. Browse the [interface gallery](https://dex.place/coldfront/?gallery).
6. Leave a placed block in the world, reload, and press **Play** with the same seed to check your saved edits.
7. Open the map with **M**, choose a spot and travel. In **F4**, use **Go to region** to compare Shirogane, Kurogane and the Sundered Isles. Discovery cards appear once per saved world identity. Switch to the test world from the title for the smaller sandbox.

Local development: run **npm ci**, then **npm run dev** and open the printed address.

## Session log (newest first)
*(Date, phase, summary, PR link.)*

- **2026-10-09 · 1.2 working increment · [PR #4](https://github.com/dexnotavailable/coldfront/pull/4).** Published `5a9f26b`: deterministic main WorldPlan, owned water, map, safe region travel and discoveries. 292 tests, check/build, clean Node22 build and local browser journeys pass. Public version/assets/isolation match. Three-seed atlas/slices and 300 local browser goldens accepted; CI and sixteen true regional postcards remain. Owner-requested terrain reference audit completed; isolated Ibara, house and giant-tree lanes continue.

- **2026-10-09 · 1.1 complete · [PR #3](https://github.com/dexnotavailable/coldfront/pull/3).** Shipped real atlas/slice tools, 150-case browser goldens and measured benchmarks; fixed save/lifecycle races and regenerated source-bound HUD/postcard proof. 190 tests, checks/build, clean Node22 build and Chromium/Firefox/WebKit CI all pass. Live release d4c4c49 verified by public metadata/headers. Public gameplay automation remains unavailable after the recorded approval-review rejection; local production save/reload behavior passed.

- **2026-10-08 · 1.1 steps 1–3 · [PR #2](https://github.com/dexnotavailable/coldfront/pull/2), merged as 554f71b.** Recovered after the PC crash, accepted deterministic foundation and first engine/interface, published f8f9d95 at dex.place/coldfront. Local production play and inspected screenshots pass; 155 tests, check, build, clean Node22 build and GitHub CI pass. Public HTTP/version/isolation pass; public browser launch was rejected by automatic approval review and remains unverified. Continuing atlas/slice/goldens/bench in isolated Astra lanes.

- **2026-10-08 · docs only · PR #1 (fourth part).** The owner's rules for Calamities, presence, the first days and testing alone. Calamities are now forces a kingdom tries to hold: five natures (Sellsword, Idol, Wildfire, Bastion, Oathsworn), a Hold that falls unless the Calamity is fed what it wants, rogues that roam when it breaks, the Bastion that keeps a kingdom standing, and at most nine in the world, about five on a full server (`docs/13-units-classes-power.md` §15). Great powers have presence (`docs/16-sight.md` §11). The world does the early killing: the Steward's peace, the empty throne, omens (`docs/05-systems.md` §2, §16). New `docs/17-simulation-and-bots.md`: the tally (the simulation of unwatched people, renamed from "the ledger" and moved to Milestone 3), catching up, world speed and skip ahead, the owner's cheats, whole-season runs and bot kings. 57 new catalogue rows (1,198 in all), two new Cataclysms (20 in all), the agent's calls 57–74 in `docs/09-open-questions.md` §2, and question 4 answered. Then, at the owner's request, `docs/18-look-and-feel.md`: one set of motion curves for the interface, cameras and world; what the picture never does (no shake, blur or flashes); night, clouds and their shadows, one wind, weather and each region's air; movement drawn between physics steps; the avatar's and the world's animation; effects (whose first, then which element), danger zones and conditions on the body; the interface's motion, listed in catalogue A4; motion strips for checking. Two more catalogue rows (`mark.ping`, `mark.telegraph`; 1,200 in all), weather in `docs/05-systems.md` §16, and the agent's calls 75–94.
- **2026-10-08 · docs only · PR #1 (third part).** The owner's rules for the camera and for sight: bird's-eye only (the over-the-shoulder camera is gone), a human field of view for every unit and NPC, and you see only what your units see. Added `docs/16-sight.md`: view cones, range by light and height, what the player sees (unseen land a fifth darker; underground drawn only where your people have seen it, total darkness elsewhere; ore inside rock never shown), hiding, people on watch and watchtowers, and the AI's awareness, hearing and memory. Removed the Shoulder camera and pointer lock from doc 13 and the catalogue (seven rows out, eight in: 1,141 rows), moved the cut that follows the avatar into phase 1.1, and brought the other docs in line. A fresh reviewer's 40 findings were applied (the cut's cover rule, the silhouette, looking ahead, who counts as a foe, the dark, and the engineering plan). Decisions 35–56 and questions 17–18 in `docs/09-open-questions.md`.
- **2026-10-08 · docs only · PR #1 (second part).** The owner's new rules for people: no first-person view (units were then played from above or over the shoulder; the third part dropped the shoulder camera), skills for every unit, classes with roles and ranks, and a power ladder up to the Calamity. Added `docs/13-units-classes-power.md` (the rulebook), `docs/14-class-library.md` (65 classes, 28 advanced classes, 342 skills including the office skills and Cataclysms, 21 Trials) and `docs/15-item-library.md` (840 items, 377 of them generated from metal tiers), with `docs/tools/content-check.mjs` to check them and recompute the benchmark ladder. Brought the catalogue (1,140 rows), docs 01, 02, 05–10, `AGENTS.md`, the README and the prompts in line.
- **2026-10-08 · docs only · PR #1.** Added the interface catalogue (`docs/11-interface-catalogue.md`: rules for every screen, input, cameras, 1,002 listed controls, texts and keys, and its checker `docs/tools/ui-catalogue.mjs`), the sessions doc (`docs/12-sessions.md`) and `AGENTS.md` so Codex can build from the same guide. Brought docs 01, 03–09, the README and the prompts in line. No game code yet: phase 1.1 is still the next step.
