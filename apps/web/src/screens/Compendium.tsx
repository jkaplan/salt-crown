import { useEffect, useMemo, useState } from 'react'
import {
  MUTATIONS, MUTANT_TYPES, TRUEKIN_TYPES, RELICS, BIONICS, HOUSES,
} from '@salt/game'
import type { RunState } from '@salt/game'
import { useUnlocks } from '../persistence/unlocks'
import MutationIcon from '../components/MutationIcon'
import ItemIcon from '../components/ItemIcon'

type Tab = 'mutations' | 'squads' | 'relics' | 'bionics' | 'factions' | 'glossary'

const TABS: { id: Tab; label: string }[] = [
  { id: 'mutations', label: 'Mutations' },
  { id: 'squads', label: 'Squads' },
  { id: 'relics', label: 'Relics' },
  { id: 'bionics', label: 'Bionics' },
  { id: 'factions', label: 'Factions' },
  { id: 'glossary', label: 'Glossary' },
]

/**
 * A shell every locked/unlocked entry shares — name-or-"?", a tag, and the
 * unlocked-only body. Kept to one component rather than forking per tab, but
 * each tab still writes its own card body: a squad's stats and a relic's
 * effect have nothing in common to abstract over.
 */
function EntryCard({
  unlocked,
  selected,
  onSelect,
  eyebrow,
  name,
  icon,
  children,
}: {
  unlocked: boolean
  selected: boolean
  onSelect: () => void
  eyebrow: string
  name: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  const className = [
    'compendium-card',
    selected ? 'compendium-card--selected' : '',
    unlocked ? '' : 'compendium-card--locked',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type="button" className={className} onClick={onSelect} disabled={!unlocked}>
      <div className="compendium-card__top">
        {unlocked && icon}
        <div>
          <div className="compendium-card__eyebrow">{unlocked ? eyebrow : 'Not yet encountered'}</div>
          <h3>{unlocked ? name : '?'}</h3>
        </div>
      </div>
      {unlocked && children}
    </button>
  )
}

function LockedDetail() {
  return <p className="compendium-empty">Not yet encountered. Find one in a run to read it here.</p>
}

/* --------------------------------------------------------------- mutations --- */

type MutationCategory = 'all' | 'offense' | 'defense' | 'mobility' | 'utility'

const MUTATION_CATEGORY: Record<string, MutationCategory> = {
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

const MUTATION_CATEGORY_NAMES: Record<MutationCategory, string> = {
  all: 'All',
  offense: 'Offense',
  defense: 'Defense',
  mobility: 'Mobility',
  utility: 'Utility',
}

function MutationsTab({ unlocked, unlockAll }: { unlocked: Set<string>; unlockAll: boolean }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<MutationCategory>('all')
  const [selectedId, setSelectedId] = useState(MUTATIONS[0]?.id ?? '')

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return MUTATIONS.filter((m) => {
      const category = MUTATION_CATEGORY[m.id] ?? 'utility'
      if (filter !== 'all' && category !== filter) return false
      if (!query) return true
      return `${m.name} ${m.blurb}`.toLowerCase().includes(query)
    })
  }, [filter, search])

  useEffect(() => {
    if (!visible.some((m) => m.id === selectedId)) setSelectedId(visible[0]?.id ?? '')
  }, [selectedId, visible])

  const selected = visible.find((m) => m.id === selectedId) ?? visible[0]
  const selectedUnlocked = !!selected && (unlockAll || unlocked.has(selected.id))

  return (
    <div className="compendium__body">
      <aside className="compendium__sidebar">
        <div className="compendium__panel-header">Categories</div>
        <nav className="compendium__tabs" aria-label="Mutation categories">
          {(Object.keys(MUTATION_CATEGORY_NAMES) as MutationCategory[]).map((key) => (
            <button key={key} type="button" className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>
              {MUTATION_CATEGORY_NAMES[key]}
            </button>
          ))}
        </nav>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          aria-label="Search mutations"
          className="compendium__search"
        />
      </aside>

      <div className="compendium__content">
        <section className="compendium-grid" aria-live="polite">
          {visible.map((m) => {
            const isUnlocked = unlockAll || unlocked.has(m.id)
            return (
              <EntryCard
                key={m.id}
                unlocked={isUnlocked}
                selected={m.id === selected?.id}
                onSelect={() => setSelectedId(m.id)}
                eyebrow={MUTATION_CATEGORY_NAMES[MUTATION_CATEGORY[m.id] ?? 'utility']}
                name={m.name}
                icon={<MutationIcon icon={m.icon} size={24} />}
              >
                <p className="compendium-card__blurb">{m.blurb}</p>
                <p className="compendium-card__effect">{m.describe(1)}</p>
                <p className="compendium-card__effect compendium-card__effect--secondary">
                  Peak: {m.describe(6)}
                </p>
              </EntryCard>
            )
          })}
        </section>
      </div>

      <aside className="compendium-detail">
        {selected && selectedUnlocked ? (
          <>
            <h3>
              <MutationIcon icon={selected.icon} size={20} /> {selected.name}
            </h3>
            <p className="compendium-detail__blurb">{selected.blurb}</p>
            <div className="compendium-detail__stat-block">
              <div>
                <span className="summary-label">At level 1</span>
                <strong>{selected.describe(1)}</strong>
              </div>
              <div>
                <span className="summary-label">At level 6</span>
                <strong>{selected.describe(6)}</strong>
              </div>
            </div>
          </>
        ) : (
          <LockedDetail />
        )}
      </aside>
    </div>
  )
}

