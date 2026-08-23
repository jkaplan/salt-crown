import { unitType } from '@salt/game'

/**
 * A unit name with its definition on hover. Same reasoning as MutationTag:
 * if you have to ask what a Sludge-Waller is, the game should answer, not the
 * designer.
 */
export default function UnitName({ typeId }: { typeId: number }) {
  const type = unitType(typeId)
  const s = type.base

  return (
    <span className={`unit-name ${type.lineage}`} tabIndex={0}>
      {type.name}
      <span className="tip" role="tooltip">
        <span className="tip-name">
          {type.name} <em>{type.lineage === 'mutant' ? 'Mutant' : 'True Kin'}</em>
        </span>
        <span className="tip-desc">{type.description}</span>
        <span className="tip-effect">
          {s.hp} hp · {s.damage} dmg · {s.armor} armour ·{' '}
          {s.range > 40 ? `${s.range} range` : 'melee'} · {s.moveSpeed.toFixed(1)} speed ·{' '}
          {(s.accuracy * 100).toFixed(0)}% acc
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
