import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

test('initial bootstrap shows measurable progress while warming marketing routes', () => {
  const intro = read('components/navigation/initial-brand-intro.tsx')
  const css = read('components/navigation/initial-brand-intro.module.css')

  assert.match(intro, /useRouter/)
  assert.match(intro, /router\.prefetch/)
  assert.match(intro, /BOOTSTRAP_DURATION_MS\s*=\s*2400/)
  assert.match(intro, /data-testid="initial-load-progress"/)
  assert.match(intro, /aria-valuenow=\{progress\}/)
  assert.match(intro, /Math\.min\(100/)
  assert.match(css, /\.progressTrack/)
  assert.match(css, /\.progressBar/)
})

test('marketing links request full prefetch while manual warm-up uses the supported router signature', () => {
  const header = read('components/marketing/site-header.tsx')

  assert.match(header, /useRouter/)
  assert.match(header, /router\.prefetch/)
  assert.doesNotMatch(header, /onInvalidate/)
  assert.match(header, /prefetch=\{true\}/)
  assert.match(header, /accountHref/)
})

test('route misses use a branded fallback and dashboard auth streams behind a local suspense boundary', () => {
  assert.equal(existsSync(join(root, 'app/loading.tsx')), true)
  assert.equal(existsSync(join(root, 'components/navigation/branded-route-loading.tsx')), true)
  assert.equal(existsSync(join(root, 'components/navigation/branded-route-loading.module.css')), true)

  for (const path of [
    'app/dashboard/layout.tsx',
    'app/admin/layout.tsx',
    'app/mentor/dashboard/layout.tsx',
  ]) {
    const layout = read(path)
    assert.match(layout, /Suspense/)
    assert.match(layout, /BrandedRouteLoading/)
    assert.match(layout, /fallback=/)
    assert.match(layout, /requireAccount/)
  }
})
