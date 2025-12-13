import neostandard, { resolveIgnoresFromGitignore } from 'neostandard'

export default {
	...neostandard({ ignores: resolveIgnoresFromGitignore() }),
	rules: {
		...(base.rules || {}),
		'@stylistic/quote-props': 'off' // Consistency is better.
	}
}
