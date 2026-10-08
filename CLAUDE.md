# COLDFRONT: Claude Code

The guide for every coding agent is `AGENTS.md`. It is imported here in full and its rules apply as written:

@AGENTS.md

## Notes for Claude Code only

- **Where you are.** A cloud session has `CLAUDE_CODE_REMOTE=true` and starts on a branch of its own. Anywhere else you're on the owner's computer. Either way, do `docs/12-sessions.md` §1 before you change anything.
- **Start-up hook.** In cloud sessions a hook in `.claude/settings.json` runs `npm ci` when `node_modules` is missing. If it reports a failure, run `npm ci` yourself. There's no hook on the owner's computer.
- **Images.** "Open the image" in golden rule 3 means the Read tool on the image file.
- **Long commands.** The shell tool waits 2 minutes by default (10 at most), then moves the command to the background. Start renders and benchmarks in the background yourself, with a log in `out/`.
- **Windows.** Your shell is Git Bash, but npm scripts still run under cmd.exe (`docs/12-sessions.md` §8).
- **`gh`.** In cloud sessions GitHub is reached through a proxy. `gh pr …` commands are pre-approved where they exist. Where a `gh` command is missing, or fails with "This GraphQL query is not enabled for this session", use the REST form it points to (`gh api repos/<owner>/<repo>/...`): that is the intended route, not a way around a block. REST can't mark a draft pull request ready, so if `gh pr ready` isn't available, say so in the report and the owner clicks **Ready for review**.
- **If you can't open or edit the pull request,** put the full report in your final message. The owner opens the pull request with the session's **Create PR** button.
- **Ultracode.** The owner turns it on for this repo (`.claude/settings.json`), so you plan workflows (scripts that run many helper agents in parallel) for substantive tasks. Use them for the cases under "Helper agents" in `AGENTS.md` and not for anything else. Implementer agents work in isolated worktrees that branch from your current `HEAD`. Workflows spend the owner's usage limit faster than ordinary work, and a limit stops the session, so keep them lean.
- **Goals.** If the owner has set a `/goal`, show the evidence in the conversation each turn (scores, test and build results, the pushed commit), because the goal's evaluator only reads the conversation.
