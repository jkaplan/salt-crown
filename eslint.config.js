import tseslint from 'typescript-eslint'

/**
 * The sim must stay deterministic. These bans are the enforcement.
 *
 * Math.random  — non-deterministic by definition. Use Rng.
 * Date.now / performance.now — wall clock leaks into results.
 * Math.sin/cos/tan/pow/exp/log — NOT bit-identical across JS engines,
 *   which silently breaks cross-device replay. Use lookup tables or
 *   integer math. Math.sqrt IS exactly specified by IEEE-754 and is fine.
 */
const nondeterministic = [
  { object: 'Math', property: 'random', message: 'Non-deterministic. Use Rng from @salt/sim.' },
  { object: 'Date', property: 'now', message: 'Wall clock in the sim breaks replay.' },
  { object: 'performance', property: 'now', message: 'Wall clock in the sim breaks replay.' },
  { object: 'Math', property: 'sin', message: 'Not bit-identical across JS engines. Use a lookup table.' },
  { object: 'Math', property: 'cos', message: 'Not bit-identical across JS engines. Use a lookup table.' },
  { object: 'Math', property: 'tan', message: 'Not bit-identical across JS engines. Use a lookup table.' },
  { object: 'Math', property: 'pow', message: 'Not bit-identical across JS engines. Use repeated multiplication.' },
  { object: 'Math', property: 'exp', message: 'Not bit-identical across JS engines.' },
  { object: 'Math', property: 'log', message: 'Not bit-identical across JS engines.' },
]

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['packages/sim/src/**/*.ts'],
    rules: {
      'no-restricted-properties': ['error', ...nondeterministic],
    },
  },
)
