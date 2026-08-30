/**
 * Curated icon art — 7Souls RPG Graphics (GameDev Market bundle), used under
 * its Pro license. Twenty-three hand-picked files out of a couple thousand
 * in the pack, one per mutation family / bionic / relic, so a player who's
 * learned to recognise a shape doesn't have that recognition thrown away by
 * the next item that happens to reuse a hand-drawn glyph.
 *
 * Static imports rather than a public/ folder path convention: this is a
 * small, fixed, hand-curated set (not a dynamically-loaded library), so
 * Vite's normal asset pipeline (hashing, bundling) is the right fit.
 *
 * Licensing note: this pack's terms permit personal/commercial use in a
 * derived project but not republishing the raw assets themselves inside an
 * open-source project. Fine for a private repo — worth checking again before
 * this repository is ever made public.
 */
import mutationBlade from './mutation-blade.png'
import mutationFang from './mutation-fang.png'
import mutationShield from './mutation-shield.png'
import mutationMass from './mutation-mass.png'
import mutationChevron from './mutation-chevron.png'
import mutationDash from './mutation-dash.png'
import mutationEye from './mutation-eye.png'
import mutationFlame from './mutation-flame.png'
import mutationDrop from './mutation-drop.png'
import mutationBurst from './mutation-burst.png'
import mutationBolt from './mutation-bolt.png'

import bionicNerveLattice from './bionic-nerve-lattice.png'
import bionicBracingStruts from './bionic-bracing-struts.png'
import bionicCarbideEdge from './bionic-carbide-edge.png'
import bionicRecoilDamper from './bionic-recoil-damper.png'
import bionicCirculatoryShunt from './bionic-circulatory-shunt.png'
import bionicGaitAssist from './bionic-gait-assist.png'

import relicSaltIdol from './relic-salt-idol.png'
import relicMarrowHorn from './relic-marrow-horn.png'
import relicCisternWard from './relic-cistern-ward.png'
import relicVatBrand from './relic-vat-brand.png'
import relicSwarmBanner from './relic-swarm-banner.png'
import relicIronWard from './relic-iron-ward.png'

/** Keyed by MutationIconId (packages/game/src/mutations.ts) — one per family. */
export const MUTATION_ICON_SRC: Record<string, string> = {
  blade: mutationBlade,
  fang: mutationFang,
  shield: mutationShield,
  mass: mutationMass,
  chevron: mutationChevron,
  dash: mutationDash,
  eye: mutationEye,
  flame: mutationFlame,
  drop: mutationDrop,
  burst: mutationBurst,
  bolt: mutationBolt,
}

/** Keyed by Bionic.id (packages/game/src/bionics.ts). */
export const BIONIC_ICON_SRC: Record<string, string> = {
  'nerve-lattice': bionicNerveLattice,
  'bracing-struts': bionicBracingStruts,
  'carbide-edge': bionicCarbideEdge,
  'recoil-damper': bionicRecoilDamper,
  'circulatory-shunt': bionicCirculatoryShunt,
  'gait-assist': bionicGaitAssist,
}

/** Keyed by Relic.id (packages/game/src/relics.ts). */
export const RELIC_ICON_SRC: Record<string, string> = {
  'salt-idol': relicSaltIdol,
  'marrow-horn': relicMarrowHorn,
  'cistern-ward': relicCisternWard,
  'vat-brand': relicVatBrand,
  'swarm-banner': relicSwarmBanner,
  'iron-ward': relicIronWard,
}
