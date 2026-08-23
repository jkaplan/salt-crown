import { useEffect, useRef, useState } from 'react'
import { TEAM_A, type BattleConfig, type GroupResult, type Winner } from '@salt/sim'
import { BattleView } from '../BattleView'
import type { ViewStats } from '../BattleView'

const SPEEDS = [1, 2, 4, 8]

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

  useEffect(() => {
    let cancelled = false
    const view = new BattleView()
    const host = hostRef.current
    if (!host) return

    view.setPlayerColor(playerColor)

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
  const markerPct = Math.min(100, Math.max(0, momentum * 100))
  const neutral = 'rgba(154, 160, 166, 0.84)'
  const enemyColor = '#d98552'
  const sideColor = momentum >= 0.5 ? playerColor : enemyColor
  const drift = Math.abs(momentum - 0.5) * 100
  const powerTrackStyle = momentum === 0.5
    ? {
        background: neutral,
        transition: 'background 180ms ease-out',
        borderColor: playerColor,
        boxShadow: `0 0 10px color-mix(in srgb, ${playerColor} 45%, transparent)`,
      }
    : momentum > 0.5
      ? {
          background: `linear-gradient(90deg, ${neutral} 0%, ${neutral} 50%, ${playerColor} 50%, ${playerColor} ${50 + drift}%, ${neutral} ${50 + drift}%, ${neutral} 100%)`,
          transition: 'background 180ms ease-out',
          borderColor: playerColor,
          boxShadow: `0 0 12px color-mix(in srgb, ${playerColor} 55%, transparent)`,
        }
      : {
          background: `linear-gradient(90deg, ${neutral} 0%, ${neutral} ${50 - drift}%, ${enemyColor} ${50 - drift}%, ${enemyColor} 50%, ${neutral} 50%, ${neutral} 100%)`,
          transition: 'background 180ms ease-out',
          borderColor: playerColor,
          boxShadow: `0 0 10px color-mix(in srgb, ${playerColor} 40%, transparent)`,
        }

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
              <div className="battle-momentum-track" style={powerTrackStyle}>
                <div className="battle-momentum-center" />
                <div
                  className="battle-momentum-marker"
                  style={{
                    left: `${markerPct}%`,
                    background: sideColor,
                    borderColor: sideColor,
                    boxShadow: `0 0 0 2px rgba(0, 0, 0, 0.25), 0 0 12px ${sideColor}`,
                  }}
                />
              </div>
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
