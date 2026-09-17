export const PASSWORD_RECOVERY_COOLDOWN_SECONDS = 60
export const PASSWORD_RECOVERY_COOLDOWN_STORAGE_KEY = 'strativate:password-recovery:cooldown-until'

export function normalizeRecoveryEmail(value: string) {
  return value.trim().toLowerCase()
}

export function isRecoveryEmail(value: string) {
  const email = normalizeRecoveryEmail(value)
  return email.length > 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function recoveryCooldownUntil(now = Date.now(), seconds = PASSWORD_RECOVERY_COOLDOWN_SECONDS) {
  return now + Math.max(0, seconds) * 1000
}

export function remainingRecoveryCooldown(until: number, now = Date.now()) {
  if (!Number.isFinite(until)) return 0
  return Math.max(0, Math.ceil((until - now) / 1000))
}

export function recoveryRedirectUrl(origin: string) {
  return `${origin.replace(/\/$/, '')}/auth/callback?type=recovery`
}
