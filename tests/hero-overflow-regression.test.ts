import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(new URL('../app/hero-kinetic.css', import.meta.url), 'utf8')

test('accent headline reveal preserves vertical glyph overflow', () => {
  const keyframes = css.match(/@keyframes hero-accent-reveal\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(keyframes, /clip-path:\s*inset\(-[\d.]+em\s+0\s+-[\d.]+em\s+0\)/)
  assert.doesNotMatch(keyframes, /100%\s*\{[^}]*clip-path:\s*inset\(0 0 0 0\)/s)
})
