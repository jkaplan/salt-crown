# Evidence: how comparable games handle the march

Gathered 2026-09-05, in exploration mode, before any travel code is written.

**Every claim below is marked.** `[reported]` means a source said so and it has
not been verified in the game itself — which is nearly everything here, because
this was desk research, not play. `[judged]` is an inference drawn from those
reports about what it means for Salt Crown; those can never be re-run and are
the ones most likely to be wrong. `[measured]` means it was checked against
Salt Crown's own code.

Games covered: The Oregon Trail (1985), The Banner Saga, Battle Brothers,
Darkest Dungeon, Loop Hero, A Legionary's Life, FTL.

---

## Finding 1 — Oregon Trail's pace does the OPPOSITE of what our plan assumed

This is the important one and it invalidates a decision already marked agreed
in [plans/travel.md](../plans/travel.md).

- Pace settings are hours travelled per day: Steady 8h, Strenuous 12h,
  Grueling 16h. `[reported]`
- Food cost is charged **per mile, and rises with pace**: grueling 4/mile,
  normal 2/mile, slow 1.5/mile. `[reported]`
- Rations are a separate axis: filling 3 lb/person/day, meagre 2, bare bones
  1. `[reported]`
- Grueling "will quickly decrease your party's quality of health and morale".
  `[reported]`

**So pushing hard costs roughly double the food for the same distance, not
less.** `[judged]` Our plan has Forced and Killing *saving* Water by spending
fewer days on the road. That is backwards from the source.

**And the deeper problem: what pace actually buys in Oregon Trail is calendar
days, because winter is coming.** `[judged]` The whole pace system is a trade
of health and supply for *time*, and it only works because time is scarce.

**Salt Crown has no calendar.** `[measured]` Nothing anywhere in the run is
scarce against elapsed time — there is no season, no deadline, no pursuer. So
"arrive sooner" currently buys nothing, and a pace system has no pressure to
push against.

Corroborating, from two other games that had to solve exactly this:

- **FTL** — the Rebel fleet advances with every jump and takes over beacons
  behind you, specifically to stop you farming a sector and to force you
  forward. `[reported]` Its entire reason for existing is to make time
  scarce. `[judged]`
- **Banner Saga 3** — converted caravan supplies and population into "a sort
  of Doomsday Clock". `[reported]`

### What this implies for us

Either pace is cut, or Salt Crown needs something time is scarce against.
`[judged]` The cheapest candidate is already in the fiction and needs no new
system: **the Muster is a rite, and rites convene on a date.** Arriving late
to it — or the rite proceeding without you — would make days cost something.
That is a fiction-first answer to a mechanical hole, which is how the premise
work in §15 went too.

---

## Finding 2 — I was wrong that benching is cheaper elsewhere

Stated confidently in conversation before this research, and wrong. Recorded
with the correction beside it rather than deleted.

- **Battle Brothers**: "All Brothers will consume money and food constantly,
  so the bigger the roster of backup troops, the higher the maintenance."
  `[reported]` Benched brothers eat exactly like fielded ones.
- Roster is ~24; 12 fight at a time. `[reported]`
- Provisions run ~2 per man per day, more on difficult terrain. Running out
  lowers morale and leads to desertion before starvation. `[reported]`
- Injuries heal over time out of combat, duration by severity, and the reserve
  roster exists so the hurt can sit out. `[reported]`

Salt Crown already matches this: a benched Prospect still costs full Water.
`[measured]` So that is not an anomaly to fix.

**The real reason to leave someone behind is never "it saves upkeep" — it is
"they are recovering, and recovery is rate-limited."** `[judged]`

Darkest Dungeon is the clearest version:

- Stress relief costs gold **and holds the hero for a week**, unavailable.
  `[reported]`
- Stress-relief slots cap at 16-17 per week against a maximum roster of 28-31.
  `[reported]` The bottleneck is deliberate. `[judged]`
- Design intent is explicitly to force party rotation; at 100 stress a hero
  takes an Affliction which cascades party-wide stress. `[reported]`
- The player chooses between upgrading equipment and de-stressing someone —
  the same gold. `[reported]`

### What this implies for us

Salt Crown does **not** force rotation. `[measured]` Wounds recover for free
with time (`FREE_RECOVERY_MUTANT` / `FREE_RECOVERY_TRUEKIN`), there is a
fielding cap of 6 Prospects, and nothing rate-limits healing or makes it
compete for a resource. So there is no pressure to rotate anyone.

