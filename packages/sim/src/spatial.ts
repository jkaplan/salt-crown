/**
 * Uniform grid for nearest-enemy queries and separation.
 *
 * Rebuilt every tick with a counting sort into preallocated buffers — no
 * allocation in the tick loop, which is the actual perf risk here (GC pressure,
 * not entity count). See docs/TECH.md.
 */
export class SpatialGrid {
  readonly cellSize: number
  readonly cols: number
  readonly rows: number
  readonly cellCount: number

  /** starts[c]..starts[c+1] indexes into `items` for cell c. */
  readonly starts: Int32Array
  readonly items: Int32Array
  private readonly cursor: Int32Array

  constructor(width: number, height: number, cellSize: number, capacity: number) {
    this.cellSize = cellSize
    this.cols = Math.max(1, Math.ceil(width / cellSize))
    this.rows = Math.max(1, Math.ceil(height / cellSize))
    this.cellCount = this.cols * this.rows
    this.starts = new Int32Array(this.cellCount + 1)
    this.cursor = new Int32Array(this.cellCount)
    this.items = new Int32Array(capacity)
  }

  cellX(x: number): number {
    const c = (x / this.cellSize) | 0
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c
  }

  cellY(y: number): number {
    const r = (y / this.cellSize) | 0
    return r < 0 ? 0 : r >= this.rows ? this.rows - 1 : r
  }

  /** Counting sort of every live unit into its cell. */
  build(count: number, x: Float32Array, y: Float32Array, alive: Uint8Array): void {
    const { starts, cursor, items, cols } = this
    starts.fill(0)

    // Count per cell (offset by one so the prefix sum lands in place).
    for (let i = 0; i < count; i++) {
      if (alive[i] === 0) continue
      const c = this.cellY(y[i]) * cols + this.cellX(x[i])
      starts[c + 1]++
    }

    // Prefix sum.
    for (let c = 0; c < this.cellCount; c++) {
      starts[c + 1] += starts[c]
      cursor[c] = starts[c]
    }

    // Scatter. Ascending `i` keeps cell contents deterministically ordered.
    for (let i = 0; i < count; i++) {
      if (alive[i] === 0) continue
      const c = this.cellY(y[i]) * cols + this.cellX(x[i])
      items[cursor[c]++] = i
    }
  }
}
