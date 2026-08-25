import type { UnitType } from '@salt/sim'
import { BOSS_TYPES, FAUNA_TYPES } from './wasteland.js'
import { LEGENDARY_TYPES } from './legendaries.js'

/**
 * M1 content: 10 unit types, 5 mutant and 5 True Kin. Machines arrive in M3
 * because they're ruin-found, not purchasable.
 *
 * PLACEHOLDER NUMBERS. These exist so the loop can be played and judged;
 * balancing happens against batch-sim data once the shape is agreed.
 *
 * The lineages don't counter each other — they differ by cost, reliability
 * and upgrade path (docs/V0-DESIGN.md §3):
 *   Mutants  — frail, cheap, mutations are the only thing that lifts them.
 *   True Kin — durable, reliable, expensive, no mutations ever.
 */

const MUTANT = 'mutant' as const
const TRUEKIN = 'truekin' as const
const MACHINE = 'machine' as const

/**
 * The five mutants are differentiated by *kind*, not degree. Because armour is
 * flat reduction, three different kinds of durability counter three different
 * kinds of attacker, and that is where the variety lives:
 *
 *   Chaff          mass          — no durability at all, but you field forty
 *   Sludge-Waller  raw HP        — soaks big hits, dies to sustained volume
 *   Thornback      flat armour   — hard-counters swarms, dies to big hitters
 *   Stiltwalker    evasion       — beats low-accuracy, deleted by marksmen
 *   Spitter        range         — no durability, needs a screen
 *
 * Fielding only one kind is a real mistake. That is the point.
 */
const RECRUITABLE: readonly UnitType[] = [
  {
    id: 0,
    name: 'Chaff',
    lineage: MUTANT,
    cost: 2,
    color: 0x7a8a5c,
    blurb: 'Numbers, and nothing else whatsoever.',
    description:
      'Bred by the hundred and named for what they are. Barely trained, barely armed, and sent forward first so something more expensive does not have to be. One is worthless. Forty is a wall.',
    base: {
      hp: 30, armor: 0, damage: 5, attackInterval: 10,
      range: 22, moveSpeed: 5.2, accuracy: 0.7, evade: 0.05, radius: 7,
    },
  },
  {
    id: 1,
    name: 'Sludge-Waller',
    lineage: MUTANT,
    cost: 5,
    color: 0x4a6b52,
    blurb: 'Enormous, wet, and barely fights at all.',
    description:
      'Bred for the flooded levels beneath the Houses, where the pumps failed generations ago. Bloated, amphibious, and slow to notice injury. It exists to be hit — it does almost no damage and moves at a crawl.',
    base: {
      hp: 165, armor: 1, damage: 8, attackInterval: 20,
      range: 22, moveSpeed: 2.4, accuracy: 0.66, evade: 0.02, radius: 12,
    },
  },
  {
    id: 2,
    name: 'Stiltwalker',
    lineage: MUTANT,
    cost: 5,
    color: 0xa8c46a,
    blurb: 'Too fast to hit, far too easy to kill.',
    description:
      'Legs bred long for crossing the salt flats with messages. It dodges most of what is thrown at it and hits quickly in return, but anything that connects tends to be the last thing that needs to. Accurate shooters ignore the dodging entirely.',
    base: {
      hp: 38, armor: 0, damage: 10, attackInterval: 8,
      range: 22, moveSpeed: 9, accuracy: 0.78, evade: 0.24, radius: 7,
    },
  },
  {
    id: 3,
    name: 'Spitter',
    lineage: MUTANT,
    cost: 7,
    color: 0x8fbf3f,
    blurb: 'Hits hard from far away. Dies to a stiff look.',
    description:
      'Its gut brews something caustic, and somewhere along the line it learned to aim. Heavy single shots at long range, no armour, and no ability whatsoever to defend itself. Put something in front of it.',
    base: {
      hp: 42, armor: 0, damage: 14, attackInterval: 14,
      range: 240, moveSpeed: 3.2, accuracy: 0.7, evade: 0.06, radius: 8,
    },
  },
  {
    id: 4,
    name: 'Thornback',
    lineage: MUTANT,
    cost: 7,
    color: 0x6b6f3a,
    blurb: 'Swarms break on it. Big hitters do not.',
    description:
      'Its skin mineralised generations back and no House has bothered breeding it out. Armour is flat reduction, so a hundred weak blows do almost nothing to it — but its own hide is thin underneath, and anything hitting hard enough to get through kills it quickly.',
    base: {
      hp: 90, armor: 7, damage: 9, attackInterval: 15,
      range: 22, moveSpeed: 3.6, accuracy: 0.72, evade: 0.03, radius: 9,
    },
  },

  // ---- True Kin: durable, predictable, expensive ----
  {
    id: 5,
    name: 'Levy',
    lineage: TRUEKIN,
    cost: 12,
    color: 0xc9a870,
    blurb: 'A House owes its levies nothing but a spear.',
    description:
      'Conscripted from a House’s own holdings and owed nothing beyond a spear. Trained, equipped, and entirely replaceable by anyone above them.',
    base: {
      hp: 105, armor: 3, damage: 15, attackInterval: 12,
      range: 24, moveSpeed: 4.6, accuracy: 0.82, evade: 0.1, radius: 9,
    },
  },
  {
    id: 6,
    name: 'Halberdier',
    lineage: TRUEKIN,
    cost: 16,
    color: 0xd8b978,
    blurb: 'Reach, weight, and a great deal of drilling.',
    description:
      'Drilled infantry with reach. The backbone of any House still wealthy enough to keep a standing line rather than simply buy bodies.',
    base: {
      hp: 118, armor: 4, damage: 24, attackInterval: 17,
      range: 34, moveSpeed: 4, accuracy: 0.84, evade: 0.08, radius: 10,
    },
  },
  {
    id: 7,
    name: 'Marksman',
    lineage: TRUEKIN,
    cost: 15,
    color: 0xe0cc94,
    blurb: 'Expensive, fragile, and worth it from far enough away.',
    description:
      'A specialist, and priced like one. Shoots from far enough back that being fragile rarely comes up.',
    base: {
      hp: 88, armor: 1, damage: 22, attackInterval: 17,
      range: 320, moveSpeed: 4, accuracy: 0.88, evade: 0.1, radius: 9,
    },
  },
  {
    id: 8,
    name: 'Shieldbearer',
    lineage: TRUEKIN,
    cost: 16,
    color: 0xb08d55,
    blurb: 'Paid to be hit, and very good at it.',
    description:
      'Armoured to a near standstill and paid to be hit. Harmless on the attack and extraordinarily difficult to move.',
    base: {
      hp: 165, armor: 8, damage: 10, attackInterval: 16,
      range: 24, moveSpeed: 3.4, accuracy: 0.78, evade: 0.04, radius: 11,
    },
  },
  {
    id: 9,
    name: 'Dragoon',
    lineage: TRUEKIN,
    cost: 22,
    color: 0xefd9a0,
    blurb: 'A House heir with something to prove.',
    description:
      'A minor heir working off an obligation to their House. Fast, expensive, and painfully aware of being watched.',
    base: {
      hp: 130, armor: 5, damage: 22, attackInterval: 13,
      range: 26, moveSpeed: 6.6, accuracy: 0.86, evade: 0.14, radius: 10,
    },
  },
]

