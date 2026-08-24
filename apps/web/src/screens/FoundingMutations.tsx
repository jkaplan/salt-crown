import { useState } from 'react'
import { MAX_FOUNDING_MUTATIONS, MUTATIONS, foundingLevel } from '@salt/game'

/**
 * The mutant origin's character creation — docs/V0-DESIGN.md §13.
 *
 * "The True Kin start is about who leads you, the mutant start is about what
 * you are." So this screen is the counterpart to picking a commander, and it
 * matters more than a stat bump: this is what YOUR body can do, every single
 * battle, for the whole run — Prospects fight as their own individual, not
 * just as a squad-wide modifier.
 *
 * The trade is inside one currency. Taking fewer means taking them deeper —
 * a level 6 Horns on the body doing the fighting is a genuinely different
 * opening from three mutations at 2, and the level updates live as the
 * player adds and removes, because that trade is the entire decision and
 * describing it in prose would make it a puzzle instead.
 */
export default function FoundingMutations({
  onBack,
  onConfirm,
}: {
  onBack: () => void
  onConfirm: (mutationIds: string[], name: string) => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [name, setName] = useState('Rust')

  const level = foundingLevel(picked.length)

  const toggle = (id: string) =>
    setPicked((p) =>
      p.includes(id)
        ? p.filter((x) => x !== id)
        : p.length < MAX_FOUNDING_MUTATIONS
          ? [...p, id]
          : p,
    )

  return (
    <div className="founding">
      <header className="setup-head">
        <h1>What are you?</h1>
        <p className="dim">
          You were elevated as somebody&rsquo;s joke and you kept the title. Whatever you carry,
          the squad you stand with carries too — at full strength, because you are a Firstborn.
        </p>
      </header>

      <label className="name-row">
        <span className="dim">They call you</span>
        <input
          className="name-input"
          value={name}
          maxLength={18}
          onChange={(e) => setName(e.target.value)}
          aria-label="Your name"
        />
      </label>

      <div className="founding-meter">
        <b>{picked.length}</b>
        <i>/{MAX_FOUNDING_MUTATIONS} chosen</i>
        <span className="founding-level">
          {picked.length === 0 ? (
            <span className="dim">pick at least one</span>
          ) : (
            <>
              each at level <b>{level}</b>
              {picked.length < MAX_FOUNDING_MUTATIONS && (
                <span className="dim"> — fewer means deeper</span>
              )}
            </>
          )}
        </span>
      </div>

      <ul className="founding-list">
        {MUTATIONS.map((m) => {
          const on = picked.includes(m.id)
          return (
            <li key={m.id}>
              <button
                className={on ? 'founding-pick on' : 'founding-pick'}
                disabled={!on && picked.length >= MAX_FOUNDING_MUTATIONS}
                onClick={() => toggle(m.id)}
              >
                <span className="row-name">
                  <b>{m.name}</b>
                  <span className="dim">{m.blurb}</span>
                </span>
                {/* At the level it would actually arrive at, not a generic
                    description — the level is half the decision. */}
                <span className="gc-effect">{m.describe(level)}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="setup-actions">
        <button className="btn-quiet" onClick={onBack}>
          Back
        </button>
        <button
          className="btn-primary"
          disabled={picked.length === 0 || name.trim() === ''}
          onClick={() => onConfirm(picked, name.trim())}
        >
          Walk away
        </button>
      </div>
    </div>
  )
}
