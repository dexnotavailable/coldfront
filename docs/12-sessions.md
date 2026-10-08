# 12 · Sessions and environment

How a coding session runs: where it works, how it gets a browser for screenshots, how work reaches GitHub, and what differs between tools. `AGENTS.md` holds the rules; this doc holds the detail behind them. Read it before your first render, push or report in a session.

Everything here is written as "if this works, do it; if it doesn't, do that". Tools and their sandboxes change, so test instead of assuming, and follow golden rule 13: if the environment refuses an action, don't go around it.

---

## 1. Where you are

A session runs in one of two places:

- **A cloud session:** a fresh machine with a copy of the repo. Claude Code sets `CLAUDE_CODE_REMOTE=true` there. A Codex cloud task is the same idea.
- **The owner's computer** (Windows or Mac): the owner's own clone, their own hardware, and their own sign-ins.

If you can't tell which, behave as on the owner's computer. It's the careful choice.

**At the start of every session, before you change anything:**
1. Run `git status` and `git log --oneline -15`.
2. **On the owner's computer, whatever branch is checked out:** run `git fetch origin`. If an open pull request from an earlier session exists (`gh pr list --state open`), switch to its branch and bring it up to date (`git pull --ff-only`). Otherwise create `<agent>/<phase>-<short-name>` from `origin/main`, where `<agent>` is `codex` or `claude` (for example `codex/phase-1-1-foundations`). A branch whose pull request was already merged is finished: don't build on it.
3. **In a cloud session** that started on a fresh branch of its own, keep that branch. If it started from another open pull request's branch, your pull request replaces that one: the report starts with "Replaces #<n>: merge this one and close #<n>."
4. **Never work on `main`.** If you still find yourself on it after steps 2 and 3, make the branch now.
5. Changes you find already sitting in the working tree are someone's unsaved work. Don't discard them. If they belong to the open pull request's phase, carry on from them; otherwise leave them alone and mention them in the report.
6. If `node_modules` is missing or out of date, run `npm ci`.

If `git fetch` or `gh` isn't possible where you are (no network, no sign-in), do what you can of the above from the local clone and say so in the report.

---

## 2. Screenshots need a browser

Every visual claim rests on an image you opened (golden rule 3). Postcards and interface screenshots are both taken by Playwright in headless Chromium.

**Headless WebGL works through software rendering (SwiftShader).** Tested on 2026-09-29 in an Anthropic cloud container (Chromium 141, Playwright 1.56):
- Launch Chromium with `args: ['--enable-unsafe-swiftshader']`. That gives WebGL2 and a correct Three.js render.
- Do **not** add `--use-angle=swiftshader`; it hung in testing.
- Rendering is slow but workable: about 1 s per frame at 1M triangles, and 7–9 s at 4M with shadows and bloom. Chunk generation, not rendering, dominates postcard time. Follow the postcard-mode rules in `04-terrain.md` §14.3 (no render loop, no upload cap, capture in the page).
- Use the same launch flags on every machine, so images look the same wherever they're rendered.

**Getting a browser:**
1. If `PLAYWRIGHT_BROWSERS_PATH` is set or `/opt/pw-browsers` exists, browsers are pre-installed. Don't run `playwright install`.
2. **Pin `playwright` to an exact version** (no `^`) that matches the pre-installed browser build (1.56.x matched Chromium build 1194), so a later install can't drift. If they still don't match, launch with `executablePath: '/opt/pw-browsers/chromium'`.
3. If no browser exists, run `npx playwright install chromium`. On the owner's computer this works. If a network allowlist blocks it, run `npx @puppeteer/browsers install chrome-headless-shell@stable` (retry with an explicit version number if the version lookup is blocked). It downloads from `storage.googleapis.com`. Pass that binary as `executablePath`. **Don't add `puppeteer` to package.json**: its install step would download Chrome on every Cloudflare build.
4. If your sandbox stops the browser from starting, ask for approval through your tool's normal prompt.
5. If none of that works, say so at the top of the report and ask the owner to allow the download (README Part B3, step 7, for a Claude cloud session). Until a browser runs, make no visual claims.

**Opening the images.** Use your tool's image viewer on the files in `out/` (Claude Code: the Read tool; Codex: its image-viewing tool). A screenshot you didn't open counts as not looked at. An in-app browser pointed at the dev server is fine for a quick look while you work, but the evidence in a report comes from the files the scripts wrote.

---

## 3. Network and installs

- Package registries and GitHub are usually reachable; most other sites are not. Some sandboxes start with the network off and ask the owner before each use.
- Nothing in the game or its build may download at run time, at build time or at install time (a browser, a font, a model). Everything comes from npm and is bundled (golden rule 6).

---

## 4. Git and GitHub

- **Commit after each working step and push after every commit.** A usage limit can stop a session without warning, a cloud machine gets recycled, and a computer can sleep: unpushed work can be lost.
- **Check that each push landed:** `git status` should say the branch is up to date with its remote. If a push fails, retry once; if it still fails, keep committing and say so at the top of the report.
- **Save builds.** Every push builds a Cloudflare preview (the free plan allows 500 builds a month), and once the pull request exists, every push also runs CI. **Start** the message of in-between commits with `[skip ci]`: Cloudflare honours it only at the start, GitHub anywhere. Leave it off the first playable push and the last push of the session, so those get a preview link and a CI run.
- **`main` is the owner's.** Never commit to it, push it or merge into it. The owner merges pull requests on GitHub.
- **The pull request.** Open a draft after the first playable push (`gh pr create --draft --title "<phase>: <summary>" --body-file <file>`) and keep its description current (`gh pr edit <n> --body-file <file>`). Mark it ready (`gh pr ready <n>`) when the phase is done.
- **`gh`.** On the owner's computer it must be installed and signed in by the owner (README Part B). In a Claude Code cloud session GitHub is reached through a proxy: some `gh pr …` commands may be missing there, and some fail with "This GraphQL query is not enabled for this session". In both cases use the REST form (`gh api repos/<owner>/<repo>/...`), which is the intended route. REST can't mark a draft pull request ready: if `gh pr ready` isn't available, say so in the report, and the owner clicks **Ready for review**.
- **If you can't commit, push or open the pull request** (a read-only `.git`, no network, no `gh`): ask through your tool's approval prompt, once for each kind of action. A refusal is final for that action in this session. Then leave the work as far along as you can get it (committed, or at least saved in the working tree), put the full report in your final message, and say at its top what the owner has to do: push the branch, or open the pull request on GitHub (**Pull requests → New pull request**, or the **Compare & pull request** banner).

