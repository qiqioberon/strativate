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
        aria-label="Batalkan pilihan tetap masuk"
        onClick={onCancel}
        disabled={busy}
      ><X size={18} aria-hidden="true" /></button>
      <div className="auth-persistence-dialog__icon" aria-hidden="true"><ShieldCheck size={24} /></div>
      <div className="auth-persistence-dialog__copy">
        <h2 id="auth-persistence-title">Tetap masuk di perangkat ini?</h2>
        <p id="auth-persistence-description">Pilih “Tetap masuk” jika perangkat ini milik pribadi.</p>
      </div>
      <div className="auth-persistence-dialog__actions">
        <button
          ref={primaryRef}
          className="button button-primary auth-persistence-dialog__primary"
          type="button"
          onClick={() => onChoose('persistent')}
          disabled={busy}
        >{busy ? 'Memproses…' : 'Tetap masuk'}</button>
        <button
          className="button button-outline auth-persistence-dialog__secondary"
          type="button"
          onClick={() => onChoose('session')}
          disabled={busy}
        >Hanya sesi ini</button>
      </div>
    </div>
  </dialog>
}
