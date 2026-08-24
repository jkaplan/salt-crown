# Salt Crown — V0 Build Order

Six milestones. **Every milestone ends in something you can run.** Week estimates assume steady solo part-time work; scale to your actual hours.

Ordering note: because positioning, in-battle input, and counters are all cut, **mutations are the depth system** — so they land in M1, not later. Machines arrive in M3 because they're ruin-found, not purchased, which also keeps M1 lean.

---

## M0 — Skeleton and proof ✅ DONE

De-risk everything before any game exists.

- npm workspace monorepo: `packages/sim`, `packages/game`, `apps/web`
- Seeded PRNG; ESLint rule banning `Math.random` in `packages/sim`
- Fixed-timestep 20 Hz tick loop
- One unit type. Two lines walk at each other and fight. Colored rectangles.
- **Headless batch runner**: `npm run sim:batch -- --seeds 1000` prints win rates and durations
- **Perf probe**: ramp entity count until frame time breaks; write down the real number

**Exit:** same seed produces byte-identical results twice. You know your true entity ceiling — not the spec's guessed 220.

**Result:** determinism PASS (11/11 tests). Sim ceiling measured at 8,000 entities running 6× realtime on desktop — the 220 guess was off by ~3 orders of magnitude, see [TECH.md](TECH.md). The harness immediately earned itself by catching a 40/60 mirror-match bias caused by sequential tick resolution; the tick is now simultaneous (snapshot reads, two-phase damage) and sits at 49.7/50.3.

---

## M1 — The vertical slice ✅ DONE — the milestone that matters

First point at which "is this fun?" can be asked.

- **Mutants and True Kin only** — 10 unit types (Machines come in M3)
- Two-tier model: Officers + bulk rank-and-file
- **Mutations**: 1–2 at random levels on recruit, visible before you buy
- Recruit screen, Salvage only
- Auto-arranged battle (melee front, ranged back), Pixi rendering, 1×/2×/4× speed
- Morale as a damage multiplier — battles run to the finish, a bleeding squad hits softer
- Skirmish sandbox: any unit vs any unit at any scale, plus the on-device perf probe
- Matchup harness (`npm run sim:matchup`): equal-salvage matrix + screen test
- 8 encounters against rival warbands, then win/lose
- Post-battle report

**Cut ruthlessly.** No wounds, no Water, no expeditions, no bionics, no Firstborn.

**Exit:** you play it five times in a row without being asked to. If not, stop and fix *this* before building anything below.

**Result:** 21/21 tests green, lint and typecheck clean. All content is PLACEHOLDER, pending real judgement once played.

Prospects were made leaders. A leading Prospect leaks its mutations to the whole squad at half level (min 1) — a Horns 5 standout gives twenty fighters Horns 3 — so a good roll is worth more than one extra body, and mutations start acting at army scale instead of on a single fighter. One leader slot per squad, either an Officer (flat bonus) or a leading Prospect (the leak); a Prospect can only lead its own lineage. This unified `officerId` into a single `leader` field across the codebase.

Routing was built, played, and cut. It ended mass battles anticlimactically — squads walked off before the clash resolved, which is the opposite of what the spectacle is for. Replaced with **morale as a damage multiplier**: battles run to annihilation, and a bleeding squad hits softer, so a losing side collapses on the field. Losing a battle now ends the run.

Campaign harness (`npm run sim:campaign`) plays full runs with a greedy bot. Three tuning passes, each driven by measurement rather than guesswork:

| Enemy budget | Reward | Bot completion | Verdict |
|---|---|---|---|
| `110 + 105i + 9i²` | `60 + 34i` | 3% | Unwinnable — enemy grew quadratically against linear income |
| `120 + 82i + 4i²` | `95 + 78i` | 31% *(survive)* | Good, but routing let you lose and continue |
| `100 + 58i + 3i²` | `105 + 80i` | 82% | Far too soft once losing ended the run |
| `112 + 75i + 3.8i²` | `105 + 80i` | 25% | Good, until the unit rebalance below changed every cost |
| **`80 + 62i + 8.5i²`** | **`105 + 80i`** | **21%** | Current. Flatter early, steeper late — deaths spread evenly |

Winning warband p50 62 bodies, max 152 — break prospect is reachable.

The mutants were then rebuilt to differ by *kind* rather than degree (three kinds of durability against flat armour), verified with a new equal-salvage matchup matrix. That immediately caught Stiltwalker winning ~everything at 30% evade and Marksman at literally 0% against the whole roster. Nine of ten units now show a 100% spread. Sludge-Waller stays flat at 40% and should — the screen test proves the point: Spitter alone vs Chaff is 0%, Spitter behind a Sludge-Waller screen is 100%. Enemy curve retuned to `80 + 62i + 8.5i²` after the cost changes, landing at 21% bot completion with deaths spread across every encounter.

---

## M2 — Attrition and leaders (weeks 4–5)

- Wound ladder, hit zones, permadeath, injury effects
- Officer squad bonuses
- **Firstborn promotion** — surviving mutants accumulate mutations and graduate to the named tier
- Morale as a run-level resource shifted by events (see V0-DESIGN §7)
- Recovery and treatment costs
- Roster screen showing the whole warband at a glance

**Exit:** losing a Firstborn you grew over ten battles makes you wince.

---

## M3 — Ruins, machines, economy (weeks 6–7)

- Water, superlinear upkeep, desertion on shortfall
- Scavenge / Delve; crews miss the next battle
- **Bionics**: found in ruins, installed into True Kin for Salvage
- **Machines**: 5 types, found in ruins and rare events only, degrade permanently, cost Salvage per battle to run
- Tinkerer event — the rare exception that can restore a machine
- Ruin flavor and outcome text; first hints of what's below

**Exit:** you delve instead of reinforcing, lose the next battle for it, and feel that it was your call.

---

## M4 — Full run (weeks 8–9)

- 15 encounters, 3 acts, 15 unit types
- All three encounter pools: rival warbands, wasteland fauna/flora, bosses
- **Three bosses** — horrors from below, visibly not playing the same game
- Act 3 mass battles at 90–200+
- The three break-run seeds from V0-DESIGN §11
- **Two origins**: Scion of a House, and the Freed Firstborn (mutant start, True Kin at a premium)

**Exit:** you complete full runs. At least one breaks.

---

## M5 — Tune and port (week 10)

- Batch-sim balance pass: 10,000 runs against the upkeep curve and payout tables
- Instrument and measure the actual break-run rate
- Capacitor build; validate on the S24 Ultra and an iPhone
- Apply hybrid aggregation **only if** the M0 probe and real device testing say you need it

**Exit:** a phone build you can hand to someone.

---

## Sequencing rules

1. **M1 is a gate, not a checkpoint.** If the loop isn't fun with 10 units and mutations, more systems won't save it — they'll make it a longer unfun loop.
2. **Build the batch-sim harness in M0, not M5.** Superlinear upkeep and a 10–12% break rate are statistical targets. You cannot hand-playtest to them.
3. **Don't optimize before M0's perf probe.** 220 entities is a guess. Measure, then decide.
4. **Art last.** Colored rectangles through M4. Readability comes from squad shape and color, which primitives can validate.
5. **Guard the cuts.** Espers, Coolant, Survey, per-House sub-origins, and positioning are all V0.1 or later. Pulling any of them forward is the main risk to this schedule.