---

## 5. CI, Cloudflare and preview links

- **CI:** `.github/workflows/ci.yml` runs check, test and build (and, once `test:golden:browsers` exists, the golden hashes in three browsers) on every pull-request push that isn't marked `[skip ci]`. Read the result with `gh pr checks <n>`, or the commit's check runs. A red CI means something is broken: fix it before you finish.
- **Match Cloudflare's build before the final push.** Cloudflare installs with `npm ci` on Node 22 in a clean checkout, then runs `npm run build`. Reproduce that in a throwaway checkout of your last commit: `git worktree add --detach <temp-dir>/cf-check HEAD`, run `npm ci` and `npm run build` inside it (for example with `--prefix <temp-dir>/cf-check`), then `git worktree remove --force <temp-dir>/cf-check`.
- **Preview links.** Cloudflare Pages builds every pushed branch and posts the preview URL on the pull request and on the commit. **Read the real link** (`gh pr view <n> --comments`, or the commit's `gh api repos/<owner>/<repo>/commits/<sha>/status` and `.../check-runs`) and put it in the report.
  - If it isn't there yet, give the predicted alias: `https://<alias>.<PROJECT>.pages.dev`. The alias is the branch name, lowercased, with non-alphanumerics turned into `-`, trimmed of leading and trailing `-`, and **truncated to 28 characters**. Say that it may take a few minutes to appear.
  - **Project name:** `coldfront`. *(Owner: change this if your Cloudflare project has a different address.)*
  - If the owner hasn't connected Cloudflare yet, say the link will appear once they do (README Part C).
- **The interface gallery** is part of every build through Milestone 4: `<preview link>/?gallery`. Link it in any report that touches the interface.

---

## 6. Images in reports

- Relative paths don't render in pull-request descriptions. Use `https://github.com/<owner>/<repo>/blob/<commit-sha>/docs/postcards/m1/<file>.jpg?raw=true`, with the SHA of the commit that added the image.
- Committed images are 1280 × 720 JPEGs: phase-end postcards in `docs/postcards/m1/`, plus small work-in-progress sheets in `docs/postcards/wip/` (under 1 MB in total, overwritten each time): at most one contact sheet per touched region, and one named `ui.jpg` for the interface screens you touched.
- Never commit `out/`.

---

## 7. Long commands

Most tools stop waiting for a shell command after a couple of minutes, and some stop the command itself. Run postcards, `ui:shots`, `bench:gen` and the browser golden test in the background with their output going to a log in `out/`, and read the log; or split postcard runs with `--only`. Never run a benchmark alongside a render, and never run two renders at once: headless Chromium on SwiftShader uses several cores by itself, and cloud machines are small (2 to 4 cores, 8 to 16 GB).

---

## 8. On the owner's computer

- **Windows:** npm scripts run under cmd.exe on Windows and under `sh` on Cloudflare and CI, so every script must work in both. Call `node`, `vite` or `vitest` directly, or a small Node script. Keep `FOO=1 cmd` prefixes, `rm -rf` and other shell-only syntax out of `package.json`, and use Node's `path` functions in tools. Line endings are LF everywhere (`.gitattributes`).
- **Hardware varies.** Don't assume a cloud machine's 4 cores. Still render in one process, never alongside a benchmark.
- **Let the owner play at once.** Besides the Cloudflare link, the report's "What you can try" gives the local way in: `npm run dev` and the link it prints.
- The computer can sleep or the window can close mid-session, so push after every commit, as always.

---

## 9. Notes per tool

**Codex**
- It reads `AGENTS.md` from the repo root, and nothing else by default. `CLAUDE.md` is not for it.
- On the owner's computer its sandbox usually starts with the network off and keeps `.git` read-only, so installing packages, committing, pushing, `gh` and starting a headless browser can each need the owner's approval. Ask through the normal prompt; don't hunt for another route (§4 says what to do when the answer is no).
- In a cloud task you may not be able to push or open the pull request yourself: the owner does that from the task's page. Finish as §4's last bullet says.
- The ChatGPT desktop app has a built-in browser that can open the dev server and take screenshots. The command-line and editor versions don't. Either way, `npm run ui:shots` and `npm run postcards` produce the images of record, and you open those files with your image viewer (`view_image`).
- Work in the project folder itself, not in a separate worktree copy of it, unless you are a helper agent that was given one: the branch check in §1, `node_modules` and `out/` all live in the main folder.
- The owner picks the model and the reasoning effort. Don't change them, and don't ask the owner to.

**Claude Code**
- It reads `CLAUDE.md`, which imports `AGENTS.md` and adds what is specific to it (the start-up hook, ultracode and workflows).
- `.claude/settings.json` pre-approves routine commands and blocks force-pushes, pushes to `main` and merges. It is the owner's file (golden rule 12).
