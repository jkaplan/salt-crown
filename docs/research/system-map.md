# Reading: what Salt Crown's systems actually touch

Taken 2026-09-06, against master at `39cd87e`. Stage 1 evidence — our own,
before anybody else's.

**This document contains no design proposals.** That is deliberate: evidence
and inference are kept apart so the evidence does not get bent toward the
conclusion somebody wanted. What to do about any of this belongs in a plan.

## Why this exists

The complaint, in the player's words: *"it does not feel very cohesive. The
only reason I understand what is going on is because I was a part of it."*

A prose answer to that would be unfalsifiable. So the question was narrowed to
one a script can settle: **which of this game's quantities touch each other,
and which are islands?**

## Method — and what it gets wrong

`npm run map` ([tools/system-map.mjs](../../tools/system-map.mjs)). For every
file in `packages/game/src`:

1. Strip comments. This repo is comment-heavy and a paragraph *about* morale is
   not a system touching morale.
2. Find every mention of the twelve quantities a player carries.
3. Two quantities **interact** only if they appear **within three lines** of
   each other — an expression, an argument list, a returned object literal.

Step 3 is the load-bearing choice. Sharing a 200-line orchestrator like
`advance()` is co-location, not interaction; counting it as interaction makes
every system look connected to every other and the map says nothing. Under the
loose test every quantity "meets" eight or nine others. Under the strict one
the picture below appears.

**Known false positives, found by spot-checking**: import blocks (`mutations +
wound` at [prospects.ts:2-3](../../packages/game/src/prospects.ts#L2-L3), `bionics
+ mutations` at [roster.ts:3-4](../../packages/game/src/roster.ts#L3-L4)) and
prose inside data strings (`discipline + water` at
[wasteland.ts:84](../../packages/game/src/wasteland.ts#L84), which is a
creature's flavour text). Each of those pairs is *only* supported by its false
positive, so the true figures for the weak pairs are lower than printed, not
higher. That error runs in the direction that makes the finding stronger.

Everything below is **measured** unless marked otherwise.

## What each quantity touches

| Quantity | Touches | What |
|---|---|---|
| salvage | 5 | bionics, gap, morale, water, wound |
| water | 5 | bionics, discipline, gap, morale, salvage |
| morale | 5 | bionics, discipline, gap, salvage, water |
| bionics | 5 | morale, mutations, salvage, water, wound |
| wound | 4 | bionics, capacity, mutations, salvage |
| gap | 4 | morale, salvage, stragglers, water |
| mutations | 4 | bionics, capacity, instability, wound |
| capacity | 2 | mutations, wound |
| discipline | 2 | morale, water *(the water link is a false positive — see above)* |
| instability | 1 | mutations |
| stragglers | 1 | gap |
| **condition** | **0** | **nothing** |

## The pairs, by weight

```
 13  salvage + water            the economy's spine
 12  morale + salvage
  7  morale + water
  6  bionics + salvage
  5  capacity + mutations
  4  discipline + morale
  4  salvage + wound            treatment costs salvage
  3  bionics + water
  3  gap + water
  3  gap + morale
  3  gap + stragglers
  2  bionics + morale
  2  bionics + wound
  2  instability + mutations
  1  gap + salvage              one branch of one event
  1  capacity + wound
```

**There is a core and there is a fringe, and the gap between them is large.**
Salvage, water and morale account for 32 of the 71 interaction sites between
them. Below four sites, a pair is one or two lines of code holding two systems
together.

## The three islands

**1. Machine condition touches nothing.** Zero strict interactions with any
other quantity. It reads hp, damage and cycle time
([machines.ts:98](../../packages/game/src/machines.ts#L98)) and is read by
nothing else. Running a machine costs a **flat** `MACHINE_RUN_COST = 55`
([run.ts:1187](../../packages/game/src/run.ts#L1187)) regardless of its
condition, so a machine at 6 costs exactly what one at 1 costs. Condition is
restored by one branch of one event and by nothing else. The meter goes down
and the player watches it.

**2. Instability touches only mutations, in two places.** Written at
[run.ts:280](../../packages/game/src/run.ts#L280), halved at
[prospects.ts:465](../../packages/game/src/prospects.ts#L465). Both verified as
real. It is a closed loop — push past capacity, gain instability, roll a flare,
gain a mutation, halve the instability — with no exit into salvage, water,
morale, the road or the battle. It is also the **newest** system in the game.

**3. Stragglers touch only the gap.** Three sites, all in `advanceLeg`. Bodies
fall behind, and the only other quantity that hears about it is the distance to
the quarry.

## The verb table — the sharpest result

Every player action is an exported function in
[run.ts](../../packages/game/src/run.ts). Which quantities does each touch?

| Quantity | Verbs | Which |
|---|---|---|
| **salvage** | **12** | appraise, assignRelic, buy, installBionic, recallExpedition, rerollOffers, resolveEvent, resolveTrailEvent, sellProspect, sendExpedition, treatOfficer, treatWound |
| stragglers | 3 | advanceLeg, resolveTrailEvent, setOut |
| morale | 3 | resolveEvent, resolveTrailEvent, setOut |
| water | 2 | advanceLeg, resolveTrailEvent |
| wound | 2 | treatOfficer, treatWound |
| gap | 2 | advanceLeg, resolveTrailEvent |
| instability | 1 | chooseMutation |
| condition | 1 | resolveEvent |
| mutations | 1 | chooseMutation |
| bionics | 1 | installBionic |
| capacity | 0 | — |
| discipline | 0 | — |

Two of the three verbs for morale, and one of the two for water, are
`resolveEvent` / `resolveTrailEvent` — *things that happened to you*, not
actions sought out. Strip those and the reactive ones (`advanceLeg` is walking,
not deciding) and the deliberate picture is:

- **salvage: ten verbs.**
- **wound: two, and both of them spend salvage.**
- **mutations, bionics, instability: one each.**
- **water, morale, condition, gap, capacity, discipline: none.**

**One quantity is played with. The other eleven are watched.**

## What is not established here

- **Nothing about how it feels.** Everything above is structure. Whether a
  player experiences a low-interaction quantity as incoherent is exactly the
  kind of claim this document exists to avoid making. It is assumption A4/A1
  territory in [PLAN.md](../PLAN.md), and it needs a person.
- **Interaction count is not a quality measure.** A quantity can legitimately be
  a display. This map says which ones are, not which ones should be.
- **The battle sim was not mapped**, only `packages/game`. Discipline and
  condition both reach into `packages/sim` through resolved stats, which this
  method does not follow. Their true degree is higher than 2 and 0
  respectively — but only into the battle, not into the run.
- **Verb *availability* was not measured**, only verb existence. How many of the
  twenty are live at a typical camp is a different and worthwhile measurement,
  and it needs the harness instrumented rather than a script over source.

## Reproducing it

```
npm run map              # prints all three tables
npm run map -- out.json  # also writes the raw pairs and verb sets
```
