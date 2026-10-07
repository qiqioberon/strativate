'use client'
import { useEffect, useRef } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import type { AuthPersistenceMode } from '@/lib/auth/session-persistence'

type Props = {
  open: boolean
  busy: boolean
  onChoose: (mode: AuthPersistenceMode) => void
  onCancel: () => void
}

export function SessionChoiceDialog({ open, busy, onChoose, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      primaryRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => () => {
    const dialog = dialogRef.current
    if (dialog?.open) dialog.close()
  }, [])

  return <dialog
    ref={dialogRef}
    className="auth-persistence-dialog"
    style={{ position: 'fixed', inset: 0, margin: 'auto' }}
    aria-modal="true"
    aria-labelledby="auth-persistence-title"
    aria-describedby="auth-persistence-description"
    onCancel={event => {
      event.preventDefault()
      if (!busy) onCancel()
    }}
  >
    <div className="auth-persistence-dialog__surface">
      <button
        className="auth-persistence-dialog__close"
        type="button"
        aria-label="Cancel sign-in preference"
        onClick={onCancel}
        disabled={busy}
      ><X size={18} aria-hidden="true" /></button>
      <div className="auth-persistence-dialog__icon" aria-hidden="true"><ShieldCheck size={24} /></div>
      <div className="auth-persistence-dialog__copy">
        <h2 id="auth-persistence-title">Stay signed in on this device?</h2>
        <p id="auth-persistence-description">Choose “Stay signed in” if this is your personal device.</p>
      </div>
      <div className="auth-persistence-dialog__actions">
        <button
          ref={primaryRef}
          className="button button-primary auth-persistence-dialog__primary"
          type="button"
          onClick={() => onChoose('persistent')}
          disabled={busy}
        >{busy ? 'Processing…' : 'Stay signed in'}</button>
        <button
          className="button button-outline auth-persistence-dialog__secondary"
          type="button"
          onClick={() => onChoose('session')}
          disabled={busy}
        >This session only</button>
      </div>
    </div>
  </dialog>
}
