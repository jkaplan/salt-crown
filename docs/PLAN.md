# Salt Crown — the living plan

Status: **the assumptions table below is the current one** — 2026-09-06

This file carries stage 3 of the dev loop: what has to be true, ranked by how
much changes if it is false. It was written after a year of work rather than
before it, which is itself the most useful thing in it — see "How this list
came to be missing" at the bottom.

Per-piece plans live in [plans/](plans/). The design itself is in
[V0-DESIGN.md](V0-DESIGN.md); this file does not restate it.

---

## How to read the marks

Every claim is **measured**, **judged** or **reported**, per stage 2 of the
loop. The distinction is about how each fails:

- **measured** — a number from an instrument. Names what was fed in. Fails by
  measuring the wrong input.
- **judged** — a call somebody made looking at the thing. Can never be re-run.
  Fails by reasoning from something *next to* the claim.
- **reported** — somebody said so and nobody has checked.

---

## The assumptions, ranked by what breaks

Ranked by **how much the plan changes if it is false**, not by how likely it
is to be false. An assumption whose failure merely disappoints is not here.

| # | Assumption | If it is false | Cheapest test | Status |
|---|---|---|---|---|
| **A1** | A march makes a run *better*, not merely *longer* | The whole 2026-09-05 pivot goes. Travel becomes a screen you click through, and the game reverts toward the auto battler it was | Play five marches without being asked to. M1's own gate shape | **open** — named the riskiest assumption in the pivot on day one and still unspiked. Now finally testable: the screen exists |
| **A2** | A run whose trail has gone cold is still worth finishing | "Continue to a lesser ending" is a chore, and the honest fix is to make a cold trail end the run after all — which the plan already says out loud | Play one run to a cold trail and finish it | **open** — and this is the *majority* case: 65% of Column runs (300 runs, measured) go cold |
| **A3** | The bot is a usable stand-in for a player | Every balance number on record is a reading of the bot rather than of the game — including all of travel's constants | Play three runs and compare your decisions to the bot's policy | **open, and weakening.** Step 6 produced evidence against it: the bot takes water first every time, which visibly moved the pace spread |
| **A4** | The gap reads as a clock a player can feel | Pace collapses into a water-cost menu with a number attached, and the chase stops generating pressure — which was the entire reason it replaced a calendar | Play three marches, then say what the number meant without looking | **open** — never seen by anyone |
| **A5** | ~10% completion is the right difficulty | Every pace constant, encounter budget and price in the game moves | One human run against the bot's measured 11.0% | **open** — never tested against a person, only against a greedy bot on one origin |
| **A6** | Six trail events are enough to carry three legs a march | Legs revert to flavour text plus a drain — the exact Banner Saga failure mode the travel plan was rewritten around | Play to encounter 8 and notice whether the road went quiet | **open, and known-shaped**: six events over fifteen marches means the back half is quiet *by construction* |
| **A7** | Water-per-body and Food-per-day are genuinely different axes | Food is decoration and should not be built at all — a second resource that reskins the first | Find one situation where they diverge: a small warband on a long haul against a big one on a short hop | **open and currently untestable** — march length is fixed at 3 legs, so the days axis does not vary yet. Worth fixing before Food is built, not after |
| **A8** | The 15-encounter / 3-act structure survives the pivot | Run structure is rebuilt around distance, and every completion baseline on record loses its meaning | Decide it — this is a design call, not a measurement | **open**, flagged in V0-DESIGN §16 as "not decided" |
| **A9** | Rate-limited recovery makes benching a real decision | The fielding cap of 6 goes back to being free, and "who sits out this march" stops being a question | Play three camps and see whether you ever bench anyone on purpose | **open for the player half.** The mechanical half is **measured**: wounded-Prospect-camps went from 0 to 1558 over 300 runs when recovery stopped being automatic |
| **A10** | Instability's "crazy mutated mess" is reachable and worth reaching | Instability is a cost with no payoff — a tax rather than a bargain | Read the peak-instability distribution, then judge | **partly measured**: peak instability is 5, which is enough for the terminal "blob of a man" state to be built. The judgement is open |
| **A11** | Three legs is the right march length | Variable length becomes the default, which the plan already ruled safe on one condition — that distance is visible before the buy | Play a march and say whether it felt thin or draggy | **open**, and the condition is now satisfied (the gap is in the camp status bar), so this is cheap to change |
| **A12** | The baggage train delivers "other ways to feel closer to your warband" | The upgrade screen is a stat shop with fiction on it | Ask, after playing, what would make you care about these people | **open** — unbuilt, and the goal is stated in the player's own words rather than mechanically |
| **A13** | Superlinear collapse (Lanchester's square law) is desirable | The core battle math changes and every balance figure resets | Watch three battles and say whether the snowball felt earned or arbitrary | **judged**, deliberately kept — ally-healing was rejected as a curve-flattener. Never tested against a player |
| **A14** | Losing a battle should end a run | The break-run pillar changes shape, and §11's definition of a break run needs rewriting anyway (V0-DESIGN §16 flags that it should probably also mean running out of road) | Play until you lose one and see whether it landed as fair | **judged**, load-bearing, untested |

---

## What this list says when you stand back from it

**Eleven of the fourteen are open, and nine of those need the same test: a
person playing the game.** Not an instrument, not another 300-run harness
pass — a person. The harness has been extraordinarily good at the questions it
can answer (it caught three regressions this month that left every test green)
and it cannot answer any of the nine.

**A3 is the one that makes the others worse.** Every number in this repo's
documents came from the bot. If the bot is a poor stand-in, the failure is not
one wrong figure — it is that the evidence base is systematically tilted in a
direction nobody has characterised. Step 6 gave the first concrete instance:
the bot's "always take water" policy visibly narrowed the pace spread.

**A7 is the one to act on first**, because it is cheap and it gates unbuilt
work. Food should not be built while the days axis cannot vary.

---

## How this list came to be missing

This is stage 3 of the loop and the loop has been followed closely everywhere
else — the plans have fences, the predictions can come out false, the failed
versions are on the record. What was missing was the table itself, for the
whole life of the project, and nothing noticed.

The reason is worth keeping: **every individual plan had its own riskiest
assumption named, and naming it locally felt like doing the work.**
`plans/travel.md` says in its status line that its riskiest assumption is
unspiked. That is honest and it is not a substitute, because an assumption
named inside one plan is only ever weighed against that plan. A9 and A3 belong
to no plan at all, and A3 undermines every plan at once — neither could have
surfaced from a per-plan note.

The general form: **a local check does not aggregate.** Fourteen locally
honest documents can still add up to a project that has not asked what it is
betting on.