/* ------------------------------------------------------------------ squads --- */

function SquadsTab({ unlocked, unlockAll }: { unlocked: Set<string>; unlockAll: boolean }) {
  const units = [...MUTANT_TYPES, ...TRUEKIN_TYPES]
  const [selectedId, setSelectedId] = useState(units[0]?.id ?? 0)
  const selected = units.find((u) => u.id === selectedId)
  const selectedUnlocked = !!selected && (unlockAll || unlocked.has(String(selected.id)))

  return (
    <div className="compendium__body">
      <div className="compendium__content">
        <section className="compendium-grid">
          {units.map((u) => {
            const isUnlocked = unlockAll || unlocked.has(String(u.id))
            return (
              <EntryCard
                key={u.id}
                unlocked={isUnlocked}
                selected={u.id === selectedId}
                onSelect={() => setSelectedId(u.id)}
                eyebrow={u.lineage === 'mutant' ? 'Mutant' : 'True Kin'}
                name={u.name}
              >
                <p className="compendium-card__blurb">{u.blurb}</p>
              </EntryCard>
            )
          })}
        </section>
      </div>

      <aside className="compendium-detail">
        {selected && selectedUnlocked ? (
          <>
            <h3>{selected.name}</h3>
            <p className="compendium-detail__blurb">{selected.description}</p>
            <div className="compendium-detail__stat-block">
              <div>
                <span className="summary-label">Cost</span>
                <strong>{selected.cost} salvage per body</strong>
              </div>
              <div>
                <span className="summary-label">Stats</span>
                <strong>
                  {selected.base.hp} hp · {selected.base.damage} dmg · {selected.base.armor} armour ·{' '}
                  {selected.base.moveSpeed} speed · {(selected.base.accuracy * 100).toFixed(0)}% acc ·{' '}
                  {selected.base.range > 40 ? `${selected.base.range} range` : 'melee'}
                </strong>
              </div>
            </div>
          </>
        ) : (
          <LockedDetail />
        )}
      </aside>
    </div>
  )
}

/* -------------------------------------------------------- relics / bionics --- */

