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

  return (
    <div className="start-screen">
      <div className="start-card">
        <h1>Salt Crown</h1>
        <p className="tagline">A pure auto battler. Compose a warband. Watch it clash.</p>

        <form onSubmit={handleSubmit}>
          <label>
            <span className="label">Seed</span>
            <input
              type="text"
              value={seedText}
              onChange={(e) => onSeedChange(e.target.value)}
              placeholder="Enter seed string"
              autoFocus
            />
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
