import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const participants = readFileSync('components/admin/people.tsx', 'utf8')
const migration = readFileSync('supabase/migrations/202609150003_profile_whatsapp_admin_mentee_sorting.sql', 'utf8')

test('Mentee management renders contact records as a semantic sortable table', () => {
  assert.match(participants, /data-testid="participant-table"/)
  assert.match(participants, /SortableTableHeader label="Mentee"/)
  assert.match(participants, /SortableTableHeader label="Email"/)
  assert.match(participants, /SortableTableHeader label="WhatsApp"/)
  assert.match(participants, /SortableTableHeader label="Institusi"/)
  assert.match(participants, /SortableTableHeader label="Bergabung"/)
  assert.match(participants, /ops-icon-button/)
  assert.match(participants, /<dialog/)
})

test('Mentee listing uses server pagination, search, and sorting through an admin-only projection', () => {
  assert.match(participants, /list_admin_mentees_page/)
  assert.match(participants, /p_query: query\.trim\(\)/)
  assert.match(participants, /p_sort_key:/)
  assert.match(participants, /p_sort_direction:/)
  assert.match(participants, /<TablePagination/)
  assert.match(participants, /totalItems=\{totalPeople\}/)
  assert.match(participants, /label="Pagination mentee"/)
  assert.match(migration, /count\(\*\) over\(\)/)
  assert.match(migration, /limit greatest/)
  assert.match(migration, /offset greatest/)
})

test('Mentee modal is read-only and includes onboarding context instead of admin mutation controls', () => {
  assert.match(participants, /Detail mentee · read-only/)
  assert.match(participants, /Status onboarding/)
  assert.match(participants, /Sumber informasi/)
  assert.match(participants, /Minat kompetisi/)
  assert.doesNotMatch(participants, /update\(|delete\(|upsert\(/)
})
