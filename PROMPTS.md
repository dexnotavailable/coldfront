# Prompts for building COLDFRONT

Copy a prompt into a session opened on the `coldfront` project (README Part B). They work the same in Codex and in Claude Code, because both follow `AGENTS.md`. Parts in `<angle brackets>` are for you to fill in.

Prompts 1–7 run whole phases. Prompts 8–10 are for the interface and the cameras: small, exact tasks, which is how an agent builds screens well.

---

## 1. Kickoff (the very first session)

In Claude Code, type `/effort ultracode` and press Enter before pasting it. In Codex, just paste it.

```
You're starting COLDFRONT: a seasonal multiplayer voxel civilization builder that runs in the browser. In one line: Minecraft extended downwards, with Big Globe-class terrain and a bird's-eye view, where every unit is a Minecraft-player equivalent run by the game, and playing one moves exactly like Minecraft, seen from above. This repository contains only the design docs so far. You're writing the first code.

I'm the owner. I don't code. I make design calls; you make every technical call.

Before writing code, read in this order: AGENTS.md, docs/01-vision.md, docs/08-roadmap.md (Milestone 1), docs/04-terrain.md (§1–§7, §10, the test world in §11, and §13–§16; the other sections when a phase needs them), docs/07-architecture.md, docs/10-prior-art.md (§1, §2 and §4), docs/02-world.md, docs/12-sessions.md. From docs/11-interface-catalogue.md read Part A, B3–B4, C1, C2 and C4 (the Overhead camera uses C1's maths, and the cut follows the avatar under cover from phase 1.1), and the sections of the 1.1 screens when you build them; from docs/13-units-classes-power.md read §3.2 and §3.4 (the avatar and the Overhead camera); read docs/18-look-and-feel.md (the look and feel; its §13 says what 1.1 brings). Leave the other docs until a phase needs them.

This session: Milestone 1, phase 1.1 (Foundations). If it's done and verified and you still have plenty of room, continue into phase 1.2 (World plan) on the same branch, but only after the 1.1 report is in the pull request.

How to work:
- First, prove the screenshot pipeline: render a test scene in headless Chromium using the notes in docs/12-sessions.md, and open the image. Every visual claim you make later needs a screenshot you've looked at.
- Terrain quality is the whole point of this milestone. My last attempt with another model died on primitive terrain: the hellscape spikes were plain cones. Build 1.1 so later phases can reach the quality bar in docs/04-terrain.md §1–2: the deterministic math and noise library (with derivatives and measured quantiles, and the forbidden-token test), pointwise generation that LOD can reuse, and the review tools (atlas, slice, postcards).
- The interface is built only from docs/11-interface-catalogue.md. Set up its pipeline (string table, ui:lint, gallery, ui:shots) before the first screen, and put nothing on screen that it doesn't list: no subtitles, no helper text, no decoration.
- Push a playable build and open a draft pull request as soon as step 3 of phase 1.1 works, so I get a link early.
- Reuse before you reinvent: port what docs/10-prior-art.md lists for this phase (the bitwise greedy mesher, the lighting queues, OpenSimplex2; psrdnoise comes in 1.2), within its licence rules.
- Use helper agents where AGENTS.md says they help (reviews, audits, disjoint features in isolated copies), never for rendering or benchmarks.
- Don't ask me technical questions. If a design question comes up that the docs don't answer, pick what fits the pillars, log it in docs/09-open-questions.md, and keep going.

Before you finish:
- npm test, npm run check and npm run build pass, and so does the clean-checkout build described in docs/12-sessions.md.
- Atlas, slice and postcards are regenerated and reviewed, and so are the screenshots of the 1.1 screens.
- docs/progress.md is updated: status board, scores, bench numbers, known issues, next steps, and a "Try this" list for me.
- Push the branch and put the report (the template in AGENTS.md) in the pull request's description.
```

---

## 2. Continue (every session after the first)

On your own computer, open the `coldfront` folder and paste the prompt: the agent picks the right branch itself. In a Claude cloud session, start on **`main`** if you merged the last pull request; if you didn't (for example, the phase isn't finished yet), pick **that pull request's branch** instead.

