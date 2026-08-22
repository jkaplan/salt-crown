import { useEffect, useRef, useState } from 'react'
import { TEAM_A, type BattleConfig, type GroupResult, type Winner } from '@salt/sim'
import { BattleView } from '../BattleView'
import type { ViewStats } from '../BattleView'

const SPEEDS = [1, 2, 4, 8]

interface Props {
  config: BattleConfig
  title: string
  onStats?: (stats: ViewStats | null) => void
  onDone: (results: GroupResult[], winner: Winner, ticks: number) => void
}

/**
 * Pure auto battler: speed controls only. No positioning, no commands. All the
 * decisions were made in camp — see docs/V0-DESIGN.md §6.
 */
export default function BattleScreen({ config, title, onStats, onDone }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<BattleView | null>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const [stats, setStats] = useState<ViewStats | null>(null)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(true)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    let cancelled = false
    const view = new BattleView()
    const host = hostRef.current
    if (!host) return

    void view.init(host).then(() => {
      if (cancelled) {
        view.destroy()
        return
      }
      viewRef.current = view
      view.onStats = setStats
      view.onFinished = (results, winner, ticks) => {
        setFinished(true)
        doneRef.current(results, winner, ticks)
      }
      view.paused = true
      setPaused(true)
      view.start(config)
    })

    return () => {
      cancelled = true
      onStats?.(null)
      viewRef.current = null
      view.destroy()
    }
  }, [config, onStats])

  useEffect(() => {
    onStats?.(stats)
  }, [onStats, stats])

  const setSpeedTo = (s: number) => {
    if (viewRef.current) viewRef.current.speed = s
    setSpeed(s)
  }

  const togglePause = () => {
    if (!viewRef.current) return
    viewRef.current.paused = !viewRef.current.paused
    setPaused(viewRef.current.paused)
  }

  const combatants = stats
    ? [...stats.combatants].sort(
        (a, b) => Number(a.team !== TEAM_A) - Number(b.team !== TEAM_A) || a.groupIndex - b.groupIndex,
      )
    : []

  return (
    <div className="battle">
      <div className="stage-wrap">
        <div className="stage" ref={hostRef} />
        {stats && (
          <div className="battle-hud">
            <div className="battle-hud-head">
              <span>Squad health</span>
              <span>{stats.tick}t</span>
            </div>
            <div className="battle-hud-list">
              {combatants.map((combatant) => {
                const ratio = combatant.maxHp > 0 ? Math.max(0, Math.min(1, combatant.currentHp / combatant.maxHp)) : 0
                return (
                  <div
                    key={`${combatant.groupIndex}-${combatant.label}`}
                    className={`battle-hud-row ${combatant.team === TEAM_A ? 'player' : 'enemy'}`}
                  >
                    <div className="battle-hud-label">{combatant.label}</div>
                    <div className="battle-hud-track">
                      <div className="battle-hud-fill" style={{ width: `${ratio * 100}%` }} />
                    </div>
                    <div className="battle-hud-text">
                      {combatant.currentHp.toFixed(0)} / {combatant.maxHp.toFixed(0)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <div className="battle-bar">
        <div className="battle-title">{title}</div>
        <div className="counts">
          <span className="a">{stats?.aliveA ?? 0}</span>
          <span className="vs">vs</span>
          <span className="b">{stats?.aliveB ?? 0}</span>
        </div>
        <button onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
        <div className="speeds">
          {SPEEDS.map((s) => (
            <button key={s} className={s === speed ? 'on' : ''} onClick={() => setSpeedTo(s)}>
              {s}×
            </button>
          ))}
        </div>
        <div className="perf">
          {stats ? `${stats.fps.toFixed(0)} fps · ${stats.simMs.toFixed(2)} ms/tick` : '—'}
        </div>
      </div>
      {finished && <div className="battle-done">Resolving…</div>}
    </div>
  )
}
