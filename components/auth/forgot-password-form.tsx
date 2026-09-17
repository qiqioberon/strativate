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
        setMessage(`Permintaan sebelumnya masih diproses. Coba lagi dalam ${countdownLabel(seconds)}.`)
        return
      }

      if (!response.ok) throw new Error('recovery-request-failed')

      const seconds = Math.max(1, Number(payload.cooldownSeconds) || PASSWORD_RECOVERY_COOLDOWN_SECONDS)
      const until = persistCooldown(seconds)
      setCooldown(remainingRecoveryCooldown(until))
      setSent(true)
      setMessage('Jika email tersebut terdaftar, tautan untuk membuat kata sandi baru sudah dikirim. Periksa kotak masuk dan folder spam.')
    } catch {
      setError('Permintaan pemulihan belum dapat diproses. Silakan coba lagi beberapa saat lagi.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return <>
    <div className="auth-heading">
      <div className="auth-persistence-dialog__icon" aria-hidden="true">{sent ? <MailCheck size={24} /> : <Mail size={24} />}</div>
      <p className="kicker">Pemulihan akun</p>
      <h1>Lupa kata <em>sandi?</em></h1>
      <p>Masukkan email akunmu. Kami akan mengirim tautan aman untuk membuat kata sandi baru.</p>
    </div>
    <form className="auth-form" onSubmit={submit}>
      <label>Email
        <input name="email" type="email" required autoComplete="email" maxLength={254} disabled={busy} placeholder="nama@email.com" />
      </label>
      {message && <p role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary full-button" disabled={busy || cooldown > 0}>
        {busy ? 'Mengirim…' : cooldown > 0 ? <>Kirim ulang dalam {countdownLabel(cooldown)}</> : sent ? <>Kirim ulang tautan <RotateCcw size={16} /></> : <>Kirim tautan pemulihan <Mail size={16} /></>}
      </button>
      <a className="button button-outline full-button auth-mode-switch" href="/auth"><ArrowLeft size={16} aria-hidden="true" />Kembali ke halaman masuk</a>
    </form>
  </>
}
