import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('global error boundary uses a dedicated standalone branded layout', () => {
  const source = read('app/error.tsx')
  assert.match(source, /global-error-page/)
  assert.match(source, /BrandLogo/)
  assert.match(source, /onClick=\{reset\}/)
  assert.match(source, /href="\/"/)
  assert.ok(existsSync(new URL('app/error-page.css', root)))
})

test('homepage mentor marquee opens the shared mentor detail dialog instead of navigating away', () => {
  const source = read('components/marketing/mentor-marquee.tsx')
  assert.match(source, /'use client'/)
  assert.match(source, /useState/)
  assert.match(source, /MentorDetailModal/)
  assert.match(source, /event\.preventDefault\(\)/)
  assert.match(source, /onSelect\(mentor\)/)
  assert.match(source, /href=\{`\/mentor#mentor-/)
})

test('mentor marquee interaction styles promote identity first then reveal details on hover and focus', () => {
  assert.ok(existsSync(new URL('app/mentor-marquee.css', root)))
  const source = read('app/mentor-marquee.css')
  assert.match(source, /marketing-mentor-marquee__identity/)
  assert.match(source, /marketing-mentor-marquee__details/)
  assert.match(source, /:hover[\s\S]*marketing-mentor-marquee__identity/)
  assert.match(source, /:focus-visible[\s\S]*marketing-mentor-marquee__details/)
  assert.match(source, /prefers-reduced-motion:\s*reduce/)
})

test('root layout loads the dedicated error and mentor marquee styles after base marketing styles', () => {
  const source = read('app/layout.tsx')
  const marketing = source.indexOf("import './marketing.css'")
  const error = source.indexOf("import './error-page.css'")
  const marquee = source.indexOf("import './mentor-marquee.css'")
  assert.ok(marketing >= 0)
  assert.ok(error > marketing)
  assert.ok(marquee > marketing)
})
