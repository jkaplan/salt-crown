# Salt Crown

Run-based **pure auto battler**. Post-collapse wasteland, Caves of Qud tone. Recruit a warband of mutants, True Kin, and salvaged machines; watch it clash; manage the attrition.

Structural model is *How Many Dudes?* (roguelike autobattler, no positioning, depth from unit variety + modifiers), crossed with *Battle Brothers* attrition and *Caves of Qud* worldbuilding.

## Docs

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

1. **The sim is deterministic.** `(state, inputs, seed) => newState`. Seeded PRNG only. Same seed, same result, always. Golden-seed replay tests exist; if you break one you changed combat behavior — say so explicitly rather than updating the fixture.
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
- **One leader per squad, either kind.** An Officer grants a flat bonus; a leading Prospect leaks its mutations to the whole squad at half level (min 1) instead. A Prospect can only lead mutant squads — never True Kin. Never let both apply to the same squad at once.
- **Lineages don't counter each other.** They differ by cost, reliability, and upgrade path.
  - Mutants: cheap fodder, physically frail, random mutations at random levels, gain more by surviving
  - True Kin: rare, durable, reliable. No mutations; bionics installed from ruin finds
  - **Mutants can never take bionics** — their bodies can't carry the implants. Mutations and bionics are mutually exclusive per unit, and that exclusivity is what keeps the two lineages distinct. Do not relax it.
  - Machines: **never purchasable** — found in ruins only, arrive at full power, only degrade, permanent when destroyed
- **Armor is flat reduction**, not percentage.
- **Battles are fought to the finish and losing ends the run.** Nobody flees. There is **no routing, withdrawal threshold, posture, or pre-battle order** — every one of those cuts the mass-battle climax short, and composition is the only pre-battle decision.
- **Morale is a damage multiplier, not an exit.** `effectiveness = discipline + (1 - discipline) × (alive / started)`. Mutants 0.35 (fold fast), True Kin 0.78 (hold), Machines 1.0 (never degrade). Fewer bodies *and* weaker blows makes collapse superlinear. Machines never degrading is the balance for them being much stronger — don't undo it.
- **Morale should become a run-level resource** shifted by between-battle events. Not built yet; hook point is a modifier on `Warband` folded into `resolveDiscipline()`.
- **Never scale encounter difficulty to warband strength.** Rubber-banding kills the break-run pillar.
- **Two origins:** Scion of a House (True Kin start) and the Freed Firstborn (mutant start, True Kin recruit at a steep premium). Asymmetry is data — starting roster and price modifiers — not new systems.
- **V0 scope:** 15 unit types (5/lineage), 2 resources (Salvage, Water), 2 expedition verbs (Scavenge, Delve), 15 encounters, 2 origins. Espers, Coolant, Survey, and per-House sub-origins are V0.1.

Scope creep toward the full vision is the main risk on this project. When a change would pull a V0.1 system forward, say so before building it.
