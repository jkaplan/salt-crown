import { useEffect, useState } from 'react'
import type { RunState } from '@salt/game'
import { dbGet, dbSet } from './db'

/**
 * What's been discovered, across every run — the compendium's whole reason
 * for having a lock icon. Requested directly: entries "show up as locked or
 * a '?' until you unlock them. That should persist between runs."
 *
 * Five categories, one per compendium tab that has real spoiler content.
 * Glossary isn't here — it's the rulebook, not a discovery, and stays fully
 * visible always. Numbers are typeIds (squads) or ids (everything else),
 * stored as strings since IndexedDB keys/values round-trip arrays cleanly
 * either way and a single string type keeps the four id-based sets uniform.
 */
export interface UnlockSets {
  squads: Set<string>
  mutations: Set<string>
  relics: Set<string>
  bionics: Set<string>
  factions: Set<string>
}

type StoredUnlocks = Record<keyof UnlockSets, string[]>

const EMPTY: StoredUnlocks = { squads: [], mutations: [], relics: [], bionics: [], factions: [] }
const UNLOCKS_KEY = 'unlocks'
const UNLOCK_ALL_KEY = 'unlockAll'

function toStored(sets: UnlockSets): StoredUnlocks {
  return {
    squads: [...sets.squads],
    mutations: [...sets.mutations],
    relics: [...sets.relics],
    bionics: [...sets.bionics],
    factions: [...sets.factions],
  }
}

function toSets(stored: StoredUnlocks): UnlockSets {
  return {
    squads: new Set(stored.squads),
    mutations: new Set(stored.mutations),
    relics: new Set(stored.relics),
    bionics: new Set(stored.bionics),
    factions: new Set(stored.factions),
  }
}

/**
 * What's observable from the CURRENT state alone — not a history. Called on
 * every RunState change and unioned into the persisted set, never
 * subtracted, so a Prospect who died still counted the mutation it carried
 * while it was alive: the union catches it on whichever render happened
 * while it was still in `warband.prospects`.
 *
 * "Owned/encountered", not "offered" — recruiting a squad, having a
 * Prospect actually carry a mutation, finding (not necessarily binding) a
 * relic or implant, meeting a House by name. Being shown 3 mutation choices
 * and picking none of them unlocks nothing; that was a road not taken.
 */
function observe(run: RunState): Partial<Record<keyof UnlockSets, string[]>> {
  const { warband, encounter } = run

  const squads = [
    ...warband.squads.map((sq) => sq.typeId),
    ...warband.prospects.map((p) => p.typeId),
  ].map(String)

  const mutations = warband.prospects.flatMap((p) => p.mutations.map((m) => m.id))

  const relics = [
    ...warband.relics,
    ...warband.squads.map((sq) => sq.relicId).filter((id): id is string => !!id),
  ]

  const bionics = [...warband.bionics, ...warband.officers.flatMap((o) => o.bionics)]

  // Your own officers, plus any House whose name has actually been shown to
  // you on a march card ("Levies of Vantry") — that's already visible
  // before you commit to the fight, so there's no spoiler in counting it.
  const factions = [
    ...warband.officers.map((o) => o.house),
    ...(encounter.kind === 'warband' ? [encounter.enemy.officers[0]?.house] : []),
  ].filter((h): h is string => !!h)

  return { squads, mutations, relics, bionics, factions }
}

function union(sets: UnlockSets, found: Partial<Record<keyof UnlockSets, string[]>>): {
  next: UnlockSets
  changed: boolean
} {
  let changed = false
  const next: UnlockSets = {
    squads: new Set(sets.squads),
    mutations: new Set(sets.mutations),
    relics: new Set(sets.relics),
    bionics: new Set(sets.bionics),
    factions: new Set(sets.factions),
  }
  for (const key of Object.keys(found) as (keyof UnlockSets)[]) {
    for (const id of found[key] ?? []) {
      if (!next[key].has(id)) {
        next[key].add(id)
        changed = true
      }
    }
  }
  return { next, changed }
}

/**
 * Loads persisted unlocks once, then watches `run` and grows the set as new
 * things are observed. `unlockAll` is a durable dev override — a checkbox
 * in the compendium itself, not tied to any one run — for seeing everything
 * without having to actually earn it in play.
 */
export function useUnlocks(run: RunState | null): {
  unlocked: UnlockSets
  unlockAll: boolean
  setUnlockAll: (value: boolean) => void
} {
  const [unlocked, setUnlocked] = useState<UnlockSets>(() => toSets(EMPTY))
  const [unlockAll, setUnlockAllState] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.all([dbGet<StoredUnlocks>(UNLOCKS_KEY), dbGet<boolean>(UNLOCK_ALL_KEY)]).then(
      ([stored, all]) => {
        if (cancelled) return
        if (stored) setUnlocked(toSets(stored))
        if (all) setUnlockAllState(all)
        setLoaded(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!loaded || !run) return
    setUnlocked((current) => {
      const { next, changed } = union(current, observe(run))
      if (changed) void dbSet(UNLOCKS_KEY, toStored(next))
      return changed ? next : current
    })
  }, [loaded, run])

  const setUnlockAll = (value: boolean) => {
    setUnlockAllState(value)
    void dbSet(UNLOCK_ALL_KEY, value)
  }

  return { unlocked, unlockAll, setUnlockAll }
}
