import type { BattleReport } from '@salt/game'
import { COLLAPSE_THRESHOLD, TICKS_PER_SECOND } from '@salt/sim'

interface Props {
  report: BattleReport
  onContinue: () => void
  isLast: boolean
}

export default function Report({ report, onContinue, isLast }: Props) {
  const dead = report.squads.reduce((n, s) => n + s.dead, 0)
  const held = report.squads.reduce((n, s) => n + s.survived, 0)
  const enemyDead = report.enemy.reduce((n, s) => n + s.dead, 0)
  const enemyDamageDealt = report.enemy.reduce((n, s) => n + s.damageDealt, 0)
  const enemyDamageTaken = report.enemy.reduce((n, s) => n + s.damageTaken, 0)
  const playerDamageDealt = report.squads.reduce((n, s) => n + s.damageDealt, 0)
  const playerDamageTaken = report.squads.reduce((n, s) => n + s.damageTaken, 0)
  const seconds = report.ticks / TICKS_PER_SECOND
  const playerDps = seconds > 0 ? playerDamageDealt / seconds : 0
  const enemyDps = seconds > 0 ? enemyDamageDealt / seconds : 0
  const lostProspects = report.prospects.filter((p) => p.died)
  const livedProspects = report.prospects.filter((p) => !p.died)

  return (
    <div className="report">
      <div className="report-card">
        <h2 className={report.won ? 'won' : 'lost'}>
          {report.won ? 'The field is yours' : 'The warband broke'}
        </h2>
        <p className="enc">
          {report.encounterName} · {(report.ticks / TICKS_PER_SECOND).toFixed(0)}s
        </p>

        <div className="tally">
          <div>
            <span className="big dead">{dead}</span>
            <span className="label">fodder lost</span>
          </div>
          <div>
            <span className="big held">{held}</span>
            <span className="label">still standing</span>
          </div>
          <div>
            <span className="big">{enemyDead}</span>
            <span className="label">theirs killed</span>
          </div>
          <div>
            <span className="big salvage">
              {report.salvageEarned > 0 ? `+${report.salvageEarned}` : '0'}
            </span>
            <span className="label">salvage</span>
          </div>
        </div>

        <div className="battle-summary">
          <h3>Battle summary</h3>
          <div className="summary-grid">
            <div>
              <span className="summary-label">Enemies killed</span>
              <strong>{enemyDead}</strong>
            </div>
            <div>
              <span className="summary-label">Your DPS</span>
              <strong>{playerDps.toFixed(1)}</strong>
            </div>
            <div>
              <span className="summary-label">Enemy DPS</span>
              <strong>{enemyDps.toFixed(1)}</strong>
            </div>
            <div>
              <span className="summary-label">Damage dealt</span>
              <strong>{playerDamageDealt.toFixed(0)}</strong>
            </div>
            <div>
              <span className="summary-label">Damage taken</span>
              <strong>{playerDamageTaken.toFixed(0)}</strong>
            </div>
            <div>
              <span className="summary-label">Enemy damage taken</span>
              <strong>{enemyDamageTaken.toFixed(0)}</strong>
            </div>
          </div>
        </div>

        {report.prospects.length > 0 && (
          <div className="prospect-roll">
            {lostProspects.length > 0 && (
              <>
                <h3 className="lost-head">Lost</h3>
                <ul className="pot-list">
                  {lostProspects.map((p) => (
                    <li key={p.name} className="pot-dead">
                      <span className="prospect-name">{p.name}</span>
                      <span className="dim">
                        {p.label} · {p.battles} battle{p.battles === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {livedProspects.length > 0 && (
              <>
                <h3>Still with you</h3>
                <ul className="pot-list">
                  {livedProspects.map((p) => (
                    <li key={p.name}>
                      <span className="prospect-name">{p.name}</span>
                      <span className="dim">
                        {p.battles} battle{p.battles === 1 ? '' : 's'} survived
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <table className="losses">
          <thead>
            <tr>
              <th>Squad</th>
              <th>Fielded</th>
              <th>Dead</th>
              <th>Standing</th>
              <th title="The damage multiplier it ended the battle on. Morale falls with losses, so a collapsing squad hits weaker as well as thinner.">
                Morale
              </th>
            </tr>
          </thead>
          <tbody>
            {report.squads.map((s) => {
              const eff = Math.round(s.endEffectiveness * 100)
              return (
                <tr key={s.label} className={eff < COLLAPSE_THRESHOLD * 100 ? 'collapsing' : ''}>
                  <td>{s.label}</td>
                  <td>{s.started}</td>
                  <td className="dead">{s.dead}</td>
                  <td>{s.survived}</td>
                  <td className={eff < COLLAPSE_THRESHOLD * 100 ? 'dead' : ''}>{eff}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {lostProspects.length > 0 && (
          <p className="hint">
            A Prospect does not come back. Fodder is a line item; these were the ones worth
            watching.
          </p>
        )}

        <button className="btn-primary" onClick={onContinue}>
          {report.won ? (isLast ? 'End the run' : 'Break camp') : 'The run ends here'}
        </button>
      </div>
    </div>
  )
}
