import { useEffect, useRef, useState } from 'react'
import type { BattleConfig, GroupResult, Winner } from '@salt/sim'
import { BattleView } from '../BattleView'
import type { ViewStats } from '../BattleView'

const SPEEDS = [1, 2, 4, 8]

interface Props {
  config: BattleConfig
  title: string
  onDone: (results: GroupResult[], winner: Winner, ticks: number) => void
}

/**
 * Pure auto battler: speed controls only. No positioning, no commands. All the
 * decisions were made in camp — see docs/V0-DESIGN.md §6.
 */
export default function BattleScreen({ config, title, onDone }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<BattleView | null>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const [stats, setStats] = useState<ViewStats | null>(null)
  const [speed, setSpeed] = useState(1)
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
      view.start(config)
    })

    return () => {
      cancelled = true
      viewRef.current = null
      view.destroy()
    }
  }, [config])

  const setSpeedTo = (s: number) => {
    if (viewRef.current) viewRef.current.speed = s
    setSpeed(s)
  }

  return (
    <div className="battle">
      <div className="stage" ref={hostRef} />
      <div className="battle-bar">
        <div className="battle-title">{title}</div>
        <div className="counts">
          <span className="a">{stats?.aliveA ?? 0}</span>
          <span className="vs">vs</span>
          <span className="b">{stats?.aliveB ?? 0}</span>
        </div>
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
