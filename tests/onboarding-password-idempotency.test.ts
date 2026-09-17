import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { formError } from '../lib/auth/errors'

const root = process.cwd()
const wizard = readFileSync(join(root, 'components/onboarding/wizard.tsx'), 'utf8')

test('onboarding treats same_password as an idempotent password save and hides saved credentials until explicitly editing', () => {
  assert.match(wizard, /passwordUpdateError\s*&&\s*passwordUpdateError\.code\s*!==\s*['"]same_password['"]/)
  assert.match(wizard, /setPasswordSaved\(true\)/)
  assert.match(wizard, /setEditingPassword\(false\)/)
  assert.match(wizard, /!passwordSaved\s*\|\|\s*editingPassword/)
  assert.match(wizard, />Ubah kata sandi</)
})

test('same_password copy describes the current account instead of implying cross-user uniqueness', () => {
  const message = formError({ code: 'same_password', message: 'New password should be different from the old password.' })
  assert.match(message, /Kata sandi baru sama dengan kata sandi akun saat ini/)
  assert.doesNotMatch(message, /sudah digunakan/)
})
