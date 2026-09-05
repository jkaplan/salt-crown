# Plan: A travel phase between camp and battle

Status: proposed — 2026-09-05

## Why this exists

Requested directly: the run should feel more like Oregon Trail — the road itself should
be a place something happens, not a number paid once. Today `march()` is instant: camp
ends, Water is charged, battle starts. Nothing occupies the space in between, so nothing
about the *trip* to an encounter is ever felt, only its bill.

## Where it sits

`camp → [NEW: travel] → battle`, replacing today's `camp → battle` cut. Reuses the phase
machine already in `run.ts` (`'camp' | 'battle' | 'report' | 'over'`) — this adds
`'travel'` as one more phase, not a parallel structure. The March button on the camp
screen now enters travel instead of calling `march()` directly; `march()` itself still
runs at the end of travel, unchanged, to pay Water and resolve desertion right before
the fight — travel spreads a version of that cost across the trip, it doesn't replace it.

## What changes

1. A fixed number of **legs** per march (proposed: 3, same for every encounter — see
   Open questions). Each leg is a short beat: flavor text (landmark/distance, same voice
   as `ACT_FRAMING`/encounter flavor already in the game), a Water draw for that leg, and
   a chance of a **trail event**.
2. **Pace**, chosen once when travel begins (Push / Steady / Careful) — trades Water burn
   for arrival condition. Steady is tuned to match today's total March water cost exactly,
   so choosing nothing different costs nothing different. Push burns more Water per leg
   but finishes sooner and raises trail-event odds; Careful burns less but raises the
   chance of arriving late (a small morale or Salvage cost, TBD in build).
3. **Trail events** reuse the existing `events.ts` data shape (a choice declares
   `salvage`/`morale`/`requires`, `resolveEvent()` applies it) under a new category rather
   than a new engine. A leg with only one possible outcome auto-resolves with a line of
   flavor and no takeover screen — same rule the project already applies to camp events
   ("a one-option choice is a notification"). A leg with a real branch gets the existing
   full-screen takeover treatment.
4. Water accounting moves from one lump sum at `march()` to a per-leg draw that sums to
   the same total under Steady pace — this is a reskin of existing math, not a new
   resource or a silent rebalance.

## Deliberately not in this

- **No new resource.** Water keeps doing the ration job. A separate Food/rations
  currency is the "liquids system" idea already logged as deferred in
  `docs/V0-DESIGN.md` §15 — this plan does not revive it.
- **No map or routing.** Legs are linear and fixed-count, not a chosen path. No terrain
  or weather state — landmark text is flavor keyed to act/encounter, not a new system.
- **No battle-time effect.** Travel changes what arrives at the fight (bodies, Water,
  morale) — never battle mechanics, posture, or behavior. The project's "no pre-battle
  posture" rule is about the fight itself; pace is a camp-phase economic choice, same
  category as buying gear, not an exception to that rule.
- **No death outside the wound/permadeath system.** A bad trail event costs Salvage,
  Water, or morale through the same levers `events.ts` already has — it does not add a
  second way for a body to die that bypasses the wound ladder. A "the river takes
  someone" event would need its own balance pass against that system and is out of scope
  here.
- **No per-leg pace changes.** Pace locks for the whole march (see Open questions).

## How it gets proved

Extend `sim:campaign`'s bots to pick a fixed pace (greedy always Steady, to start) and
run travel legs headlessly. Compare against the current baseline in `docs/ROADMAP.md`
(21% bot completion, `80 + 62i + 8.5i²` enemy curve).

```
predicted:  Steady pace, greedy bot, 300 runs: completion rate within 2 points of the
            existing 21% baseline (this is a reskin, not a rebalance, if Steady = today).
            Push: measurably higher desertion count than Steady on the same seeds.
            Careful: measurably lower desertion, measurably more runs arriving "late".
measured:   (fill in at build)
verdict:    (fill in at build)
```

## Open questions

- **Leg count: fixed at 3 for every encounter, or scaled by act?** Fixed is simpler and
  keeps the sim harness comparable across the whole run. Recommend fixed to start;
  revisit only if travel starts to feel identical late-game vs early-game.
- **Does pace lock for the whole march, or can it change mid-trip?** Locking once (like
  today's single March button) is less new UI and less new state. Letting the player
  react to a bad leg by easing off is more Oregon-Trail but doubles the surface area.
  Recommend locked-once for the first version.
- **What does "arriving late" (Careful) or "arriving rough" (Push) actually cost?** Needs
  a concrete number before build — proposed as a small morale delta (within the existing
  ±0.12 clamp) for Careful-late and a small additional desertion-chance bump for
  Push-rough, both reusing existing `Warband.morale`/`payWater` mechanics rather than new
  ones. Needs to be picked and written here before Order of work is final.

## Order of work

Not started — this plan needs to be agreed first. Once it is, the natural build order is:
(1) add the `'travel'` phase and leg data model in `packages/game` with tests, no UI;
(2) extend `sim:campaign` to exercise it and get the baseline reading above; (3) build the
travel screen in `apps/web`, reusing the existing takeover component.
