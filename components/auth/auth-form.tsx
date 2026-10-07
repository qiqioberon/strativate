'use client'
import { useRef, useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { authFormError } from '@/lib/auth/public-errors'
import {
  clearBrowserAuthPersistenceMode,
  setBrowserAuthPersistenceMode,
  type AuthPersistenceMode,
} from '@/lib/auth/session-persistence'
import { PasswordInput } from './password-input'
import { SessionChoiceDialog } from './session-choice-dialog'

type PendingLogin =
  | { kind: 'password'; email: string; password: string }
  | { kind: 'google' }

export function AuthForm() {
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pendingLogin, setPendingLogin] = useState<PendingLogin | null>(null)
  const inFlight = useRef(false)
  const locked = busy || pendingLogin !== null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked || inFlight.current) return
    setError(''); setMessage('')
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email')).trim()
    if (!register) {
      setPendingLogin({ kind: 'password', email, password: String(data.get('password')) })
      return
    }

    inFlight.current = true
    setBusy(true)
    try {
      clearBrowserAuthPersistenceMode()
      const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
      if (error) throw error
      setMessage('If your email can be processed, a verification link will be sent. Check your inbox and spam folder.')
    } catch (error) {
      setError(authFormError(error, 'We couldn\'t send the email link. Please try again.'))
    } finally { inFlight.current = false; setBusy(false) }
  }

  function google() {
    if (locked || inFlight.current) return
    setError(''); setMessage('')
    setPendingLogin({ kind: 'google' })
  }

  async function authenticate(mode: AuthPersistenceMode) {
    const login = pendingLogin
    if (!login || inFlight.current) return
    inFlight.current = true
    setBusy(true); setError('')
    try {
      setBrowserAuthPersistenceMode(mode)
      const supabase = createClient()
      if (login.kind === 'password') {
        const { error } = await supabase.auth.signInWithPassword({ email: login.email, password: login.password })
        if (error) throw error
        window.location.assign('/auth/continue')
        return
      }

      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })
      if (error) throw error
    } catch (error) {
      clearBrowserAuthPersistenceMode()
      setPendingLogin(null)
      inFlight.current = false
      setError(authFormError(error, login.kind === 'google'
        ? 'We couldn\'t connect to Google. Please try again.'
        : 'We couldn\'t sign you in. Check your email and password, then try again.'))
      setBusy(false)
    }
  }

  function cancelPersistenceChoice() {
    if (!busy && !inFlight.current) setPendingLogin(null)
  }

  return <>
    <div className="auth-heading">
      <p className="kicker">{register ? 'Start your journey' : 'Welcome back'}</p>
      <h1>{register ? <>Join <em>Strativate.</em></> : <>Claim your <em>next win.</em></>}</h1>
      <p>{register ? 'Enter your email to receive a verification link and complete your profile.' : 'Sign in to continue your journey with Strativate.'}</p>
    </div>
    <form className="auth-form" onSubmit={submit}>
      <label>Email<input name="email" type="email" required autoComplete="email" maxLength={254} disabled={locked} /></label>
      {!register && <><PasswordInput label="Password" language="en" name="password" required autoComplete="current-password" disabled={locked} /><a className="auth-text-link auth-forgot-link" href="/auth/forgot-password">Forgot password?</a></>}
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <button className="button button-primary full-button" disabled={locked}>{busy ? 'Processing…' : register ? 'Send email link' : 'Sign in'}<ArrowRight aria-hidden="true" size={16} /></button>
      <button className="button button-outline full-button" type="button" onClick={google} disabled={locked}>Continue with Google</button>
      <button className="button button-outline full-button auth-mode-switch" type="button" disabled={locked} onClick={() => { setRegister(!register); setError(''); setMessage('') }} data-testid="auth-mode-switch">{register ? 'Already have an account? Sign in' : 'Don\'t have an account? Sign up'}</button>
    </form>
    <SessionChoiceDialog open={pendingLogin !== null} busy={busy} onChoose={authenticate} onCancel={cancelPersistenceChoice} />
  </>
}
