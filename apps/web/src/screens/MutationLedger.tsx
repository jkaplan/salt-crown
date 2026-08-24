import { useEffect, useMemo, useState } from 'react'
import { MUTATIONS } from '@salt/game'

type MutationFilter = 'all' | 'offense' | 'defense' | 'mobility' | 'utility'

const categoryMap: Record<string, MutationFilter> = {
  horns: 'offense',
  carapace: 'defense',
  'bulging-sacs': 'defense',
  'adrenal-glands': 'mobility',
  'twitch-reflex': 'defense',
  'keen-sense': 'offense',
  'serrated-claws': 'offense',
  'flaming-ray': 'offense',
  'dense-bone': 'defense',
  regeneration: 'utility',
  quills: 'defense',
  'razor-tail': 'defense',
  frenzy: 'utility',
}

const categoryNames: Record<MutationFilter, string> = {
  all: 'All',
  offense: 'Offense',
  defense: 'Defense',
  mobility: 'Mobility',
  utility: 'Utility',
}

const categoryOrder: MutationFilter[] = ['all', 'offense', 'defense', 'mobility', 'utility']

export default function MutationLedger() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<MutationFilter>('all')
  const [selectedId, setSelectedId] = useState(MUTATIONS[0]?.id ?? '')

  const visibleMutations = useMemo(() => {
    const query = search.trim().toLowerCase()

    return MUTATIONS.filter((mutation) => {
      const category = categoryMap[mutation.id] ?? 'utility'
      const matchesFilter = filter === 'all' || category === filter
      const haystack = `${mutation.name} ${mutation.blurb} ${mutation.describe(1)} ${mutation.describe(6)}`.toLowerCase()
      const matchesSearch = !query || haystack.includes(query)
      return matchesFilter && matchesSearch
    })
  }, [filter, search])

  useEffect(() => {
    if (!visibleMutations.some((mutation) => mutation.id === selectedId)) {
      setSelectedId(visibleMutations[0]?.id ?? MUTATIONS[0]?.id ?? '')
    }
  }, [selectedId, visibleMutations])

  const counts = useMemo(
    () => ({
      // One bucket per filter, or the tab counts disagree with the tabs.
      // These were folded into a single `support` bucket, which made Mobility
      // show the combined total and Utility show nothing at all.
      total: MUTATIONS.length,
      offense: MUTATIONS.filter((m) => categoryMap[m.id] === 'offense').length,
      defense: MUTATIONS.filter((m) => categoryMap[m.id] === 'defense').length,
      mobility: MUTATIONS.filter((m) => categoryMap[m.id] === 'mobility').length,
      utility: MUTATIONS.filter((m) => (categoryMap[m.id] ?? 'utility') === 'utility').length,
    }),
    [],
  )

  const selectedMutation = useMemo(
    () => visibleMutations.find((mutation) => mutation.id === selectedId) ?? visibleMutations[0] ?? MUTATIONS[0],
    [selectedId, visibleMutations],
  )

  return (
    <main className="mutation-ledger">
      <header className="mutation-ledger__header">
        <div>
          <p className="mutation-ledger__eyebrow">Mutant physiology</p>
          <h2>Mutation ledger</h2>
        </div>
        <p className="mutation-ledger__copy">
          Available mutations in the current V0 build. A leading Prospect leaks the mutation to its squad at half level.
        </p>
      </header>

      <div className="mutation-ledger__toolbar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search mutation name, trait, or bonus…"
          aria-label="Search mutations"
        />
      </div>

      <section className="mutation-ledger__body">
        <aside className="mutation-ledger__sidebar">
          <div className="mutation-ledger__panel-header">Categories</div>
          <nav className="mutation-ledger__tabs" aria-label="Mutation categories">
            {categoryOrder.map((key) => {
              const label = key === 'all' ? 'All mutations' : categoryNames[key]
              const count = counts[key === 'all' ? 'total' : key]
              return (
                <button
                  key={key}
                  type="button"
                  className={filter === key ? 'on' : ''}
                  onClick={() => setFilter(key)}
                >
                  <span>{label}</span>
                  <em>{count}</em>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="mutation-ledger__content">
          <section className="mutation-ledger__stats" aria-label="Mutation summary counts">
            <div className="mutation-stat">
              <span className="summary-label">Total</span>
              <strong>{counts.total}</strong>
            </div>
            <div className="mutation-stat">
              <span className="summary-label">Offense</span>
              <strong>{counts.offense}</strong>
            </div>
            <div className="mutation-stat">
              <span className="summary-label">Defense</span>
              <strong>{counts.defense}</strong>
            </div>
            <div className="mutation-stat">
              <span className="summary-label">Mobility / Utility</span>
              <strong>{counts.mobility + counts.utility}</strong>
            </div>
          </section>

          <section className="mutation-grid" aria-live="polite">
            {visibleMutations.length === 0 ? (
              <div className="mutation-empty">No mutations match the current search or filter.</div>
            ) : (
              visibleMutations.map((mutation) => {
                const category = categoryMap[mutation.id] ?? 'utility'
                const isSelected = mutation.id === selectedMutation?.id

                return (
                  <button
                    key={mutation.id}
                    type="button"
                    className={isSelected ? 'mutation-card mutation-card--selected' : 'mutation-card'}
                    onClick={() => setSelectedId(mutation.id)}
                  >
                    <div className="mutation-card__top">
                      <div>
                        <div className="mutation-card__eyebrow">Mutation</div>
                        <h3>{mutation.name}</h3>
                      </div>
                      <span className="mutation-card__tag">{categoryNames[category]}</span>
                    </div>

                    <p className="mutation-card__blurb">{mutation.blurb}</p>

                    <div className="mutation-card__meta">
                      <span className="dot" />
                      <span>Levels 1–6</span>
                    </div>

                    <p className="mutation-card__effect">{mutation.describe(1)}</p>
                    <p className="mutation-card__effect mutation-card__effect--secondary">
                      Peak: {mutation.describe(6)}
                    </p>
                  </button>
                )
              })
            )}
          </section>
        </div>

        <aside className="mutation-detail">
          <div className="mutation-detail__header">
            <span className="mutation-detail__label">Selected mutation</span>
            <span className="mutation-detail__tag">{selectedMutation ? categoryNames[categoryMap[selectedMutation.id] ?? 'utility'] : 'Unknown'}</span>
          </div>

          {selectedMutation ? (
            <>
              <h3>{selectedMutation.name}</h3>
              <p className="mutation-detail__blurb">{selectedMutation.blurb}</p>

              <div className="mutation-detail__stat-block">
                <div>
                  <span className="summary-label">At level 1</span>
                  <strong>{selectedMutation.describe(1)}</strong>
                </div>
                <div>
                  <span className="summary-label">At level 6</span>
                  <strong>{selectedMutation.describe(6)}</strong>
                </div>
              </div>

              <div className="mutation-detail__rule">
                <span className="summary-label">Rule</span>
                <p>
                  Leading Prospects leak this mutation to the squad they command at half level, minimum 1.
                </p>
              </div>
            </>
          ) : (
            <p className="mutation-empty">No mutation selected.</p>
          )}
        </aside>
      </section>
    </main>
  )
}
