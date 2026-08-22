/**
 * Deterministic PRNG — splitmix32.
 *
 * The sim's entire determinism guarantee rests on this. `Math.random` is
 * banned in packages/sim by ESLint; this is the only source of randomness.
 *
 * State is a single uint32, so a battle's RNG can be snapshotted or replayed
 * by copying one number.
 */
export class Rng {
  private s: number

  constructor(seed: number) {
    this.s = seed >>> 0
  }

  /** Next uint32. */
  next(): number {
    this.s = (this.s + 0x9e3779b9) >>> 0
    let z = this.s
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0
    return (z ^ (z >>> 15)) >>> 0
  }

  /** Float in [0, 1). */
  float(): number {
    return this.next() / 4294967296
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return this.next() % n
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.float() * (max - min)
  }

  get state(): number {
    return this.s
  }

  set state(v: number) {
    this.s = v >>> 0
  }
}

/** Turn a seed string into a uint32. FNV-1a. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}
