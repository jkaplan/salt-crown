import { useCallback, useEffect, useRef, useState } from 'react'
import { TEAM_A, TEAM_B, hashSeed } from '@salt/sim'
import { MUTATIONS, UNIT_TYPES, makeGroup } from '@salt/game'
import type { MutationRoll } from '@salt/game'
import { BattleView } from '../BattleView'
import type { ProbeRow, ViewStats } from '../BattleView'

const SPEEDS = [1, 2, 4, 8]

/**
 * Sandbox. Pit anything against anything at whatever scale the device stands,
 * and measure where it gives out. Doubles as the on-device perf probe.
 */
export default function Skirmish() {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<BattleView | null>(null)

  const [seed, setSeed] = useState('salt-crown')
  const [typeA, setTypeA] = useState(0)
  const [typeB, setTypeB] = useState(0)
  const [countA, setCountA] = useState(300)
  const [countB, setCountB] = useState(300)
  const [mutA, setMutA] = useState('')
  const [mutLevel, setMutLevel] = useState(3)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)
  const [stats, setStats] = useState<ViewStats | null>(null)
  const [probe, setProbe] = useState<ProbeRow[] | null>(null)
  const [probing, setProbing] = useState(false)

  const startBattle = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const mutations: MutationRoll[] = mutA ? [{ id: mutA, level: mutLevel }] : []
    view.paused = false
    setPaused(false)
    view.start({
      seed: hashSeed(seed),
      groups: [makeGroup(TEAM_A, typeA, countA, mutations), makeGroup(TEAM_B, typeB, countB)],
    })
  }, [seed, typeA, typeB, countA, countB, mutA, mutLevel])

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
      view.start({
        seed: hashSeed('salt-crown'),
        groups: [makeGroup(TEAM_A, 0, 300), makeGroup(TEAM_B, 0, 300)],
      })
    })

    return () => {
      cancelled = true
      viewRef.current = null
      view.destroy()
    }
  }, [])

  const runProbe = useCallback(async () => {
    const view = viewRef.current
    if (!view || probing) return
    setProbing(true)
    view.paused = true
    setProbe(await view.probe())
    view.paused = paused
    setProbing(false)
  }, [probing, paused])

  const togglePause = () => {
    const view = viewRef.current
    if (!view) return
    view.paused = !view.paused
    setPaused(view.paused)
  }

  const setSpeedTo = (s: number) => {
    if (viewRef.current) viewRef.current.speed = s
    setSpeed(s)
  }

  return (
    <div className="skirmish">
      <div className="stage" ref={hostRef} />

      <aside className="panel">
        <section>
          <h2>Skirmish</h2>
          <label>
            Seed
            <input value={seed} onChange={(e) => setSeed(e.target.value)} />
          </label>

          <label>
            Left <span className="value">{countA}</span>
            <select value={typeA} onChange={(e) => setTypeA(Number(e.target.value))}>
              {UNIT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              type="range" min={5} max={4000} step={5}
              value={countA} onChange={(e) => setCountA(Number(e.target.value))}
            />
          </label>

          <label>
            Left mutation
            <select value={mutA} onChange={(e) => setMutA(e.target.value)}>
              <option value="">— none —</option>
              {MUTATIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {mutA && (
              <input
                type="range" min={1} max={6} step={1}
                value={mutLevel} onChange={(e) => setMutLevel(Number(e.target.value))}
              />
            )}
            {mutA && <span className="value">level {mutLevel}</span>}
          </label>

          <label>
            Right <span className="value">{countB}</span>
            <select value={typeB} onChange={(e) => setTypeB(Number(e.target.value))}>
              {UNIT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              type="range" min={5} max={4000} step={5}
              value={countB} onChange={(e) => setCountB(Number(e.target.value))}
            />
          </label>

          <div className="row">
            <button onClick={startBattle}>Fight</button>
            <button onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
          </div>
          <div className="row speeds">
            {SPEEDS.map((s) => (
              <button key={s} className={s === speed ? 'on' : ''} onClick={() => setSpeedTo(s)}>
                {s}×
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>Live</h2>
          <dl>
            <dt>Tick</dt>
            <dd>{stats?.tick ?? 0}</dd>
            <dt>Left</dt>
            <dd className="a">{stats?.aliveA ?? 0}</dd>
            <dt>Right</dt>
            <dd className="b">{stats?.aliveB ?? 0}</dd>
            <dt>Entities</dt>
            <dd>{stats?.total ?? 0}</dd>
            <dt>Sim</dt>
            <dd>{stats ? `${stats.simMs.toFixed(2)} ms/tick` : '—'}</dd>
            <dt>FPS</dt>
            <dd>{stats ? stats.fps.toFixed(0) : '—'}</dd>
          </dl>
        </section>

        <section>
          <h2>Perf probe</h2>
          <p className="hint">
            Pure sim cost, no rendering. Headroom is how many times faster than realtime the sim
            runs at 20&nbsp;Hz.
          </p>
          <button onClick={runProbe} disabled={probing}>
            {probing ? 'Measuring…' : 'Run probe'}
          </button>
          {probe && (
            <table>
              <thead>
                <tr>
                  <th>Per side</th>
                  <th>ms/tick</th>
                  <th>Headroom</th>
                </tr>
              </thead>
              <tbody>
                {probe.map((r) => (
                  <tr key={r.perSide} className={r.headroom < 1 ? 'over' : ''}>
                    <td>{r.perSide}</td>
                    <td>{r.msPerTick.toFixed(3)}</td>
                    <td>{r.headroom.toFixed(1)}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </aside>
    </div>
  )
}
