import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const managementPath = 'components/admin/mentor-management.tsx'
const invitationsPath = 'components/admin/mentor-invitations.tsx'
const layoutPath = 'app/layout.tsx'
const stylesPath = 'app/mentor-management.css'

test('mentor management owns a scoped one-column role-card reset and intentional invite composition', () => {
  assert.equal(existsSync(stylesPath), true, 'mentor management should own scoped layout styles')
  if (!existsSync(stylesPath)) return

  const management = readFileSync(managementPath, 'utf8')
  const layout = readFileSync(layoutPath, 'utf8')
  const styles = readFileSync(stylesPath, 'utf8')

  assert.match(layout, /import '\.\/mentor-management\.css'/)
  assert.match(management, /mentor-management-surface/)
  assert.match(management, /mentor-invite-layout/)
  assert.match(styles, /\.mentor-management-root \.mentor-management-section,[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  assert.match(styles, /\.mentor-management-root \.mentor-invite-layout\s*\{[^}]*grid-template-columns:/)
})

test('mentor account rows expose named responsive regions and overflow-safe identities', () => {
  const management = readFileSync(managementPath, 'utf8')
  const styles = readFileSync(stylesPath, 'utf8')

  assert.match(management, /mentor-account-row-responsive/)
  assert.match(management, /mentor-account-status--account/)
  assert.match(management, /mentor-account-status--availability/)
  assert.match(styles, /@media \(max-width: 1100px\)/)
  assert.match(styles, /@media \(max-width: 800px\)/)
  assert.match(styles, /@media \(max-width: 520px\)/)
  assert.match(styles, /overflow-wrap:\s*anywhere/)
})

test('mentor invitation and account pagination have scoped wrapping hooks', () => {
  const management = readFileSync(managementPath, 'utf8')
  const invitations = readFileSync(invitationsPath, 'utf8')
  const styles = readFileSync(stylesPath, 'utf8')

  assert.match(management, /mentor-pagination-wrap/)
  assert.match(invitations, /mentor-invitation-pagination/)
  assert.match(styles, /\.mentor-management-root \.mentor-invitation-pagination\s*\{[^}]*flex-wrap:\s*wrap/)
})
