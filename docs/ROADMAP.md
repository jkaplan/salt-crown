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

Prospects were made leaders. A leading Prospect leaked its mutations to the whole squad at half level (min 1) — a Horns 5 standout gave twenty fighters Horns 3. One leader slot per squad, either an Officer (flat bonus) or a leading Prospect (the leak); a Prospect can only lead its own lineage. This unified `officerId` into a single `leader` field across the codebase.

**Later cut.** The leak mechanic did not survive a fiction check — nothing explains how one bodys mutation applies to twenty others. Replaced with a discipline-only bonus; see the M4+ entry below.

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

## M2 — Attrition and leaders (weeks 4–5) ✅ DONE

- ~~Wound ladder, hit zones, permadeath, injury effects~~ ✅ built
- ~~Officer squad bonuses~~ ✅ built
- ~~**Firstborn promotion** — surviving mutants accumulate mutations and graduate to the named tier~~ ✅ built
- ~~Morale as a run-level resource shifted by events (see V0-DESIGN §7)~~ ✅ built
- ~~Recovery and treatment costs~~ ✅ built
- ~~Roster screen showing the whole warband at a glance~~ ✅ built — rebuilt again since as the Warband page in Camp's hub-and-doors split

**Exit:** losing a Firstborn you grew over ten battles makes you wince. Held back on this
for a long stretch — the mutation-leak mechanic that made a Firstborn's promotion into a
squad-wide power spike was cut (fiction-driven, not a balance call: nothing explained how
one body's mutation reached twenty others). Losing one still matters — the body itself, the
battles survived, the discipline bonus its squad loses — just not for the reason this line
originally meant. Left as-is rather than rewritten, since it is a record of what the exit
criterion WAS when M2 shipped, not a live spec.

---

## M3 — Ruins, machines, economy (weeks 6–7) ✅ DONE

- ~~Water, superlinear upkeep, desertion on shortfall~~ ✅ built
- ~~Scavenge / Delve; crews miss the next battle~~ ✅ built
- ~~**Bionics**: found in ruins, installed into True Kin for Salvage~~ ✅ built
- ~~**Machines**: 5 types, found in ruins and rare events only, degrade permanently, cost Salvage per battle to run~~ ✅ built
- ~~Tinkerer event — the rare exception that can restore a machine~~ ✅ built
- ~~Ruin flavor and outcome text; first hints of what's below~~ ✅ built — SCAVENGE_FLAVOUR / DELVE_FLAVOUR in expeditions.ts

**Exit:** you delve instead of reinforcing, lose the next battle for it, and feel that it was your call.

**Water result:** the first cut had no teeth — a greedy buyer and a careful one
completed at the same rate (24.0% / 24.3%) and only 1.4% of marches went short,
which by the harness's own criterion means the resource was decorative. Payout
retuned from `115 + 62i` to `88 + 34i` against `sim:campaign`:

| Bot | Completes | Deserters | Marches short | Winning size p50 |
|---|---|---|---|---|
| greedy | 20.8% | 2228 | 10.9% | — |
| thrifty | 17.6% | 16 | 0.2% | 52 |

Water caps warband **size** — p50 winning warband fell from 69 bodies to 52 —
without changing difficulty; greedy still completes at roughly its pre-Water
rate. It is a soft cap, not a trap: overbuying wastes salvage as bodies walk,
rather than ending the run. That is §8's "a squeeze, never an execution".

The thrifty bot completing *lower* is a limitation of the bot, not the curve —
it can buy but never sell, so it has no way to shrink a roster it has outgrown.
A player can sell a Prospect or let a squad go.

**Expedition result:** took three versions, each corrected by measurement
rather than argument. `sim:campaign --scavenge` / `--delve` send a maximum
crew every camp, which is the upper bound on exploitation, not good play.

| Cost model | greedy none | greedy scavenge | greedy delve |
|---|---|---|---|
| no cost | 20.8% | 45.2% | **66.0%** — strictly dominant |
| staked in Water | 20.8% | **0.0%** — a trap | 9.2% |
| staked in Salvage | 20.8% | 20.8% | 24.8% |

Benching three Prospects out of a fifty-body warband is not a cost, whatever
the flavour text says. But staking Water over-corrected: Water is the binding
constraint, so *any* trade of water for salvage is strictly bad and the verb
became unplayable.

That second failure is what defined the system. A warband capped by Water ends
up holding salvage it cannot spend — so crews are outfitted with **salvage**,
and **Scavenge buys water with it**. Delve stakes salvage for more salvage,
high variance, plus ruin finds. Both remain a modest positive at best, which
is right for an optional action whose real cost is that the crew misses the
next battle.

**Bionic result:** measured head-to-head, a 20-body True Kin squad against the
same squad under a bare officer:

| Implants | Salvage | Wins vs bare officer |
|---|---|---|
| 1 | 70 | 80.0% |
| 2 | 155 | 97.5% |
| 3 | 235 | 100.0% |

That salvage would buy ~117 Chaff, which would crush 20 True Kin outright —
except Water caps the roster near 50 bodies, so it cannot be spent that way.
**Water is what makes the bionic path viable at all.** This is §6b's stated
counterweight arriving on schedule: quality multipliers grow until raw body
count stops being the dominant term.

In `sim:campaign` the greedy bot gains nothing from bionics (20.8% → 21.6%),
which is the *expected* result, not a failure: §13 says bionics are "taxed,
not locked" and that mutation stacking is the path of least resistance. A bot
that buys the cheapest power per salvage will always take the mutant path. The
thrifty bot, which cannot overbuy bodies, gains materially (17.6% → 20.8%).

**Machine result:** first pass got both halves wrong, and the probe said so.

*Decay was a cliff.* Condition scaled every stat at once, which compounds — at
condition 4 a Chrome Warden held 0.82 of hp AND damage AND armour AND accuracy
AND speed, about 0.55 of its effective power. It went 78% → 56% → 5% wins in
two battles. Six condition has to mean roughly six battles, so condition now
touches **hp, damage and cycle time only**, floor 0.6. Against 80 Chaff:

| Condition | 6 | 5 | 4 | 3 | 2 | 1 |
|---|---|---|---|---|---|---|
| Wins | 96% | 96% | 96% | 86% | 24% | 0% |

Strong for four battles, wobbling at three, visibly finished at one.

*And they were not "far above everything".* One machine beat ~30 Chaff — 60
salvage of bodies, against 55 salvage **per battle** to run. Stats roughly
tripled; a machine now beats 60–80 Chaff, and Water per machine went 3 → 12
because the superlinear term is driven by headcount and a machine is one head:
against a 40-body warband, three machines took the bill from 80 to 158.

Delve finds one at 7%, so most runs never see a machine — which is what makes
the run that does memorable.

---

## M4 — Full run (weeks 8–9) ✅ DONE

- ~~15 encounters, 3 acts, 15 unit types~~ ✅ built
- ~~All three encounter pools: rival warbands, wasteland fauna/flora, bosses~~ ✅ built
- ~~**Three bosses** — horrors from below, visibly not playing the same game~~ ✅ built
- ~~Act 3 mass battles at 90–200+~~ ✅ built
- The three break-run seeds from V0-DESIGN §11
- ~~**Two origins**: Scion of a House, and the Freed Firstborn (mutant start, True Kin at a premium)~~ ✅ built

**Exit:** you complete full runs. At least one breaks.

**Run structure result:** budgets are written as three bands with a ramp inside
each, not one polynomial — acts *are* bands, and §12's 8–20 / 30–70 / 90–200+
is a step function that no single curve fits properly. Payouts are a fraction
of the budget rather than a curve of their own, so retuning difficulty can no
longer silently break the economy.

The first pass completed **0% of runs**, and the histogram named the cause:
98 of 200 died at encounter 5. **Armour is the load-bearing number on a boss.**
It is flat reduction, so a boss's armour decides whether cheap bodies are
relevant to the fight *at all* rather than how tough it is — the act-1 boss had
12 armour against a Chaff's 5 damage, every fodder swing did the minimum 1, and
no quantity of warband could out-damage nothing.

Correcting it overshot: cutting HP as well as armour left the act-1 boss
outweighed by its own escort, which makes a boss encounter a warband with a
mascot. A test caught that, not a playthrough. Armour stayed low, HP went back
up, escort share dropped 0.35 → 0.12.

| | greedy | thrifty |
|---|---|---|
| Completes | 17.0% | 16.5% |
| Winning warband p50 | 46 | 57 (max 123) |

Deaths are now spread evenly across all fifteen encounters with no wall
anywhere. Battle time is **5.8 min per winning run at 1×** (1.5 at 4×), leaving
roughly 20–30 minutes for fifteen camps — the shape §12's 25–35 minute target
asks for. Act-3 fields run ~400 entities, which the sim does at 130× realtime.

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


## Post-M4 — the leak mechanic, cut

A leading Prospect used to pass its own mutations to the whole squad it led,
half level for an ordinary Prospect, full level for a Firstborn. Raised
directly by the player: what physically explains one body's mutation reaching
twenty others? Nothing did — it was a stat-scaling trick wearing a fiction it
couldn't support.

Removed. `resolveSquadStats` no longer applies a leading Prospect's mutations
to the squad at all; only `resolveDiscipline` reads the leader now, and only
for a discipline bonus (`LEADING_PROSPECT_DISCIPLINE_BONUS`, bigger for a
Firstborn). Mutations stay exactly what they say they are: what happened to
this one body. That body still fights as its own individual at full strength
every battle, so the choice of who leads still matters — just not as a
squad-wide multiplier.

This was the single largest per-salvage value in the game (see
`sim:leaders`), so its removal is a real rebalance, not a wash. Squad-wide
buffs are deferred to V0.1 relics/perks, which can explain themselves —
`carrying` a totem or a banner leaking effect to a formation has a mechanism
a body's own biology does not.
