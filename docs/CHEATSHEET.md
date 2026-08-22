# Salt Crown — Cheatsheet

Prefer the polished HTML version for reading:
[docs/CHEATSHEET.html](docs/CHEATSHEET.html)

Quick reference for units, mutations, officers, and game mechanics.

---

## Mutations

Mutations scale with level (1–6). Higher levels are rarer finds and cost more to recruit with.

| Mutation | Level 1 | Level 3 | Level 6 | Effect |
|----------|---------|---------|---------|--------|
| **Horns** | +1.5 dmg | +4.5 dmg | +9 dmg | Straightforward damage boost |
| **Carapace** | +0.8 arm | +2.4 arm | +4.8 arm | Flat armour, stacks |
| **Bulging Sacs** | +7 HP | +21 HP | +42 HP | Raw durability |
| **Adrenal Glands** | +0.5 move | +1.5 move | +3 move | Speed multiplier, helps kiting |
| **Twitch Reflex** | +2.2% evade | +6.6% evade | +13.2% evade | Dodge chance against attacks |
| **Keen Sense** | +2% accuracy | +6% accuracy | +12% accuracy | Hit better |
| **Serrated Claws** | +2.6 dmg, -6% acc | +7.8 dmg, -6% acc | +15.6 dmg, -6% acc | Damage spike with accuracy cost |
| **Flaming Ray** | 90 range, -20% dmg | 156 range, -20% dmg | 222 range, -20% dmg | Converts to ranged attack, weaker hits |
| **Dense Bone** | +1.1 arm, -0.7 move | +3.3 arm, -0.7 move | +6.6 arm, -0.7 move | Tank mutation, very slow |
| **Regeneration** | +1.2 HP/sec | +3.6 HP/sec | +7.2 HP/sec | Heal between hits |
| **Quills** | 6% reflect | 18% reflect | 36% reflect | Reflect melee damage back at attacker |
| **Frenzy** | +9% attack speed | +27% attack speed | +54% attack speed | Attack faster as HP drops (capped at 75% speed) |

**Key insight:** Mutations compound. A squad with two level-3 mutations is much stronger than the base unit. Keeping mutants alive to accumulate mutations is the whole game.

---

## Mutant Units

**All mutants can roll mutations. None can take bionics.** Cost is per body.

| Unit | Cost | HP | Armour | Damage | Attacks/sec | Range | Speed | Accuracy | Evade | Strategy |
|------|------|----|----|--------|-------------|-------|-------|----------|-------|----------|
| **Chaff** | 2 | 30 | 0 | 5 | 0.10 | 22 (melee) | 5.2 | 70% | 5% | Mass = power. Unmutated is useless. |
| **Sludge-Waller** | 5 | 165 | 1 | 8 | 0.05 | 22 (melee) | 2.4 | 66% | 2% | Absorbs hits. Moves like a glacier. |
| **Stiltwalker** | 5 | 38 | 0 | 10 | 0.125 | 22 (melee) | 9 | 78% | 24% | Fast and dodgy. Dies to marksmen. |
| **Spitter** | 7 | 42 | 0 | 14 | 0.07 | 240 (ranged) | 3.2 | 70% | 6% | Long-range striker. Needs screening. |
| **Thornback** | 7 | 90 | 7 | 9 | 0.067 | 22 (melee) | 3.6 | 72% | 3% | Stops swarms. Dies to big hits. |

**Cost per squad:**
- 10 Chaff = 20 salvage
- 5 Sludge-Wallers = 25 salvage
- 8 Stiltwalkers = 40 salvage
- 6 Spitters = 42 salvage
- 5 Thornbacks = 35 salvage

---

## True Kin Units

**No mutations ever. Can take bionics (M3).** More durable and reliable than mutants. Cost is per body.

| Unit | Cost | HP | Armour | Damage | Attacks/sec | Range | Speed | Accuracy | Evade | Role |
|------|------|----|----|--------|-------------|-------|-------|----------|-------|------|
| **Levy** | 12 | 105 | 3 | 15 | 0.083 | 24 (melee) | 4.6 | 82% | 10% | Baseline infantry. Reliable. |
| **Halberdier** | 16 | 118 | 4 | 24 | 0.059 | 34 (reach) | 4 | 84% | 8% | Extended reach line. Heavy hitter. |
| **Marksman** | 15 | 88 | 1 | 22 | 0.059 | 320 (ranged) | 4 | 88% | 10% | Specialist DPS from far back. |
| **Shieldbearer** | 16 | 165 | 8 | 10 | 0.063 | 24 (melee) | 3.4 | 78% | 4% | Tank. Absorbs punishment. |
| **Dragoon** | 22 | 130 | 5 | 22 | 0.077 | 26 (melee) | 6.6 | 86% | 14% | Fast and strong. Premium unit. |

