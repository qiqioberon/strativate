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

test('pagination centers controls and keeps the page summary aligned right on desktop', () => {
  const pagination = readFileSync(paginationPath, 'utf8')
  const styles = readFileSync(stylesPath, 'utf8')
  assert.match(pagination, /className=\{styles\.controls\}/)
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\)/)
  assert.match(styles, /\.controls\s*\{[\s\S]*grid-column:\s*2/)
  assert.match(styles, /\.summary\s*\{[\s\S]*grid-column:\s*3[\s\S]*justify-self:\s*end/)
})
