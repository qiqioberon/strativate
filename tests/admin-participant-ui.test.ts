import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const participants = readFileSync('components/admin/people.tsx', 'utf8')

test('participant management renders profile records as a semantic table', () => {
  assert.match(participants, /data-testid="participant-table"/)
  assert.match(participants, /<th scope="col">Peserta<\/th>/)
  assert.match(participants, /<th scope="col">Username<\/th>/)
  assert.match(participants, /<th scope="col">ID akun<\/th>/)
  assert.match(participants, /<th scope="col">Bergabung<\/th>/)
  assert.match(participants, /<th scope="col">Peran<\/th>/)
  assert.doesNotMatch(participants, /className="admin-record"/)
})

test('participant search, Supabase listing, pagination, and reload remain available', () => {
  assert.match(participants, /\.from\('profiles'\)/)
  assert.match(participants, /\.eq\('role', 'mentee'\)/)
  assert.match(participants, /visiblePeople = people\.filter/)
  assert.match(participants, /Cari pada halaman ini/)
  assert.match(participants, />Sebelumnya<\/button>/)
  assert.match(participants, />Berikutnya/)
  assert.match(participants, />Muat ulang<\/button>/)
})

test('participant UUID remains secondary monospace data instead of the primary identity', () => {
  assert.match(participants, /className=\{dataStyles\.mono\}/)
  assert.match(participants, /title=\{person\.id\}/)
  assert.match(participants, /className=\{dataStyles\.identity\}/)
  assert.match(participants, /displayName\(person\)/)
})
