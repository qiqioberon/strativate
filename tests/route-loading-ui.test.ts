import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const motionGate = read('components/navigation/use-page-motion-ready.ts')
const marketingMotion = read('components/marketing/marketing-motion.tsx')

test('hard-load brand intro owns the one-time bootstrap progress experience', () => {
  assert.equal(existsSync(join(root, 'components/navigation/initial-brand-intro.tsx')), true)
  assert.equal(existsSync(join(root, 'components/navigation/initial-brand-intro.module.css')), true)
  const intro = read('components/navigation/initial-brand-intro.tsx')
  const layout = read('app/layout.tsx')
  assert.match(intro, /variant="wordmark"/)
  assert.match(intro, /data-testid="initial-brand-intro"/)
  assert.match(intro, /data-page-motion-blocker="true"/)
  assert.match(intro, /data-testid="initial-load-progress"/)
  assert.match(layout, /InitialBrandIntro/)
  assert.doesNotMatch(layout, /RouteLoadingMode/)
})

test('hard-load intro waits for page load, warms routes, reaches 100, then exits', () => {
  const intro = read('components/navigation/initial-brand-intro.tsx')
  const css = read('components/navigation/initial-brand-intro.module.css')
  assert.match(intro, /document\.readyState === 'complete'/)
  assert.match(intro, /addEventListener\('load'/)
  assert.match(intro, /router\.prefetch/)
  assert.match(intro, /BOOTSTRAP_DURATION_MS\s*=\s*2400/)
  assert.match(intro, /Math\.min\(100/)
  assert.match(css, /@keyframes\s+intro-wordmark/)
  assert.match(css, /@keyframes\s+intro-sweep/)
  assert.match(css, /@keyframes\s+intro-exit/)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
})

test('root loading fallback exists for cache misses without restoring the old client-ready overlay mode', () => {
  const loading = read('app/loading.tsx')
  const loader = read('components/navigation/branded-route-loading.tsx')
  const css = read('components/navigation/branded-route-loading.module.css')

  assert.match(loading, /BrandedRouteLoading/)
  assert.match(loader, /data-testid="route-loading-overlay"/)
  assert.match(loader, /data-page-motion-blocker="true"/)
  assert.match(loader, /data-testid="route-loading-progress"/)
  assert.match(loader, /role="status"/)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
  assert.equal(existsSync(join(root, 'components/navigation/route-loading-mode.tsx')), false)
})

test('page motion waits for loading overlays to leave the DOM before revealing content', () => {
  assert.match(motionGate, /PAGE_MOTION_BLOCKER_SELECTOR/)
  assert.match(motionGate, /data-page-motion-blocker/)
  assert.match(motionGate, /MutationObserver/)
  assert.match(motionGate, /requestAnimationFrame/)
  assert.match(marketingMotion, /usePageMotionReady/)
  assert.match(marketingMotion, /if \(!motionReady\) return/)
})
