# Plan: A travel phase between camp and battle

Status: **agreed** — 2026-09-05

Stage-4 note, per the gate in `dev/CLAUDE.md`: the riskiest assumption here —
that a travel phase makes a run feel *better* rather than merely *longer* — has
**not** been spiked, because no cheap probe tests it short of building the
thing. This status says agreed anyway, deliberately and with that named. The
first playable version is the test.

## Why this exists

Requested directly: the run should feel more like Oregon Trail — the road
itself should be a place something happens, not a number paid once. Today
`march()` is instant: camp ends, Water is charged, battle starts. Nothing
occupies the space in between, so nothing about the *trip* to an encounter is
ever felt, only its bill.

The stronger argument, which emerged while planning: **travel adds almost no
verbs. It gives the ones already in the game a reason to exist.** Treating a
wound, benching a body, running a machine — all three are near-automatic
today. A long march makes each of them a real call.

## Where it sits

`camp → [NEW: travel] → battle`, replacing today's `camp → battle` cut. Reuses
the phase machine already in `run.ts` (`'camp' | 'battle' | 'report' | 'over'`)
— this adds `'travel'` as one more phase, not a parallel structure. The March
button enters travel instead of calling `march()` directly; `march()` still
runs at the end of travel to pay out and resolve desertion right before the
fight.

## What changes

### 1. Three paces — Column, Forced, Killing

An escalating ladder, not a dial with a safe end. Column is the baseline and
costs exactly what marching costs today; every rung above it saves Water by
spending fewer days on the road, and charges more steeply for it. There is
deliberately no "slow down" option: the only question is how much you are
willing to break them to save water.

