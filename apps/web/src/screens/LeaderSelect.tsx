import { useState } from 'react'
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
  const [selectedOfficer, setSelectedOfficer] = useState<Officer | null>(null)
  const [editName, setEditName] = useState('')

  // Generate 3 unique leaders based on the seed
  const rng = new Rng(hashSeed(seed))
  const officers: Officer[] = []
  for (let i = 0; i < 3; i++) {
    officers.push(rollOfficer(rng, `leader-${i}`))
  }

  const handleSelectOfficer = (officer: Officer) => {
    setSelectedOfficer(officer)
    setEditName(officer.name)
  }

  const handleConfirm = () => {
    if (selectedOfficer) {
      onSelect({ ...selectedOfficer, name: editName })
    }
  }

  if (selectedOfficer) {
    const rank = OFFICER_RANKS_BY_ID.get(selectedOfficer.rankId)
    return (
      <div className="commander-select">
        <div className="leader-card">
          <h2>Name Your Commander</h2>
          <p className="tagline">Choose the name they will be known by.</p>

          <div className="name-edit-form">
            <div className="preview">
              <span className="rank-label">{rank?.rank}</span>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="name-input"
                placeholder="Commander name"
                autoFocus
              />
              <span className="house-label">of {selectedOfficer.house}</span>
            </div>

            <p className="preview-effect">{rank?.effect}</p>

            <div className="button-group">
              <button className="back-btn" onClick={() => setSelectedOfficer(null)}>
                Back
              </button>
              <button className="confirm-btn" onClick={handleConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="commander-select">
      <div className="leader-card">
        <h2>Choose Your Commander</h2>
        <p className="tagline">A House heir leads your forces into battle.</p>

        <ul className="leader-options">
          {officers.map((officer) => {
            const rank = OFFICER_RANKS_BY_ID.get(officer.rankId)
            return (
              <li key={officer.id}>
                <button className="leader-option" onClick={() => handleSelectOfficer(officer)}>
                  <div className="leader-head">
                    <span className="title">{officerTitle(officer)}</span>
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
