import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

test('root App Router loading boundary owns branded route loading', () => {
  const loading = read('app/loading.tsx')
  const loader = read('components/navigation/branded-route-loading.tsx')
  assert.match(loading, /BrandedRouteLoading/)
  assert.match(loader, /BrandLogo/)
  assert.match(loader, /variant="wordmark"/)
  assert.match(loader, /variant="mark"/)
  assert.match(loader, /role="status"/)
})

test('hydration marker switches presentation without owning navigation', () => {
  const mode = read('components/navigation/route-loading-mode.tsx')
  const layout = read('app/layout.tsx')
  assert.match(mode, /data-strativate-client-ready/)
  assert.match(mode, /document\.documentElement\.setAttribute/)
  assert.match(layout, /RouteLoadingMode/)
  assert.doesNotMatch(mode, /router\.(push|replace)|addEventListener\(['"]click/)
})

test('loader is full-screen, high-layer, motion-safe, and timer-free', () => {
  const loader = read('components/navigation/branded-route-loading.tsx')
  const css = read('components/navigation/branded-route-loading.module.css')
  const combined = `${loader}\n${css}`
  assert.match(css, /position:\s*fixed/)
  assert.match(css, /inset:\s*0/)
  assert.match(css, /z-index:\s*12000/)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
  assert.match(css, /data-strativate-client-ready/)
  assert.doesNotMatch(combined, /setTimeout|setInterval|min(?:imum)?Delay|minDuration/)
})
