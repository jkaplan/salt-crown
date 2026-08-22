# Salt Crown — Vision

> Long-term north star, preserved from the original spec. **This is not the V0 build target** — see [V0-DESIGN.md](V0-DESIGN.md) for what actually gets built first, and why several systems here are deliberately deferred.

## 1. Vision

- **Core fantasy:** lead a growing warband through escalating battles and ruin expeditions in a post-collapse world.
- **Desired feel:** early survival tension → mid-run strategic growth → late-run spectacle (large armies vs. huge enemy counts).
- **Balance philosophy:** not strict fairness. Some runs should become absurdly overpowered by design.

## 2. Theme and identity

Qud-inspired wasteland: mutants, machines, and caste-lineage humans.

- **Mutants** — split into Chimera (physical) and Esper (mental) families
- **Machines**
- **Caste-Born** (working name)

Ruin exploration is a core system, not side flavor.

## 3. Run and progression

Encounter-based with escalating difficulty and boss checkpoints. The player reaches "full warband" identity around 75% of the run. Scaling comes through both enemy count and enemy quality. Between battles the player makes strategic economy and exploration decisions.

## 4. Warband model

No hard cap on recruited fighters — mass battles are a key pillar, and the system is built around **logistics pressure** rather than roster caps. Permadeath exists and is expected to be semi-common. Injury states precede death, creating recovery and risk-management gameplay.

## 5. Combat scale and performance

- Preferred mode: all-on-field combat
- Mobile-first: recent iPhones; Galaxy S24 Ultra as a test target
- Fallback: hybrid simulation past the entity budget — keep all fighters visible, lower update frequency for low-priority units, aggregate swarm calculations for minor mobs
- Initial guessed budget: ~220 fully simulated entities

*(V0 note: this budget is a guess and is likely 5–10× conservative. Measure it in M0. The two-tier unit design turns aggregation into a design feature rather than a fallback.)*

## 6. Economy and attrition

Water, Coolant, Salvage. Large warbands cost significantly more to sustain; upkeep scales superlinearly with roster size. Expedition returns scale with warband size, so growth is powerful but costly. **Attrition is the main long-term failure pressure.**

## 7. Ruin expeditions

Send fighters into ruins between battles:

- **Scavenge** — lower risk, stable returns
- **Survey** — information and planning value
- **Delve** — higher risk, higher reward

The tradeoff is immediate battle strength vs. future economy. Catastrophic outcomes only through player agency, never arbitrary RNG punishment.

## 8. Risk, death, recovery

Status ladder: `Healthy → Strained → Injured → Crippled → Dead`

Death is semi-common, especially late. Small automatic recovery between battles; larger recovery from camping, treatment, and healer synergies. Family and class influence recovery style and injury handling.

## 9. Wound simulation

Lightweight hit-zone simulation — head, core, arms, legs — not heavy simulation on every unit. Full zone tracking for heroes and elites; simplified handling for rank-and-file.

## 10. Breakability

Target ~10–12% of runs becoming broken. Breaks should come from discovering synergies and committing to risk/reward lines. Dominant outcomes are acceptable when earned through choices and setup costs.

## 11. Fairness-feeling rules

- Most failures come from attrition, logistics pressure, and bad strategic choices
- Catastrophe must trace to explicit player decisions or clear misplay
- No "you lost to invisible RNG" moments
- Player control and readability stay high even in large battles

## 12. Outstanding decisions

- Final name for the Caste-Born equivalent
- Final game title
- Run length and checkpoint cadence
- Numeric tables: upkeep curve, injury/death probabilities, recovery rates and treatment costs, expedition payout/risk
- Performance thresholds for fallback activation per device tier
