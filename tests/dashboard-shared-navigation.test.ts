import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sharedTopbar = readFileSync('components/dashboard/dashboard-topbar-actions.tsx', 'utf8')
const sharedSidebar = readFileSync('components/dashboard/dashboard-sidebar-utilities.tsx', 'utf8')
const signOut = readFileSync('components/auth/sign-out.tsx', 'utf8')
const accountProvider = readFileSync('components/auth/account-provider.tsx', 'utf8')
const admin = readFileSync('app/admin/page.tsx', 'utf8')
const mentor = readFileSync('app/mentor/dashboard/page.tsx', 'utf8')
const mentee = readFileSync('app/dashboard/dashboard-client.tsx', 'utf8')
const adminLayout = readFileSync('app/admin/layout.tsx', 'utf8')
const mentorLayout = readFileSync('app/mentor/dashboard/layout.tsx', 'utf8')
const menteeLayout = readFileSync('app/dashboard/layout.tsx', 'utf8')

test('shared dashboard topbar owns mutually exclusive accessible popovers', () => {
  assert.match(sharedTopbar, /useState<Panel>\(null\)/)
  assert.match(sharedTopbar, /notification/)
  assert.match(sharedTopbar, /account/)
  assert.match(sharedTopbar, /pointerdown/)
  assert.match(sharedTopbar, /Escape/)
  assert.match(sharedTopbar, /aria-expanded/)
  assert.match(sharedTopbar, /aria-label="Buka notifikasi"/)
  assert.match(sharedTopbar, /aria-label="Buka menu akun"/)
  assert.match(sharedTopbar, /account\.email/)
})

test('all role dashboards reuse the shared topbar and sidebar utilities', () => {
  for (const source of [admin, mentor, mentee]) {
    assert.match(source, /DashboardTopbarActions/)
    assert.match(source, /DashboardSidebarUtilities/)
  }
  assert.match(admin, /role="admin"/)
  assert.match(mentor, /role="mentor"/)
  assert.match(mentee, /role="mentee"/)
})

test('sidebar utilities expose public homepage and destructive icon logout', () => {
  assert.match(sharedSidebar, /href="\/"/)
  assert.match(sharedSidebar, /Kembali ke Beranda/)
  assert.match(sharedSidebar, /withIcon/)
  assert.match(signOut, /LogOut/)
  assert.match(signOut, /withIcon/)
})

test('authenticated layouts pass the real auth email into the shared account context', () => {
  assert.match(accountProvider, /email: string \| null/)
  for (const source of [adminLayout, mentorLayout, menteeLayout]) {
    assert.match(source, /email=\{user\.email \?\? null\}/)
  }
})

test('mentee dashboard is an owned-content workspace instead of an internal catalog', () => {
  assert.doesNotMatch(mentee, /id: 'explore'/)
  assert.doesNotMatch(mentee, /section === 'explore'/)
  assert.doesNotMatch(mentee, /open\('explore'\)/)
  assert.match(mentee, /Produk Digital Saya/)
  assert.match(mentee, /href="\/program"/)
  assert.match(mentee, /href="\/produk-digital"/)
})
