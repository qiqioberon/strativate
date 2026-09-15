import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('admin operational data tables expose shared three-state sortable headers', () => {
  const files = [
    'components/admin/people.tsx',
    'components/admin/mentor-management.tsx',
    'components/admin/mentor-invitations.tsx',
    'components/admin/institutions.tsx',
    'components/admin/commerce-operations.tsx',
    'components/admin/commerce-cart-link-management.tsx',
    'components/admin/digital-product-management.tsx',
    'components/admin/private-mentoring-enrollment-management.tsx',
    'components/admin/master-options.tsx',
  ]
  for (const file of files) assert.match(read(file), /SortableTableHeader/, `${file} should expose sortable headers`)

  const shared = read('components/admin/sortable-table-header.tsx')
  assert.match(shared, /if \(!active \|\| direction === null\) return 'asc'/)
  assert.match(shared, /if \(direction === 'asc'\) return 'desc'/)
  assert.match(shared, /return null/)
  assert.match(shared, /aria-sort/)
})

test('sortable data sets reset to their original default ordering after the third click', () => {
  assert.match(read('components/admin/sortable-table-header.tsx'), /onSortChange\(next === null \? null : sortKey, next\)/)
  assert.match(read('components/admin/people.tsx'), /p_sort_key: sortKey \?\? 'created_at'/)
  assert.match(read('components/admin/institutions.tsx'), /else \{\s*request = request\.order\('created_at'/)
  assert.match(read('components/admin/digital-product-management.tsx'), /if \(!sortKey \|\| !sortDirection\) return filteredProducts/)
})
