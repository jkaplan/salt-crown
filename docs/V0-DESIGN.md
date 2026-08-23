# Salt Crown — V0 Design

> V0 goal: **prove the loop is fun.** Everything here is chosen to reach a playable, ugly, repeatable run fast. Nothing here is a promise about the shipped game — see [VISION.md](VISION.md) for the north star.

## 1. What kind of game this is

A **pure auto battler**: you compose a warband between fights, then watch it clash. No positioning, no in-battle commands, no counter-triangle.

That's three of the four places an auto battler normally stores its strategy, deliberately removed. All of it therefore lives in the fourth: **composition depth under economic pressure.** Two systems carry the entire game:

1. **Economy** — Machines are strictly better but the Water curve means you field a handful. Portfolio allocation under budget.
2. **Mutations and bionics** — modifiers that attach to units and change battle behavior. This is the relic system, the upgrade system, and lineage identity, all at once.

If composition stops being interesting, that's the bug. Combat math is not where the fun lives.

### Reference triangulation

- **How Many Dudes?** (Butterscotch Shenanigans) — the structural model. Roguelike autobattler, 42 unit types across 6 non-countering families, hundreds of relics that change battle behavior. Proof that variety + modifiers can carry a game with no positioning.
- **Battle Brothers** — roster attrition, named characters, injuries, permadeath, no roster cap held in check by superlinear upkeep.
- **Caves of Qud** — tone, mutation levels, True Kin vs. mutant social structure, ruin archaeology, horrors below.

## 2. The world

The **Houses** — True Kin caste families with elaborate royal traditions — are at war with each other. They have been for a long time and it has nothing to do with you.

**Mutants** were bred. The Houses made them — servants, labour, and bodies for the wars the Houses fight with each other — and the breeding outran its controls generations ago. There are now vastly more mutants than True Kin, which is the real reason True Kin are rare and expensive and mutants cost three salvage: not scarcity of one, but a demographic collapse of the other.

The Houses have not stopped. They still need bodies, so the programmes continue, and the ratio keeps getting worse. Nobody is watching that clock.

Mutants sit outside the caste system entirely — no Houses, no traditions, no place in anyone's succession, because they were made rather than born into it. Everyone spends them as fodder, including you. They may yet matter as a faction in their own right.

*This is why "Firstborn" is such a cruel joke: a House elevating a bred slave to a succession title, mocking its own rites with something it manufactured. And why the mutants took the word and meant it.*

**Machines** are lost technology. Nobody can build them. They are found, fought over, and slowly worn out.

And something underneath is coming up. **This is never explained.** Ruin text, boss design, and stray dialogue hint; nothing confirms. The world is doing what it does regardless of the player.

### Terminology (keep these straight)

| Term | Means |
|---|---|
| **Lineage** | True Kin / Mutants / Machines. The three unit pools. |
| **House** | A True Kin caste family. Houses war with each other. Mutants and Machines have none. |
| **Officer** | Named tier, True Kin. Recruited. |
| **Firstborn** | Named tier, Mutant. Not recruited — *promoted* from a fodder mutant that survived long enough. |

### On the word "Firstborn"

The Houses invented it. It's a ceremonial elevation of a favored mutant slave — a parody of their own succession rites, performed as an affectation and a joke among people with far too many traditions.

The mutants took the word and meant it. Outside the caste system it came to mean the one who survived, the one who kept mutating, the one still standing. Same title, two entirely different weights, which is roughly how the Houses and everyone else regard each other in general.

## 3. The three lineages

| | **Mutants** | **True Kin** | **Machines** |
|---|---|---|---|
| **Role** | Common fodder | Rare and reliable | Rare and devastating |
| **Cost** | Cheap, plentiful | Expensive | Not purchasable — see below |
| **Water** | Low | Low | **Brutal** |
| **Power** | **Frail** baseline; mutations are the only thing that lifts them | Solid, predictable, durable | Far above everything |
| **Upgrade path** | Random mutations; more as they survive | **Bionics**, installed from ruin finds | **None.** They only degrade. |
| **Leaders** | Firstborn (emergent) | Officers (recruited) | None |
| **Social** | No caste, no House | Houses, traditions, succession | Not people |

