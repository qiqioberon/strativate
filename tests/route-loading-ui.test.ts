import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

test('hard-load brand intro is a separate root concern', () => {
  assert.equal(existsSync(join(root, 'components/navigation/initial-brand-intro.tsx')), true)
  assert.equal(existsSync(join(root, 'components/navigation/initial-brand-intro.module.css')), true)
  const intro = read('components/navigation/initial-brand-intro.tsx')
  const layout = read('app/layout.tsx')
  assert.match(intro, /variant="wordmark"/)
  assert.match(intro, /data-testid="initial-brand-intro"/)
  assert.match(layout, /InitialBrandIntro/)
  assert.match(layout, /RouteLoadingMode/)
})

test('hard-load intro owns a short entrance and exit lifecycle', () => {
  const intro = read('components/navigation/initial-brand-intro.tsx')
  const css = read('components/navigation/initial-brand-intro.module.css')
  assert.match(intro, /INTRO_EXIT_START_MS\s*=\s*650/)
  assert.match(intro, /INTRO_REMOVE_MS\s*=\s*900/)
  assert.match(intro, /prefers-reduced-motion:\s*reduce/)
  assert.match(css, /@keyframes\s+intro-wordmark/)
  assert.match(css, /@keyframes\s+intro-sweep/)
  assert.match(css, /@keyframes\s+intro-exit/)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
})

test('App Router fallback is internal-navigation-only and compact', () => {
  const loading = read('app/loading.tsx')
  const loader = read('components/navigation/branded-route-loading.tsx')
  const css = read('components/navigation/branded-route-loading.module.css')
  assert.match(loading, /BrandedRouteLoading/)
  assert.match(loader, /variant="mark"/)
  assert.match(loader, /data-testid="route-loading-mark"/)
  assert.doesNotMatch(loader, /variant="wordmark"/)
  assert.match(css, /data-strativate-client-ready/)
  assert.match(css, /\.overlay\s*\{[\s\S]*display:\s*none/)
  assert.match(css, /data-strativate-client-ready='true'[\s\S]*\.overlay[\s\S]*display:\s*grid/)
})

test('route loading remains truthful and does not own timing', () => {
  const loader = read('components/navigation/branded-route-loading.tsx')
  const css = read('components/navigation/branded-route-loading.module.css')
  const mode = read('components/navigation/route-loading-mode.tsx')
  const combined = `${loader}\n${css}\n${mode}`
  assert.match(loader, /role="status"/)
  assert.match(css, /z-index:\s*12000/)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
  assert.doesNotMatch(combined, /setTimeout|setInterval|router\.(push|replace)|addEventListener\(['"]click/)
})
