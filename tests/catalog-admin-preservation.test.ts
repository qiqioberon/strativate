import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('admin no longer mounts the legacy Product Catalog screen', () => {
  const admin = read('app/admin/page.tsx')
  assert.doesNotMatch(admin, /Katalog Produk/)
  assert.doesNotMatch(admin, /CatalogManagement/)
})

test('preserved catalog-named presentation components have no legacy backend coupling', () => {
  for (const path of [
    'components/admin/catalog-management.tsx',
    'components/admin/catalog-structures.tsx',
    'components/catalog/catalog-browser.tsx',
  ]) {
    const source = read(path)
    assert.doesNotMatch(source, /@\/lib\/catalog|lib\/catalog\//, path)
    assert.doesNotMatch(source, /createClient\(|db\.from\(['"]catalog_|\.rpc\(['"](?:set|create)_catalog_/, path)
    assert.doesNotMatch(source, /CatalogProduct|CatalogCommercialItem|CatalogMentorTier|CatalogSessionPackage/, path)
  }
})
