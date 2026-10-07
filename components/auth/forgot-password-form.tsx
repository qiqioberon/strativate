'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Mail, MailCheck, RotateCcw } from 'lucide-react'
import {
  PASSWORD_RECOVERY_COOLDOWN_SECONDS,
  PASSWORD_RECOVERY_COOLDOWN_STORAGE_KEY,
  normalizeRecoveryEmail,
  recoveryCooldownUntil,
  remainingRecoveryCooldown,
} from '@/lib/auth/password-recovery'

type RecoveryResponse = {
  ok?: boolean
  cooldownSeconds?: number
  retryAfterSeconds?: number
}

function readCooldownUntil() {
  try {
    return Number(window.localStorage.getItem(PASSWORD_RECOVERY_COOLDOWN_STORAGE_KEY) || '0')
  } catch {
    return 0
  }
}

function persistCooldown(seconds: number) {
  const until = recoveryCooldownUntil(Date.now(), seconds)
  try { window.localStorage.setItem(PASSWORD_RECOVERY_COOLDOWN_STORAGE_KEY, String(until)) } catch { /* Storage can be disabled. */ }
  return until
}

function countdownLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = String(seconds % 60).padStart(2, '0')
  return `${minutes}:${remainder}`
}

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  useEffect(() => {
    const sync = () => setCooldown(remainingRecoveryCooldown(readCooldownUntil()))
    sync()
    const timer = window.setInterval(sync, 1000)
    return () => window.clearInterval(timer)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || inFlight.current || cooldown > 0) return

    const data = new FormData(event.currentTarget)
    const email = normalizeRecoveryEmail(String(data.get('email') || ''))
    inFlight.current = true
    setBusy(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/auth/password-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const payload = await response.json().catch(() => ({})) as RecoveryResponse

      if (response.status === 429) {
        const seconds = Math.max(1, Number(payload.retryAfterSeconds) || PASSWORD_RECOVERY_COOLDOWN_SECONDS)
        const until = persistCooldown(seconds)
        setCooldown(remainingRecoveryCooldown(until))
        setMessage(`Your previous request is still being processed. Try again in ${countdownLabel(seconds)}.`)
        return
      }

      if (!response.ok) throw new Error('recovery-request-failed')

      const seconds = Math.max(1, Number(payload.cooldownSeconds) || PASSWORD_RECOVERY_COOLDOWN_SECONDS)
      const until = persistCooldown(seconds)
      setCooldown(remainingRecoveryCooldown(until))
      setSent(true)
      setMessage('If that email is registered, a link to create a new password has been sent. Check your inbox and spam folder.')
    } catch {
      setError('We couldn\'t process your recovery request. Please try again in a moment.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return <>
    <div className="auth-heading">
      <div className="auth-persistence-dialog__icon" aria-hidden="true">{sent ? <MailCheck size={24} /> : <Mail size={24} />}</div>
      <p className="kicker">Account recovery</p>
      <h1>Forgot your <em>password?</em></h1>
      <p>Enter your account email. We&apos;ll send you a secure link to create a new password.</p>
    </div>
    <form className="auth-form" onSubmit={submit}>
      <label>Email
        <input name="email" type="email" required autoComplete="email" maxLength={254} disabled={busy} placeholder="name@example.com" />
      </label>
      {message && <p role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary full-button" disabled={busy || cooldown > 0}>
        {busy ? 'Sending…' : cooldown > 0 ? <>Resend in {countdownLabel(cooldown)}</> : sent ? <>Resend link <RotateCcw aria-hidden="true" size={16} /></> : <>Send recovery link <Mail aria-hidden="true" size={16} /></>}
      </button>
      <a className="button button-outline full-button auth-mode-switch" href="/auth"><ArrowLeft size={16} aria-hidden="true" />Back to sign in</a>
    </form>
  </>
}
