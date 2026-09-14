import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const managementPath = 'components/admin/mentor-management.tsx'
const sharedStylesPath = 'components/admin/data-management.module.css'
const modalStylesPath = 'components/admin/mentor-management.module.css'

test('mentor accounts render as a semantic data table with the real management columns', () => {
  const management = readFileSync(managementPath, 'utf8')

  assert.match(management, /data-testid="mentor-management-table"/)
  assert.match(management, /<table/)
  assert.match(management, /<th scope="col">Mentor<\/th>/)
  assert.match(management, /<th scope="col">Tier<\/th>/)
  assert.match(management, /<th scope="col">Status akun<\/th>/)
  assert.match(management, /<th scope="col">Setup akun<\/th>/)
  assert.match(management, /<th scope="col">Ketersediaan<\/th>/)
  assert.match(management, /<MentorTierSelect/)
  assert.doesNotMatch(management, /mentor-account-row-responsive/)
})

test('mentor listing uses exact filtered count and numbered pagination', () => {
  const management = readFileSync(managementPath, 'utf8')

  assert.match(management, /rpc\('count_managed_mentors'/)
  assert.match(management, /const \[listResult, countResult\] = await Promise\.all/)
  assert.match(management, /<TablePagination/)
  assert.match(management, /totalItems=\{totalMentors\}/)
  assert.match(management, /label="Pagination mentor"/)
})

test('Kelola opens mentor detail in a native modal dialog instead of an inline detail section', () => {
  const management = readFileSync(managementPath, 'utf8')

  assert.match(management, /useRef<HTMLDialogElement>/)
  assert.match(management, /dialog\.showModal\(\)/)
  assert.match(management, /<dialog[\s\S]*data-testid="mentor-management-dialog"/)
  assert.match(management, /onClose=\{\(\) => setSelectedId\(null\)\}/)
  assert.match(management, /data-testid="mentor-management-dialog-close"/)
  assert.match(management, /window\.innerWidth - document\.documentElement\.clientWidth/)
  assert.match(management, /document\.body\.style\.paddingRight/)
  assert.doesNotMatch(management, /<section className="role-card mentor-manage-panel/)
})

test('mentor modal keeps lifecycle and weekly availability controls in the management flow', () => {
  const management = readFileSync(managementPath, 'utf8')

  assert.match(management, /set_mentor_active/)
  assert.match(management, /delete_mentor_account/)
  assert.match(management, /Hapus akun mentor/)
  assert.match(management, /<MentorAvailabilityEditor/)
  assert.match(management, /availability_current_week_configured/)
  assert.match(management, /availability_next_week_configured/)
  assert.match(management, /Setup akun/)
})

test('mentor table and modal own responsive overflow containment', () => {
  assert.equal(existsSync(sharedStylesPath), true)
  assert.equal(existsSync(modalStylesPath), true)
  const sharedStyles = readFileSync(sharedStylesPath, 'utf8')
  const modalStyles = readFileSync(modalStylesPath, 'utf8')

  assert.match(sharedStyles, /\.tableScroll\s*\{[\s\S]*overflow-x:\s*auto/)
  assert.match(sharedStyles, /\.mentorTable\s*\{[\s\S]*min-width:/)
  assert.match(modalStyles, /\.dialog\s*\{[\s\S]*max-height:\s*calc\(100dvh - 32px\)/)
  assert.match(modalStyles, /\.dialogBody\s*\{[\s\S]*overflow-y:\s*auto/)
  assert.match(modalStyles, /\.dialog::backdrop/)
})

test('mentor invitation flow and reload remain reachable', () => {
  const management = readFileSync(managementPath, 'utf8')
  const invitations = readFileSync('components/admin/mentor-invitations.tsx', 'utf8')

  assert.match(management, /<MentorInviteForm/)
  assert.match(management, /<MentorInvitations/)
  assert.match(management, />Muat ulang<\/button>/)
  assert.match(invitations, /<TablePagination/)
  assert.match(invitations, /list_admin_mentor_invites_page/)
  assert.match(invitations, />Muat ulang<\/button>/)
})