function EffectTab({
  kind,
  entries,
  unlocked,
  unlockAll,
}: {
  kind: 'bionic' | 'relic'
  entries: readonly { id: string; name: string; blurb: string; cost: number; effect: string }[]
  unlocked: Set<string>
  unlockAll: boolean
}) {
  const [selectedId, setSelectedId] = useState(entries[0]?.id ?? '')
  const selected = entries.find((e) => e.id === selectedId)
  const selectedUnlocked = !!selected && (unlockAll || unlocked.has(selected.id))

  return (
    <div className="compendium__body">
      <div className="compendium__content">
        <section className="compendium-grid">
          {entries.map((e) => {
            const isUnlocked = unlockAll || unlocked.has(e.id)
            return (
              <EntryCard
                key={e.id}
                unlocked={isUnlocked}
                selected={e.id === selectedId}
                onSelect={() => setSelectedId(e.id)}
                eyebrow={`${e.cost} salvage`}
                name={e.name}
                icon={<ItemIcon kind={kind} id={e.id} size={24} />}
              >
                <p className="compendium-card__blurb">{e.blurb}</p>
                <p className="compendium-card__effect">{e.effect}</p>
              </EntryCard>
            )
          })}
        </section>
      </div>

      <aside className="compendium-detail">
        {selected && selectedUnlocked ? (
          <>
            <h3>
              <ItemIcon kind={kind} id={selected.id} size={20} /> {selected.name}
            </h3>
            <p className="compendium-detail__blurb">{selected.blurb}</p>
            <div className="compendium-detail__stat-block">
              <div>
                <span className="summary-label">Effect</span>
                <strong>{selected.effect}</strong>
              </div>
              <div>
                <span className="summary-label">Cost</span>
                <strong>{selected.cost} salvage</strong>
              </div>
            </div>
          </>
        ) : (
          <LockedDetail />
        )}
      </aside>
    </div>
  )
}

/* --------------------------------------------------------------- factions --- */

