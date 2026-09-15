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
  { files: ['app/dashboard/dashboard-client.tsx'], rules: {
    // Pre-existing dashboard demo-store callback intentionally captures the full account object.
    'react-hooks/preserve-manual-memoization': 'off',
  } },
  { files: ['components/auth/auth-form.tsx', 'components/auth/setup-form.tsx', 'components/onboarding/wizard.tsx'], rules: {
    // Hard navigation after Auth cookie changes discards stale prefetched RSC state.
    '@next/next/no-location-assign-relative-destination': 'off',
  } },
  { files: [
    'lib/calendar/server.ts',
    'lib/google-calendar/server.ts',
    'lib/private-mentoring/server.ts',
    'lib/private-mentoring/scheduling-server.ts',
    'tests/calendar-slot-engine.test.ts',
    'tests/google-calendar-service.test.ts',
  ], rules: {
    // Calendar integration currently crosses newly-added Supabase RPC/table boundaries
    // that are intentionally validated by SQL tests but are not yet represented in the
    // checked-in generated database types. Keep this exception tightly scoped until
    // database.types.ts is regenerated from the deployed schema.
    '@typescript-eslint/no-explicit-any': 'off',
  } },
  globalIgnores(['.next/**', 'tests/fixtures/**/.next/**', '.test-postgres/**', '.test-results/**', 'test-results/**', 'next-env.d.ts']),
])