### Mutants
**Physically frail** — low HP, low armor. An unmutated mutant is genuinely bad. Mutations are the only thing that lifts them, which is what makes the recruit screen a real lottery rather than a price comparison.

#### The five are differentiated by *kind*, not degree

Because **armour is flat reduction**, different kinds of durability counter different kinds of attacker. That is where the variety lives — not in one unit having slightly more HP than another.

| Unit | Durability | Beats | Loses to |
|---|---|---|---|
| **Chaff** | none — but you field 200 | anything fragile | flat armour |
| **Sludge-Waller** | raw HP | nothing alone — it's a **screen** | sustained volume |
| **Thornback** | flat armour | swarms, decisively | anything hitting hard |
| **Stiltwalker** | evasion | low-accuracy attackers | armour, marksmen |
| **Spitter** | none — range instead | expensive melee elites | anything cheap and fast |

Verify with `npm run sim:matchup`. Every unit should show a wide **spread** — a row reading ~50% against everything is a unit with no identity, and that's the bug to fix.

#### Screening units can't be judged 1v1

Sludge-Waller does almost no damage *on purpose* and loses nearly every solo matchup. That is correct: its job is to stand in front of something. The matchup tool's screen test measures it directly, and the effect is not subtle:

| | alone | behind a screen |
|---|---|---|
| Spitter vs Chaff | **0%** | **100%** |
| Marksman vs Chaff | 53% | **100%** |

Do not buff a screening unit to make it win 1v1. It would be overpowered in every real composition.

Arrive with **1–2 mutations at random levels** (Qud-style: level scales effect, so a level 6 mutation is a genuine find). Low chance to gain another mutation between battles. Cheap enough to lose 60 and shrug.

**Mutants cannot take bionics.** Not a balance rule — their bodies aren't strong enough to carry the implants True Kin install. This is load-bearing: mutations and bionics being mutually exclusive *per unit* is what keeps the two lineages distinct. If mutants could take both, True Kin collapse into "mutants without the fun part."

A mutant that survives enough battles and accumulates enough mutations promotes to **Firstborn** — the named tier. You don't recruit these; you grow them. Losing one late in a run should hurt more than losing a purchased Officer.

### True Kin
No mutations, ever. Instead, **bionics** found in ruins are installed for Salvage. Deliberate build-crafting rather than a lottery. This is the mechanical reason ruin-diving exists.

### Machines
**Not sold in the recruit screen.** Machines are found in ruins and rare events, and that's the only way to get one. They arrive at full power and **only degrade** — each battle costs Salvage just to keep them running, and destroyed machines are gone permanently.

The exception that proves the rule: rare **tinkerer** events, a legendary figure who can restore or upgrade a machine with enough scrap or a unique component. Should feel like an event, not a shop.

This self-balances "Machines are much stronger": strictly better, finite, decaying, and expensive to merely own.

## 4. The three-tier warband

Individual identity, hit zones, and permadeath cannot apply to 200 units — nobody can track that, and an obituary for anonymous mutant #147 is noise. But mutations *are* individual, so there has to be a tier between "named hero" and "number in a column."

**Officers** — True Kin, 2–8 per run
- Named, recruited individually, hit zones and wound ladder (M2)
- Each leads one squad and grants it a flat bonus plus discipline
- Always fewer officers than squads, so assigning them is a decision

**Potentials** — mutants, ~1 per dozen bodies recruited
- Mutants that came out of the vats with something useful. Individually named, individually simulated, individually killable — and permanently dead when killed.
- Carry the mutations. Sturdier than the fodder they came from (×2.2 HP), because being noticed at all means having survived something.
- **Can lead a squad of their own lineage.** Doing so leaks their mutations to the whole squad at half level (rounded up, min 1): a Horns 5 standout gives its squad Horns 3. This is what makes a Potential worth more than one extra body — mutation stops being one fighter's stat line and becomes an army-wide multiplier.
- Every battle survived is a step toward **Firstborn** (M2). Potentials *are* the Firstborn pipeline.

