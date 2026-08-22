import { Rng, hashSeed } from '@salt/sim'
import { OFFICER_RANKS_BY_ID, officerTitle, rollOfficer } from '@salt/game'
import type { Officer } from '@salt/game'

export default function LeaderSelect({
  seed,
  onSelect,
}: {
  seed: string
  onSelect: (officer: Officer) => void
}) {
  // Generate 3 unique leaders based on the seed
  const rng = new Rng(hashSeed(seed))
  const officers: Officer[] = []
  for (let i = 0; i < 3; i++) {
    officers.push(rollOfficer(rng, `leader-${i}`))
  }

  return (
    <div className="leader-select">
      <div className="leader-card">
        <h2>Choose Your Commander</h2>
        <p className="tagline">A House heir leads your forces into battle.</p>

        <ul className="leader-options">
          {officers.map((officer) => {
            const rank = OFFICER_RANKS_BY_ID.get(officer.rankId)
            return (
              <li key={officer.id}>
                <button className="leader-option" onClick={() => onSelect(officer)}>
                  <div className="leader-head">
                    <span className="title">{officerTitle(officer)}</span>
                    <span className="rank-blurb">{rank?.blurb}</span>
                  </div>
                  <div className="leader-effect">{rank?.effect}</div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
