import { useState } from 'react'

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

export default function StartScreen({
  seedText,
  onSeedChange,
  onStart,
}: {
  seedText: string
  onSeedChange: (seed: string) => void
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
          <button type="submit" className="start-btn">
            Begin Campaign
          </button>
        </form>
      </div>
    </div>
  )
}