That, not "leaving units behind", is the actual gap. `[judged]` A depot
mechanic bolted onto a game with no rotation pressure would be a button
nobody presses.

---

## Finding 3 — travel-as-spine has a known failure mode, and it is ours

- **Banner Saga** supplies: roughly 1 unit sustains ~100 caravan members for
  1 day; the UI shows days-until-starvation and ticks down whether travelling
  or camped. `[reported]`
- Real player complaint, chapter 6: waiting ~30 days, then ~30 more, then ~40
  more, where "nothing seems to change no matter how long you wait, only your
  caravan dies out for the missing supplies." `[reported]`
- Players also wanted Forage to be usable on demand rather than only at fixed
  story points. `[reported]`

**That is precisely the failure our 3-leg march risks**: legs that are flavour
text plus a resource drain are a progress bar that eats your warband.
`[judged]` The lesson is not "make travel shorter" — it is that **every leg
must present a decision or a change**, or it is not travel, it is waiting.

---

## Finding 4 — Loop Hero's loop is a decision, not a treadmill

- Camp is out-of-run progression: resources gathered on expeditions build 23
  structures that unlock cards, classes and abilities. `[reported]`
- The core decision is **commit or retreat**: push the next loop for a boss
  chance and risk losing most of what you gathered, or bank it now and spend
  it on the camp. `[reported]`
- Criticised as repetitive and grind-heavy in the endgame; visuals and story
  wear thin. `[reported]`

### What this implies for us

Salt Crown has no retreat. `[measured]` Losing ends the run; there is no
"bank what you have and go home." Loop Hero suggests the interesting decision
on a road is not only *how fast* but *whether to keep going*. `[judged]`
Whether Salt Crown wants that is genuinely open — it cuts against "losing ends
the run", which is a stated pillar.

---

## Finding 5 — A Legionary's Life, mostly as a counter-example

- Between battles is a **"Lull" phase spanning several months**, where you
  train, buy equipment, and random events occur. `[reported]`
- **Losing health has no side effects and there are no wound penalties.**
  `[reported]`
- Permadeath, with points earned toward a stronger start next run. `[reported]`

The Lull is interesting as camp-as-a-season rather than camp-as-a-moment.
`[judged]` The wound model is the opposite of Salt Crown's and not a model to
copy — this project's whole attrition pillar is that damage persists.

---

## What this research changes

1. **Pace, as designed, does not survive contact.** It saves the wrong
   resource and pushes against a pressure the game does not have. Needs either
   a calendar (the Muster's date is the cheap candidate) or cutting.
2. **"Leaving units behind" is the wrong problem.** The gap is that nothing
   forces roster rotation at all. Fix that first, or the depot is a dead
   button.
3. **Legs must each carry a decision.** A leg that is only flavour and a drain
   is the specific thing players disliked in the closest comparable game.
4. **Open, raised by Loop Hero:** should a march be abandonable?

## Sources

- [Oregon Trail strategy guide (GameFAQs)](https://gamefaqs.gamespot.com/pc/577345-the-oregon-trail/faqs/30964)
- [Banner Saga wiki — Caravan](https://bannersaga.fandom.com/wiki/Caravan)
- [Banner Saga Steam discussion — waiting complaint](https://steamcommunity.com/app/237990/discussions/0/648817377483642834)
- [Battle Brothers wiki — Provisions](https://battlebrothers.fandom.com/wiki/Provisions)
- [Battle Brothers Dev Blog #79 — Injury mechanics](https://battlebrothersgame.com/dev-blog-79-progress-update-injury-mechanics/)
- [Battle Brothers Dev Blog #22 — FAQ](https://battlebrothersgame.com/dev-blog-22-battle-brothers-faq/)
- [Darkest Dungeon wiki — Stress](https://darkestdungeon.fandom.com/wiki/Stress)
- [A Mechanical Critique of Darkest Dungeon — The Gemsbok](https://thegemsbok.com/art-reviews-and-articles/darkest-dungeon-red-hook-critique-mechanics-design/)
- [Loop Hero wiki — Buildings](https://loophero.fandom.com/wiki/Buildings)
- [Game Design Breakdown: Loop Hero](https://medium.com/@sacitsivri/game-design-breakdown-loop-hero-4a86d55142b8)
- [A Legionary's Life on Steam](https://store.steampowered.com/app/1058430/A_Legionarys_Life/)
- [A Legionary's Life — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/ALegionarysLife)
- [FTL wiki — Rebel Fleet](https://ftl.fandom.com/wiki/Rebel_Fleet)
