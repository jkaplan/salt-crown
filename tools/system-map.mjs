/*
 * The system map — docs/research/system-map.md.
 *
 * Answers one question mechanically: which of this game's quantities actually
 * touch each other, and which are islands. Run it with `npm run map`.
 *
 * Two resources "interact" only if they appear within three lines of each
 * other — an expression, an argument list, a returned object literal. Sharing
 * a 200-line orchestrator is co-location, not interaction, and counting that
 * as an interaction makes every system look connected to every other one.
 *
 * Comments are stripped first. This repo is comment-heavy and a paragraph
 * ABOUT morale is not a system touching morale.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const DIR = 'packages/game/src'
const WINDOW = 3

/** The quantities a player carries. Field names, not concepts. */
const RESOURCES = {
  salvage: /\bsalvage\b/,
  water: /\bwater\b/,
  morale: /\bmorale\b/,
  instability: /\binstability\b/,
  condition: /\bcondition\b/,
  wound: /\bwound[s]?\b/i,
  gap: /\bgap\b/,
  capacity: /\bcapacity\b/,
  discipline: /\bdiscipline\b/,
  stragglers: /\bstragglers?\b/,
  mutations: /\bmutations?\b/,
  bionics: /\bbionics?\b/,
}

/** Everything the player can actually do. Exported actions from run.ts. */
const VERBS = [
  'chooseMutation', 'appraise', 'treatWound', 'treatOfficer', 'setFielded',
  'sellProspect', 'chooseCampOption', 'resolveEvent', 'sendExpedition',
  'recallExpedition', 'installBionic', 'assignRelic', 'buy', 'rerollOffers',
  'assignLeader', 'moveSquad', 'placeSquad', 'setOut', 'advanceLeg',
  'resolveTrailEvent',
]

function stripComments(src) {
  let out = ''
  let i = 0
  let mode = 'code'
  while (i < src.length) {
    const two = src.slice(i, i + 2)
    if (mode === 'code') {
      if (two === '/*') { mode = 'block'; out += '  '; i += 2; continue }
      if (two === '//') { mode = 'line'; out += '  '; i += 2; continue }
      out += src[i]; i++
    } else if (mode === 'block') {
      if (two === '*/') { mode = 'code'; out += '  '; i += 2; continue }
      out += src[i] === '\n' ? '\n' : ' '; i++
    } else {
      if (src[i] === '\n') { mode = 'code'; out += '\n'; i++; continue }
      out += ' '; i++
    }
  }
  return out
}

const readLines = (file) => stripComments(readFileSync(`${DIR}/${file}`, 'utf8')).split(/\r?\n/)

const names = Object.keys(RESOURCES)

// ---- which quantities meet each other ------------------------------------

const pairs = new Map()
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.ts'))) {
  const hits = []
  readLines(file).forEach((text, i) => {
    for (const [name, re] of Object.entries(RESOURCES)) {
      if (re.test(text)) hits.push({ name, line: i + 1 })
    }
  })
  for (let a = 0; a < hits.length; a++) {
    for (let b = a + 1; b < hits.length; b++) {
      if (hits[b].line - hits[a].line > WINDOW) break
      if (hits[a].name === hits[b].name) continue
      const k = [hits[a].name, hits[b].name].sort().join(' + ')
      if (!pairs.has(k)) pairs.set(k, new Set())
      pairs.get(k).add(`${file}:${hits[a].line}`)
    }
  }
}

const degree = Object.fromEntries(names.map((n) => [n, new Set()]))
for (const k of pairs.keys()) {
  const [x, y] = k.split(' + ')
  degree[x].add(y)
  degree[y].add(x)
}

console.log('--- what each quantity actually touches ---')
for (const n of [...names].sort((a, b) => degree[b].size - degree[a].size)) {
  const d = [...degree[n]].sort().join(', ')
  console.log(`${n.padEnd(13)} ${String(degree[n].size).padStart(2)}  ${d || 'NOTHING'}`)
}

console.log('\n--- every pair, and in how many places ---')
for (const [k, where] of [...pairs].sort((a, b) => b[1].size - a[1].size)) {
  console.log(`${String(where.size).padStart(3)}  ${k.padEnd(26)} ${[...where].slice(0, 4).join(' ')}`)
}

// ---- which verbs touch which quantity -------------------------------------

const FN = /^(?:export\s+)?function\s+([A-Za-z0-9_]+)/
const verbTouches = Object.fromEntries(names.map((n) => [n, new Set()]))
let cur = ''
for (const text of readLines('run.ts')) {
  const m = FN.exec(text)
  if (m) cur = m[1]
  if (!VERBS.includes(cur)) continue
  for (const [name, re] of Object.entries(RESOURCES)) {
    if (re.test(text)) verbTouches[name].add(cur)
  }
}

console.log('\n--- which player verbs touch which quantity ---')
for (const n of names) {
  const v = [...verbTouches[n]].sort()
  console.log(`${n.padEnd(13)} ${String(v.length).padStart(2)}  ${v.join(', ') || 'NO PLAYER VERB'}`)
}

if (process.argv[2]) {
  writeFileSync(
    process.argv[2],
    JSON.stringify(
      {
        pairs: [...pairs].map(([k, v]) => [k, [...v]]),
        verbs: Object.fromEntries(names.map((n) => [n, [...verbTouches[n]].sort()])),
      },
      null,
      2,
    ),
  )
}
