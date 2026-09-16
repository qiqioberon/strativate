import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

test('hard-load brand intro is the only global loading concern', () => {
  assert.equal(existsSync(join(root, 'components/navigation/initial-brand-intro.tsx')), true)
  assert.equal(existsSync(join(root, 'components/navigation/initial-brand-intro.module.css')), true)
  const intro = read('components/navigation/initial-brand-intro.tsx')
  const layout = read('app/layout.tsx')
  assert.match(intro, /variant="wordmark"/)
  assert.match(intro, /data-testid="initial-brand-intro"/)
  assert.match(layout, /InitialBrandIntro/)
  assert.doesNotMatch(layout, /RouteLoadingMode/)
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

test('internal navigation does not install a root full-screen loading boundary', () => {
  assert.equal(existsSync(join(root, 'app/loading.tsx')), false)
  assert.equal(existsSync(join(root, 'components/navigation/route-loading-mode.tsx')), false)
  assert.equal(existsSync(join(root, 'components/navigation/branded-route-loading.tsx')), false)
  assert.equal(existsSync(join(root, 'components/navigation/branded-route-loading.module.css')), false)
})
