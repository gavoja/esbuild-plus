import neostandard, { resolveIgnoresFromGitignore } from 'neostandard'

export default [
  ...neostandard({ ignores: resolveIgnoresFromGitignore() }),
  {
    rules: {
      '@stylistic/quote-props': 'off' // Consistency is better.
    }
  }
]
