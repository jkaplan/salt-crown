import { MUTATIONS_BY_ID } from '@salt/game'
import type { MutationRoll } from '@salt/game'

/**
 * A mutation chip with its definition on hover. The recruit screen is meant to
 * be a lottery you can read — if you can't tell what Quills 4 does without
 * leaving the screen, you're buying blind.
 */
export default function MutationTag({ roll, hot }: { roll: MutationRoll; hot?: boolean }) {
  const def = MUTATIONS_BY_ID.get(roll.id)
  if (!def) return null

  return (
    <span className={`tag ${hot ? 'hot' : ''}`} tabIndex={0}>
      {def.name} <b>{roll.level}</b>
      <span className="tip" role="tooltip">
        <span className="tip-name">
          {def.name} <em>level {roll.level}</em>
        </span>
        <span className="tip-effect">{def.describe(roll.level)}</span>
        <span className="tip-blurb">{def.blurb}</span>
        <span className="tip-scale">Scales 1–6. Higher rolls are rarer and cost more.</span>
      </span>
    </span>
  )
}
