'use client'

import { CheckCircle2, X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

export function MentoringConfirmDialog({ open, title, eyebrow = 'Konfirmasi sesi', children, confirmLabel, cancelLabel = 'Kembali', confirmIcon = <CheckCircle2 aria-hidden="true"/>, destructive = false, busy = false, confirmDisabled = false, onClose, onConfirm }: {
  open: boolean
  title: string
  eyebrow?: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  confirmIcon?: ReactNode
  destructive?: boolean
  busy?: boolean
  confirmDisabled?: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return <dialog ref={ref} className="calendar-dialog compact-confirm-dialog mentoring-confirm-dialog"
    aria-labelledby={id} aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header className="compact-confirm-dialog__header"><p className="kicker">{eyebrow}</p><h3 id={id}>{title}</h3></header>
    <div className="compact-confirm-dialog__body">{children}
      <div className="button-row compact-confirm-dialog__actions">
        <button type="button" className="button button-outline" disabled={busy} onClick={onClose}><X aria-hidden="true"/>{cancelLabel}</button>
        <button type="button" className={'button ' + (destructive ? 'mentoring-session-cancel-confirm' : 'button-primary')}
          disabled={busy || confirmDisabled} onClick={onConfirm}>{confirmIcon}{busy ? 'Memproses…' : confirmLabel}</button>
      </div>
    </div>
  </dialog>
}
