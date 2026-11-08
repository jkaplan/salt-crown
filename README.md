# Salt Crown

A prototype survival roguelite set in a post-collapse salt wasteland. You march a warband of
mutants and salvaged machines across the map, and the fights along the way play out on their own
as an auto battler. The interesting part is getting your band to the end of the road alive.

It's a personal project and still early. Expect rough edges.

## Running it

```sh
npm install
npm run dev     # the game in the browser
npm test        # the test suite
```

Every other command is in [docs/COMMANDS.md](docs/COMMANDS.md).

## How it's built

TypeScript, PixiJS, React, Vite, and Vitest, split into npm workspaces:

```
packages/sim   the simulation: pure TypeScript, no browser code
packages/game  the content: units, mutations, encounters, as typed data
apps/web       the game in the browser, built on top of the sim
tools/         scripts that run thousands of simulated battles
```

The simulation is deterministic. Given the same starting state and random seed, a battle always
plays out the same way. That makes two things possible:

- **Replay tests.** Recorded battles are checked hash by hash, so any change to how combat
  behaves fails a test instead of slipping through.
- **Balance by measurement.** `npm run sim:batch` runs large numbers of battles and reports win
  rates, so balance questions get answered with numbers rather than guesses. It caught a lopsided
  matchup in what should have been a mirror match before any content was built on top of it.

## Docs

The design and planning docs are in [docs/](docs/). Start with [docs/V0-DESIGN.md](docs/V0-DESIGN.md)
for what the game is now, and [docs/PLAN.md](docs/PLAN.md) for the open questions it's betting on.

Built with [Claude Code](https://claude.com/claude-code) as a development partner.