/**
 * The five machines. Lost technology — nobody can build them, and nobody
 * fully understands them either.
 *
 * They are STRICTLY BETTER than anything in the other two pools, and that is
 * deliberate: §3 self-balances it by making them finite, decaying, and
 * expensive to merely own. A machine cannot be bought at any price, arrives at
 * full power, loses condition every battle it fights, and is gone forever when
 * destroyed.
 *
 * `cost` is a notional worth, never a price. It is used for power scoring and
 * the matchup harness; nothing offers a machine for sale, because the shop
 * builds its stock from MUTANT_TYPES and TRUEKIN_TYPES only.
 *
 * PLACEHOLDER NUMBERS.
 */
export const MACHINE_TYPES: readonly UnitType[] = [
  {
    id: 10,
    name: 'Chrome Warden',
    lineage: MACHINE,
    cost: 260,
    color: 0xb8c4cc,
    blurb: 'Still holding a door that is no longer there.',
    description:
      'A House security frame, left standing when the House stopped. It has been executing the same standing order for four generations and has never once been relieved. Enormously armoured, slow, and completely indifferent to being shot.',
    base: {
      hp: 1100, armor: 15, damage: 62, attackInterval: 13,
      range: 26, moveSpeed: 2.8, accuracy: 0.86, evade: 0.02, radius: 12,
    },
  },
  {
    id: 11,
    name: 'Ordnance Frame',
    lineage: MACHINE,
    cost: 300,
    color: 0xc9a56b,
    blurb: 'Fires once. That is usually sufficient.',
    description:
      'A siege platform on three legs, built to break fortifications that no longer exist. Its ranging optics still work. Its armour never did — it was meant to be escorted, and it has not been escorted in a very long time.',
    base: {
      hp: 380, armor: 3, damage: 240, attackInterval: 34,
      range: 340, moveSpeed: 2.2, accuracy: 0.92, evade: 0.03, radius: 11,
    },
  },
  {
    id: 12,
    name: 'Sweeper',
    lineage: MACHINE,
    cost: 230,
    color: 0x9fb8a0,
    blurb: 'Sanitation. Of a kind.',
    description:
      'A maintenance unit that classifies anything moving in a restricted corridor as debris. It is very fast, it is not very strong, and it has never been told the corridor is gone.',
    base: {
      hp: 400, armor: 5, damage: 34, attackInterval: 5,
      range: 24, moveSpeed: 8.5, accuracy: 0.9, evade: 0.16, radius: 8,
    },
  },
  {
    id: 13,
    name: 'Hauler-Nine',
    lineage: MACHINE,
    cost: 240,
    color: 0x8a8f7a,
    blurb: 'Carries. Will not stop carrying.',
    description:
      'A cargo walker with nothing left to deliver. It is barely a weapon and very nearly unkillable, and a line that forms up behind one tends to survive the opening exchange.',
    base: {
      hp: 2200, armor: 10, damage: 40, attackInterval: 20,
      range: 24, moveSpeed: 3.0, accuracy: 0.74, evade: 0.01, radius: 12,
    },
  },
  {
    id: 14,
    name: 'Arc Caster',
    lineage: MACHINE,
    cost: 285,
    color: 0x8fd0e0,
    blurb: 'The air goes strange a half-second before.',
    description:
      'Nobody agrees on what it was for. It throws current a long way with unsettling precision, and the wasteland has learned to read the smell that comes before it discharges.',
    base: {
      hp: 460, armor: 6, damage: 105, attackInterval: 16,
      range: 260, moveSpeed: 3.4, accuracy: 0.95, evade: 0.05, radius: 10,
    },
  },
]