**Fodder** — everything else
- Anonymous, grouped into squads by unit type. **No mutations at all.**
- A squad tracks `count`, `type`, and its leader (an Officer or a leading Potential — never both). Deaths are a number.
- The roster shows one collapsed "Infantry: 128 bodies", expandable to the per-type breakdown. At 140 bodies you don't want twelve cards, you want one number and your handful of people.

### One leader per squad, of either kind

A squad has exactly one leader slot. Put an Officer there for a flat, reliable bonus. Put a Potential there for the mutation leak — cheaper to acquire, higher variance, and it ties the squad's fate to a fighter who can die independently of it. **A Potential cannot lead True Kin** — a mutant does not command that caste. The choice between the two is genuinely a build decision, not a strict upgrade in either direction.

### Why mutations are individual, not squad-wide

An earlier version gave the whole squad a shared mutation roll — twenty Chaff, all with Horns 3. That is not how a random process works, and it made the recruit screen unreadable: you were buying a stat block rather than a person.

One or two standouts per batch is more believable *and* more legible. You are mostly buying the Potentials; the fodder is what comes in the same crate.

**"Potential" is the True Kin's word for them** — worth watching, possibly worth elevating. It is exactly as condescending as it sounds, coming from a caste that bred them in the first place.

## 5. Combat

Two warbands line up facing each other and go at it. **Melee front, ranged back, arranged automatically.** No player placement.

### Fighter stats (keep it this small)

```ts
interface Stats {
  hp: number
  armor: number          // FLAT damage reduction, applied per hit
  damage: number
  attackInterval: number // in sim ticks (20/sec)
  range: number          // 1 = melee; >1 auto-assigns to the back line
  moveSpeed: number
  accuracy: number
  evade: number
}
```

### Per-tick resolution (20 Hz)

1. Acquire target (nearest valid in range, via uniform-grid buckets)
2. Move if out of range
3. Attack if cooldown elapsed: `hit = accuracy vs evade`, `dmg = max(1, damage - armor)`
4. On death: remove; if Named, roll a wound zone and advance the wound ladder; check squad morale

A squad losing >50% of its count or its leader rolls to **rout** — flees the field, survivors live.

### Player controls
Speed only: 1× / 2× / 4×. Nothing else during battle.

## 6. The decision surface

Everything interesting happens between battles. Five levers:

1. **Recruit** — Officers individually (evaluate carefully), rank-and-file in bulk. Mutants and True Kin only; Machines are never sold.
2. **Install** — bionics into True Kin, using ruin finds and Salvage. Scarce slots.
3. **Assign leaders** — attach an Officer or Firstborn to a squad. Always fewer leaders than squads.
4. **Send an expedition** — Scavenge or Delve. The crew **misses the next battle**.
5. **Treat the wounded** — spend to heal, or send them in hurt and risk the next rung.

There is deliberately **no pre-battle order, posture, or withdrawal setting.** Composition is the pre-battle decision. Anything else is a slider players set once and ignore.

## 7. Defeat and morale

**Battles are fought to the finish. Nobody flees. Losing a battle ends the run.**

There is no routing, no withdrawal threshold, no pre-battle posture. Every one of those cuts the mass-battle climax short, which is the spectacle the whole game is built to deliver. The armies clash and it resolves.

### Morale is a multiplier, not an exit

Each squad carries a **discipline** value: the damage multiplier it retains once ground down to nothing.

```
effectiveness = discipline + (1 - discipline) × (alive / started)
```

Damage is scaled by that. So a bleeding squad hits softer *as well as* having fewer bodies — the collapse is superlinear, and a losing side visibly falls apart instead of walking off.

