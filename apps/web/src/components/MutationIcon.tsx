import type { MutationIconId } from '@salt/game'
import { MUTATION_ICON_SRC } from '../assets/icons'

/**
 * One curated icon per family, not per mutation — carapace and dense-bone are
 * both 'shield', quills and razor-tail are both 'burst'. That reuse is the
 * point: a player who's learned "this icon means armour" should recognise
 * the family at a glance across every mutation that has it, the same way a
 * currency symbol works regardless of the amount next to it. The name and
 * tooltip still say which one it actually is.
 */
export default function MutationIcon({
  icon,
  size = 16,
}: {
  icon: MutationIconId
  size?: number
}) {
  return (
    <span className="mutation-icon" style={{ width: size, height: size }} aria-hidden="true">
      <img src={MUTATION_ICON_SRC[icon]} width={size} height={size} alt="" draggable={false} />
    </span>
  )
}
