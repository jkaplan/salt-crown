import type { UnitType } from '@salt/sim'

/**
 * The two encounter pools that are not other people — docs/V0-DESIGN.md §10.
 *
 * Neither is recruitable. Both live in UNIT_TYPES because that table is
 * indexed by id, and neither is in MUTANT_TYPES or TRUEKIN_TYPES, which is
 * what the shop and the rival-band generator actually build from.
 *
 * They are `mutant` lineage because the wasteland mutated them and there are
 * only ever three lineages (CLAUDE.md). Lineage answers "how does this pool
 * behave when it starts losing", which is the right question for the three
 * pools a player recruits from and the wrong one for a pack animal — so both
 * of these set `discipline` directly instead.
 */

const MUTANT = 'mutant' as const

/**
 * Fauna and flora. Cheap, weird, atmospheric, and doing their own thing —
 * §10 calls them the middle tier of content cost, and the point of them is
 * that a run is not eight consecutive fights against people with a plan.
 *
 * They differ from rival warbands in shape, not just stats: no leaders, no
 * mutations, no mixed composition. A beast encounter is one or two kinds of
 * thing in quantity, which reads completely differently on the field.
 *
 * PLACEHOLDER NUMBERS.
 */
export const FAUNA_TYPES: readonly UnitType[] = [
  {
    id: 15,
    name: 'Salt Hound',
    lineage: MUTANT,
    cost: 6,
    color: 0xc2b49a,
    blurb: 'Arrives in numbers and from downwind.',
    description:
      'Something that used to be a dog, bred thin and pale by four generations of drinking from the flats. They hunt the way weather arrives — all at once, from the direction you were not watching.',
    // A pack does not decide to stop. It thins until there is no pack.
    discipline: 0.55,
    base: {
      hp: 26, armor: 0, damage: 9, attackInterval: 7,
      range: 22, moveSpeed: 9.5, accuracy: 0.74, evade: 0.12, radius: 7,
    },
  },
  {
    id: 16,
    name: 'Glasswing',
    lineage: MUTANT,
    cost: 3,
    color: 0xa9c8d8,
    blurb: 'A sound like a window being considered.',
    description:
      'They drift in off the flats in their thousands and settle on whatever is warm. Individually they are almost nothing. The problem has never been an individual.',
    discipline: 0.9,
    base: {
      hp: 9, armor: 0, damage: 4, attackInterval: 6,
      range: 22, moveSpeed: 7.0, accuracy: 0.66, evade: 0.22, radius: 6,
    },
  },
  {
    id: 17,
    name: 'Rooted Thing',
    lineage: MUTANT,
    cost: 22,
    color: 0x6f8455,
    blurb: 'It was here before the road was.',
    description:
      'Ambulatory only by the loosest definition. It has been standing in the same wash for a very long time, and everything that has ever walked past it is part of it now.',
    // It does not know the others are gone. It may not know there were others.
    discipline: 1,
    base: {
      hp: 240, armor: 5, damage: 30, attackInterval: 18,
      range: 34, moveSpeed: 1.2, accuracy: 0.8, evade: 0, radius: 12,
    },
  },
  {
    id: 18,
    name: 'Cistern Worm',
    lineage: MUTANT,
    cost: 18,
    color: 0x8b6f7a,
    blurb: 'Comes up where the water was.',
    description:
      'They follow the old pipe runs and surface wherever somebody has recently been drinking. Slow, blind, and extremely difficult to discourage.',
    discipline: 0.85,
    base: {
      hp: 130, armor: 3, damage: 20, attackInterval: 13,
      range: 24, moveSpeed: 2.6, accuracy: 0.7, evade: 0.01, radius: 10,
    },
  },
  {
    id: 19,
    name: 'Ashcrawler',
    lineage: MUTANT,
    cost: 14,
    color: 0x7d7468,
    blurb: 'Plated, patient, and closer than it was.',
    description:
      'A scavenger built like a collapsed wall. It does not hurry and it does not need to — it eats what other things have finished with, and it is prepared to wait for you to become that.',
    discipline: 0.75,
    base: {
      hp: 95, armor: 7, damage: 14, attackInterval: 11,
      range: 22, moveSpeed: 3.4, accuracy: 0.76, evade: 0.02, radius: 9,
    },
  },
]