| Lineage | Discipline | Consequence |
|---|---|---|
| **Mutants** | 0.35 | Fold fast. A horde past half strength is barely fighting. |
| **True Kin** | 0.78 | Barely notice. Discipline is the caste virtue. |
| **Machines** | 1.00 | Never degrade at all. |

This preserves the risk curve that routing was carrying: **the stronger the army, the harder it is to break** — and Machines never breaking is the balance for them being much stronger. It just expresses it through combat rather than through units leaving the field.

Officers raise their squad's discipline. A Warden is worth more than their damage bonus suggests.

### Morale should be a run-level resource

*Direction, not yet built.* Discipline is currently derived from lineage plus officer. It should also carry a **warband-level morale modifier** shifted by events between battles — a brutal victory, a Firstborn lost, a ruin that went badly, water running short. That makes events matter mechanically rather than as flavour text, and gives morale a management layer across the run.

Hook point: a modifier on `Warband` folded into `resolveDiscipline()`. Cheap to add once events exist (M3).

### Failure

**Run ends when you lose a battle.** Since battles run to annihilation, a defeat is a wiped warband.

Attrition is still what kills you — it's the reason you arrive at an encounter too thin to win it — it just isn't a separate failure track any more. You bleed across encounters, fail to rebuild, and then lose one.

*If surviving a defeat should come back, M2's wound ladder is the natural home: bodies that fell resolve afterward into Dead vs Crippled vs Injured. That restores partial survival without anyone running away mid-battle.*

**Encounter difficulty is fixed — never scaled to warband strength.** Rubber-banding would directly kill the "some runs become absurdly overpowered" pillar. If being strong doesn't trivialise fights, breaking the game isn't a reward.

### Wound ladder
`Healthy → Strained → Injured → Crippled → Dead` — Named tier only, individually.

Zones: **Head** → accuracy and leader-bonus loss · **Core** → max HP · **Arms** → damage · **Legs** → move and evade.

Free recovery between battles is one rung, Strained → Healthy only. Worse costs resources. Mutants recover an extra rung free. Machines recover nothing without Salvage. True Kin recover normally.

## 8. Economy

- **Salvage** — universal currency. Recruit, install bionics, repair machines, treat wounds.
- **Water** — upkeep. Consumed per encounter, scaled by roster size.

Coolant is folded into Water for V0; Machines consume 2.5×. Split it out in V0.1 if faction-specific logistics proves worth the UI.

**Superlinear upkeep** (starting point, expect to retune):

```
waterCost = sum(unit.waterCost) * (1 + roster / 40)
```

| Roster | Multiplier |
|---|---|
| 20 | ×1.50 |
| 60 | ×2.50 |
| 120 | ×4.00 |

Water shortfall causes desertion before it causes death. Attrition should feel like a squeeze, never an execution.

## 9. Expeditions

| Action | Return | Risk |
|---|---|---|
| **Scavenge** | ~100% expected value, stable | ~3% injury |
| **Delve** | ~220% expected value, high variance, bionics and machine finds | ~18% injury, ~5% death |

Survey is cut from V0 — it's an information action and V0 has almost no hidden state worth paying to reveal.

Delving is the **only reliable source of bionics and machines**, so it isn't an optional economy side-game. It's how two of three lineages get stronger. The real cost is that the crew misses the next battle.

## 10. Encounter pools

Three sources, in ascending cost to build:

1. **Rival warbands** — other Houses' forces, built from the same unit pool you recruit from. Nearly free content.
2. **Wasteland fauna and flora** — beasts, ruin-things, drifting growths. Cheap, weird, atmospheric. Doing their own thing.
3. **Bosses** — the horrors from below. Bespoke, clearly not playing the same game as everyone else. Three per run.

### Direction: recurring rival leaders

*Not built. Depends on M2's wound ladder — recorded here so it isn't lost.*

Rival warbands already generate named Officers and Potentials as squad leaders (`generateEncounter`). The natural extension: some of them **persist** instead of being regenerated fresh each encounter. A leader who survives a fight against you shows up again later — carrying a wound from the last one, at the head of a different band.

