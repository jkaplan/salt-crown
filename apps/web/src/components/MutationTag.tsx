import { MUTATIONS_BY_ID } from '@salt/game'
import type { MutationRoll } from '@salt/game'
import MutationIcon from './MutationIcon'

/**
 * A mutation chip with its definition on hover. The recruit screen is meant to
 * be a lottery you can read — if you can't tell what Quills 4 does without
 * leaving the screen, you're buying blind.
 */
export default function MutationTag({ roll, hot }: { roll: MutationRoll; hot?: boolean }) {
  const def = MUTATIONS_BY_ID.get(roll.id)
  if (!def) return null

  return (
    <span className={`tag ${hot ? 'hot' : ''}${def.defect ? ' defect' : ''}`} tabIndex={0}>
      <MutationIcon icon={def.icon} size={13} />
      {def.name} <b>{roll.level}</b>
      <span className="tip" role="tooltip">
        <span className="tip-name">
          {def.name} <em>level {roll.level}</em>
        </span>
        <span className="tip-effect">{def.describe(roll.level)}</span>
        {/* A defect was never chosen and never priced, so the buyer's-guide
            line below would be nonsense on one. */}
        <span className="tip-scale">
          {def.defect
            ? 'Not chosen. An unstable body grew this on its own.'
            : 'Scales 1–6. Higher rolls are rarer and cost more.'}
        </span>
      </span>
    </span>
  )
}