| Pace | Water | Cost |
|---|---|---|
| **Column** | baseline (today's cost exactly) | — |
| **Forced** | less | morale hit; they arrive worn |
| **Killing** | least | bigger morale hit, **and bodies die** |

Names are real marching terms so none needs a tooltip. "Forced march" is the
actual military phrase; "a killing pace" says precisely what it does.

Pace **locks** for the whole march. A trail event may offer to change it as one
of its branches ("the wash is flooded — ford it now, or make camp and lose the
day"), which costs no new UI because `events.ts` already renders branching
choices, and makes events the thing that disrupts a plan rather than a menu
the player pokes at. Commitment stays real; the road is what breaks it.

### 2. Death on the road is the wound ladder, not a new dice roll

**Fodder only — never a named Prospect or Officer.** And it is explicitly not
a fresh death roll: a hard pace **escalates a wound rung**, so the body that
does not get up is *the one that was already hurt*. Nothing dies at random;
it dies of something the player could see in camp beforehand and could have
paid `TREAT_COST` to prevent.

That coupling is what makes Killing pace fair rather than cruel, and it is
why treatment stops being optional.

### 3. Straggling, keyed to discipline

Historically the dominant cost of hard marching — Lee lost a large fraction of
his army to it before Antietam; Napoleon's 1812 campaign lost far more men to
straggling and exhaustion than to battle. Critically, **straggling is a
discipline problem, not only a fatigue one**, which means it maps onto a stat
the game already has:

- Mutants (discipline 0.35) straggle badly
- True Kin (0.78) hold together
- Machines (1.0) never straggle — they break instead

Stragglers rejoin a leg or two later, or they don't. This turns Killing pace
from a flat loss into a gamble with a tail, and makes *arriving early* versus
*arriving whole* a genuine tension.

### 4. Legs

Fixed at **3** per march for the first version — comparable in the harness,
predictable in rhythm, trivially changed later.

**Distance is shown at camp, before the buy**, and this is load-bearing rather
than cosmetic. It is the condition under which variable march length later
becomes safe: a hidden variable distance is an unearned run-killer (a run that
dies to three long marches in a row lost to nothing the player could play
around), whereas a *visible* one turns the same variance into a forecast —
buy light for a long haul, heavy for a short one. That makes the existing buy
decision richer rather than noisier.

### 5. The other three march factors

- **Machines wear on the road.** Reuses `applyCondition` and
  `MACHINE_CONDITION_MAX`; no new system. Makes the 12× Water a machine
  already drinks bite harder over distance.
- **Treatment matters before you leave.** Camp warns which bodies are likely
  to worsen at the pace being considered, so the choice is informed rather
  than discovered afterwards. Mostly UI on top of the wound coupling above.
- **Water found on the road.** A trail event can trade salvage for Water — the
  same trade Scavenge already makes, in a new place. Gives a march that went
  badly a way to recover, and gives trail events something to do besides hurt.

### 6. Water accounting

Moves from one lump sum at `march()` to a per-leg draw that sums to the same
total at Column pace — a reskin of existing math, not a silent rebalance.

## Deliberately not in this

**The fence moved once, deliberately, and that is recorded rather than
quietly edited:** an earlier draft ruled out *any* death outside the wound
ladder. Killing pace now kills. It was allowed through on two conditions —
fodder only, and routed through the wound ladder rather than around it — which
is why the rule it breaks is narrower than it looks.

Still out:

- **No food system.** Agreed in shape (below) and explicitly not built here.
- **No camp/baggage upgrades.** Same — agreed in shape, not built here.
- **No map, no route choice, no branching paths.** Legs are linear.
- **No terrain or weather.** Landmark text is flavor keyed to act/encounter,
  not new state.
- **No load or weight stat.** It would mostly duplicate what Water already
  does — tax by headcount.
- **No battle-time effect.** Travel changes what *arrives* at the fight —
  bodies, Water, morale, wounds — never battle mechanics or posture. Pace is a
  camp-phase economic choice, the same category as buying gear.

## How it gets proved

Extend `sim:campaign`'s bots to march at a fixed pace and run legs headlessly.
Baseline is the current post-Instability reading: **9.0-10.0% greedy
completion over 300 runs**.

```
predicted:  Column pace, greedy, 300 runs: completion within 2 points of the
            9.0-10.0% baseline — this is a reskin at Column, not a rebalance.
            Forced:  measurably lower Water spend AND measurably lower morale
                     than Column on the same seeds.
            Killing: measurably fewer bodies arriving than set out; the gap
                     between "set out" and "arrived" is the number that says
                     whether the pace is a real gamble or a formality.
            Straggling: mutant-heavy warbands lose measurably more to the road
                     than True Kin-heavy ones at the same pace.
measured:   (fill in at build)
verdict:    (fill in at build)
```

## Open questions

- **Leaving bodies behind at a depot.** Historically real — armies routinely
  left their sick and wounded to be collected later. Mechanically it is a
  sharper version of benching: today a benched body still marches and still
  drinks. "Leave them here" would stop their upkeep and spare them the road,
  at the cost of not having them at the next fight. Awkward against a linear
  run structure (there is no coming back through), so it needs either a way to
  recover them or an honest accounting of them as gone. **Not decided.**
- **What Forced and Killing cost in exact numbers.** Morale is clamped ±0.12
  run-wide, so per-march deltas must be small. Pick against `sim:campaign`,
  not by feel.
- **Straggler return rate.** What fraction rejoin, and after how many legs.

## Order of work

1. `'travel'` phase and leg data model in `packages/game`, with tests. No UI.
2. Wound-rung escalation and discipline-keyed straggling, with tests.
3. Extend `sim:campaign` to exercise it; take the baseline reading above.
4. Travel screen in `apps/web`, reusing the existing takeover component.
5. Trail events as a new `events.ts` category.

---

## Agreed but not built: two systems this one sets up

Recorded so their shape is not re-derived from scratch later. Neither is in
scope for the work above.

### Food — scales with days, where Water scales with bodies

Food only earns a slot if it is not a second Water. Today Water is per-body
and superlinear by headcount; a second resource with the same shape would be
the same mechanic twice. The agreed split: **Water is charged per body, Food
is charged per day on the road.** A big warband on a short hop is a Water
problem; a small warband on a long haul is a Food problem. Two resources that
bind in genuinely different situations, and it puts distance on an axis
headcount does not dominate.

Note for whoever builds it: until Food exists, pace saves **Water** by
shortening the trip. When Food arrives it takes over that days-based axis and
Water should revert to pure headcount. Doing that cleanly is part of the Food
work, not a leftover from this plan.

### The baggage train — a camp that travels

Not a place. Upgrading a camp you abandon every march makes no sense; what
gets upgraded is the column's own kit — rain catchers on the wagons, a medic's
tent pitched each night, a salvage-sorting wagon. It moves with the warband,
so upgrades pay off on the road as well as in camp, which is where travel
makes them matter. Historically right too: armies carried their camp.

Every upgrade costs Water/Food to haul and slows the column, so each is a
trade rather than a pure gain. Stated goal behind the request, in the player's
own words: *"other ways to feel closer to your warband and to help them."*
