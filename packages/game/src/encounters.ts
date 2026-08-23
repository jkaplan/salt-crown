import { Rng } from '@salt/sim'
import { rollOfficer } from './officers.js'
import type { Officer } from './officers.js'
import { rollPotential } from './potentials.js'
import type { Potential } from './potentials.js'
import type { Warband } from './roster.js'
import { squadCost } from './roster.js'
import { MUTANT_TYPES, TRUEKIN_TYPES } from './units.js'

export const ENCOUNTERS_PER_RUN = 8

/**
 * M1 fights rival warbands only — built from the same unit pool you recruit
 * from, so the content is nearly free. Wasteland fauna and the bosses from
 * below arrive in M4 (docs/V0-DESIGN.md §10).
 */
const BAND_PREFIX = [
  'Scav-band of', 'The Rust', 'Outriders of', 'The Low', 'Kin of',
  'The Salt', 'Wallers of', 'The Broken', 'Levies of', 'The Pale',
]

const BAND_SUFFIX = [
  'the Weir', 'Chorus', 'Ashfall', 'Gutter', 'the Ninth Gate',
  'Cinder', 'the Drowned Yard', 'Hollowmarch', 'the Red Cistern', 'Thrum',
]

const FLAVOUR = [
  'They were here first, and they intend to say so.',
  'Somebody paid them. Nobody remembers who.',
  'A House quarrel, three generations old, still being settled.',
  'They have been following your dust for two days.',
  'Neither side will remember what this was about.',
  'They want the ruin you were going to want.',
  'A rival levy, drawn up and waiting.',
  'Something drove them up out of the low country.',
]

export interface Encounter {
  index: number
  name: string
  flavour: string
  enemy: Warband
  reward: number
  bodies: number
}


/**
 * Enemy strength scales by salvage-equivalent budget, which naturally produces
 * escalating body counts — cheap mutants early, True Kin mixed in later.
 *
 * Difficulty is FIXED, never scaled to the player's warband. Rubber-banding
 * would kill the break-run pillar: if being strong doesn't trivialise fights,
 * breaking the game isn't a reward. See docs/V0-DESIGN.md §7.
 */
export function generateEncounter(rng: Rng, index: number): Encounter {
  let budget = Math.round(70 + 52 * index + 6.5 * index * index)
  const truekinChance = 0.12 + index * 0.07

  const squads: Warband['squads'] = []
  const potentials: Potential[] = []
  let guard = 0
  while (budget > 25 && guard++ < 12) {
    const isTrueKin = rng.float() < truekinChance
    const pool = isTrueKin ? TRUEKIN_TYPES : MUTANT_TYPES
    const type = pool[rng.int(pool.length)]
    const count = isTrueKin ? 3 + rng.int(6) : 8 + rng.int(14)
    const cost = squadCost(type.id, count)
    if (cost > budget * 1.35) continue

    squads.push({
      id: `e${rng.next().toString(36)}`,
      typeId: type.id,
      count,
      leader: null,
    })
    // Rival bands throw up standouts the same way you do.
    if (!isTrueKin && rng.float() < 0.5) {
      potentials.push(rollPotential(rng, type.id, index))
      budget -= type.cost * 3
    }
    budget -= cost
  }

  // Fallback so an unlucky roll can never produce an empty warband.
  if (squads.length === 0) {
    squads.push({
      id: `e${rng.next().toString(36)}`,
      typeId: MUTANT_TYPES[0].id,
      count: 12 + index * 4,
      leader: null,
    })
  }

  // Later bands field an officer of their own.
  const officers: Officer[] = []
  if (index >= 2 && rng.float() < 0.5) {
    const officer = rollOfficer(rng, `eo${rng.next().toString(36)}`)
    officers.push(officer)
    squads[0].leader = { kind: 'officer', id: officer.id }
  }

  const enemy: Warband = { squads, potentials, officers, salvage: 0 }
  const bodies = squads.reduce((n, s) => n + s.count, 0) + potentials.length

  return {
    index,
    name: `${BAND_PREFIX[rng.int(BAND_PREFIX.length)]} ${BAND_SUFFIX[rng.int(BAND_SUFFIX.length)]}`,
    flavour: FLAVOUR[rng.int(FLAVOUR.length)],
    enemy,
    reward: Math.round(105 + index * 80),
    bodies,
  }
}
