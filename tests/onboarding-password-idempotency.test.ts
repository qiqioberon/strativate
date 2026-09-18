import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { formError } from '../lib/auth/errors'

const root = process.cwd()
const experience = readFileSync(join(root, 'components/onboarding/experience.tsx'), 'utf8')
const stages = readFileSync(join(root, 'components/onboarding/stages.tsx'), 'utf8')

test('onboarding treats same_password as idempotent and keeps password editing isolated to its own stage', () => {
  assert.match(experience, /passwordUpdateError\s*&&\s*passwordUpdateError\.code\s*!==\s*['"]same_password['"]/)
  assert.match(experience, /setPasswordSaved\(true\)/)
  assert.match(experience, /setEditingPassword\(false\)/)
  assert.match(stages, /editingPassword \|\| \(!passwordSaved && !google\)/)
  assert.match(stages, />Ubah kata sandi</)
  assert.match(stages, /Akun Google-mu sudah siap/)
  assert.match(stages, /Lewati tanpa kata sandi/)
})

test('Google password skip cannot accidentally submit a stale password draft', () => {
  assert.match(experience, /effectivePassword = skipPassword \? '' : password/)
  assert.match(experience, /effectiveConfirmation = skipPassword \? '' : confirmation/)
  assert.match(experience, /saveIdentity\(undefined, true\)/)
})

test('same_password copy describes the current account instead of implying cross-user uniqueness', () => {
  const message = formError({ code: 'same_password', message: 'New password should be different from the old password.' })
  assert.match(message, /Kata sandi baru sama dengan kata sandi akun saat ini/)
  assert.doesNotMatch(message, /sudah digunakan/)
})
