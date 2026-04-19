import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Guardrails born from the 2026-04-19 Safari regression loop. Both
      // patterns below work fine in Chrome — my Chrome MCP E2E harness
      // couldn't catch either — but break mobile Safari. Ban them at lint
      // time so future drift fails CI instead of hitting the user.
      'no-restricted-syntax': [
        'error',
        {
          // -1 literal parses as UnaryExpression(operator:'-', argument:Literal(1)),
          // not as a raw Literal with value=-1.
          selector: "CallExpression[callee.name='navigate'][arguments.length=1][arguments.0.type='UnaryExpression'][arguments.0.operator='-'][arguments.0.argument.value=1]",
          message: "Use useBackNavigation('/fallback') from @/hooks/useBackNavigation instead of navigate(-1). Raw navigate(-1) drops users out of the app when there is no in-app history (deep link, magic link, cold tab).",
        },
      ],
    },
  },
  // Playwright + node-only scripts legitimately use page.goBack() semantics
  // and don't need the navigate(-1) ban.
  {
    files: ['tests/**/*.{ts,tsx}', 'scripts/**/*.{ts,js,mjs}'],
    rules: { 'no-restricted-syntax': 'off' },
  },
])
