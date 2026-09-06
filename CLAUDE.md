# Salt Crown

Run-based **overland survival roguelite whose battles resolve as a pure auto battler**. Post-collapse wasteland, Caves of Qud tone. March a warband of mutants, True Kin and salvaged machines across the salt; watch it clash; manage the attrition.

**The focus shifted on 2026-09-05** — this was a pure auto battler until then, and a lot of the docs still read that way. The road became the spine of a run rather than the gap between fights. See [docs/V0-DESIGN.md](docs/V0-DESIGN.md) §16 for what changed and why; that section is authoritative where an older passage disagrees.

Structural model is *Oregon Trail* (the march is the game: distance, supply, and who survives it), crossed with *How Many Dudes?* (roguelike autobattler, no positioning, depth from unit variety + modifiers), *Battle Brothers* attrition and *Caves of Qud* worldbuilding.

## Docs

- [docs/PLAN.md](docs/PLAN.md) — **what this project is betting on.** The assumptions table, ranked by what breaks. Read it before proposing work; update it when a decision changes what is being assumed.
- [docs/VISION.md](docs/VISION.md) — long-term vision. Aspirational, not the build target.
- [docs/TECH.md](docs/TECH.md) — stack decision and architecture rules.
- [docs/V0-DESIGN.md](docs/V0-DESIGN.md) — what V0 actually is. **Read before proposing design changes.**
- [docs/ROADMAP.md](docs/ROADMAP.md) — milestones M0–M5.
- [docs/UX.md](docs/UX.md) — the interface system. **Follow it instead of improvising per-screen.**

## Stack

TypeScript (strict) · PixiJS v8 · React 19 · Vite · Vitest · npm workspaces

## Architecture rules — do not violate

```
packages/sim   pure TS. No Pixi, no React, no DOM, no Math.random, no Date.now.
packages/game  content data (units, mutations, bionics, encounters) as typed objects.
apps/web       Vite + React + Pixi. Imports sim. Sim NEVER imports this.
```

1. **The sim is deterministic.** `(state, inputs, seed) => newState`. Seeded PRNG only. Same seed, same result, always. Golden-seed replay in `packages/sim/test/golden.test.ts` pins recorded hashes mid-battle and at the end. If one fails you changed combat behavior — say so explicitly, then re-record with `npm run sim:golden`. Never paste new numbers in to make it green.
2. **Fixed timestep, 20 Hz.** Render interpolates at 60fps. Never tie sim advancement to frame time.
3. **Battle state never enters React.** The battle view is one canvas React does not re-render.
4. **No allocation in the tick loop.** Object pools / typed arrays. GC pressure is the real perf risk, not entity count.
5. **Avoid `Math.sin/cos/pow/exp` in the sim** — not bit-identical across JS engines, which breaks cross-device replay.

## Terminology

| Term | Means |
|---|---|
| **Lineage** | True Kin / Mutants / Machines. The three unit pools. Never call these "families". |
| **House** | A True Kin caste family. Houses war with each other. Mutants and Machines have none. |
| **Officer** | Named tier, True Kin, recruited. |
| **Firstborn** | Named tier, Mutant. Not recruited — promoted from a fodder mutant that survived. |

## Design invariants

- **Pure auto battler.** No positioning, no in-battle commands, no counter-triangle. Depth comes from composition under economic pressure, plus mutations and bionics. Do not reintroduce any of the three cut layers.
- **Three tiers.** **Officers** (True Kin, named) → **Prospects** (mutants with mutations; individually named, simulated, and permanently killable; ~1 per dozen recruited; they are the Firstborn pipeline) → **Fodder** (anonymous squads by type, **no mutations at all**). Never give fodder mutations or per-body tracking; never make Prospects anonymous.
- **One leader per squad, either kind.** An Officer grants a flat stat bonus; a leading Prospect grants discipline only (bigger once they are Firstborn) — never their own mutations. Mutations stay with the body that has them; there is no mechanism for one body's mutation to apply to another's stats. A Prospect can only lead mutant squads — never True Kin. Never let both apply to the same squad at once.
- **Lineages don't counter each other.** They differ by cost, reliability, and upgrade path.
  - Mutants: cheap fodder, physically frail, random mutations at random levels, gain more by surviving
  - True Kin: rare, durable, reliable. No mutations; bionics installed from ruin finds
  - **Mutants can never take bionics** — their bodies can't carry the implants. Mutations and bionics are mutually exclusive per unit, and that exclusivity is what keeps the two lineages distinct. Do not relax it.
  - Machines: **never purchasable** — found in ruins only, arrive at full power, only degrade, permanent when destroyed
- **Armor is flat reduction**, not percentage.
- **Battles are fought to the finish and losing ends the run.** Nobody flees. There is **no routing, withdrawal threshold, posture, or pre-battle order** — every one of those cuts the mass-battle climax short, and composition is the only pre-battle decision.
- **Morale is a damage multiplier, not an exit.** `effectiveness = discipline + (1 - discipline) × (alive / started)`. Mutants 0.35 (fold fast), True Kin 0.78 (hold), Machines 1.0 (never degrade). Fewer bodies *and* weaker blows makes collapse superlinear. Machines never degrading is the balance for them being much stronger — don't undo it.
- **Morale is a run-level resource.** `Warband.morale` is shifted by between-battle events and folded into every squad's `resolveDiscipline()`. Clamped to ±0.12 — a thumb on the scale, never a second health bar.
- **Events are data, not code.** A choice declares what it does (`salvage`, `morale`, `requires`); `resolveEvent()` is the only thing that knows how to apply it. Adding an event is a row in `events.ts`. Every event needs at least two branches that differ — a one-option choice is a notification.
- **Never scale encounter difficulty to warband strength.** Rubber-banding kills the break-run pillar.
- **Two origins:** Scion of a House (True Kin start) and the Freed Firstborn (mutant start, True Kin recruit at a steep premium). Asymmetry is data — starting roster and price modifiers — not new systems.
- **V0 scope:** 15 unit types (5/lineage), 2 expedition verbs (Scavenge, Delve), 15 encounters, 2 origins — **plus the march**: a travel phase, and the Food and baggage-train systems that hang off it (see [docs/plans/travel.md](docs/plans/travel.md)). Espers, Survey, and per-House sub-origins are still V0.1.

Scope discipline still applies, but the thing being guarded changed on 2026-09-05. The old rule read "scope creep toward the full vision is the main risk" and treated the march as creep; the march is now the spine. What needs guarding instead:

- **One system at a time, each ending in something playable.** Travel ships alone and gets played before Food or the baggage train are built, precisely because all three interlock and building them together means nothing is playable for a long stretch.
- **A second resource must not be a reskin of the first.** Water is charged per body; Food is charged per day. If a proposed system's pressure is already expressible in an existing one, it is decoration.
- **The auto battler invariants above are untouched by the shift.** No positioning, no in-battle commands, no counter-triangle. The march is the game; the battle is still a thing you watch.
