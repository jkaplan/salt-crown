import type { UnitType } from '@salt/sim'

/**
 * Legendary creatures — docs/V0-DESIGN.md §15, requested directly: "coming
 * across a legendary creature like in Qud with some bit of backstory to
 * them... legendary creatures need to be highlighted as they possess much
 * strength."
 *
 * Deliberately NOT a fourth boss tier. What makes a boss a boss is that it is
 * guaranteed, ordered, and escalating — three fixed checkpoints the run
 * builds toward (§10, §12). A legendary is the opposite of a checkpoint: it
 * MAY turn up in any wasteland encounter, in any act, and most runs will
 * never meet more than one or two of them. That unpredictability is the
 * whole point — an act boss is dreaded because you know it is coming; a
 * legendary is dreaded because you don't.
 *
 * Power sits deliberately between the two existing tiers: a clear, unmissable
 * step up from the toughest ordinary fauna (Rooted Thing, 240 HP) — but
 * nowhere near even the act-1 boss (The Sounding, 2400 HP). This is a rare
 * and dangerous individual, not a fourth checkpoint wearing a fauna's
 * clothes.
 *
 * The first pass of these numbers was wrong, the same way the act-1 boss's
 * first pass was: sized against an abstract "between fauna and boss" feel
 * rather than checked against what an early warband can actually bring.
 * Measured directly, all four lost to a Chaff swarm at any size up to 45 —
 * damage high enough to one-shot 30-HP fodder every swing meant numbers
 * never got the chance to matter, the exact Lanchester failure the boss
 * retune already found once. Cut roughly in half on damage and armour,
 * re-checked against the same probe: each now shows the threshold pattern
 * Rooted Thing itself shows — losing to an undersized swarm, winning clearly
 * once the swarm crosses a real size — rather than being unbeatable at any
 * size or trivial at any size.
 *
 * Even retuned, a fixed-power body still hits a structurally weaker warband
 * harder in RELATIVE terms than a strong one, whatever its absolute tuning.
 * Measured against sim:campaign, the Freed Firstborn origin (no Officers,
 * "far more variance" by design — see origins.ts) took a real hit that
 * neither a further power cut nor a frequency cut (LEGENDARY_CHANCE) fully
 * recovered; encounters.ts additionally excludes the first two encounters of
 * every run so at least one camp's buildup happens before the roaming danger
 * pool turns on. The residual gap past that point is left as a real,
 * measured property of this content rather than chased indefinitely — it
 * lines up with the origin's own documented identity, and closing it
 * completely would mean nerfing legendaries below where they work for the
 * Scion. A dedicated M5 balance pass is the right place to revisit this at
 * the scale (10,000 runs) that would actually resolve it either way.
 *
 * Each one gets a real backstory paragraph, not a reused blurb — that is
 * what "legendary" is asking for, and a one-line description would not have
 * delivered it. Where possible each ties back into something already
 * established (a House's cruelty, the grading economy, an existing fauna
 * type) rather than inventing new lore load-bearing enough to need its own
 * explanation.
 *
 * PLACEHOLDER NUMBERS.
 */

const MUTANT = 'mutant' as const

export const LEGENDARY_TYPES: readonly UnitType[] = [
  {
    id: 23,
    name: 'Widowsalt',
    lineage: MUTANT,
    cost: 90,
    color: 0xb08a6a,
    blurb: 'Outlived every pack that tried to claim this stretch, including her own.',
    description:
      "She was a Salt Hound once, in the ordinary sense — one matriarch among many, running a pack the size of any other. Three rival packs tried to take her territory over as many years, and she is the only Salt Hound left for two days' walk in any direction, hers included. Nobody has worked out whether she killed her own pack or simply outlasted them. She hunts alone now because there is nothing left to hunt with, and she has had a long time to get good at it.",
    // Faster and more evasive than the pack she came from, not tougher —
    // she survived on speed and being the one who left first, not armour.
    base: {
      hp: 240, armor: 1, damage: 17, attackInterval: 8,
      range: 22, moveSpeed: 7.2, accuracy: 0.78, evade: 0.16, radius: 9,
    },
  },
  {
    id: 24,
    name: 'The Ungraded',
    lineage: MUTANT,
    cost: 130,
    color: 0x6a5a4a,
    blurb: 'The one crate the Assayers never finished opening.',
    description:
      'Every batch that comes out of a vat gets graded — that is what an Assayer is for, and it is how the Houses have always priced stock. This one never got a number. The Assayer sent to read it did not come back, and the House that owned the batch quietly wrote the whole crate off rather than send a second grader. That was long enough ago that the House itself may not exist any more. What grew in that crate never found out it was supposed to have a ceiling.',
    // Deep and unmeasured on purpose — high HP and armour, nothing flashy.
    // The flavour IS the number: nobody ever capped what this could become.
    //
    // Armour tuned carefully rather than pushed as high as the flavour
    // wants: 8 against a Chaff's 5 damage repeated the exact failure the
    // act-1 boss had before its own retune — flat armour meant fodder could
    // not scratch it at any number, since Lanchester's numbers advantage
    // needs SOME real damage to concentrate. 4 is still well above anything
    // ordinary Act-1 fauna carries, and still lets the deepest-armoured
    // legendary be ground down by enough bodies rather than being immune to
    // the idea of bodies.
    base: {
      hp: 440, armor: 3, damage: 20, attackInterval: 15,
      range: 24, moveSpeed: 2.6, accuracy: 0.78, evade: 0.02, radius: 12,
    },
  },
  {
    id: 25,
    name: 'Glasskeeper',
    lineage: MUTANT,
    cost: 110,
    color: 0x8fb0c0,
    blurb: 'The swarms that follow it are not an accident.',
    description:
      "Glasswing drift in their thousands and mean almost nothing individually — that is the whole reason nobody bothers hunting them. Something has worked out how to make that a resource instead of a nuisance. Where the swarms move in unusually straight lines, in numbers too even to be weather, this is nearby, and it is not there by coincidence. Nobody has gotten close enough afterward to say what it actually wants the swarm FOR.",
    // Its own body is unremarkable; the danger is that a fight against it
    // is never really a fight against one thing. Range stands in for "the
    // swarm is doing most of the work" without also making it untouchable —
    // early evade/accuracy were tuned too far in that direction together.
    base: {
      hp: 200, armor: 2, damage: 14, attackInterval: 10,
      range: 70, moveSpeed: 4.4, accuracy: 0.8, evade: 0.12, radius: 8,
    },
  },
  {
    id: 26,
    name: 'The Standing Debt',
    lineage: MUTANT,
    cost: 150,
    color: 0x5a4f52,
    blurb: 'Sent out to collect on an account that no longer has an owner.',
    description:
      "A House built it to walk its debtors down and stand outside their door until the account was settled — a punishment for the ones who could not be reasoned with any other way. The House that issued the debt is gone. The debtor it was sent after is gone. It has not been told either of those things, and nothing about how it was built gives it a way to decide the matter closed on its own. It is still collecting. It will keep collecting after you, too.",
    // Slow, heavy, relentless — closes distance without hurry because it has
    // never once needed to hurry, and hits like something that was built to
    // end an argument rather than win one.
    base: {
      hp: 340, armor: 3, damage: 21, attackInterval: 13,
      range: 26, moveSpeed: 2.9, accuracy: 0.8, evade: 0.03, radius: 11,
    },
  },
]

export const LEGENDARY_IDS = new Set(LEGENDARY_TYPES.map((t) => t.id))