function FactionsTab({ unlocked, unlockAll }: { unlocked: Set<string>; unlockAll: boolean }) {
  return (
    <div className="compendium__body">
      <div className="compendium__content">
        <section className="compendium-grid">
          {HOUSES.map((h) => {
            const isUnlocked = unlockAll || unlocked.has(h.name)
            return (
              <div
                key={h.name}
                className={isUnlocked ? 'compendium-card' : 'compendium-card compendium-card--locked'}
              >
                <div className="compendium-card__top">
                  <div>
                    <div className="compendium-card__eyebrow">{isUnlocked ? 'House' : 'Not yet met'}</div>
                    <h3>{isUnlocked ? h.name : '?'}</h3>
                  </div>
                </div>
                {isUnlocked && <p className="compendium-card__blurb">{h.blurb}</p>}
              </div>
            )
          })}
        </section>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- glossary --- */

const GLOSSARY: { term: string; definition: string }[] = [
  { term: 'Lineage', definition: 'The three unit pools — Mutants, True Kin, Machines. They differ by cost, reliability and upgrade path; none of them counter each other.' },
  { term: 'House', definition: 'A True Kin caste family. Houses war with each other, constantly, and it has nothing to do with you. Mutants and Machines have none.' },
  { term: 'Officer', definition: 'Named tier, True Kin, recruited. Leads one squad and grants it a flat bonus plus discipline, plus any implants fitted to them.' },
  { term: 'Prospect', definition: 'A mutant that came out of the vats with something useful — individually named, individually simulated, permanently killable. Roughly one in a dozen mutants recruited.' },
  { term: 'Firstborn', definition: 'Named tier, Mutant. Not recruited — promoted from a fodder Prospect that survived long enough and filled its body with mutations.' },
  { term: 'Salvage', definition: 'What you spend — recruit, appraise, treat, install, bind. Rewards a good decision.' },
  { term: 'Water', definition: 'What you owe, every march, whether or not you did anything with it. Punishes a big roster; scales superlinearly with headcount.' },
  { term: 'Discipline', definition: "The damage multiplier a squad keeps as it bleeds. Mutants fold fast, True Kin hold, Machines never notice. A morale multiplier, not a health bar — nobody flees." },
  { term: 'Morale', definition: "A run-level resource, shifted by between-battle events, folded into every squad's discipline. A thumb on the scale, never a second health bar." },
  { term: 'Capacity', definition: "How many mutations a Prospect's body can ever hold. Hidden until appraised — the whole reason the market is speculation rather than shopping." },
  { term: 'Wound ladder', definition: 'Strained → Injured → Crippled. Temporary battle damage on a named body, applied after a fight and healed by rest or salvage.' },
  { term: 'Permanent injury', definition: "A maiming that never heals — the alternative to dying, rolled for a Prospect's own body at the exact moment it would otherwise be lost." },
  { term: 'Quickened', definition: 'A rare trait: a Prospect that earns growth in half the usual battles, and whose mutations can climb past the ordinary level ceiling.' },
  { term: 'Relic', definition: "A found object bound to a squad directly — carried, not biological, so any squad can hold one regardless of lineage. One per squad." },
  { term: 'Bionic', definition: "A found implant installed into an Officer. True Kin only — mutant bodies can't carry one. Mutations and bionics are mutually exclusive by design." },
  { term: 'Legendary', definition: 'A rare, dangerous individual met by chance out in the wasteland. Unlike a boss, most runs will never see one at all — you never see it coming.' },
  { term: 'Boss', definition: 'The guaranteed, escalating fight ending every act — one enormous problem, not a bigger crowd.' },
  { term: 'Expedition', definition: 'Sending Prospects into a ruin instead of fielding them — Scavenge (safe, steady) or Delve (risky, a long tail of a payout). The real cost is missing the next battle.' },
]

function GlossaryTab() {
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const visible = GLOSSARY.filter(
    (g) => !query || g.term.toLowerCase().includes(query) || g.definition.toLowerCase().includes(query),
  )

  return (
    <div className="compendium__content">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search terms…"
        aria-label="Search glossary"
        className="compendium__search"
      />
      <dl className="glossary-list">
        {visible.map((g) => (
          <div key={g.term} className="glossary-entry">
            <dt>{g.term}</dt>
            <dd>{g.definition}</dd>
          </div>
        ))}
        {visible.length === 0 && <p className="compendium-empty">No terms match.</p>}
      </dl>
    </div>
  )
}

/* ---------------------------------------------------------------- shell --- */

export default function Compendium({ run }: { run: RunState | null }) {
  const { unlocked, unlockAll, setUnlockAll } = useUnlocks(run)
  const [tab, setTab] = useState<Tab>('mutations')

  return (
    <main className="compendium">
      <header className="compendium__header">
        <div>
          <p className="compendium__eyebrow">Field reference</p>
          <h2>Compendium</h2>
        </div>
        <p className="compendium__copy">
          What you've actually run into, across every run. Locked entries mean you haven't found one yet.
        </p>
        <label className="unlock-all-toggle" title="A durable override for seeing everything without earning it in play.">
          <input type="checkbox" checked={unlockAll} onChange={(e) => setUnlockAll(e.target.checked)} />
          Unlock everything
        </label>
      </header>

      <nav className="compendium__section-tabs" aria-label="Compendium sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'mutations' && <MutationsTab unlocked={unlocked.mutations} unlockAll={unlockAll} />}
      {tab === 'squads' && <SquadsTab unlocked={unlocked.squads} unlockAll={unlockAll} />}
      {tab === 'relics' && (
        <EffectTab kind="relic" entries={RELICS} unlocked={unlocked.relics} unlockAll={unlockAll} />
      )}
      {tab === 'bionics' && (
        <EffectTab kind="bionic" entries={BIONICS} unlocked={unlocked.bionics} unlockAll={unlockAll} />
      )}
      {tab === 'factions' && <FactionsTab unlocked={unlocked.factions} unlockAll={unlockAll} />}
      {tab === 'glossary' && <GlossaryTab />}
    </main>
  )
}
