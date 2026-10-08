# 17 · Simulation, bots and dev tools

This doc is how the world stays cheap to run with hundreds of thousands of people in it, how time can be sped up and skipped while the game is built, the owner's tools for testing, and the bots that play kings. It expands `05-systems.md` §22 and `07-architecture.md` §9.

Every number is a starting value *(tune)* unless it is marked **fixed**.

---

## 1. The owner's rules (8 October 2026)

1. **Light on every front.** The world must stay cheap to simulate across hundreds of thousands of people and more. Whatever nobody is watching runs as code, probability and calculation. A rendering hiccup can be forgiven; a slow simulation can't.
2. **Things happen while you're away.** You wake up to what happened overnight.
3. **Development can't wait for players.** The owner can't play alone, so there must be ways to speed time up, skip forward in a way that looks natural, and cheat to test.
4. **Bots play like players.** A bot king makes the choices a player would, like a chess engine: in a given state, which resource matters most, which Warden to go for, where to expand. Bots serve development and playtests first, and can later fill a server when players are few.

## 2. How the world stays light

### 2.1 Attention decides detail

Each unit sits in one of four tiers by where players are looking (`05-systems.md` §22): T0 possessed, T1 near a camera, T2 loaded but unwatched, and T3, the **tally**, for everyone else. (The tally is the simulation's word; the Ledger is the in-game book of what a kingdom has learned.) Only T0 and T1 run Minecraft physics and pathfinding: a few thousand units at once. Everyone else is numbers.

### 2.2 The tally: rates, events and dice

- **A settlement is a set of numbers:** its people by class and needs tier, its stocks, its production and consumption rates, its loyalty and how it drifts, its buildings' integrity. Routes are flows of goods. Companies, caravans and war parties are strengths moving along a route graph.
- **Rates over time, not ticks.** The tally keeps each rate and the time it was last settled, and brings anything up to date in one step: stock + (in − out) × time passed. It works out when the next thing will happen (a store empties, a field ripens, winter starts, a war party arrives), puts it in a queue, and jumps from event to event. A quiet settlement costs nothing between events.
- **Dice for what's uncertain.** Births, deaths, illness, finds, desertions, the weather and the Deep's moves roll against set odds, from a seeded random stream for each settlement, so any run can be replayed exactly.
- **Battles nobody watches** are fought by the **regiment model**, in 1-second rounds *(tune)*. Each side is a set of groups (units of one class, grade and gear, and how many). Each round:
  1. **Damage.** A side deals the sum, over its groups, of the number of units × their damage a second × the share able to strike: a third for melee in a crowd (as `13-units-classes-power.md` §16 assumes), all of a ranged group within range.
  2. **Who takes it.** Each enemy group takes a share by its exposure: Assault and Guard count 3, Support and Secondary 1, mounted 2 (`13-units-classes-power.md` §12). Overmatch between the two groups' grades (§5.4 there) and armour against the attackers' most common damage type (§5.2) apply.
  3. **Losses.** A group loses its damage ÷ one unit's effective Health in units, the fraction rolled by dice. The fallen are Downed, and `13-units-classes-power.md` §18 decides who rises.
  4. **Ground and surprise.** Defenders on walls or high ground take 25% less and deal 25% more at range. The side that saw the other first (`16-sight.md` §8) doubles its first round's damage, as an unaware hit does.
  5. **Morale** (`05-systems.md` §8) starts from loyalty and falls 2 for each 1% of the side's strength lost, faster under Dread (`16-sight.md` §11) or attacked from two sides; officers and the king slow it. When a side has lost half its strength or its morale breaks, each unit's loyalty decides as §8 there says. The Deep's armies never break (§17 there).
  6. The battle ends when a side is gone, breaks or pulls back. Tests tune the model until it matches the same fight run with full units, within 10% on average.
- **Agreement:** every system has a version for units and one for the tally, and the two agree on average (`05-systems.md` §22). Tests compare them.

### 2.3 Catching up

- **On the server** (Milestone 5 on), the tally runs all the time. Offline kings are run by their officials and the offline AI (`05-systems.md` §2), and nothing waits for a player to look.
- **A solo world** (in the browser, from Milestone 3) can't run while its tab is closed. On load it catches up the time since it was last saved, up to 7 real days, through the tally, behind the loading bar. The news and the Chronicle say what happened, as if you had been away from a server.
- **When a camera arrives,** the tally's people are placed back in the world where the tally says they are, with the same identities and what they carry (`05-systems.md` §22, hydration).

### 2.4 Budgets

Measured with `npm run bench:sim` from Milestone 3 *(tune)*:

| What | Target |
|---|---|
| a settlement in the tally | no work between events; under 50 µs an event |
| a full server's tally (100 kings, 2 million people) | 2 ms of one core for each real second on average; a quarter of a core at its busiest |
| a bot king's choices | under 1 ms each; a look ahead under 50 ms, at most one a bot each in-game day |
| units at full detail | a few thousand at once (`07-architecture.md` §9) |
| catching up a solo world with up to 9 bot kings | a real week in under 2 minutes |
| a whole season with 100 bot kings and no screen (§5) | under 4 hours on one 8-core machine |

The last row follows from the others: a season is 4,368 real hours, so the tally costs about 9 core-hours and 100 bots about 12 more.

---

## 3. Time controls

- **Speed** (`tools.pace`): pause, × 1, × 2, × 5, × 10 or × 20. At high speed, units near the camera drop to T2 timing so the simulation keeps up; the picture may stutter, the simulation may not.
- **Skip ahead** (`tools.skip`): an in-game hour (2.5 real minutes), day (a real hour) or year (a real week). The world runs through the tally at full speed (the units near the camera are taken into the tally first and placed back after), and the news and the Chronicle record what happened. The same rules run, so the result looks natural.
- **On a server** (Milestone 5 on): only on a dev server, through the admin tools. Never on a live season.

## 4. The owner's cheats

The Tools panel (catalogue D12) holds them in every build through Milestone 4. From Milestone 5 they live on dev servers and in the admin tools (`07-architecture.md` §9).

| Tool | Does | Since |
|---|---|---|
| Speed | §3 | M2 |
| Skip ahead | §3 | M3 |
| Spawn | puts a person or a beast (M2), a war party (M4) or a rogue Calamity (M7) at the cursor | M2 |
| Give | a stack of any item to the selected person, or coin to the treasury | M2 |
| Level | sets the selected person's level; the grade follows (`13-units-classes-power.md` §9) | M2 |
| Time of year | jumps the calendar to the start of spring, summer, autumn or winter | M2 |
| Start event | begins a world event now, after its omens (`05-systems.md` §16) | M6 |
| See everything | `16-sight.md` §5.6 | M2 |
| Bot kings | how many bot kings, up to 9, share a new solo world (§6) | M4 |
| The AI's reasons | under `?dev`: why the selected person or bot king chose what it did, with its scores | M2 |

## 5. Whole-season runs

`npm run season -- --seed 1 --kings 100` plays a whole season with no screen: every king a bot, on the tally, at full speed. It writes a report to `out/season/` with:
- the winners, and where their score came from (`05-systems.md` §20)
- deaths by cause: the world (cold, hunger, the Deep, disasters) against other kings
- how novice bots did in their first days (§6.3), against the target in `05-systems.md` §2
- Calamities raised, gone rogue and slain, and how many lived at once
- the economy over time, and when each Warden fell
- warnings for anything off target, such as one personality winning most runs

Run it over a batch of seeds after any change that moves the numbers. It is the playtest the owner can't run alone.

---

## 6. Bot kings

### 6.1 What a bot king is

A kingdom whose player is the game. Everything under the king already runs itself: jobs, officials, supply routes and every person's own AI (`05-systems.md` §6). A bot makes only the player's decisions, at a player's pace: about once an in-game hour, and at once when news arrives.

### 6.2 The same rules

A bot sees only what its units see (`16-sight.md`), its orders travel like anyone's (`05-systems.md` §4), it pays for everything, and it has no owner tools. It never cheats, so it can stand in for a player.

### 6.3 How a bot decides

Like a chess engine, but sized for a game far bigger than chess: an opening book, an evaluation, and a short look ahead.

1. **The book.** Written playbooks, like chess openings: *Expand 101* (stockpile, fields, houses, a palisade, a watchtower, a second settlement by the third day), *Ready for winter*, *The first war party*, *Down to Layer 1*, *A Tier I Warden*. Each is a list of goals with the conditions that start and end them.
2. **The evaluation.** A score of the kingdom as the bot knows it: days of food and fuel, defence against the threats it has seen, growth, wealth, loyalty, coverage, and score within reach. Which resource matters most is the one that would raise that score most for one more unit of it, right now.
3. **The moves.** The same actions a player has: build, zone, dig, route, appoint, set policies, raise and send companies, trade, make treaties, raise a Calamity.
4. **The look ahead.** For big choices (where to expand, which Warden next, war or peace), it runs each candidate a few in-game weeks forward and keeps the best. It runs them on a model of the world as its people know it (its own kingdom, and what they have seen of the rest), with dice of its own, never on the real world's tally, so it can't foresee what a player couldn't. Small choices use the evaluation alone.
5. **Personality:** weights on the evaluation. Warlord, trader, builder, Warden hunter and turtle, and a **novice** that makes a first-timer's mistakes, for testing the first days.
6. **Difficulty:** how far it looks ahead, how good its book is, and how fast it reacts.

### 6.4 How bots get better

- **Whole-season runs** tune the weights: personalities play thousands of seasons against each other, and what wins is kept. The same runs expose strategies that break the game.
- **The book grows by hand:** when a run finds a strong line of play, it is written into the book. Weights and books are data in the repository, read by the game; nothing in the shipped game learns on its own.

### 6.5 Marked

A bot king is marked as a bot wherever kings are named (`rel.bot`). It scores and shows in the Standings like a player, and earns no titles or rewards.

### 6.6 Where bots play

- **Solo worlds** (Milestone 4 on): up to 9 rivals (`tools.bots`).
- **Dev servers** (Milestone 5 on): to fill a server to 100 kings for playtests and load tests, and in whole-season runs.
- **Live seasons,** only if the owner chooses to fill a thin server: bots take free places when a season starts and never join halfway.

---

## 7. Engineering

- **Where the code lives:** the tally in `packages/shared/src/tally/` (Milestone 3) and the bots in `packages/shared/src/bots/`, both shared and pure, so the solo worker, the server and the tools run the same code; whole-season runs in `packages/tools/season/`.
- **Repeatable:** every random stream is seeded, per settlement and per bot, so a run with the same seed and inputs plays out the same way, which makes bug reports reproducible.
- **Tests:**
  - the tally and the units agree on average, and nothing is lost or doubled going in or out of the tally (`07-architecture.md` §9)
  - an in-game day skipped and a day run at × 20 end with the same totals, within a set tolerance
  - a bot never starves on an easy seed, never attacks a king under the Steward's peace (`05-systems.md` §2), and never acts on what it couldn't see: tested by giving it a world where the truth differs from what its people saw
- **Benchmarks:** `npm run bench:sim` (Milestone 3) measures tally events a second, catch-up time and look-ahead time, and reports them as `bench:gen` does.

## 8. What ships when

| Phase | Simulation, bots and tools |
|---|---|
| M2 | the owner's speed, spawn, give, level and time-of-year tools; the AI's reasons under `?dev` |
| M3 | the tally, moved forward from Milestone 5; solo worlds that catch up on load; skip ahead; `bench:sim` |
| M4 | bot kings in solo worlds: book, evaluation and look ahead; spawning war parties |
| M5 | the tally on the server; bots on dev servers, marked; whole-season runs; the tools move to dev servers and the admin tools |
| M6 | starting world events |
| M7 | personalities and difficulty tuned by whole-season runs; spawning rogue Calamities; load tests toward 100 kings |
