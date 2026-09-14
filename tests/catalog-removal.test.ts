import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migrationPath = 'supabase/migrations/202609140002_remove_legacy_product_catalog.sql'

test('legacy catalog cleanup is explicit and never uses CASCADE', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  assert.doesNotMatch(sql, /\bdrop\b[^;]*\bcascade\b/i)
  for (const object of [
    'public_catalog_products',
    'public_catalog_commercial_items',
    'catalog_products',
    'catalog_commercial_items',
    'catalog_mentor_tiers',
    'catalog_product_type',
  ]) {
    assert.match(sql, new RegExp(`\\b${object}\\b`))
  }
})

test('runtime database types no longer expose Product Catalog objects', () => {
  const source = readFileSync('lib/supabase/database.types.ts', 'utf8')
  assert.doesNotMatch(source, /\bCatalogProduct\b/)
  assert.doesNotMatch(source, /\bcatalog_products\s*:/)
  assert.doesNotMatch(source, /\bpublic_catalog_products\s*:/)
})
