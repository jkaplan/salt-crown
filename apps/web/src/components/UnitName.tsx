import { unitType } from '@salt/game'
import type { ResolvedStats } from '@salt/sim'

/**
 * A unit name with its definition on hover. Same reasoning as MutationTag:
 * if you have to ask what a Sludge-Waller is, the game should answer, not the
 * designer.
 *
 * `resolved`, when given, is what actually shows in the tip instead of the
 * base type line — a squad's real numbers after leader bonus and mutations,
 * not the type's stock stats. This is where the per-row stat strip moved:
 * docs/UX.md §2 says the battle line is about pace and the recruit list is
 * about price and capacity, not five stats sitting in every row whether or
 * not the screen's decision needs them.
 */
export default function UnitName({
  typeId,
  resolved,
}: {
  typeId: number
  resolved?: ResolvedStats
}) {
  const type = unitType(typeId)
  const s = resolved ?? type.base

  const traits = resolved
    ? [
        resolved.regen > 0 && 'regen',
        resolved.quills > 0 && 'quills',
        resolved.frenzy > 0 && 'frenzy',
      ].filter((t): t is string => Boolean(t))
    : []

  return (
    <span className={`unit-name ${type.lineage}`} tabIndex={0}>
      {type.name}
      <span className="tip" role="tooltip">
        <span className="tip-name">
          {type.name} <em>{type.lineage === 'mutant' ? 'Mutant' : 'True Kin'}</em>
        </span>
        <span className="tip-desc">{type.description}</span>
        <span className="tip-effect">
          {s.hp.toFixed(0)} hp · {s.damage.toFixed(0)} dmg · {s.armor.toFixed(0)} armour ·{' '}
          {s.range > 40 ? `${s.range.toFixed(0)} range` : 'melee'} · {s.moveSpeed.toFixed(1)}{' '}
          speed · {(s.accuracy * 100).toFixed(0)}% acc
          {traits.length > 0 ? ` · ${traits.join(', ')}` : ''}
        </span>
        <span className="tip-scale">
          {type.cost} salvage each
          {type.lineage === 'mutant'
            ? ' · can mutate'
            : ' · never mutates, takes bionics instead'}
        </span>
      </span>
    </span>
  )
}