/**
 * The horrors from below. Three per run, at encounters 5, 10 and 15.
 *
 * §10: "bespoke, clearly not playing the same game as everyone else." That is
 * the whole design brief, and it is a statement about SHAPE rather than about
 * numbers. A rival warband is forty things you could have recruited. A boss is
 * one thing, with an escort, and the one thing has more HP than the escort put
 * together — so the fight reads as a siege against a single problem rather
 * than as a bigger version of last week.
 *
 * ARMOUR IS THE LOAD-BEARING NUMBER HERE, and it is set low on purpose.
 *
 * Armour is flat reduction (CLAUDE.md), so a boss's armour decides whether
 * cheap bodies are relevant to the fight at all rather than how tough it is.
 * The first pass gave the act-1 boss 12 armour against a Chaff's 5 damage:
 * every fodder swing did the minimum 1, the whole warband could not out-damage
 * nothing, and 98 of 200 harness runs died on that one encounter. A boss is
 * meant to be a wall, not a check for a stat the player has no way to have yet.
 *
 * So the walls are built out of HP, and armour rises just enough across the
 * three that an all-fodder warband gets steadily worse value — which is the
 * pressure toward quality that §6b wants, applied as a gradient instead of a
 * gate.
 *
 * The correction overshot once in the other direction: cutting HP as well as
 * armour left the act-1 boss outweighed by its own escort, which makes a boss
 * encounter a warband with a mascot. HP is back up and the escort share is
 * down; armour stayed where it is, because armour was the thing that was
 * actually wrong.
 *
 * PLACEHOLDER NUMBERS.
 */
export const BOSS_TYPES: readonly UnitType[] = [
  {
    id: 20,
    name: 'The Sounding',
    lineage: MUTANT,
    cost: 400,
    color: 0x6a5f7d,
    blurb: 'The noise under the flats, which has finished approaching.',
    description:
      'For a while it was a sound that came up through the salt for most of an hour and then stopped. Nobody who described it agreed with anybody else, and everybody who described it agreed it was getting closer. It is not a sound.',
    discipline: 1,
    base: {
      hp: 2400, armor: 3, damage: 34, attackInterval: 12,
      range: 46, moveSpeed: 2.4, accuracy: 0.88, evade: 0, radius: 12,
    },
  },
  {
    id: 21,
    name: 'Palimpsest',
    lineage: MUTANT,
    cost: 600,
    color: 0x8d6a5a,
    blurb: 'Several things, agreeing.',
    description:
      'A breeding programme that continued after the people running it stopped, and kept continuing, and stopped being several. It is still trying to fill an order. It has not been told the order was cancelled or by whom.',
    discipline: 1,
    base: {
      hp: 6000, armor: 6, damage: 66, attackInterval: 10,
      range: 40, moveSpeed: 2.2, accuracy: 0.9, evade: 0, radius: 12,
    },
  },
  {
    id: 22,
    name: 'The Long Gullet',
    lineage: MUTANT,
    cost: 900,
    color: 0x4f6b64,
    blurb: 'The reason the lower levels are the lower levels.',
    description:
      'The Houses did not abandon the deep levels because the pumps failed. The pumps failed because there was no longer anybody down there to run them, and there was no longer anybody down there because of this. It has been fed continuously for four generations and has never once been full.',
    discipline: 1,
    base: {
      hp: 16000, armor: 10, damage: 125, attackInterval: 9,
      range: 52, moveSpeed: 2.0, accuracy: 0.93, evade: 0, radius: 12,
    },
  },
]
