import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  PASSWORD_RECOVERY_COOLDOWN_SECONDS,
  isRecoveryEmail,
  normalizeRecoveryEmail,
  recoveryCooldownUntil,
  recoveryRedirectUrl,
  remainingRecoveryCooldown,
} from '../lib/auth/password-recovery'

test('password recovery normalizes email and validates basic shape', () => {
  assert.equal(normalizeRecoveryEmail('  User@Example.COM  '), 'user@example.com')
  assert.equal(isRecoveryEmail('user@example.com'), true)
  assert.equal(isRecoveryEmail('not-an-email'), false)
})

test('password recovery cooldown is a persistent 60 second browser window', () => {
  assert.equal(PASSWORD_RECOVERY_COOLDOWN_SECONDS, 60)
  const until = recoveryCooldownUntil(1_000)
  assert.equal(until, 61_000)
  assert.equal(remainingRecoveryCooldown(until, 1_500), 60)
  assert.equal(remainingRecoveryCooldown(until, 61_001), 0)
})

test('password recovery redirect explicitly marks the callback as recovery', () => {
  assert.equal(recoveryRedirectUrl('https://strativate.id/'), 'https://strativate.id/auth/callback?type=recovery')
})

test('password recovery backend uses hashed durable limits and Supabase recovery', () => {
  const route = readFileSync('app/api/auth/password-recovery/route.ts', 'utf8')
  const migration = readFileSync('supabase/migrations/202609170002_password_recovery_rate_limit.sql', 'utf8')
  assert.match(route, /createHmac\('sha256'/)
  assert.match(route, /consume_password_recovery_rate_limit/)
  assert.match(route, /resetPasswordForEmail/)
  assert.match(migration, /interval '60 seconds'/)
  assert.match(migration, /v_email_count >= 5/)
  assert.match(migration, /v_ip_count >= 30/)
  assert.match(migration, /revoke all on public\.password_recovery_rate_limits from public, anon, authenticated/)
})

test('login exposes forgot password and recovery page keeps generic anti-enumeration copy', () => {
  const authForm = readFileSync('components/auth/auth-form.tsx', 'utf8')
  const forgot = readFileSync('components/auth/forgot-password-form.tsx', 'utf8')
  assert.match(authForm, /\/auth\/forgot-password/)
  assert.match(forgot, /Jika email tersebut terdaftar/)
  assert.match(forgot, /PASSWORD_RECOVERY_COOLDOWN_STORAGE_KEY/)
  assert.match(forgot, /inFlight/)
})