This is the world-exists-independently-of-you principle (§2) made mechanical, and it gives permadeath real weight on the enemy side too: killing a rival leader *for good* becomes an accomplishment rather than clearing an encounter. Needs: a persistent enemy roster instead of full regeneration, and the wound ladder to have somewhere to record what happened to them. Candidate for M2–M4.

## 11. Break runs

The 10–12% target is a *measured outcome*, not a design input — you'll only know after 50+ runs plus batch-sim data. Treat it as V0.2 instrumentation.

What V0 builds is the **shape** that permits it: multiplicative synergies gated behind real commitment cost.

- **Mutation stacking** — mutations compound, and mutants only accumulate them by surviving. Investing in keeping fodder alive pays off enormously or not at all.
- **Bionic builds** — a fully-installed True Kin line, bought with delves you took instead of reinforcements.
- **A hoarded machine core** — a few machines kept running at ruinous Water cost, backed by a horde too cheap to starve.

Each demands giving up immediate power. That's the shape of an earned break.

## 12. Run structure

- **15 encounters**, 3 acts × 5. Boss at 5, 10, 15.
- Enemy counts: Act 1 → 8–20 · Act 2 → 30–70 · Act 3 → 90–200+
- Starting roster depends on origin (see §13). End **~8–10 named + 100–140 rank-and-file**, plus whatever machines you found.
- Full warband identity lands around encounter 11 (~75%).
- **Target run length 25–35 minutes.** Deliberately short — you need to play this 30+ times, and every extra minute taxes iteration speed.
- **15 unit types**, 5 per lineage.

## 13. Origins

You choose who you are at run start. Two in V0.

### Scion of a House (True Kin)
The default. You inherit a warband and a name that means something to other Houses.

- Start with **2 Officers + ~12 mutant fodder**
- Recruit True Kin at standard cost — the bionics path is open from encounter 1
- The straightforward economy: buy quality, install bionics, delve for parts

### The Freed Firstborn (Mutant)
A slave, elevated to Firstborn by their owner as a House affectation, who walked away and started their own warband.

- Start with **1 Firstborn (you) + ~16 mutant fodder**, no Officers
- **True Kin recruit at a steep premium** — they won't readily serve under a mutant. This is the defining constraint.
- Bionics are **taxed, not locked.** True Kin cost more, so a bionic core is a slower, more expensive pivot — a real strategic option, just not the default one. Mutation stacking is the path of least resistance: survive, accumulate, promote your own Firstborn.
- Cheaper roster, weaker units, far more variance

The asymmetry is almost entirely **data** — starting roster, recruit price modifiers — not new systems. That's why two origins are affordable in V0 while House-specific bonuses are not.

**Founding mutations.** Where the Scion picks a commander from three rolled Officers, the Freed Firstborn picks **up to 3 mutations** for themselves at run start. That's the mutant origin's character-creation step, and it's the right shape for it: the True Kin start is about *who leads you*, the mutant start is about *what you are*.

It also seeds the whole run — those three mutations are the ones that leak to every squad you lead, so the opening choice sets the build you're pushing toward rather than just a stat bump. Picking fewer than 3 should be worth something (salvage, or a higher-level roll on the ones you do take), so "narrow and deep" is a real alternative to "wide and shallow."

*Later: individual Houses as sub-origins with their own traditions and bonuses. V0.1.*

## 14. Open decisions

- **"True Kin" is Freehold's proper noun.** Fine as a placeholder; rename before anything ships.
- **Individual Houses as sub-origins** (own traditions, own bonuses) are V0.1. The two lineage origins in §13 are V0 because they're pure data.
- **Title:** the repo is already called `salt_crown` — salt wastes, a crown for whoever holds the warband. Recommend keeping it until something clearly beats it.
- Numeric tables exist to be tuned by the batch-sim harness, not argued about in advance.
