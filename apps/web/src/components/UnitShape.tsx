import { squadShape } from '@salt/game'

function shapePoints(kind: number): string {
  switch (kind) {
    case 1:
      return '16,2 30,16 16,30 2,16'
    case 3:
      return '16,2 30,30 2,30'
    case 4:
      return '16,2 28,8 30,18 24,30 8,30 2,18 4,8'
    case 5:
      return '16,2 22,8 28,14 24,18 27,30 16,23 5,30 8,18 4,14 10,8'
    case 6:
      return '16,2 20,12 30,12 24,17 26,30 16,21 6,30 8,17 2,12 12,12'
    case 7:
      return '16,2 20,8 29,7 24,16 29,25 20,24 16,30 12,24 3,25 8,16 3,7 12,8'
    default:
      return ''
  }
}

export default function UnitShape({ typeId, size = 18 }: { typeId: number; size?: number }) {
  const kind = squadShape(typeId)
  const points = shapePoints(kind)
  return (
    <span className="unit-shape" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 32 32" width={size} height={size}>
        {kind === 0 && <circle cx="16" cy="16" r="14" className="unit-shape-fill" />}
        {kind === 2 && <rect x="3" y="3" width="26" height="26" rx="4" className="unit-shape-fill" />}
        {kind !== 0 && kind !== 2 && <polygon points={points} className="unit-shape-fill" />}
      </svg>
    </span>
  )
}
