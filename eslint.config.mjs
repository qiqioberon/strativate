import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  { rules: {
    '@next/next/no-html-link-for-pages': 'off',
    // Existing screens intentionally hydrate the separate product demo store.
    'react-hooks/set-state-in-effect': 'off',
  } },
  { files: ['components/auth/auth-form.tsx', 'components/auth/setup-form.tsx', 'components/onboarding/wizard.tsx'], rules: {
    // Hard navigation after Auth cookie changes discards stale prefetched RSC state.
    '@next/next/no-location-assign-relative-destination': 'off',
  } },
  globalIgnores(['.next/**', '.test-postgres/**', '.test-results/**', 'test-results/**', 'next-env.d.ts']),
])
