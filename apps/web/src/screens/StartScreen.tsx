// World words for seed generation
const WORLD_WORDS = [
  'Rust', 'Ash', 'Weir', 'Gutter', 'Cinder', 'Thrum', 'Chorus', 'Ashfall',
  'Drowned', 'Hollow', 'Pale', 'Broken', 'Salt', 'Low', 'Red', 'Cistern',
  'Wreck', 'Silt', 'Bone', 'Fray', 'Void', 'Dusk', 'Thorn', 'Sting',
  'Scrap', 'Mire', 'Scar', 'Husk', 'Blight', 'Tangle', 'Shale', 'Crux',
]

function generateRandomSeed(): string {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]
  return `${pick(WORLD_WORDS)}-${pick(WORLD_WORDS)}`.toLowerCase()
}

const PLAYER_PALETTE = ['#7fc7bb', '#9ac7ff', '#d7b3ff', '#ffbe7a', '#8fe38c']

export default function StartScreen({
  seedText,
  playerColor,
  onSeedChange,
  onPlayerColorChange,
  onStart,
}: {
  seedText: string
  playerColor: string
  onSeedChange: (seed: string) => void
  onPlayerColorChange: (color: string) => void
  onStart: () => void
}) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onStart()
  }

  const handleRandomize = () => {
    onSeedChange(generateRandomSeed())
  }

  return (
    <div className="start-screen">
      <div className="start-card">
        <h1>Salt Crown</h1>
        <p className="tagline">A pure auto battler. Compose a warband. Watch it clash.</p>

        <form onSubmit={handleSubmit}>
          <label>
            <span className="label">Seed</span>
            <div className="seed-input-group">
              <input
                type="text"
                value={seedText}
                onChange={(e) => onSeedChange(e.target.value)}
                placeholder="Enter seed string"
                autoFocus
              />
              <button type="button" className="randomize-btn" onClick={handleRandomize}>
                Randomize
              </button>
            </div>
            <span className="hint">
              Same seed produces the same encounters. Try: <code>salt-crown</code>, <code>test</code>
              , or anything.
            </span>
          </label>

          <div className="palette-block">
            <span className="label">Choose your color</span>
            <div className="color-palette">
              {PLAYER_PALETTE.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className={swatch === playerColor ? 'swatch on' : 'swatch'}
                  onClick={() => onPlayerColorChange(swatch)}
                  aria-label={`Choose ${swatch} as your colour`}
                  style={{ ['--c' as string]: swatch }}
                />
              ))}
              {/* Presets cover the readable range; the picker is for anything else. */}
              <label
                className={PLAYER_PALETTE.includes(playerColor) ? 'swatch custom' : 'swatch custom on'}
                style={{ ['--c' as string]: playerColor }}
                title="Custom colour"
              >
                <input
                  type="color"
                  value={playerColor}
                  onChange={(e) => onPlayerColorChange(e.target.value)}
                  aria-label="Custom faction colour"
                />
              </label>
            </div>
          </div>

          <button type="submit" className="start-btn">
            Begin Campaign
          </button>
        </form>
      </div>
    </div>
  )
}
