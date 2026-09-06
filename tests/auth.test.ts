import assert from 'node:assert/strict'
import test from 'node:test'
import { destinationFor, passwordError, usernameError } from '../lib/auth/rules'

test('routes only known roles and enforces persisted onboarding/setup', () => {
  assert.equal(destinationFor({ role: 'admin' }, null), '/admin')
  assert.equal(destinationFor({ role: 'mentor', mentor_setup_completed_at: null }, null), '/auth/setup')
  assert.equal(destinationFor({ role: 'mentor', mentor_setup_completed_at: 'now' }, null), '/mentor')
  assert.equal(destinationFor({ role: 'mentee' }, null), '/onboarding')
  assert.equal(destinationFor({ role: 'mentee' }, { onboarding_completed_at: null }), '/onboarding')
  assert.equal(destinationFor({ role: 'mentee' }, { onboarding_completed_at: 'now' }), '/dashboard')
  assert.equal(destinationFor({ role: 'member' }, null), '/auth/error')
})

test('password is mandatory for email and optional but validated for Google', () => {
  assert.ok(passwordError('', '', true))
  assert.equal(passwordError('', '', false), null)
  assert.ok(passwordError('short', 'short', false))
  assert.ok(passwordError('Long-password-2026', 'different', false))
  assert.equal(passwordError('Long-password-2026', 'Long-password-2026', true), null)
})

test('username validates allowed format without changing case-sensitive display', () => {
  assert.equal(usernameError('Aqil_26'), null)
  assert.ok(usernameError('aq'))
  assert.ok(usernameError('admin@example.com'))
  assert.ok(usernameError('a'.repeat(31)))
})
