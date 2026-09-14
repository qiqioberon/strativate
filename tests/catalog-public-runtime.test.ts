import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('homepage and Digital Product public runtime do not import Product Catalog runtime', () => {
  for (const path of [
    'app/page.tsx',
    'components/marketing/home-page.tsx',
    'components/marketing/program-card.tsx',
    'app/produk-digital/page.tsx',
  ]) {
    const source = read(path)
    assert.doesNotMatch(source, /@\/lib\/catalog|lib\/catalog\//, path)
    assert.doesNotMatch(source, /Product Master/, path)
  }
})
