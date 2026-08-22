# Tech Stack Decision

## Verdict: TypeScript + PixiJS + React, no game engine

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Your strongest language. Strict mode matters — this game is a pile of interacting data schemas. |
| Sim core | Plain TS, zero deps | Deterministic, headless, testable, portable. No engine imports, ever. |
| Battle renderer | PixiJS v8 (WebGL/WebGPU) | Sprite batching handles 10k+ sprites. Far more than we need. |
| Meta UI | React 19 + Vite | ~70% of this game is UI: roster, wounds, expeditions, shop, formation editor. React crushes engine UI toolkits here. |
| State | Zustand | Meta-layer state only. Battle state must never touch React. |
| Testing | Vitest | Golden-seed replay tests are the backbone of balance work. |
| Package manager | npm workspaces | pnpm needs admin here (corepack cannot write to the laragon Node dir). Functionally identical for this repo. |
| Phone (later) | Capacitor | Wraps the same web build for iOS/Android. Add at M5, not before. |
| Steam (later) | Tauri | Only if you go commercial. |

## Why not Godot / Unity

Both are the right answer for a game whose hard problem is rendering, physics, or 3D. Your hard problems are **data modeling and UI density** — 100+ fighters with wound states, equipment, squad assignments, and expedition status. Building that in Godot `Control` nodes or Unity uGUI is slow, painful work that React does for free.

**Reconsider an engine if** you hit any of: real-time physics, 3D, >2000 simulated entities, or a controller-first console port.

## The one architectural rule that matters

```
packages/sim   →  pure TypeScript. No Pixi, no React, no DOM, no Math.random, no Date.now.
packages/game  →  content data (units, items, encounters) as typed objects.
apps/web       →  Vite + React + Pixi. Imports sim. Sim never imports this.
```

The sim takes `(state, inputs, seed) → newState` and nothing else. This buys you:

1. **Headless batch simulation** — run 10,000 battles in a script to tune balance. Non-negotiable for this game: you cannot hand-playtest your way to a 10% break-run rate.
2. **Replay from seed** — bug reports become a seed string.
3. **Real unit tests** on combat math.
4. **Web Worker offload** later, for free.

## Determinism rules

- Seeded PRNG (splitmix32 or xoroshiro128+). `Math.random` is banned in `packages/sim` — enforce with an ESLint rule.
- Fixed timestep: sim runs at **20 Hz**, render interpolates at 60fps. Never tie sim to frame time.
- Avoid `Math.sin/cos/pow/exp` inside the sim — last-bit results are not spec-guaranteed across JS engines. Use lookup tables or integer math. (Only bites you on cross-device replay; cheap to do right from day one.)

## Performance — measured at M0

Run it yourself with `npm run sim:perf`. Desktop, pure sim, no rendering. *Headroom* is how many times faster than realtime the sim runs at 20 Hz:

| Per side | Total entities | ms/tick | Headroom |
|---|---|---|---|
| 50 | 100 | 0.031 | 1619× |
| 110 | **220** | 0.043 | **1155×** |
| 220 | 440 | 0.137 | 365× |
| 500 | 1,000 | 0.560 | 89× |
| 1,000 | 2,000 | 0.905 | 55× |
| 2,000 | 4,000 | 3.143 | 16× |
| 4,000 | 8,000 | 8.079 | 6.2× |

**The spec's 220-entity budget was too conservative by roughly three orders of magnitude.** At 8,000 entities the sim still runs 6× faster than realtime on desktop; phones are ~3–6× slower, so even that holds. Simulation cost is simply not the constraint for anything V0 will field.

Which means the ceiling is set by **rendering and GC**, exactly as predicted. Use the in-app probe (Run probe) on a real device to find it.

**Observed with rendering (desktop, M0):** 2,000 per side — 4,000 sprites — runs smoothly. So the render path isn't the constraint at V0 scale either. Phone numbers are still unmeasured; that's an M5 job.

The actual bottlenecks, in order:

1. **GC pressure** from per-tick allocation. Fix: object pools, struct-of-arrays with typed arrays, no `{x,y}` literals in the tick loop.
2. **React re-rendering during battle.** Fix: battle state lives entirely outside React; the battle view is one `<canvas>` React never re-renders.
3. Spatial queries for targeting. Fix: uniform grid bucketing over unit positions. Cheap — units auto-arrange into melee/ranged lines, so positions stay well-clustered.

Do not build the hybrid-aggregation fallback in V0. Build the *measurement* in M0, find the real ceiling, then decide. The two-tier unit design in V0-DESIGN.md gives you aggregation as a **design feature** rather than a perf hack.
