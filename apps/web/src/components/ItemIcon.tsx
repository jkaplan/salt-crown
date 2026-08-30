import { BIONIC_ICON_SRC, RELIC_ICON_SRC } from '../assets/icons'

/**
 * One curated icon per bionic/relic — unlike mutations, these don't share a
 * family (six of each, all thematically distinct), so each gets its own
 * rather than being grouped.
 */
export default function ItemIcon({
  kind,
  id,
  size = 20,
}: {
  kind: 'bionic' | 'relic'
  id: string
  size?: number
}) {
  const src = (kind === 'bionic' ? BIONIC_ICON_SRC : RELIC_ICON_SRC)[id]
  if (!src) return null
  return (
    <span className="item-icon" style={{ width: size, height: size }} aria-hidden="true">
      <img src={src} width={size} height={size} alt="" draggable={false} />
    </span>
  )
}
