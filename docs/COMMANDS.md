# Commands

Every command in the repo and what it is for. The global rule: if an
invocation with flags gets typed twice, it becomes a named command before it is
typed a third time.

## Running and checking

| Command | What it is for |
|---|---|
| `npm run dev` | The game, in a browser, with hot reload. This is the only way to actually play it |
| `npm run build` | Production build of the web app |
| `npm test` | The whole suite. Includes the golden-seed replay that pins combat behaviour |
| `npm run test:watch` | The suite, re-running as you edit |
| `npm run typecheck` | `tsc --noEmit` across the workspace |
| `npm run lint` | ESLint across the workspace |

## Measuring the game

These are the instruments. Balance claims come from here, never from feel —
see [PLAN.md](PLAN.md) A3 for how much to trust the bot behind them.

| Command | What it is for |
|---|---|
| `npm run sim:campaign` | **The main one.** Plays full runs with a greedy bot and reports completion, water, wounds, the named tier and the chase. Flags: `--runs N`, `--pace column\|forced\|killing\|chase`, `--thrifty`, `--firstborn` |
| `npm run sim:batch` | Many battles at one matchup, for win rates and variance |
| `npm run sim:perf` | The same, reporting tick cost rather than outcomes |
| `npm run sim:matchup` | One matchup in depth |
| `npm run sim:leaders` | What a leader is worth per salvage |
| `npm run sim:why` | Why a given battle went the way it did |
| `npm run sim:golden` | **Re-records** the golden-seed hashes. Only after a deliberate combat change, and say so out loud when you do |

## Reading the codebase

| Command | What it is for |
|---|---|
| `npm run map` | Which of the game's quantities actually touch each other, and which are islands. Add a path to also write the raw data as JSON. See [research/system-map.md](research/system-map.md) |
