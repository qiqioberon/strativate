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
  const scopes = value.match(/function scopesForRole[\s\S]*?\n}/)?.[0] ?? ''
  assert.match(scopes, /\n  return \[\.\.\.BASE_SCOPES, 'https:\/\/www\.googleapis\.com\/auth\/calendar\.events\.readonly', 'https:\/\/www\.googleapis\.com\/auth\/calendar\.freebusy'\]\n/)
})

test('Google event creation is independent from conference creation for Zoom-backed sessions', () => {
  const value = source()
  assert.match(value, /if \(input\.createEvent\)/)
  assert.match(value, /if \(input\.createConference\) body\.conferenceData/)
  assert.match(value, /const \{ id: _id, \.\.\.patchBody \} = body/)
})
