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

**Prospects** — mutants, ~1 per dozen bodies recruited
- Mutants that came out of the vats with something useful. Individually named, individually simulated, individually killable — and permanently dead when killed.
- Carry the mutations. Sturdier than the fodder they came from (×2.2 HP), because being noticed at all means having survived something.
- **Can lead a squad of their own lineage.** Doing so steadies its discipline — more once they are a Firstborn — but does not pass their mutations to it. Mutations stay exactly what they say they are: what happened to this body. (Cut from an earlier build: a leading Prospect used to "leak" its mutations to the whole squad at half level. Nothing explained how one body's mutation reaches twenty others, and the game already has an honest mechanism for a leader steadying their squad — discipline — without inventing a biological one. Squad-wide buffs are V0.1's job, via relics and perks.)
- Every battle survived is a step toward **Firstborn** (M2). Prospects *are* the Firstborn pipeline.

**Fodder** — everything else
- Anonymous, grouped into squads by unit type. **No mutations at all.**
- A squad tracks `count`, `type`, and its leader (an Officer or a leading Prospect — never both). Deaths are a number.
- The roster shows one collapsed "Infantry: 128 bodies", expandable to the per-type breakdown. At 140 bodies you don't want twelve cards, you want one number and your handful of people.

### One leader per squad, of either kind

A squad has exactly one leader slot. Put an Officer there for a flat, reliable stat bonus. Put a Prospect there for a discipline bonus instead — cheaper to acquire, and it ties the squad's fate to a fighter who can die independently of it. **A Prospect cannot lead True Kin** — a mutant does not command that caste. The choice is asymmetric on purpose: an Officer changes what a squad CAN do, a Prospect changes how long it keeps doing it.

### Why mutations are individual, not squad-wide

An earlier version gave the whole squad a shared mutation roll — twenty Chaff, all with Horns 3. That is not how a random process works, and it made the recruit screen unreadable: you were buying a stat block rather than a person.

One or two standouts per batch is more believable *and* more legible. You are mostly buying the Prospects; the fodder is what comes in the same crate.

**"Prospect" is the True Kin's word for them** — worth watching, possibly worth elevating. It is exactly as condescending as it sounds, coming from a caste that bred them in the first place.

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
4. On death: remove; if Named, roll a wound zone and advance the wound ladder
5. Recompute each group's effectiveness from its remaining strength — the damage multiplier every attack above is scaled by

Nobody routs. A squad that has lost half its bodies is still on the field and
still swinging; it just swings softer, because effectiveness folds losses back
into damage (§7). Fewer bodies *and* weaker blows is what makes a collapse
superlinear, and it is what routing used to do less interestingly by simply
removing the squad from the fight.

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

## 5b. Scale — how comparable games limit forces

*Research, not yet a decision. Informs the open question of how many Prospects
a warband should hold.*

Every comparable game limits something, but **almost none of them limit the
total**. They limit the *rate of addition* or the *number fielded*:

| Game | What is capped | What is not |
|---|---|---|
| **Battle Brothers** | 12 fielded in a battle | roster of ~20 hired |
| **Mechabellum** | 2 unit deployments per round, plus a supply budget | total army size |
| **Slay the Spire** | 1 card reward per fight | deck size |

Two things fall out of that:

**A reserve is a feature, not overflow.** Battle Brothers explicitly keeps the
roster bigger than the battle limit so the wounded and exhausted can sit out.
The gap between *owned* and *fielded* is where injury, recovery and rotation
become decisions instead of bookkeeping.

**Difficulty scales off the fielded force, not the roster.** Battle Brothers
caps its AI scaling at your twelve strongest, so hoarding never taxes you.
Salt Crown doesn't scale difficulty at all (§7), which achieves the same end
more bluntly — but the principle matters if scaling is ever added: never make
the reserve a punishment.

**Salt Crown currently caps nothing.** Squads and Prospects are limited only
by salvage, which is why a run drifts toward a dozen-plus Prospects — too many
to care about individually, too few to trade as a commodity.