**Cost per squad:**
- 4 Levies = 48 salvage
- 3 Halberdiers = 48 salvage
- 3 Marksmen = 45 salvage
- 3 Shieldbearers = 48 salvage
- 2 Dragoons = 44 salvage

---

## Officer Ranks

Officers lead squads and grant bonuses. **True Kin only.** Cost is per officer.

| Rank | Cost | Bonus | Morale Boost | Strategy |
|------|------|-------|--------------|----------|
| **Serjeant** | 85 | +18% squad damage | +5% hold | Amplifies offence. Best with damage squads. |
| **Warden** | 90 | +2.5 squad armour, +12% morale | +12% hold | Tank leader. Squad holds way longer before routing. |
| **Marshal** | 110 | +9% accuracy, +6% damage | +8% morale | Balanced. Improves both offence and accuracy. |
| **Outrider** | 80 | +25% move speed, +5% evade | +4% morale | Fast and evasive. Best with fast units. |

**Key insight:** Morale bonus means the squad breaks *later*. A Warden-led squad survives 68% + 12% = 80% losses before routing; an unled mutant squad routs at 40%.

---

## Houses

Eight True Kin houses. Each commander is drawn from one at random.

- **Vantry**
- **Oskal**
- **Merethel**
- **Caldrion**
- **Thessaly**
- **Ambrose**
- **Wexhall**
- **Duon**

No mechanical difference (M1 design feature; house bonuses arrive M0.1). Mutants have no houses.

---

## Combat Math

### Damage Resolution

```
hit_chance = attacker_accuracy - defender_evade (clamped 5%–95%)
damage_dealt = max(1, attacker_damage - defender_armor)
```

**Armour is flat reduction, not percentage.** A Thornback with 7 armour blocks 7 damage from every attack. Against 5-damage chaff it survives; against 24-damage halberdiers it dies fast.

### Morale (Discipline)

When a squad loses >50% of its starting count (or its leader), it **routs** and flees. It doesn't instantly die—routed units run off the field and escape alive.

**Discipline = damage multiplier as the squad breaks:**
- **Mutants** → 35% (fold early, lose fast)
- **True Kin** → 78% (hold longer, tighter)
- **Machines** → 100% (never degrade; fight till destroyed)

A squad at 10% remaining effectiveness hits for 10% of base damage but doesn't leave.

### Attack Interval

`attacks_per_second = 1 / attackInterval_ticks × 20 Hz`

A unit with `attackInterval: 10` attacks twice per second. One with `attackInterval: 20` attacks once per second.

### Range

- **≤40 units** = melee (applies to Quills reflections)
- **>40 units** = ranged (not melee, doesn't trigger Quills)

---

## Squad Composition Logic

### The Five Mutant Kinds Counter Each Other

- **Chaff**: mass (cheap, many, weak)
- **Sludge-Waller**: raw HP (soaks volume, dies to burst)
- **Thornback**: flat armour (stops swarms, dies to burst)
- **Stiltwalker**: evasion (dodges, dies to accuracy)
- **Spitter**: range (no durability, needs screening)

Running only one kind is a trap. Running all five with mutations is a start.

### True Kin Don't Counter Mutants

They cost 4–5× as much per body but don't "beat" a cheap horde in raw math—they beat it through *reliability*. Mutations are random; an officer's bonus is guaranteed.

**Mixed warbands work:** mutant swarms with True Kin officers to stabilize, or True Kin lines with mutant flankers to handle edge cases.

### Costs vs. Power

- **Chaff (2 salvage)** → weak but many
- **Levy (12 salvage)** → 6× cost, 3.5× HP, 3× damage
- **Dragoon (22 salvage)** → 11× chaff cost, but one can lead 20 chaff to victory

Economic efficiency ≠ raw power. Efficiency matters when salvage is tight.

---

## Economy

### Salvage Income

- **Scavenge** → ~100 salvage (stable)
- **Delve** → ~220 salvage (high variance, risky, finds bionics/machines)
- **Battle reward** → ~60 + encounter_index × 34 (scales with run length)

Example: Encounter 3 pays roughly 102 salvage.

### Water Cost

**Not in V0 yet.** Will arrive M1.5. Superlinear upkeep means larger warbands get expensive to maintain.

---

## Firstborn (M2+)

Named mutant tier, promoted from fodder that survives long enough and accumulates mutations. When a mutant squad is led by a Firstborn, that squad's mutations leak to the whole squad at **half level (min 1)**.

Example: Horns 5 Firstborn leading Chaff squad gives the whole squad Horns 3.

This makes keeping Firstborn alive way more valuable than the body count—they're your scaling engine.

---

## Determinism & Seeds

Same seed always produces:
- Same 15 encounters in the same order
- Same 3 commander options on leader select
- Same enemy warbands (composition + mutations)
- Identical battle outcomes (if you make identical choices)

Use seeds to test composition, replay interesting fights, or share runs.
