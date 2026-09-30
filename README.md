# COLDFRONT

A seasonal, ~100-player voxel civilization builder in the browser. You rule a kingdom from above and possess its people on the ground, pushing supply lines down a funnel-shaped world to break the strongholds of the Wardens and, finally, the King Below.

This repository starts as **design docs only**. AI coding sessions build the game from them, one phase at a time. This README is **your guide as the owner**. The coding agent reads `CLAUDE.md` instead.

| File | What it is |
|---|---|
| `CLAUDE.md` | Rules and workflow for the coding agent |
| `PROMPTS.md` | Prompts you paste into sessions (kickoff, continue, feedback…) |
| `docs/01-vision.md` … `docs/10-prior-art.md` | The design: vision, world, lore, terrain spec, systems, UI and art, architecture, roadmap, open questions, and the audit of open-source code we can reuse |
| `docs/progress.md` | The live progress log. Read this after each session. |
| `docs/diagrams/` | The world map and funnel diagrams (and the script that draws them) |
| `.claude/settings.json` | Session settings: turns on ultracode at the highest reasoning effort, pre-approves routine commands (npm, git, node…), blocks force-pushes and merges as a safety net, and installs the project's packages when a session starts |
| `.github/workflows/ci.yml` | The automatic check GitHub runs on every pull request (the green tick or red cross) |
| `.gitignore` | Tells git which generated files never to save |

---

## What you need

- A **GitHub** account (you have one)
- A **Claude** plan with cloud coding sessions (your Max plan includes them)
- A free **Cloudflare** account, for playable preview links
- A desktop browser (Chrome, Edge or Firefox) on a computer with a decent graphics chip, for playtesting

---

## Part A · Put the docs on GitHub (about 10 minutes, once)

1. Go to **github.com → New repository**.
   - Name: `coldfront`
   - Visibility: **Private** (recommended)
   - Leave "Add a README", ".gitignore" and "license" **unchecked**. The repo must start empty.
   - Click **Create repository**.
2. On the empty repo page, click **"uploading an existing file"**.
3. Drag in **everything** from this folder, including the three hidden items whose names start with a dot: `.claude`, `.github` and `.gitignore`. Your computer hides them by default:
   - **Mac:** in Finder, press **Cmd + Shift + .** (full stop) to show them.
   - **Windows:** in File Explorer, choose **View → Show → Hidden items**.

   Then click **Commit changes**.
4. **Check the upload.** The repo's front page should list `.claude`, `.github`, `docs`, `.gitignore`, `CLAUDE.md`, `PROMPTS.md` and `README.md`. If `.claude` or `.github` is missing, add its file by hand: **Add file → Create new file**, type the path as the name (`.claude/settings.json` or `.github/workflows/ci.yml`; typing each `/` creates a folder), paste the file's contents, and click **Commit changes**.
5. Because the repo is private, install the Claude GitHub app on it: open **github.com/apps/claude**, click **Install** (or **Configure**), choose **Only select repositories**, and pick `coldfront`.

## Part B · Start the first build session (about 5 minutes)

1. Go to **claude.ai/code** and sign in. Connect GitHub if it asks.
2. The **Default** environment it offers is fine. Its network setting ("Trusted") lets the agent install the tools it needs.
3. Pick the repository **`coldfront`** and the branch **`main`**.
4. **Model:** Opus 5.5. The repo turns on **ultracode** by itself (`.claude/settings.json`): the agent plans "workflows" that run many helper agents in parallel. It's the strongest setup, and it also uses your plan's usage faster. For a small fix, type `/effort ultracode off` in that session to turn it off there.
5. **Mode:** choose **Auto** (strongly recommended). The session runs for hours, and in Auto a safety check approves its routine actions, so it doesn't stop to wait for you. If Auto isn't offered, choose **Accept edits**. The repo already pre-approves routine commands, but in that mode the session stops to ask you before each workflow launch and waits until you approve.
6. *(Optional, saves the agent some trouble)* Open the environment's settings (the cloud icon above the message box, then the gear on **Default**), set **Network access** to **Custom**, tick **Also include default list**, and add these two lines so it can download its test browser:
   ```
   cdn.playwright.dev
   playwright.download.prss.microsoft.com
   ```
