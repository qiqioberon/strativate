import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../components/admin/hero-poster-management.tsx', import.meta.url), 'utf8')

test('hero poster creation appends automatically while editing exposes a natural position control', () => {
  assert.doesNotMatch(source, /name="sort_order"/)
  assert.match(source, /Poster baru otomatis ditempatkan di posisi terakhir\./)
  assert.match(source, /editing \? <PosterField id="hero-poster-position"/)
  assert.match(source, /name="position"[^>]*type="number"/)
  assert.match(source, /getNextHeroPosterSortOrder\(posters\)/)
  assert.match(source, /moveHeroPosterIdToPosition\(posters, posterId, position\)/)
  assert.match(source, /<dt>Posisi<\/dt><dd>\{index \+ 1\}<\/dd>/)
})
