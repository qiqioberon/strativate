'use client'

import { Trash2 } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

export function AdminDeleteConfirmation({
  open,
  title,
  description,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return <dialog ref={ref} className="editorial-delete-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>
    <div className="editorial-delete-dialog__icon"><Trash2 aria-hidden="true" /></div>
    <h3 id={titleId}>{title}</h3>
    <p>{description}</p>
    <div>
      <button type="button" className="button button-outline" onClick={onCancel} disabled={busy}>Cancel</button>
      <button type="button" className="button button-danger" onClick={onConfirm} disabled={busy}><Trash2 aria-hidden="true" />{busy ? 'Deleting…' : 'Delete permanently'}</button>
    </div>
  </dialog>
}