```
Continue COLDFRONT. Read AGENTS.md, then docs/progress.md to see where we are, then the docs the next phase needs.

Do the next unfinished phase in docs/08-roadmap.md. If you finish it (verified, postcards passing) and still have room, start the one after.

My notes since last time: <paste your notes, or write "none">

Finish the way AGENTS.md says: tests, check and build pass; postcards and interface screenshots re-rendered and reviewed; progress.md updated; branch pushed; the report in the pull request's description.
```

---

## 2b. Pick up after a usage limit (same session)

When your limit resets, reopen the session that stopped and send the prompt below. On your own computer, if you closed the window: in Codex, reopen the chat from the app's list (or run `codex resume` in the `coldfront` folder); in Claude Code, run `claude --continue` there (or reopen the session in the desktop app).

```
Continue where you stopped. Check git log, git status and docs/progress.md first, and don't redo work that's already committed.
```

If that session is gone, use prompt 2 in a new session instead.

---

## 3. Feedback after playing a build

Send this in the same session if it's still open; otherwise start a new session with the continue prompt and paste these notes into it.

```
I played the build at <link>. My notes:
- <what you saw, where (region, and the F3 coordinates if you have them), what you expected instead>
- <...>

Treat these as design input. Fix what's clearly broken. For taste calls, make the change and show me before/after images in the report. If you disagree with a note, don't skip it silently: log your reasoning in docs/09-open-questions.md.
```

---

## 4. Polish one region

```
Polish pass on <REGION>. Re-read its recipe in docs/04-terrain.md and its postcards. Render its postcards on seeds 1–3, score them, and have a fresh helper agent blind-review them. Then improve the weakest criteria until every postcard scores at least 18/20 or the timebox in docs/04-terrain.md §14.6 runs out. Report the budget numbers, but don't trade quality for them before phase 1.10. Show before/after images in the report, and list any postcard still under 18 with the reason.
```

---

## 5. Start a new milestone (from Milestone 2 on)

```
Milestone <N> starts now. Read AGENTS.md, docs/progress.md, the Milestone <N> outline in docs/08-roadmap.md, the sections of docs/05-systems.md and docs/07-architecture.md it depends on, docs/13-units-classes-power.md (its §20 says what Milestone <N> brings), the rows marked M<N> in docs/14-class-library.md and docs/15-item-library.md (`node docs/tools/content-check.mjs --upto M<N>` counts them), what Milestone <N> brings in docs/16-sight.md §10, docs/17-simulation-and-bots.md §8 and docs/18-look-and-feel.md §13, and the rows marked M<N> in docs/11-interface-catalogue.md (its Part F lists them).

First, draft a detailed phase plan for Milestone <N>, in the same style as Milestone 1's, and add it to docs/08-roadmap.md. Give every interface row marked M<N> to one of the phases. Then build phase <N>.1. In the pull request, ask me to approve the phase plan.
```

---

## 6. Goals for long phases (optional)

