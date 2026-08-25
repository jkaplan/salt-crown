import type { HarmKind } from '@salt/game'

function glyph(kind: HarmKind) {
  switch (kind) {
    case 'blade':
      return <polygon points="16,2 19,20 16,17 13,20" />
    case 'pierce':
      return <polygon points="16,1 18,22 16,26 14,22" />
    case 'blunt':
      return <polygon points="16,3 26,9 24,22 16,29 8,22 6,9" />
    case 'burn':
      return <path d="M18,2 C11,11 7,15 7,21 a9,9 0 1,0 18,0 C25,17 20,13 22,7 C19,9 18,6 18,2 Z" />
  }
}

/** A permanent injury's own mark — small, and deliberately not the mutation glyph style. */
export default function InjuryIcon({
  kind,
  size = 14,
}: {
  kind: HarmKind
  size?: number
}) {
  return (
    <span className="injury-icon" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 32 32" width={size} height={size} className="injury-icon-fill">
        {glyph(kind)}
      </svg>
    </span>
  )
}
