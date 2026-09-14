import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => { assert.equal(existsSync(path), true, `${path} must exist`); return readFileSync(path, 'utf8') }

test('mentor invitations use a filtered table with server pagination', () => {
  const source = read('components/admin/mentor-invitations.tsx')
  assert.match(source, /list_admin_mentor_invites_page/)
  assert.match(source, /<table/)
  assert.match(source, /TablePagination/)
  assert.match(source, /Cari email|Email/)
  assert.match(source, /Status/)
  assert.match(source, /Tier/)
  assert.match(source, /Dari|Sampai/)
  assert.match(source, /Per halaman/)
})

test('mentor invitation and shared table pagination are centered and paginated in database', () => {
  const migration = read('supabase/migrations/202609150002_admin_private_mentoring_enrollment_management.sql')
  const paginationCss = read('components/admin/table-pagination.module.css')
  assert.match(migration, /list_admin_mentor_invites_page/)
  assert.match(migration, /p_query/)
  assert.match(migration, /p_status/)
  assert.match(migration, /p_tier_id/)
  assert.match(migration, /p_from/)
  assert.match(migration, /p_to/)
  assert.match(migration, /total_count/)
  assert.match(paginationCss, /justify-content:\s*center/)
})
