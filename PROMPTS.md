# Prompts for building COLDFRONT

Copy a prompt into a new cloud session at claude.ai/code (repository: `coldfront`, branch: `main`). Parts in `<angle brackets>` are for you to fill in.

---

## 1. Kickoff (the very first session)

Before pasting it, type `/effort ultracode` and press Enter (README Part B, step 7).

```
You're starting COLDFRONT: a seasonal multiplayer voxel civilization builder that runs in the browser. In one line: Minecraft extended downwards, with Big Globe-class terrain and a bird's-eye view, where every unit is a Minecraft-player equivalent run by the game, and possessing one feels exactly like playing Minecraft. This repository contains only the design docs so far. You're writing the first code.

I'm the owner. I don't code. I make design calls; you make every technical call.

Before writing code, read in this order: CLAUDE.md, docs/01-vision.md, docs/08-roadmap.md (Milestone 1), docs/04-terrain.md (§1–§7, §10, the test world in §11, and §13–§16; the other sections when a phase needs them), docs/07-architecture.md, docs/10-prior-art.md (§1, §2 and §4), docs/02-world.md. Skim docs/06-ui-art.md. Leave the other docs until a phase needs them.

This session: Milestone 1, phase 1.1 (Foundations). If it's done and verified and you still have plenty of room, continue into phase 1.2 (World plan) on the same branch, but only after the 1.1 report is in the pull request.

How to work:
- First, prove the screenshot pipeline: render a test scene in headless Chromium using the notes in CLAUDE.md, and open the image. Every visual claim you make later needs a screenshot you've looked at.
- Terrain quality is the whole point of this milestone. My last attempt with another model died on primitive terrain: the hellscape spikes were plain cones. Build 1.1 so later phases can reach the quality bar in docs/04-terrain.md §1–2: the deterministic math and noise library (with derivatives and measured quantiles, and the forbidden-token test), pointwise generation that LOD can reuse, and the review tools (atlas, slice, postcards).
- Push a playable build and open a draft pull request as soon as step 3 of phase 1.1 works, so I get a link early.
- Reuse before you reinvent: port what docs/10-prior-art.md lists for this phase (the bitwise greedy mesher, the lighting queues, OpenSimplex2; psrdnoise comes in 1.2), within its licence rules.
- Automatic workflows are on. Use them where parallel agents help (reviews, audits, disjoint features in isolated copies), never for rendering or benchmarks on this 4-core machine. See the workflows section in CLAUDE.md.
- Don't ask me technical questions. If a design question comes up that the docs don't answer, pick what fits the pillars, log it in docs/09-open-questions.md, and keep going.

Before you finish:
- npm test, npm run check and npm run build pass, and so does the clean-checkout build described in CLAUDE.md.
- Atlas, slice and postcards are regenerated and reviewed.
- docs/progress.md is updated: status board, scores, bench numbers, known issues, next steps, and a "Try this" list for me.
- Push the branch and put the report (the template in CLAUDE.md) in the pull request's description.
```

---

## 2. Continue (every session after the first)

Start the session on **`main`** if you merged the last pull request. If you didn't merge it (for example, the phase isn't finished yet), pick **that pull request's branch** instead, so the new session starts from the latest work.

```
Continue COLDFRONT. Read CLAUDE.md, then docs/progress.md to see where we are, then the docs the next phase needs.

Do the next unfinished phase in docs/08-roadmap.md. If you finish it (verified, postcards passing) and still have room, start the one after.

My notes since last time: <paste your notes, or write "none">

Finish the way CLAUDE.md says: tests, check and build pass; postcards re-rendered and reviewed; progress.md updated; branch pushed; the report in the pull request's description.
```

---

## 2b. Pick up after a usage limit (same session)

When your limit resets, open the session that stopped and send:

```
Continue where you stopped. Check git log, git status and docs/progress.md first, and don't redo work that's already committed.
```

If that session is gone, use prompt 2 in a new session on the same branch instead.

---

## 3. Feedback after playing a build

Send this in the same session if it's still open; otherwise start a new session with the continue prompt and paste these notes into it.

```
I played the build at <link>. My notes:
- <what you saw, where (region, and the F3 coordinates if you have them), what you expected instead>
- <...>

Treat these as design input. Fix what's clearly broken. For taste calls, make the change and show me before/after postcards in the report. If you disagree with a note, don't skip it silently: log your reasoning in docs/09-open-questions.md.
```

---

## 4. Polish one region

```
Polish pass on <REGION>. Re-read its recipe in docs/04-terrain.md and its postcards. Render its postcards on seeds 1–3, score them, and have a fresh subagent blind-review them. Then improve the weakest criteria until every postcard scores at least 18/20 or the timebox in docs/04-terrain.md §14.6 runs out. Report the budget numbers, but don't trade quality for them before phase 1.10. Show before/after images in the report, and list any postcard still under 18 with the reason.
```

---

## 5. Start a new milestone (from Milestone 2 on)

```
Milestone <N> starts now. Read CLAUDE.md, docs/progress.md, the Milestone <N> outline in docs/08-roadmap.md, and the sections of docs/05-systems.md and docs/07-architecture.md it depends on.

First, draft a detailed phase plan for Milestone <N>, in the same style as Milestone 1's, and add it to docs/08-roadmap.md. Then build phase <N>.1. In the PR, ask me to approve the phase plan.
```

---

## 6. Goals for long phases (optional)

Paste one of these into a session to keep it working until the finish line is met. `/goal` on its own shows progress; `/goal clear` stops it. The turn limit is a safety cap on your usage.

Phase 1.1:
```
/goal Phase 1.1 meets its "Done when" in docs/08-roadmap.md: npm test, npm run check and npm run build pass, TEST-1 scores at least 12/20, docs/progress.md is updated, and the branch is pushed with the PR report. Or stop after 40 turns.
```

Phase 1.3 (the hellscape):
```
/goal HELL-1 and HELL-2 pass the bar in docs/04-terrain.md §14.4 on seeds 1–3 (R2 = 2, blind review included), the thorn numbers in the terrain report meet §8.5, tests and build pass, and the branch is pushed with the PR report. Or stop after 60 turns.
```

Any phase:
```
/goal The current phase in docs/progress.md meets its "Done when" in docs/08-roadmap.md (or is done with known issues under its timebox rule), verified with screenshots the agent has looked at, and the branch is pushed with the PR report. Or stop after 50 turns.
```

Phase 1.10 ends with your sign-off, so don't give it a goal.

---

## 7. Health check (no new features)

```
Do a review session with no new features. Start fresh subagents to:
1. blind-review every current postcard against the rubric in docs/04-terrain.md §14;
2. check the code against the rules in docs/07-architecture.md (determinism, shared-code purity) and measure the budgets in docs/04-terrain.md §15;
3. compare each finished phase's "done when" in docs/08-roadmap.md with what's actually built.

Fix what they find, or log it in docs/progress.md. Report in the usual way.
```

---

## Tips

- **Changing the design:** tell the session what you want *and* say "update the docs to match", so every future session follows it.
- **Stuck or going in circles?** Stop the session. Start a new one with the continue prompt (on the same branch), and add one sentence about what went wrong.
- **Sessions per phase:** the early phases take one session; the big terrain phases (1.3–1.9) usually take 2–4. Fresh sessions read `progress.md`, so they don't need the old chat.