/**
 * Indexed by id — unitType(typeId) is UNIT_TYPES[typeId], so order matters and
 * machines, fauna, bosses and legendaries all have to live in here. None of
 * them are in either purchasable pool: the shop and the rival-band generator
 * both build from MUTANT_TYPES and TRUEKIN_TYPES, so none of them can ever be
 * offered for sale or turn up in somebody else's levy. MUTANT_TYPES and
 * TRUEKIN_TYPES filter RECRUITABLE specifically, not this table, for exactly
 * that reason — see the note on those two below; the difference used to be
 * academic and then wasn't (a real bug shipped from getting it backwards).
 */
export const UNIT_TYPES: readonly UnitType[] = [
  ...RECRUITABLE,
  ...MACHINE_TYPES,
  ...FAUNA_TYPES,
  ...BOSS_TYPES,
  ...LEGENDARY_TYPES,
]

/*
 * Filtered from RECRUITABLE, not UNIT_TYPES — a real bug lived here for a
 * while. Fauna and bosses are lineage 'mutant' for narrative reasons (the
 * wasteland mutated them too), so filtering the full UNIT_TYPES table pulled
 * all eight of them into MUTANT_TYPES alongside the five actual recruitable
 * mutants. Both the shop (shop.ts) and the rival-band generator
 * (encounters.ts) build from MUTANT_TYPES, so for a while The Long Gullet
 * could have been offered for sale, or turned up leading a random scav-band
 * at any encounter — found by sim:matchup unexpectedly iterating 18 unit
 * types instead of 10, not by a test. There is now one: see
 * "content stays inside the purchasable pool" in run.test.ts.
 */
export const MUTANT_TYPES = RECRUITABLE.filter((u) => u.lineage === MUTANT)
export const TRUEKIN_TYPES = RECRUITABLE.filter((u) => u.lineage === TRUEKIN)

/**
 * Discipline: the damage multiplier a squad retains once it has been ground
 * down to nothing. Morale is a multiplier, not an exit — nobody flees, they
 * just fight worse and worse until they are gone.
 *
 * Mutants fold toward 35% and collapse fast. True Kin barely notice. Machines
 * (M3) sit at 1 and never degrade, which is the balance for them being much
 * stronger. See docs/V0-DESIGN.md §7.
 */
export const DISCIPLINE: Record<UnitType['lineage'], number> = {
  mutant: 0.35,
  truekin: 0.78,
  // Machines never notice their own losses. That is the balance for them
  // being far above everything else in a fight — see CLAUDE.md's invariants.
  machine: 1,
}
