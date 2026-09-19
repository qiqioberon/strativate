import assert from 'node:assert/strict'
import test from 'node:test'
import { destinationFor, passwordError, usernameError } from '../lib/auth/rules'
import { isProtectedApplicationPath } from '../lib/auth/routes'

test('route protection keeps public marketing paths separate from workspaces', () => {
  for (const path of ['/', '/mentor', '/mentor/navira-putri', '/program', '/produk-digital']) {
    assert.equal(isProtectedApplicationPath(path), false, `${path} should remain public`)
  }

  for (const path of ['/admin', '/admin/users', '/mentor/dashboard', '/mentor/dashboard/calendar', '/dashboard', '/onboarding', '/checkout/item']) {
    assert.equal(isProtectedApplicationPath(path), true, `${path} should require authentication`)
  }
})

test('routes only known roles and enforces persisted onboarding/setup', () => {
  assert.equal(destinationFor({ role: 'admin' }, null), '/admin')
  assert.equal(destinationFor({ role: 'mentor', mentor_setup_completed_at: null }, null), '/auth/setup')
  assert.equal(destinationFor({ role: 'mentor', mentor_setup_completed_at: 'now' }, null), '/mentor/dashboard')
  assert.equal(destinationFor({ role: 'mentee' }, null), '/onboarding')
  assert.equal(destinationFor({ role: 'mentee' }, { onboarding_completed_at: null }), '/onboarding')
  assert.equal(destinationFor({ role: 'mentee' }, { onboarding_completed_at: 'now' }), '/dashboard')
  assert.equal(destinationFor({ role: 'member' }, null), '/auth/error')
})

test('password is mandatory for email and optional but validated for Google', () => {
  assert.ok(passwordError('', '', true))
  assert.equal(passwordError('', '', false), null)
  assert.ok(passwordError('short', 'short', false))
  assert.match(passwordError('lowercase-2026!', 'lowercase-2026!', true) || '', /kapital/)
  assert.match(passwordError('No-number!', 'No-number!', true) || '', /angka/)
  assert.match(passwordError('NoSymbol2026', 'NoSymbol2026', true) || '', /simbol/)
  assert.ok(passwordError('Long-password-2026', 'different', false))
  assert.equal(passwordError('Long-password-2026!', 'Long-password-2026!', true), null)
})

test('username validates allowed format without changing case-sensitive display', () => {
  assert.equal(usernameError('Aqil_26'), null)
  assert.ok(usernameError('aq'))
  assert.ok(usernameError('admin@example.com'))
  assert.ok(usernameError('a'.repeat(31)))
})