7. Type `/effort ultracode` and press Enter. (The repo already turns ultracode on; this makes sure, in case the settings file didn't upload.)
8. Open `PROMPTS.md`, copy **prompt 1 (Kickoff)**, paste it in and press Enter.

The session can run for a long time. **You can close the tab**; it keeps working, and you can check in from your phone.

## Part C · Get playable links (about 10 minutes, once; do it while the first session runs)

1. Sign up at **dash.cloudflare.com** (free).
2. Go to **Workers & Pages → Create application**, open the **Pages** tab, and choose **Connect to Git** (it may be labelled **Import an existing Git repository**). Authorise GitHub and pick **`coldfront`**, then **Begin setup**.
3. Fill in:
   - **Project name:** `coldfront`
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `packages/client/dist`
   - **Environment variables:** add `NODE_VERSION` = `22`
4. Click **Save and Deploy**. **The first build will fail**, because there's no game code on `main` yet. That's expected.
5. From now on, every branch the agent pushes gets its own link, like `https://claude-phase-1-1-foundations.coldfront.pages.dev` (long branch names get cut to 28 characters). The agent puts the exact link in its report. You can also find it:
   - in Cloudflare under **Workers & Pages → coldfront → Deployments** (click **Visit**)
   - on GitHub, next to each commit (the small status icon)
6. **Connected Cloudflare after a session had already pushed?** That branch gets its link at its next push. For a link right away, tell the session: "Push an empty commit so Cloudflare builds a preview."
7. If Cloudflare gave your project a different address (say `coldfront-abc.pages.dev`, because the name was taken), update the "Project name" line in `CLAUDE.md`. On GitHub: open the file, click the **pencil icon** (Edit), change the line, and click **Commit changes**. Only sessions started after that see the change.
8. Leave Cloudflare's **Web Analytics** switched off. The game's security settings block its tracking script.

## Part D · Review what a session did

1. Open the session at claude.ai/code and read the **report** at the end. It's also the description of the **pull request** on GitHub. If the session couldn't open the pull request itself, open it with the **Create PR** button at the top of the session's diff view, and paste the report in as its description.
2. Open the **preview link** and go through the **"Try this"** list.
3. Look at the **postcards**: the fixed screenshots the agent uses to prove terrain quality. They're shown in the report and saved in `docs/postcards/`.
4. Glance at the **check** on the pull request. A green tick means GitHub's automatic check passed; a red cross means the build or the tests failed there. The session sees it too and should fix it before it finishes. GitHub may email you about failed checks while a session is still working; you can ignore those until its final report.
5. Give feedback:
   - **Small things:** reply in the same session; it remembers the context.
   - **Specific spots:** leave comments on lines in the session's diff view.
   - **After playing:** use **prompt 3** in `PROMPTS.md`. Say what you saw, *where* (region, and the F3 coordinates if you can), and what you expected.
6. **Happy with it?** Merge the pull request into `main` (on GitHub: **Merge pull request**). Then start the next session on `main` with **prompt 2 (Continue)**.
7. **Not happy, or the phase isn't finished?** Don't merge. Either tell the same session what to change, or start a new session **on that pull request's branch** (not `main`) with prompt 2, so it continues from the latest work. The new session pushes to a branch of its own and opens its own pull request, which includes the old one's work: merge the newest pull request and close the older one.

## Part E · Everyday tips

- **Session rhythm:** early phases take one session; the big terrain phases (1.3–1.9) usually take 2–4. New sessions read `docs/progress.md`, so they don't need the old chat.
- **If you hit your usage limit mid-session:** the session stops where it is. Once your limit resets, open the same session at claude.ai/code and send prompt 2b from `PROMPTS.md` (or just type `continue`). If that session is gone, start a new one **on its pull request's branch** with prompt 2. The agent pushes after every step, so at most a few minutes of work is lost.
- **Let it run to a finish line.** For a long phase you can give the session a goal with `/goal`, and it keeps working until the goal is met. Copy one from `PROMPTS.md` §6. `/goal` alone shows progress; `/goal clear` stops it.
- **Show it what you like (optional).** Put screenshots of terrain you love (from Big Globe, other games, art) in `docs/references/<region>/`, for example `docs/references/hellscape/`. The agent's reviewers compare its work against them. They're for guidance only, never used in the game.
- **`main` is your "last good build".** Only merge what you've played.
- **Changing the design:** say what you want and add "update the docs to match", so every future session follows it.
- **Going in circles?** Stop the session and start fresh with the continue prompt (on the same branch), plus one sentence about what went wrong.
- **Costs:** sessions use your Claude plan's usage, and long ones use a lot, so if you hit a limit, wait for it to reset. Cloudflare's free tier (500 builds a month) is enough, because sessions skip builds for in-between commits, and GitHub's free minutes cover the automatic check. The multiplayer server (Milestone 5) will run on your own computer.

## Words you'll see

| Word | Meaning |
|---|---|
| Repository (repo) | The project's folder on GitHub |
| Branch | A copy of the project where a session makes changes, so `main` stays safe |
| Commit | One saved step |
| Pull request (PR) | A proposal to add a branch's changes to `main`, with a report |
| Merge | Accepting a pull request |
| Check (CI) | The automatic test run GitHub does on each pull request: a green tick or a red cross |
| Preview link | A playable build of one branch |
| Postcard | A fixed screenshot used to judge terrain quality |
| Seed | The number a world is generated from. Same seed, same world. |
| Ultracode | A setting (on in this repo) that makes the agent plan "workflows": many helper agents working in parallel. Stronger, and it uses your usage limit faster. `/effort ultracode off` turns it off for one session |
| Goal | A finish line you set with `/goal`; the session keeps working until it's met |