Paste one of these into a session to keep it working until the finish line is met. `/goal` on its own shows progress; `/goal clear` stops it. The turn limit at the end is a safety cap on your usage. (These were written for Claude Code's `/goal`. Codex has its own, which may count its limit differently: there, leave off the last sentence. If your tool has no `/goal`, skip this section.)

Phase 1.1:
```
/goal Phase 1.1 meets its "Done when" in docs/08-roadmap.md: npm test, npm run check and npm run build pass, TEST-1 scores at least 12/20, the 1.1 screens pass the checklist in docs/11-interface-catalogue.md A7 from screenshots, docs/progress.md is updated, and the branch is pushed with the report in the pull request. Or stop after 40 turns.
```

Phase 1.3 (the hellscape):
```
/goal HELL-1 and HELL-2 pass the bar in docs/04-terrain.md §14.4 on seeds 1–3 (R2 = 2, blind review included), the thorn numbers in the terrain report meet §8.5, tests and build pass, and the branch is pushed with the report in the pull request. Or stop after 60 turns.
```

Any phase:
```
/goal The current phase in docs/progress.md meets its "Done when" in docs/08-roadmap.md (or is done with known issues under its timebox rule), verified with screenshots the agent has looked at, and the branch is pushed with the report in the pull request. Or stop after 50 turns.
```

Phase 1.10 ends with your sign-off, so don't give it a goal.

---

## 7. Health check (no new features)

```
Do a review session with no new features. Start fresh helper agents to:
1. blind-review every current postcard against the rubric in docs/04-terrain.md §14;
2. check the code against the rules in docs/07-architecture.md (determinism, shared-code purity) and measure the budgets in docs/04-terrain.md §15;
3. compare each finished phase's "done when" in docs/08-roadmap.md with what's actually built;
4. compare the built interface with docs/11-interface-catalogue.md, from screenshots of the gallery: anything on screen that isn't listed, any row for a finished phase that's missing, any label or tooltip that differs from the catalogue's wording, any screen that fails the checklist in its A7.

Fix what they find, or log it in docs/progress.md. Report in the usual way.
```

---

## 8. Build one screen

One screen or panel per task. Name the section of the catalogue; the agent must not have to guess what's in it.

```
Goal: build <the screen or panel> exactly as docs/11-interface-catalogue.md specifies it in <section, for example "D8 · Settings">: the rows whose Since is the current phase in docs/progress.md or earlier.

Context: read Part A of that doc and that section first. The tokens are in docs/06-ui-art.md §5. Reuse the components already in packages/client/src/ui/components/.

Constraints:
- Only the rows in that section. No other controls, text, icons or decoration. Every label and tooltip exactly as written, through the string table.
- No subtitles, helper lines, section notes or stand-in text. If something seems to need explaining, that's the row's tooltip. If the catalogue gives it no tooltip, leave the explanation out and tell me.
- Don't change other screens, the tokens or how the components look. If a component is missing, add it the way the table in Part A (A3) describes it.
- If the catalogue is unclear or impossible somewhere, leave that row out and say where. Don't add rows to Part G in this task.

Done when:
- npm run ui:lint, npm run check and npm test pass.
- The screen's states are in the gallery (empty, typical, full, disabled, and error where it has one), npm run ui:shots passes, and you have opened its screenshots at every size it writes.
- Every line of the checklist in the catalogue's A7 holds. Your report lists the rows you built, the screenshot files you opened, the words you read in them, and pass or fail for each line of that checklist.
```

---

## 9. Fix how a screen looks or reads

Attach a screenshot if you can. In the desktop apps you can paste one into the message.

```
On <screen>, in the build at <link>: <what's wrong, for example "there's a grey sentence under the title", "Demolish sits too close to Repair", "this label doesn't say what the button does">.

Before changing anything, run npm run ui:shots and keep this screen's images as "before".

Fix that, on this screen only. While you're there, remove anything on it that docs/11-interface-catalogue.md doesn't list, and tell me what you removed. To change a word, change its catalogue row first, then rebuild the string table. If a token or a shared component has to change, change the doc first, then open the screenshots of every screen that uses it.

Done when npm run ui:lint and npm run ui:shots pass and your report shows the before and after images, with what you read in each.
```

---

## 10. Tune how a camera or a control feels

```
<The Command camera / the Overhead view / switching between them / the cut / a control in Command view> feels <too fast, floaty, jerky, stiff…> when I <what you were doing>.

Only numbers marked (tune) in docs/11-interface-catalogue.md Part C (C1 for Command view, C4 and C5 for playing a unit) may change. Possess movement is Minecraft's and is fixed (its B4): if that's what I'm describing, change nothing and tell me which setting adjusts it. Otherwise change at most two numbers, in the doc and the code together, keep the tests in C7 passing as they are, and report each number as old → new with the steps to try it, so I can ask for more or less.
```

---

## Tips

- **Changing the design:** tell the session what you want *and* say "update the docs to match", so every future session follows it. For anything on screen, say "change the catalogue first".
- **Stuck or going in circles?** Stop the session. Start a new one with the continue prompt, and add one sentence about what went wrong.
- **Sessions per phase:** the early phases take one session; the big terrain phases (1.3–1.9) usually take 2–4. Fresh sessions read `progress.md`, so they don't need the old chat.
- **Interface work goes better in small pieces.** One screen per task (prompt 8), then look at it in the gallery (`<preview link>/?gallery`) before asking for the next.
