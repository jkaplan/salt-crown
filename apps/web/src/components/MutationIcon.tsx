import type { MutationIconId } from '@salt/game'

/** 8-pointed star, for the reflect family (Quills, Razor Tail). */
function starPoints(spikes: number, outerR: number, innerR: number): string {
  const pts: string[] = []
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const a = (Math.PI / spikes) * i - Math.PI / 2
    pts.push(`${(16 + r * Math.cos(a)).toFixed(1)},${(16 + r * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
}

const BURST_POINTS = starPoints(8, 14, 6)

function glyph(icon: MutationIconId) {
  switch (icon) {
    case 'blade':
      return <polygon points="16,2 19,20 16,17 13,20" />
    case 'fang':
      return <polygon points="2,26 8,9 12,20 16,5 20,20 24,9 30,26" />
    case 'shield':
      return (
        <path d="M16,3 L26,7 V16 C26,23 21,28 16,30 C11,28 6,23 6,16 V7 Z" />
      )
    case 'mass':
      return (
        <>
          <circle cx="13" cy="14" r="10" />
          <circle cx="21" cy="21" r="7" />
        </>
      )
    case 'chevron':
      return <polygon points="4,4 18,16 4,28 10,28 24,16 10,4" />
    case 'dash':
      return (
        <>
          <rect x="2" y="19" width="17" height="3" transform="rotate(-24 11 20)" />
          <rect x="8" y="13" width="17" height="3" transform="rotate(-24 17 14)" opacity="0.6" />
          <rect x="14" y="7" width="17" height="3" transform="rotate(-24 23 8)" opacity="0.3" />
        </>
      )
    case 'eye':
      return (
        <path
          fillRule="evenodd"
          d="M2,16 Q16,3 30,16 Q16,29 2,16 Z M16,11 a5,5 0 1,0 0,10 a5,5 0 1,0 0,-10 Z"
        />
      )
    case 'flame':
      return <path d="M18,2 C11,11 7,15 7,21 a9,9 0 1,0 18,0 C25,17 20,13 22,7 C19,9 18,6 18,2 Z" />
    case 'drop':
      return <path d="M16,4 C22,14 26,18 26,22 a10,10 0 1,1 -20,0 C6,18 10,14 16,4 Z" />
    case 'burst':
      return <polygon points={BURST_POINTS} />
    case 'bolt':
      return <polygon points="18,2 6,18 14,18 10,30 26,12 17,12" />
  }
}

export default function MutationIcon({
  icon,
  size = 16,
}: {
  icon: MutationIconId
  size?: number
}) {
  return (
    <span className="mutation-icon" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 32 32" width={size} height={size} className="mutation-icon-fill">
        {glyph(icon)}
      </svg>
    </span>
  )
}
