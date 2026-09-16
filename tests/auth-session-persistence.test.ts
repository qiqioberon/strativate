import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AUTH_PERSISTENCE_COOKIE,
  AUTH_PERSISTENCE_MAX_AGE,
  applyAuthCookiePersistence,
  authPersistenceModeFromCookieValue,
  serializeAuthPersistenceCookie,
} from '../lib/auth/session-persistence.ts'

test('persistent mode keeps Supabase cookie lifetime unchanged', () => {
  const expires = new Date('2030-01-01T00:00:00.000Z')
  const values = [{ name: 'sb-test-auth-token', value: 'token', options: { path: '/', sameSite: 'lax' as const, maxAge: 120, expires } }]
  assert.deepEqual(applyAuthCookiePersistence(values, 'persistent'), values)
})

test('session mode strips persistence lifetime but preserves cookie security attributes', () => {
  const values = [{ name: 'sb-test-auth-token', value: 'token', options: { path: '/', sameSite: 'lax' as const, secure: true, maxAge: 120, expires: new Date('2030-01-01T00:00:00.000Z') } }]
  const [cookie] = applyAuthCookiePersistence(values, 'session')
  assert.deepEqual(cookie.options, { path: '/', sameSite: 'lax', secure: true })
})

test('session mode keeps deletion lifetime so Supabase can remove stale chunks and sign out', () => {
  const values = [{ name: 'sb-test-auth-token.1', value: '', options: { path: '/', sameSite: 'lax' as const, maxAge: 0 } }]
  assert.deepEqual(applyAuthCookiePersistence(values, 'session'), values)
})

test('only an explicit session preference changes the backwards-compatible persistent default', () => {
  assert.equal(authPersistenceModeFromCookieValue('session'), 'session')
  assert.equal(authPersistenceModeFromCookieValue('persistent'), 'persistent')
  assert.equal(authPersistenceModeFromCookieValue(undefined), 'persistent')
  assert.equal(authPersistenceModeFromCookieValue('unexpected'), 'persistent')
})

test('preference cookie is session-scoped only when requested and secure when applicable', () => {
  const session = serializeAuthPersistenceCookie('session', true)
  assert.match(session, new RegExp(`^${AUTH_PERSISTENCE_COOKIE}=session;`))
  assert.doesNotMatch(session, /Max-Age=/)
  assert.match(session, /SameSite=Lax/)
  assert.match(session, /Secure/)

  const persistent = serializeAuthPersistenceCookie('persistent', false)
  assert.match(persistent, new RegExp(`Max-Age=${AUTH_PERSISTENCE_MAX_AGE}`))
  assert.doesNotMatch(persistent, /Secure/)
})
