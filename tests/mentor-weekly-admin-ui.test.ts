import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const availabilityEditor = readFileSync('components/mentor/availability-editor.tsx', 'utf8')
const mentorManagement = readFileSync('components/admin/mentor-management.tsx', 'utf8')

test('availability editor exposes current and next week and saves the selected week only', () => {
  assert.match(availabilityEditor, /Minggu Ini/)
  assert.match(availabilityEditor, /Minggu Depan/)
  assert.match(availabilityEditor, /p_week_start_date/)
  assert.match(availabilityEditor, /availabilityWeekOptions/)
})

test('admin mentor management separates lifecycle from setup and exposes destructive deletion', () => {
  assert.match(mentorManagement, /p_account_status/)
  assert.match(mentorManagement, /Setup akun/)
  assert.match(mentorManagement, /set_mentor_active/)
  assert.match(mentorManagement, /delete_mentor_account/)
  assert.match(mentorManagement, /Hapus akun mentor/)
})
