import { useEffect, useRef, useState } from 'react'
import { BattleEventType, TEAM_A, type BattleConfig, type BattleEvent, type GroupResult, type Winner } from '@salt/sim'
import { BattleView } from '../BattleView'
import type { ViewStats } from '../BattleView'

const SPEEDS = [1, 2, 4, 8]
/** Recent notable events kept on screen; older ones just scroll off. */
const LOG_CAPACITY = 8
/** Named fighters shown in the roster HUD, per docs/V0-DESIGN.md §5c. */
const ROSTER_CAPACITY = 8

function formatEvent(e: BattleEvent): string {
  switch (e.type) {
    case BattleEventType.Hit:
      return `${e.label} is struck for ${Math.round(e.value)}`
    case BattleEventType.Died:
      return `${e.label} has fallen`
    case BattleEventType.Collapsed:
      return `${e.label} is collapsing`
    default:
      return e.label
  }
}

interface Props {
  config: BattleConfig
  title: string
  playerColor?: string
  onStats?: (stats: ViewStats | null) => void
  onDone: (results: GroupResult[], winner: Winner, ticks: number) => void
}

/**
 * Pure auto battler: speed controls only. No positioning, no commands. All the
 * decisions were made in camp — see docs/V0-DESIGN.md §6.
 */
export default function BattleScreen({ config, title, playerColor = '#7fc7bb', onStats, onDone }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<BattleView | null>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const [stats, setStats] = useState<ViewStats | null>(null)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(true)
  const [finished, setFinished] = useState(false)
  const [log, setLog] = useState<BattleEvent[]>([])

  useEffect(() => {
    let cancelled = false
    const view = new BattleView()
    const host = hostRef.current
    if (!host) return

    view.setPlayerColor(playerColor)
    setLog([])

    void view.init(host).then(() => {
      if (cancelled) {
        view.destroy()
        return
      }
      viewRef.current = view
      view.onStats = (s) => {
        setStats(s)
        if (s && s.events.length > 0) {
          // Events arrive oldest-first within a batch; reverse so the whole
          // log stays newest-first once prepended.
          setLog((prev) => [...s.events].reverse().concat(prev).slice(0, LOG_CAPACITY))
        }
      }
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
    if (viewRef.current) {
      viewRef.current.setPlayerColor(playerColor)
    }
  }, [playerColor])

  useEffect(() => {
    onStats?.(stats)
  }, [onStats, stats])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }

      if (event.key === ' ') {
        event.preventDefault()
        if (!viewRef.current) return
        viewRef.current.paused = !viewRef.current.paused
        setPaused(viewRef.current.paused)
        return
      }

      const speedByKey: Record<string, number> = {
        '1': 1,
        '2': 2,
        '3': 4,
        '4': 8,
      }
      const next = speedByKey[event.key]
      if (!next) return
      event.preventDefault()
      if (viewRef.current) viewRef.current.speed = next
      setSpeed(next)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const setSpeedTo = (s: number) => {
    if (viewRef.current) viewRef.current.speed = s
    setSpeed(s)
  }

  const togglePause = () => {
    if (!viewRef.current) return
    viewRef.current.paused = !viewRef.current.paused
    setPaused(viewRef.current.paused)
  }

  const playerPower = stats
    ? stats.combatants.filter((combatant) => combatant.team === TEAM_A).reduce((sum, combatant) => sum + combatant.currentHp, 0)
    : 0
  const enemyPower = stats
    ? stats.combatants.filter((combatant) => combatant.team !== TEAM_A).reduce((sum, combatant) => sum + combatant.currentHp, 0)
    : 0
  const totalPower = playerPower + enemyPower
  const momentum = totalPower > 0 ? playerPower / totalPower : 0.5
  // Stable array order (each named individual is its own group all battle),
  // so this doesn't reshuffle as HP changes — just caps how many show.
  const namedFighters = stats ? stats.combatants.filter((c) => c.named).slice(0, ROSTER_CAPACITY) : []
  const enemyColor = '#d98552'
  const winning = momentum >= 0.5
  const sideColor = winning ? playerColor : enemyColor

  /*
   * Fills outward from the centre in the leading side's colour, so a won
   * battle ends with the bar completely full of that colour. Half the width
   * per side means 0.5 is empty and 1.0 (or 0.0) is a full bar.
   */
  const fillPct = Math.min(100, Math.abs(momentum - 0.5) * 200)
  const fillStyle = {
    width: `${fillPct / 2}%`,
    background: sideColor,
    boxShadow: `0 0 14px ${sideColor}`,
    // Grow from the centre line toward this side's end of the track.
    [winning ? 'left' : 'right']: '50%',
  } as React.CSSProperties

  return (
    <div className="battle">
      <div className="stage-wrap">
        <div className="stage" ref={hostRef} />
        {stats && (
          <div className="battle-hud">
            <div className="battle-momentum compact">
              <div className="battle-momentum-label">
                <span>Power</span>
                <span>
                  {playerPower.toFixed(0)} / {enemyPower.toFixed(0)}
                </span>
              </div>
              <div className="battle-momentum-track">
                <div className="battle-momentum-fill" style={fillStyle} />
                <div className="battle-momentum-center" />
              </div>
            </div>
            {namedFighters.length > 0 && (
              <ul className="battle-roster">
                {namedFighters.map((c) => (
                  <li
                    key={c.groupIndex}
                    className={c.team === TEAM_A ? 'a' : 'b'}
                    data-dead={c.alive === 0 || undefined}
                  >
                    <span className="roster-name">{c.leaderLabel ?? c.label}</span>
                    <span className="roster-hp-track">
                      <span
                        className="roster-hp-fill"
                        style={{ width: `${(Math.max(0, c.currentHp) / Math.max(1, c.maxHp)) * 100}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {log.length > 0 && (
          <ul className="battle-log">
            {log.map((e, i) => (
              <li key={`${e.tick}-${i}`} className={e.team === TEAM_A ? 'a' : 'b'}>
                {formatEvent(e)}
              </li>
            ))}
          </ul>
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
