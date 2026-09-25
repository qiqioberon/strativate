import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = () => readFileSync('lib/google-calendar/server.ts', 'utf8')

test('OAuth return paths reject protocol-relative and backslash-based external redirects', () => {
  const value = source()
  assert.match(value, /startsWith\('\/'\)/)
  assert.match(value, /startsWith\('\/\/'\)/)
  assert.match(value, /includes\('\\\\'\)/)
})

test('OAuth credentials remain server-only and roles request only calendar scopes they use', () => {
  const value = source()
  assert.match(value, /import 'server-only'/)
  assert.match(value, /access_type:'offline'/)
  assert.match(value, /code_challenge_method:'S256'/)
  assert.match(value, /calendar\.events\.readonly/)
  assert.match(value, /calendar\.freebusy/)
  assert.doesNotMatch(value, /NEXT_PUBLIC_GOOGLE/)
})

test('mentee optional conflict checks request the narrow freebusy scope they actually call', () => {
  const value = source()
  assert.match(value, /function scopesForRole[\s\S]*calendar\.events\.readonly[\s\S]*calendar\.freebusy/)
})

test('Google event runtime has no conference creation or conference-link provider path', () => {
  const value = source()
  assert.match(value, /if \(input\.createEvent\)/)
  assert.match(value, /new URLSearchParams\(\{ sendUpdates:'all' \}\)/)
  assert.match(value, /const \{ id: _id, \.\.\.patchBody \} = body/)
  assert.doesNotMatch(value, /createConference|conferenceData|hangoutLink|hangoutsMeet/)
})
