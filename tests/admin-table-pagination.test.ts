import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const paginationPath = 'components/admin/table-pagination.tsx'
const stylesPath = 'components/admin/table-pagination.module.css'

test('shared admin table pagination renders numbered accessible page controls', () => {
  assert.equal(existsSync(paginationPath), true)
  assert.equal(existsSync(stylesPath), true)
  const pagination = readFileSync(paginationPath, 'utf8')

  assert.match(pagination, /aria-current=\{item === currentPage \? 'page' : undefined\}/)
  assert.match(pagination, /aria-label=\{`Halaman \$\{item \+ 1\}`\}/)
  assert.match(pagination, /Halaman \{currentPage \+ 1\} dari \{totalPages\}/)
  assert.match(pagination, /pageItems\(currentPage, totalPages\)/)
  assert.match(pagination, /Sebelumnya/)
  assert.match(pagination, /Berikutnya/)
})
