import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const managementPath = 'components/admin/mentor-management.tsx'
const invitationsPath = 'components/admin/mentor-invitations.tsx'
const stylesPath = 'components/admin/mentor-management.module.css'

test('mentor management owns a one-column role-card reset and intentional invite composition', () => {
  assert.equal(existsSync(stylesPath), true, 'mentor management should own scoped layout styles')
  if (!existsSync(stylesPath)) return

  const management = readFileSync(managementPath, 'utf8')
  const styles = readFileSync(stylesPath, 'utf8')
  assert.match(management, /styles\.section/)
  assert.match(management, /styles\.inviteLayout/)
  assert.match(styles, /\.section\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)
  assert.match(styles, /\.inviteLayout\s*\{[^}]*grid-template-columns:/s)
})

test('mentor account rows expose named responsive regions and overflow-safe identities', () => {
  const management = readFileSync(managementPath, 'utf8')
  const styles = readFileSync(stylesPath, 'utf8')
  assert.match(management, /styles\.accountRow/)
  assert.match(management, /styles\.accountStatus/)
  assert.match(management, /styles\.availabilityStatus/)
  assert.match(styles, /@media \(max-width: 1100px\)/)
  assert.match(styles, /@media \(max-width: 800px\)/)
  assert.match(styles, /@media \(max-width: 520px\)/)
  assert.match(styles, /overflow-wrap:\s*anywhere/)
})

test('mentor invitation and account pagination have scoped wrapping hooks', () => {
  const management = readFileSync(managementPath, 'utf8')
  const invitations = readFileSync(invitationsPath, 'utf8')
  assert.match(management, /styles\.pagination/)
  assert.match(invitations, /mentor-invitation-pagination/)
})
