# COLDFRONT

A seasonal, ~100-player voxel civilization builder in the browser. You rule a kingdom from above and possess its people on the ground, pushing supply lines down a funnel-shaped world to break the strongholds of the Wardens and, finally, the King Below.

This repository starts as **design docs only**. AI coding sessions build the game from them, one phase at a time. This README is **your guide as the owner**. The coding agent reads `AGENTS.md` instead.

| File | What it is |
|---|---|
| `AGENTS.md` | Rules and workflow for the coding agent. Codex reads it by itself |
| `CLAUDE.md` | Claude Code's entry point: it pulls in `AGENTS.md` and adds a few Claude-only notes |
| `PROMPTS.md` | Prompts you paste into sessions (kickoff, continue, feedback, one screen…) |
| `docs/01-vision.md` … `docs/10-prior-art.md` | The design: vision, world, lore, terrain spec, systems, UI and art, architecture, roadmap, open questions, and the audit of open-source code we can reuse |
| `docs/11-interface-catalogue.md` | **The interface bible.** The cameras, the controls, and every screen, button, menu, slider, key and sentence in the game. If it isn't listed there, the agent doesn't build it |
| `docs/12-sessions.md` | How a session runs: screenshots, branches, pushes, preview links, and what differs between Codex and Claude Code |
| `docs/13-units-classes-power.md` | **People's rulebook.** How you play a unit (always from above), how people fight, learn and grow, and the power ladder up to the Calamity |
| `docs/14-class-library.md` · `docs/15-item-library.md` | Every class and skill, and every item, as tables the game is built from |
| `docs/16-sight.md` | **Sight.** What every unit can see, why you only see what your units see, how unseen land and the underground look, hiding and watchtowers, and how enemies notice and remember you |
| `docs/17-simulation-and-bots.md` | **Keeping the world light, and testing it alone.** How hundreds of thousands of people stay cheap to simulate, your tools to speed the world up, skip ahead and cheat, whole-season runs, and bot kings that play like players |
| `docs/18-look-and-feel.md` | **How it looks and moves.** The camera's feel, light and shaders, wind and weather, animation, effects, and the interface's motion |
| `docs/tools/ui-catalogue.mjs` · `docs/tools/content-check.mjs` | Small checkers for the catalogue and for the class and item libraries: they fail if a name is too long, a skill breaks its budget, a recipe uses an item that doesn't exist, and so on |
| `docs/progress.md` | The live progress log. Read this after each session. |
| `docs/diagrams/` | The world map and funnel diagrams (and the script that draws them) |
| `.claude/settings.json` | Claude Code's session settings: turns on ultracode at the highest reasoning effort, pre-approves routine commands (npm scripts, git), blocks force-pushes, pushes to `main` and merges as a safety net, and installs the project's packages when a cloud session starts. Codex doesn't read it |
| `.github/workflows/ci.yml` | The automatic check GitHub runs on every pull request (the green tick or red cross) |
| `.gitignore` | Tells git which generated files never to save |
| `.gitattributes` | Keeps line endings identical on Windows, Mac and Linux |

---

## What you need

- A **GitHub** account (you have one)
- **A coding agent.** Either works, and you can switch between sessions, because both follow `AGENTS.md`:
  - **Codex** (OpenAI), with a ChatGPT plan that includes Codex and the GPT-6.1 Sol model
  - **Claude Code** (Anthropic), with a Claude plan that includes it
- A free **Cloudflare** account, for playable preview links
- A desktop browser (Chrome, Edge or Firefox) on a computer with a decent graphics chip, for playtesting
- For sessions on your own computer (Parts B1 and B2): a Windows or Mac computer you can leave on

---

## Part A · Put the docs on GitHub (about 10 minutes, once)

1. Go to **github.com → New repository**.
   - Name: `coldfront`
   - Visibility: **Private** (recommended)
   - Leave "Add a README", ".gitignore" and "license" **unchecked**. The repo must start empty.
   - Click **Create repository**.
