import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => { assert.equal(existsSync(path), true, `${path} must exist`); return readFileSync(path, 'utf8') }

test('admin mentoring sessions is enrollment-first with paginated filters and modal management', () => {
  const source = read('components/admin/private-mentoring-enrollment-management.tsx')
  assert.match(source, /list_admin_private_mentoring_enrollments_page/)
  assert.match(source, /get_admin_private_mentoring_enrollment_sessions/)
  assert.match(source, /<table className="ops-table/)
  assert.match(source, /TablePagination/)
  assert.match(source, /Username|username/)
  assert.match(source, /Tanggal beli|purchased_at/)
  assert.match(source, /Paket/)
  assert.match(source, /<dialog/)
  assert.match(source, /Kelola sesi/)
  assert.match(source, /Semua sesi sudah diatur/)
  assert.match(source, /configured_sessions/)
})

test('enrollment projection is admin guarded, paginated, and supports requested filters', () => {
  const migration = read('supabase/migrations/202609150002_admin_private_mentoring_enrollment_management.sql')
  assert.match(migration, /list_admin_private_mentoring_enrollments_page/)
  assert.match(migration, /public\.is_admin\(\)/)
  assert.match(migration, /p_query/)
  assert.match(migration, /p_package_id/)
  assert.match(migration, /p_progress/)
  assert.match(migration, /p_from/)
  assert.match(migration, /p_to/)
  assert.match(migration, /limit greatest/)
  assert.match(migration, /offset greatest/)
  assert.match(migration, /get_admin_private_mentoring_enrollment_sessions/)
  assert.match(migration, /username/)
  assert.match(migration, /paid_at/)
})