The direction this points: **hold many, field few.** Own any number of
Prospects, but cap how many can *lead* (~6). The rest are stock — appraised,
sold, or waiting for a slot. That makes the trade mechanical rather than
flavour and creates constant triage instead of pure accumulation. Pair it with
upkeep on held stock (M3's Water economy) and hoarding gets a price, which is
what makes a market a market.

Naming note: **"Prospect" should become "Prospect."** Assayers assay
prospects; the mining register is already established, and the word means both
"someone who might become something" and "a claim that might yield". It keeps
the condescension too — calling a person a prospect treats them as a site to
be worked.

## 5c. Battle and camp legibility — four gaps, three now decided

*Four things flagged in the same session: leaders are hard to track during a
battle, both as a HUD and on the canvas itself; squads of the same type don't
combine when you buy more; there's no battle log. Options were laid out below
before building anything; the squad list, the canvas marker, and the event
instrumentation are now decided and built. The HUD and the log's own UI are
the open remainder — see the status line closing each subsection.*

**Stale doc flag — resolved.** §5's per-tick resolution used to say a squad
"rolls to rout — flees the field," which stopped being true when morale became
a damage multiplier (§7). It now describes effectiveness instead. Left as a
note because the contradiction survived several sessions of building against
this doc: the sim was right and the spec was wrong, and nobody reading §5 in
isolation could have known that.

### 1 & 2. Seeing who's important, on the HUD and on the canvas

Both reports trace to the same root cause, so they're one problem with two
surfaces.

**What exists today:** `toSimGroups` (`packages/game/src/roster.ts`) gives
*every* Prospect its own one-body sim group, leading or not — "every
Prospect fights as its own body, including one that is leading," so none of
them can hide behind a squad and become unkillable. `BattleView.ts` draws a
banner (a 46px ring at 28% opacity, tinted to the team's accent colour, plus
a name label) over any group carrying a `leaderLabel`. Since every Prospect
carries one, **every Prospect in the warband gets an identical banner** —
not just the ones currently leading a squad. §5b already noted runs drift to
a dozen-plus Prospects; a dozen identical faint rings in the same hue read as
a texture, not as individuals. That's the literal mechanism behind "I can't
tell who is important other than the name" — the marker exists, it just
doesn't scale past a handful of instances.

Officers are the other half: they have no body in the sim (a pure stat
modifier per §4), so an Officer's banner rides on the first living body of
the fodder squad it leads — a stand-in position, not a real "this one is the
officer" marker. That's a deliberate consequence of Officers being abstract,
not a bug, but it means the two leader kinds already read differently up
close and any fix should keep that distinction rather than paper over it.

The only current interface for tracking any of this mid-battle is the
`Details` panel (`ParametersPanel.tsx`) — a full diagnostic dump of every
squad, Officer, and Prospect, gated behind the same toggle as tick count and
ms/tick. It's the right home for diagnostics and the wrong one for "is my
Firstborn still alive," which is a glance question, not a drill-down one.

**Decided — canvas marker: scale the body, add a tighter gold halo, glow
both.** ✅ Built (`apps/web/src/BattleView.ts`). A leader's own body now
renders at `LEADER_SCALE` (1.55×) via a per-unit multiplier folded into the
existing health-driven scale formula, plus an individual `GlowFilter` per
leader sprite — affordable because leaders are a few dozen sprites at most,
not the few hundred that made a layer-wide glow cost ~12fps. The ring itself
moved from team-accent at 0.28 alpha (which blended into the body's own team
tint) to solid gold at 0.9 alpha, resized to clear the now-bigger body as a
halo, and reparented into a new `haloLayer` added to the scene *before* both
team layers so it renders **behind** bodies instead of on top of them — it
used to be drawn last specifically to sit over everyone, which worked when it
was a flat disc but would have swallowed a scaled-up body if left in front.
Verified in a live browser session (headless Chrome over CDP, since neither
`chromium-cli` nor Playwright was available in this environment): a leading
Prospect visibly pops out of a packed formation now, clearly bigger with a
gold halo, where before every Prospect's marker looked identical regardless
of count.

**Known follow-up, not fixed:** with two leaders adjacent, their name labels
overlap into illegible text (confirmed in the same screenshot pass — "Warden
Umber of Vexhall" and "Bell" collided into unreadable overlap). This is
pre-existing label-anchor logic this pass didn't touch — it reads worse now
only because the markers themselves are more prominent, not because the
labels changed. Needs its own pass: likely stacking colliding labels
vertically, or truncating to initials when crowded.

**Decided — HUD: a small always-on strip on the Battle screen.** ⬜ Not built.
Reads from the same throttled `ViewStats` snapshot `ParametersPanel` already
uses (`liveStats.combatants`), filtered to named leaders and restyled for a
glance instead of a dump — portraits or initials, HP, alive/dead. This does
not put battle state in React any more than the existing debug panel already
does; it's the same bridge, read differently. Lives on the Battle screen
itself, not behind `Details`. Deferred behind the wound ladder and persistent
rival leaders (§10) per the priority call made when these options were
decided — revisit once that foundation exists, since the HUD may want to
surface wound state once there is any.

### 3. Buying more of a squad you already have

**What exists today:** `buy()` (`packages/game/src/run.ts`) always pushes a
*new* squad, even when a squad of the same `typeId` is already in the battle
line. This means two batches of the same unit type can carry **independently
assigned leaders** and independent battle-line positions — a real capability,
not an oversight, since `assignLeader` operates per squad id and nothing
stops two Chaff squads from having two different Officers.

Auto-merging on every buy would quietly remove that capability the first time
it happened to matter, which is worse than the current clutter. Options,
roughly in order of how much they touch the invariant above:

- **Do nothing structural — fix the list instead.** Sort or visually group
  squads of the same type adjacent to each other in the battle line. Answers
  "there needs to be some way to organize squads" without touching the sim
  or the leader-per-squad capability at all. Cheapest, safest, and doesn't
  foreclose anything.
- **Conditional auto-merge.** Merge a new batch into an existing squad of the
  same type only when that squad is *unled* and the new batch carries no
  standout Prospect to lead — i.e. only when merging can't destroy a
  leadership assignment. Reduces clutter for the common case (buying plain
  fodder) without the surprising-silent-behavior-change risk.
- **Explicit merge action.** A button on a squad row — "Combine with other
  Chaff" — so consolidation is the player's decision, not an automatic one.
  Most player agency, most new UI.

**Decided: the list fix, nothing structural.** ✅ Built (`buy()` in
`packages/game/src/run.ts`). A newly bought squad now lands directly after
the last existing squad of the same type instead of always at the tail —
repeat buys cluster in the battle line without touching squad identity,
counts, or the independent-leader capability at all. Conditional auto-merge
stays the candidate follow-up if clutter still bothers after this.

### 4. A battle log

**What existed before this session:** nothing. No event structure existed
anywhere in `packages/sim` — the sim resolved state, `BattleView` read it back
out via per-tick arrays for rendering. A log needed new instrumentation, not a
new view on existing data.

**Decided: build the shared instrumentation now, log UI later.** ✅ The sim
side is built (`packages/sim/src/battle.ts`, `types.ts`) — the UI is not.
`Battle` now carries a preallocated, fixed-capacity (512) ring buffer of
`BattleEvent`s: a named individual (a Prospect fighting as its own body, per
§4's note above — never a fodder squad, which has no individual identity to
report on) taking a hit or dying, or any group's effectiveness first crossing
`COLLAPSE_THRESHOLD` (0.6 — the same constant `Report.tsx`'s `.collapsing` row
now imports, so the sim event and the report table can never drift apart).
Kept a pure side-channel: `newEventsSince(lastCount)` is the only read path,
called by the renderer at its own throttled rate rather than the tick loop,
so it allocates outside `step()` only — the "no allocation in the tick loop"
rule is about the loop itself, not about reading the result back out. Covered
by five new tests (`packages/sim/test/determinism.test.ts`, "Battle events"):
fodder alone never emits Hit/Died, a losing fodder squad still emits
Collapsed, Collapsed fires exactly once per group rather than once per tick
below threshold, a named individual's Hit/Died events carry its real label,
and `newEventsSince` is cumulative with no gaps or repeats when polled every
tick. All 62 tests pass, including the golden-seed determinism suite — the
event buffer doesn't perturb outcomes.

**This overlaps items 1&2's HUD directly**, but not identically: the HUD
wants continuously-updated *state* (current HP, alive/dead), which the
existing throttled `ViewStats` snapshot already provides — the event buffer
instead wants to feed a *history* (what happened, in order), which is what a
scrolling log needs. Both are worth building on the same instrumentation, but
they're complementary reads, not the same one. The log's own UI — where it
renders, how far back it scrolls — is deferred alongside the HUD, behind the
wound ladder and persistent rival leaders per the priority call below.

### Priority call

Playtesting feedback the same night this section was written: the economy has
no pressure once a few battles pass (nothing stops buying every recruit — true
today, since Water and its upkeep are M3 and unbuilt), and the run doesn't
yet feel like it has consequence. Both trace to the same place: the wound
ladder and permadeath are M2 and unbuilt, and the persistent-rival-leaders
direction below is explicitly blocked on the wound ladder existing first.
**Decided:** wound ladder + persistent rival leaders come next, ahead of
finishing the HUD/log UI above and ahead of Water. The event buffer built in
item 4 is a direct dependency — a rival leader's history is exactly the kind
of thing it exists to record.

**Wound ladder: ✅ built** (see §7's own subsection for the full account,
including a real freeze bug it surfaced and fixed in the canvas work from
earlier the same session). **Persistent rival leaders is next** — it was
explicitly blocked on this, and now isn't.

Also decided: gear stays Officers-only (bionics, M3, unbuilt) for now.
Prospects do not get a second itemization layer alongside mutations —
mutations already are their build, and mutations/bionics exclusivity per
lineage is a load-bearing invariant (CLAUDE.md), not a gap to fill.

## 6b. Numbers vs composition — a settled decision

**Combat follows Lanchester's square law, and that is deliberate. Do not try to flatten it.**

Measured with `npm run sim:leaders`: in a mirror match, a **+5% body count wins ~95% of the time**. With 201 vs 211, the stronger side finishes with `√(211² − 201²) ≈ 64` survivors — the outcome is arithmetically determined, not a coin flip. This is inherent to any model where every unit contributes damage simultaneously.

Three fixes were tried and measured, all rejected:

| Attempt | Outcome |
|---|---|
| Widen the battle front (10 → 22 → unlimited rows) | No meaningful change; +5% still ~95% |
| Cap attackers per target at 3 | +20% edge went 100% → 95%. Marginal. |
| Cap at 2 | Battles stopped resolving at all |
| Cap at 3, verified | **1 in 60 battles stalemates.** Reverted. |

The only real fix is fixed engagement slots — a fixed number fighting per side regardless of army size, with the rest as replacements. That is a true linear law and a combat-model rewrite.

**We are keeping the square law**, because:

1. It *is* the "absurdly overpowered run" pillar. Being 20% stronger should trivialise a fight; if it didn't, breaking the game wouldn't be a reward.
2. Snowballing is the natural shape of an attrition game.
3. **The intended counterweight is multiplier depth, not curve flattening.** As mutations, bionics and gear stack, quality multipliers grow large enough that raw body count stops being the dominant term. A squad at 2.5× effectiveness beats one 30% larger.

The consequence to accept: outcomes are largely decided before you march, and **balance tuning is knife-edge** — small changes to the enemy budget swing bot completion wildly (observed: 3% → 82% → 21% across single-constant changes). Always retune against `npm run sim:campaign` after touching combat, and never trust a single run.

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

**✅ Built** (`packages/game/src/wounds.ts`, wired into `run.ts`, `roster.ts`,
`officers.ts`, and the Camp screen). One escalating wound per individual, not
several independent ones: the first hit taken while surviving rolls a zone and
starts at Strained; a later hit while already wounded moves the *same* zone up
one rung, capped at Crippled. `TREAT_COST` (40 Salvage, placeholder) buys one
rung of paid recovery — a "Treat" button next to the wound on the Prospects
roster row. `WOUND_PENALTY` (10% / 22% / 38% by rung, placeholder) is the
fraction knocked off the zone's stat(s); all four numbers are exactly the kind
this doc's own rule (§14) says to tune with the batch-sim harness, not argue
about in advance.

**One real gap in "Named tier only, individually":** Officers have no body in
the sim — they're a pure stat modifier (§4) — so they can't use the direct
"took a hit" trigger a Prospect uses. Proxy instead: if the squad an Officer
led ended a battle COLLAPSING (§7's own effectiveness threshold), they had a
`OFFICER_WOUND_CHANCE_ON_COLLAPSE` (35%, placeholder) chance of a wound too.
And since an Officer has no HP/damage/speed stat for a zone to individually
target, **any** zone on a wounded Officer scales their entire squad bonus down
by the same fraction — a simplification the original zone table didn't fully
specify for a bodyless leader, made explicit here rather than left implicit.

**Also not done: Officer wounds have no UI.** They're tracked and mechanically
applied — a Crippled Warden really does grant less armour — but there's
nowhere to see or treat one, because Officers have no roster view at all yet
(only `ParametersPanel`'s `Details` debug dump lists them). That's the
"Roster screen showing the whole warband at a glance" ROADMAP already
scopes for M2 — Officer wound surfacing belongs there, not bolted onto Camp
ahead of it.

**A real bug found and fixed while building this:** the canvas leader marker
work earlier in this session gave each leader body an individual `GlowFilter`,
created fresh on every `start()` (every march). Nothing destroyed the
*previous* battle's filters before their sprites were destroyed, which stayed
invisible for exactly one battle and then froze the second one solid — sim
tick count stopped advancing, 0.00 ms/tick, no thrown exception, just a dead
frame with PixiJS warning that a texture was destroyed while still bound to a
shader. Confirmed via headless Chrome over CDP: frozen on battle #2 before the
fix, six consecutive real battles clean after it. Caught before it reached
you only because "does a second battle in the same run even work" turned out
to be exactly the kind of thing generic single-battle testing doesn't cover.

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

Rival warbands already generate named Officers and Prospects as squad leaders (`generateEncounter`). The natural extension: some of them **persist** instead of being regenerated fresh each encounter. A leader who survives a fight against you shows up again later — carrying a wound from the last one, at the head of a different band.

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

These are personal, not squad-wide — see the note above on the leak being cut. What they seed is the player's own body: the Freed Firstborn fights as an individual every battle, same as any other Prospect, so their opening choice decides what that individual can do for the whole run. Picking fewer than 3 should be worth something (a higher-level roll on the ones you do take), so "narrow and deep" is a real alternative to "wide and shallow."

*Later: individual Houses as sub-origins with their own traditions and bonuses. V0.1.*

## 14. Open decisions

- **"True Kin" is Freehold's proper noun.** Fine as a placeholder; rename before anything ships.
- **Individual Houses as sub-origins** (own traditions, own bonuses) are V0.1. The two lineage origins in §13 are V0 because they're pure data.
- **Title:** the repo is already called `salt_crown` — salt wastes, a crown for whoever holds the warband. Recommend keeping it until something clearly beats it.
- Numeric tables exist to be tuned by the batch-sim harness, not argued about in advance.

## 15. Player wishlist — raised 2026-08-24, deliberately not V0

Requested directly by the player after playing several runs, in the player's
own words below each heading. **None of this is built.** Explicitly deferred
until V0 is complete — see CLAUDE.md's stated main risk ("scope creep toward
the full vision"). Logged here rather than dropped, so it survives to be
picked up in the right order instead of being reconstructed from memory.

### Growth should feel like an event, not a notice

*"I really want to feel a few things when playing this game... random
mutations should be a bit more rare and should be an exciting event... A few
times I've not even noticed I had a choice of mutations so maybe a modal
instead."*

Partially addressed already: growth picks became a full-screen takeover
(`apps/web/src/screens/camp/GrowthScreen.tsx`) the session before this request
was raised, specifically because a card between the status bar and the shop
tabs was easy to miss. Whether that is enough — versus wanting rarer growth,
more ceremony (animation, sound, framing), or both — is unresolved. Revisit by
asking whether the takeover alone reads as an event once played again.

### An "excited genome" — a rare trait that accelerates growth

*"I like the idea of an 'excited genome' that increases the mutation level at
a rapid speed. Need a different name for it."*

Not a stat mutation like the rest of the MUTATIONS table — a meta-trait that
changes the RATE a body earns growth (`BATTLES_PER_MUTATION` in
`prospects.ts`, currently a flat constant for every Prospect). Needs its own
mechanism: either a special roll a Prospect can carry, or an effect a growth
choice itself can grant. Naming: keep it in-world register with the rest of
the mutation table (`Horns`, `Carapace`, `Twitch Reflex`) rather than a
biology-textbook term like "genome."

### Mutation levels scaling past the current cap

*"It'd be nice if mutation levels could scale past 10."*

MUTATIONS levels currently run 1-6 (Qud-style — see mutations.ts). Whether
this means raising the general cap, or specifically letting ONE exceptional
mutation on an exceptional body climb past the normal ceiling (tying into the
accelerant trait above), is still open — worth resolving together rather than
guessing which.

### Legendary creatures with backstory ✅ built — factions ✅ built (identity only)

*"Coming across a legendary creature like in Qud with some bit of backstory
to them... I think it might require more factions like Qud has as well to
really add story to make the world feel more alive but there is a sense of
awe there and legendary creatures need to be highlighted as they possess much
strength."*

Two connected asks; only the first is built. Four legendaries (Widowsalt, The
Ungraded, Glasskeeper, The Standing Debt — `legendaries.ts`), each with a real
backstory paragraph, rolled as a low-probability sub-roll inside an ordinary
`wasteland` encounter rather than as a fourth boss tier: unpredictable rather
than a checkpoint, and most runs will only ever meet one or two. Never repeats
within a run. Highlighted on screen with the same "named individual" system
Officers/Prospects/Machines already had — HP bar, name banner, larger sprite —
plus a gold march-card border distinct from a boss's red one.

The first tuning pass was wrong the same way the act-1 boss's first pass was:
sized by feel, not measurement, and all four lost to an early Chaff swarm at
any size because their damage one-shot cheap fodder before numbers could
matter. Retuned against the same probe used for the boss; see the full account
in `legendaries.ts`'s own module comment, including a real, measured, and
un-fully-closed gap in how hard this content hits the Freed Firstborn origin
specifically — flagged there for M5's eventual larger balance pass rather than
chased to zero here.

**Factions, scoped deliberately.** Per-House mechanical bonuses ("sub-
origins") are explicitly named in ROADMAP.md as one of the few things
called out as the main risk to this project's scope discipline if pulled
forward — so this stayed identity and narrative only, nothing mechanical,
nothing that touches a player's own choices or stats.

`officers.ts`'s eight Houses (Vantry, Oskal, Merethel, Caldrion, Thessaly,
Ambrose, Wexhall, Duon) existed already, but as interchangeable name
tokens — every Officer got one at random and nothing distinguished them.
Each now carries a real one-line blurb, the same shape a unit type's own
blurb/description already has. Wired into where a House can actually show
up: a rival warband fielding an officer is now named and flavoured after
that officer's own House ("Levies of Vantry", with Vantry's own blurb as
the encounter's flavour text) instead of the generic, disconnected
scav-band name pool — a band led by a real House now reads as one. An
officer-less band stays exactly what it was, unaffiliated opportunists.
Surfaced at the moment it matters most, too: the Scion's founding
commander pick (LeaderSelect.tsx) now shows the House's identity alongside
the rank effect, so picking a House is a real flavoured choice on the very
first screen of a run, not a label discovered later by accident.

Legendary-faction ownership and House rivalry as an active mechanic remain
open — the natural next connection, not built here.

**Followers, checked against the finished fiction, not the first draft of
it.** An earlier session proposed followers for multiple legendaries by
feel — Widowsalt leading Salt Hounds among them — before the backstories
above were finished. Re-read against the actual text before building
anything: Widowsalt's is explicit that a pack would be a direct
contradiction ("the only Salt Hound left... hers included"), and The
Ungraded and The Standing Debt are both written as solitary by construction
too. Only Glasskeeper's fiction actually asks for company — "the swarms
that follow it are not an accident" — so only Glasskeeper got one: a fixed
18-body Glasswing escort (`buildLegendary`, encounters.ts), not scaled to
encounterBudget, matching every other legendary's fixed-power design.

Measured before shipping: a Chaff-count threshold sweep against the sim
directly (`tools/_glasskeeper.ts`, not checked in) showed solo Glasskeeper
crossing from losing to winning around 15-20 Chaff, escorted around 30-35 —
a real, roughly 50% tougher threshold, not a cosmetic addition. Kept at 18
on request rather than softened, so — like the enemy-gear chances above —
this is a deliberate difficulty increase for this one legendary specifically,
not an unmeasured one.

### Relics and synergistic perks ✅ built

*"Finding relics. Choosing perks that synergize. All the synergies."*

Built as the documented landing spot for squad-wide buffs — see ROADMAP.md's
post-M4 entry on cutting the mutation leak: *"Squad-wide buffs are deferred
to V0.1 relics/perks, which can explain themselves — carrying a totem or a
banner leaking effect to a formation has a mechanism a body's own biology
does not."*

A relic binds to a SQUAD, not a leader — the deliberate opposite of a
bionic, which installs into an Officer and is True-Kin-only by construction.
Any squad can carry one, fodder included, which makes it the first thing in
the game that can strengthen a bare mutant squad without a Prospect leading
it or a mutation roll landing well. Found on expeditions only (`relics.ts`),
same door bionics come through, and rarer (0.2 chance per delve vs bionics'
0.34) so it reads as a genuine find rather than routine salvage.

"Perks that synergize" turned out to mean the effect should sometimes read
the squad it's bound to rather than apply a flat number: Vat-Brand only
helps a mutant squad (the one lineage with no other equipment path at all);
Iron Ward multiplies EXISTING armour rather than adding a flat amount, so
it's worthless on a Chaff squad and real on a Thornback line. The choice
these create is which squad should carry a scarce find, not whether to take
it — the same shape "install" already has for bionics, just answered by
composition instead of availability.

Measured with `npm run sim:campaign --delve`: about 0.24 relics bound per
run at the current find rate, next to roughly 1 maiming per run at
MAIM_CHANCE. PLACEHOLDER numbers, same as every other new system this
session — a real tuning pass wants more data than one measurement.

**Extended to enemies** — *"are enemy warbands able to have relics as well?
... I want rules to apply to everyone."* A rival band built by
`buildWarband` (encounters.ts) can now spawn already carrying a relic on
one squad and an implant on its officer, one roll each for the whole band
rather than per squad — rolling per squad on a six-squad Act 3 band would
have made enemies systematically richer in found gear than the player,
which is the opposite of the ask. Scoped to ordinary rival bands only:
wasteland fauna carry none by design, and a boss or legendary's own body
keeps its separately-measured tuning untouched (a boss's WARBAND ESCORT,
built the same way any rival band is, can still inherit one). No visibility
gap to solve on top of it — `scoutEnemy` already reads real resolved stats,
so a rival band's gear already shows up in the armour read before you
march, the same way it would if it were yours.

Measured before shipping, same discipline as MAIM_CHANCE and the on-curve
buying lever: A/B on identical seeds, thrifty completion, ENEMY_RELIC_CHANCE
0.12 / ENEMY_BIONIC_CHANCE 0.3 vs both at 0. 34/150 (22.7%) with enemy gear
off, 26/150 (17.3%) with it on — a real ~24% relative difficulty increase,
not free flavour. Kept at the measured strength on request rather than
softened, so this is an intentional tightening of the curve, not an
unplanned one.

### Point-buy growth instead of choosing 1 of 3

*"They should each have a relative cost / value. I think I'd rather it be a
point and buy system instead of choosing 3."*

Two changes bundled together, not one:

1. Give every row in `MUTATIONS` (`mutations.ts`) an explicit relative
   cost/value. There's an implicit one today — `PROSPECT_COST_PER_LEVEL` in
   `prospects.ts` prices a held mutation flat-per-level at purchase time,
   treating Horns and Flaming Ray as equally valuable per point. They aren't:
   some carry a drawback (Serrated Claws' accuracy loss, Flaming Ray's own
   -20% damage, Dense Bone's move penalty), some are strictly additive.
   Costing them for real is prerequisite work either way, purchase price and
   growth would then both read from the same table.
2. Replace `rollGrowthChoices`' "3 random offers, pick 1" (`GROWTH_CHOICES` in
   `prospects.ts`) with a budget the Prospect spends across the open
   `MUTATIONS` pool, rather than picking from whatever three the roll
   happened to surface.

Open, not decided here: what the budget *is* — points per growth tick
(replacing "one mutation" as the unit entirely), or points layered on top of
today's capacity-slot system. Whether points can also buy level within one
mutation, which would fold in the still-open "levels scaling past the cap"
ask above — a point-buy naturally lets a player choose one deep mutation over
several shallow ones, which is a different shape of choice than a fixed level
roll. And whether losing the lottery framing at growth time (today's
"survive, and you *choose*" contrast against the shop's blind buy) is a
tradeoff worth taking for the added control, or works against the market
already built around scarcity and appraisal. Needs a real design pass before
implementation, not just a mechanical swap.

### Permanent injuries — dismemberment ✅ built

*"What is the effort to add an injury system? Dismemberment, maiming,
decapitation? Could just be for important fighters"* — followed by *"I think
it would be uncommon but maybe dependent on what they are attacked by...
Also, I think it's important enough to have a visual tell"* and *"I would
like to track who did the dismembering and track how many dismembers each
important character has... an who they dismember."*

The existing wound ladder (§7) turned out to fully heal end to end, so this
needed something the game didn't have anywhere: a body permanently down
something. A Prospect's own body — the only named tier with one, see §4 —
rolls once at the moment it would otherwise die in the sim (`MAIM_CHANCE`,
currently 0.12, PLACEHOLDER) to survive maimed instead. Officers have no
body of their own and stay on the existing collapse-proxy wound; Machines
already have condition decay as their permanent-loss story and don't get a
second one.

Attribution is real, not composition-approximated: the sim tracks which
group last landed the blow (`Battle.resolveDeath`, extends the existing
Hit/Died event system with a `Maimed` type and a `sourceGroupIndex`/
`sourceLabel` pair) and hands it back through `resolveBattle`. Harm kind
(blade/pierce/blunt/burn — what the injury reads as, "a hand taken clean
off" vs "a wound that never closed right") is guessed from the attacker's
label rather than threaded through as a real type, because the sim is
deliberately lineage-blind and never knew what a Halberdier was in the
first place — see `wounds.ts`'s `harmKindFromLabel` for the actual
constraint this worked around.

The trophy side: a Prospect whose own body dealt the blow (not a squad it
merely leads) accumulates `dismemberments` — who, and which encounter.
Visual tell is a small permanent glyph on the roster row, same technique as
the mutation icons two requests earlier, plus a `×N dismembered` badge.

Measured, not assumed: `npm run sim:campaign` now reports a `maimed` line.
At MAIM_CHANCE 0.12 it fires about once per run across both sides — rare
per encounter, but the cumulative effect over a full campaign is real:
thrifty completion rose from 31/150 to 42/150 runs against the same seeds
used for the water/oncurve measurements earlier in this doc's history,
because a body that used to die outright now sometimes doesn't. Worth a
real tuning pass once there's more data than one comparison — flagged here
rather than adjusted by feel, same discipline as the boss and legendaries
needed the first time.

### A liquids system, not just a water system

*"We should have a liquids system not just a water system."*

Raised in passing, not built. Water (`water.ts`) is currently the only
liquid resource — upkeep scaled superlinearly by roster size, the one thing
Water exists to punish. What "liquids" (plural) would actually add on top —
a second liquid resource with its own economy, fuel or coolant for
Machines, something narrower like a rare cistern find — is undecided.
§14 already lists Coolant as a named, explicitly-cut V0.1 system, which may
be exactly this ask under a different name — worth checking that
connection before scoping anything new.