2. On the empty repo page, click **"uploading an existing file"**.
3. Drag in **everything** from this folder, including the hidden items whose names start with a dot: `.claude`, `.github`, `.gitattributes` and `.gitignore`. Your computer hides them by default:
   - **Mac:** in Finder, press **Cmd + Shift + .** (full stop) to show them.
   - **Windows:** in File Explorer, choose **View → Show → Hidden items**.

   Then click **Commit changes**.
4. **Check the upload.** The repo's front page should list `.claude`, `.github`, `docs`, `.gitattributes`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `PROMPTS.md` and `README.md`. If `.claude` or `.github` is missing, add its file by hand: **Add file → Create new file**, type the path as the name (`.claude/settings.json` or `.github/workflows/ci.yml`; typing each `/` creates a folder), paste the file's contents, and click **Commit changes**.
5. **Protect `main`** *(recommended; GitHub offers this on public repositories, and on private ones only with a paid GitHub plan. Without it, only the agent guide's own rule stops a push to `main`)*. `main` is your "last good build", and it should change only when you merge a pull request. On GitHub, open the repo's **Settings**, then **Rules → Rulesets** in the left sidebar, and click **New ruleset → New branch ruleset**. Type a **Ruleset name** (say `protect main`), change the enforcement status from **Disabled** to **Active**, under **Target branches** add a target that includes the default branch, tick the rules **Require a pull request before merging** (leave its **Required approvals** at 0) and **Block force pushes**, and click **Create**. Claude Code is also held back by its settings file; for Codex this rule is the safety net. After this, GitHub's own file editor also asks you to open a pull request for an edit, which is fine: merge it like any other.

## Part B · Start a build session

There are three ways to run a session. All three follow `AGENTS.md` and end the same way: a branch, a pull request with a report, and a preview link.

| | Where it runs | Good for |
|---|---|---|
| **B1 · Codex on your computer** | your Windows or Mac computer, which must stay on | building with Codex. In the desktop app it can also open the running game and look at it |
| **B2 · Claude Code on your computer** | your computer, which must stay on | building with Claude Code and playing each build the moment it's ready |
| **B3 · Claude Code in the cloud** | Anthropic's servers; your computer can be off | long sessions you check from your phone |

*Codex also has cloud tasks. When this guide was written (October 2026) they couldn't open a browser on the game, and it wasn't confirmed that they can take the screenshots this project relies on. Start with B1.*

### Install once, for B1 and B2

Windows steps, with Mac differences in brackets:
1. **Git:** download Git for Windows from **git-scm.com** and install it with the default options. *(Mac: usually installed already; typing `git` in Terminal offers to install it if not.)*
2. **Node.js 22:** from **nodejs.org**, install the 22.x LTS version. The game is built with it.
3. **GitHub CLI:** install it from **cli.github.com**. Then open PowerShell *(Mac: Terminal)*, run `gh auth login`, and choose **GitHub.com**, **HTTPS**, **Yes** when it asks to authenticate Git with your GitHub credentials, then **Login with a web browser**: it shows a one-time code to type into the page that opens. This lets the agent push its work, open pull requests and fetch preview links for you.
4. **Get the project.** In PowerShell or Terminal, run these two lines (use your own GitHub username):
   ```
   cd ~/Documents
   git clone https://github.com/<your-username>/coldfront
   ```

Before each session, plug the computer in and stop it sleeping while plugged in *(Windows: Settings → System → Power, sleep "Never"; Mac: System Settings → Battery → Options, prevent automatic sleeping on power adapter)*. A sleeping computer pauses the session.

### B1 · Codex on your computer

**Install Codex** (once): install the **ChatGPT desktop app** for Windows or Mac and sign in with your ChatGPT account. Codex is inside it. *(Prefer a terminal? In PowerShell run `powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"`; on a Mac run `curl -fsSL https://chatgpt.com/codex/install.sh | sh`.)*

**Start a session:**
1. In the desktop app, open the `coldfront` folder, choose **Codex**, and start a **New chat**. If it offers to work in a separate copy of the folder (a "worktree"), choose the folder itself. *(Terminal: run `cd ~/Documents/coldfront`, then `codex`, and pick **Sign in with ChatGPT** the first time.)*
2. **Model:** GPT-6.1 Sol. The model and reasoning control is under the message box *(terminal: type `/model`)*.
3. **Reasoning effort:** leave it at the default for interface work, and raise it to **High** for the big terrain phases (1.3–1.9). Max and Ultra use your plan much faster and this project doesn't need them.
4. **Permissions:** choose **Approve for me** in the permissions control under the message box *(terminal: `/permissions`)*. Codex then works inside the project folder without stopping for routine steps. It starts with the internet switched off, so it may still ask before it installs the project's packages, starts its screenshot browser, saves a commit or pushes to GitHub. Approve commands that begin with `npm`, `npx playwright`, `node`, `git` or `gh`. Refuse anything that pushes to `main`, and for any other command you don't recognise, ask it to explain first. You shouldn't need **Full access**, which lets it reach any file on your computer.
5. **Check that it read the guide.** Send: `Summarize the instructions you were given for this repository in five lines.` The answer should mention the interface catalogue and never pushing to `main`. If it doesn't, you opened the wrong folder, or the pull request that adds `AGENTS.md` hasn't been merged into `main` yet.
6. Open `PROMPTS.md`, copy **prompt 1 (Kickoff)**, paste it in and send it.

*These steps and labels were checked against OpenAI's documentation in October 2026. The app changes often: if a label has moved, look for the same idea nearby.*

**While it runs,** leave the computer on and Codex open. To play a build before Cloudflare has it, ask the session: "Start the dev server and give me the local link."

**Next sessions:** open the folder the same way, start a new chat, and paste prompt 2. You don't pick a branch; the agent finds the right one.

**Session stopped** (a usage limit, a closed window, a restart): reopen the chat from the app's list *(terminal: run `codex resume` in the `coldfront` folder)*. Then send prompt 2b.

**What to expect from Codex.** It is strong at engineering and weak at interface taste. Left alone it pads screens with subtitles, helper lines, cards and decoration, and it tends to call a screen finished without looking at it. This repo pushes back in three ways: the catalogue lists every control and every sentence that may exist; automatic checks reject text and controls that aren't listed, both in the code and on the rendered page (the first build session writes these checks, before its first screen); and the guide makes the agent take screenshots, open them, and report what it read in them. Your part:
- A phase builds its own screens as part of prompts 1 and 2. For anything beyond that (a screen redone, a new one added), give it **one screen per task** (prompt 8). Small, exact tasks come back cleaner than "build the UI".
- When something looks wrong, send a screenshot and say which screen (prompt 9). If you dislike what the catalogue itself says, tell it to change the catalogue first.
- Open the **gallery** (add `/?gallery` to any preview link) to see every screen without playing to it.

### B2 · Claude Code on your computer

**Install Claude Code** (once): use the Claude desktop app's **Code** tab, or install the terminal version: in PowerShell, run `irm https://claude.ai/install.ps1 | iex` *(Mac: `curl -fsSL https://claude.ai/install.sh | bash`)*. Git for Windows also gives Claude Code the "Git Bash" shell the project's commands expect.

**Start a session:**
1. Open Claude Code in the `coldfront` folder:
   - **Desktop app:** Code tab → **Local** → choose the `coldfront` folder. Leave the worktree option off.
   - **Terminal:** run `cd ~/Documents/coldfront`, then `claude`.
2. **Model:** Opus 5.5 (`/model` in the terminal). **Mode:** Auto (the terminal version starts in it; in the app, pick it from the mode menu).
3. Type `/effort ultracode` and press Enter.
4. *(Optional)* Type `/remote-control` to follow and steer the session from your phone (the Claude app) or claude.ai/code.
5. Paste **prompt 1 (Kickoff)** from `PROMPTS.md`.

**While it runs,** leave the computer on and Claude Code open. To play a build before Cloudflare has it, ask the session: "Start the dev server and give me the local link."

**Next sessions:** open the folder the same way and paste prompt 2. You don't pick a branch; the agent finds the right one.

**Session stopped** (a usage limit, a closed window, a restart): open the folder again. In the terminal, run `claude --continue` to pick up the last conversation; in the app, reopen the session from the list. Then send prompt 2b.

### B3 · Claude Code in the cloud (about 5 minutes)

The cloud keeps working while your computer is off, and you can check in from your phone.

1. If the repo is private, install the Claude GitHub app on it first: open **github.com/apps/claude**, click **Install** (or **Configure**), choose **Only select repositories**, and pick `coldfront`.
2. Go to **claude.ai/code** and sign in. Connect GitHub if it asks.
3. The **Default** environment it offers is fine. Its network setting ("Trusted") lets the agent install the tools it needs.
4. Pick the repository **`coldfront`** and the branch **`main`**.
5. **Model:** Opus 5.5. The repo turns on **ultracode** by itself (`.claude/settings.json`): the agent plans "workflows" that run many helper agents in parallel. It's the strongest setup, and it also uses your plan's usage faster. For a small fix, type `/effort ultracode off` in that session to turn it off there.
6. **Mode:** choose **Auto** (strongly recommended). The session runs for hours, and in Auto a safety check approves its routine actions, so it doesn't stop to wait for you. If Auto isn't offered, choose **Accept edits**. The repo already pre-approves routine commands, but in that mode the session stops to ask you before each workflow launch and waits until you approve.
7. *(Optional, saves the agent some trouble)* Open the environment's settings (the cloud icon above the message box, then the gear on **Default**), set **Network access** to **Custom**, tick **Also include default list**, and add these two lines so it can download its test browser:
   ```
   cdn.playwright.dev
   playwright.download.prss.microsoft.com
   ```
8. Type `/effort ultracode` and press Enter. (The repo already turns ultracode on; this makes sure, in case the settings file didn't upload.)
9. Open `PROMPTS.md`, copy **prompt 1 (Kickoff)**, paste it in and press Enter.

The session can run for a long time. **You can close the tab**; it keeps working.

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
5. From now on, every branch the agent pushes gets its own link, like `https://codex-phase-1-1-foundations.coldfront.pages.dev` (long branch names get cut to 28 characters). The agent puts the exact link in its report. You can also find it:
   - in Cloudflare under **Workers & Pages → coldfront → Deployments** (click **Visit**)
   - on GitHub, next to each commit (the small status icon)
6. **Connected Cloudflare after a session had already pushed?** That branch gets its link at its next push. For a link right away, tell the session: "Push an empty commit so Cloudflare builds a preview."
7. If Cloudflare gave your project a different address (say `coldfront-abc.pages.dev`, because the name was taken), tell the next session: "My Cloudflare project is `coldfront-abc`. Update the project name in `docs/12-sessions.md`." Until that change is merged, the links agents predict will be wrong, but the ones they read from GitHub are right.
8. Leave Cloudflare's **Web Analytics** switched off. The game's security settings block its tracking script.

## Part D · Review what a session did

1. Read the **report** at the end of the session. It's also the description of the **pull request** on GitHub. If the session couldn't finish that part, it says so at the top of its report:
   - *It couldn't push:* reply "Push the branch and open the pull request", and approve the request.
   - *It pushed but couldn't open the pull request:* on GitHub, open **Pull requests → New pull request**, pick the session's branch, and paste the report in as the description. (Right after a push, the repo's front page also shows a **Compare & pull request** banner. In a Claude cloud session, use the **Create PR** button at the top of the diff view.)
   - *The pull request says "Draft":* click **Ready for review** before you merge it.
2. Open the **preview link** and go through the **"Try this"** list.
3. Look at the **postcards**: the fixed screenshots the agent uses to prove terrain quality. They're shown in the report and saved in `docs/postcards/`.
4. For interface work, open the **gallery**: the preview link with `/?gallery` on the end. It shows every screen and state built so far, with sample data. Nothing should be on a screen that you can't find in `docs/11-interface-catalogue.md`.
5. Glance at the **check** on the pull request. A green tick means GitHub's automatic check passed; a red cross means the build or the tests failed there. The session sees it too and should fix it before it finishes. GitHub may email you about failed checks while a session is still working; you can ignore those until its final report.
6. Give feedback:
   - **Small things:** reply in the same session; it remembers the context.
   - **After playing:** use **prompt 3** in `PROMPTS.md`. Say what you saw, *where* (region, and the F3 coordinates if you can), and what you expected.
   - **A screen that looks or reads wrong:** use **prompt 9**, with a screenshot.
   - **A camera or a control that feels wrong:** use **prompt 10**.
7. **Happy with it?** Merge the pull request into `main` (on GitHub: **Merge pull request**). Then start the next session with **prompt 2 (Continue)**.
8. **Not happy, or the phase isn't finished?** Don't merge. Tell the same session what to change, or start a new session and paste prompt 2. On your own computer the agent continues on the open pull request's branch by itself. In a Claude cloud session, start the new session **on that pull request's branch** (not `main`); it pushes to a branch of its own and opens its own pull request, which includes the old one's work: merge the newest pull request and close the older one.

## Part E · Everyday tips

- **Session rhythm:** early phases take one session; the big terrain phases (1.3–1.9) usually take 2–4. New sessions read `docs/progress.md`, so they don't need the old chat.
- **If you hit your usage limit mid-session:** the session stops where it is. Once your limit resets, reopen the same session and send prompt 2b from `PROMPTS.md` (or just type `continue`). If that session is gone, start a new one with prompt 2. The agent pushes after every step, so at most a few minutes of work is lost.
- **Let it run to a finish line.** For a long phase you can give the session a goal with `/goal`, and it keeps working until the goal is met. Copy one from `PROMPTS.md` §6. `/goal` alone shows progress; `/goal clear` stops it. (Those goals were written for Claude Code; the note there says what to change for Codex.)
- **Show it what you like (optional).** Put screenshots of terrain you love (from Big Globe, other games, art) in `docs/references/<region>/`, for example `docs/references/hellscape/`. The agent's reviewers compare its work against them. They're for guidance only, never used in the game.
- **`main` is your "last good build".** Only merge what you've played.
- **Changing the design:** say what you want and add "update the docs to match", so every future session follows it.
- **Changing the interface:** say what you want and add "change the catalogue first". The catalogue is what every later session builds from, so a change that skips it gets undone.
- **Going in circles?** Stop the session and start fresh with the continue prompt, plus one sentence about what went wrong.
- **Switching agents:** nothing to convert. Codex and Claude Code read the same guide and the same docs, and each picks up from `docs/progress.md` and the open pull request.
- **Costs:** sessions use your plan's usage, and long ones use a lot, so if you hit a limit, wait for it to reset. Cloudflare's free tier (500 builds a month) is enough, because sessions skip builds for in-between commits, and GitHub's free minutes cover the automatic check. The multiplayer server (Milestone 5) will run on your own computer.

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
| Catalogue | `docs/11-interface-catalogue.md`: the full list of what the interface contains |
| Gallery | A page in every build (`/?gallery`) that shows each interface screen with sample data |
| Seed | The number a world is generated from. Same seed, same world. |
| Possess | Playing one of your people yourself (Tab) |
| Overhead | How you see the person you play: from above, the camera following them (the wheel zooms, the arrow keys turn and tilt) |
| Sight | What a unit can see: a cone in front of it, farther by day and from higher up. You only see what your units see |
| Band | Your short list of people to switch between while playing (`,` and `.`) |
| Calamity | The strongest kind of person: one can break a small kingdom, and holding on to one is hard. Five kinds: Sellsword, Idol, Wildfire, Bastion, Oathsworn |
| Bot king | A kingdom the game plays by the same rules as a player, marked "Bot". For testing first |
| World speed · Skip ahead | Your tools (Tools panel) to run the world faster, or jump an hour, a day or a week ahead |
| Reasoning effort | How long the model thinks before it acts. Higher is slower and uses more of your plan |
| Ultracode | A Claude Code setting (on in this repo) that makes the agent plan "workflows": many helper agents working in parallel. Stronger, and it uses your usage limit faster. `/effort ultracode off` turns it off for one session |
| Goal | A finish line you set with `/goal`; the session keeps working until it's met |
