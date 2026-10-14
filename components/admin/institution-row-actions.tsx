'use client'

import { Menu } from '@base-ui/react/menu'
import { Archive, Check, ChevronDown, Copy, Pencil, XCircle } from 'lucide-react'
import { useRef } from 'react'
import type { ApprovalStatus } from '@/lib/supabase/database.types'
import styles from './institution-row-actions.module.css'

export function InstitutionRowActions({ name, status, busy, onEdit, onApprove, onReject, onArchive, onMerge }: {
  name: string; status: ApprovalStatus; busy: boolean
  onEdit: () => void; onApprove: () => void; onReject: () => void; onArchive: () => void; onMerge: () => void
}) {
  const selecting = useRef(false)
  const actions = [
    { label: 'Edit', Icon: Pencil, action: onEdit, tone: '' },
    ...(status === 'pending' ? [
      { label: 'Approve', Icon: Check, action: onApprove, tone: 'positive' },
      { label: 'Reject', Icon: XCircle, action: onReject, tone: 'danger' },
    ] : []),
    ...(status !== 'archived' ? [{ label: 'Archive', Icon: Archive, action: onArchive, tone: 'warning' }] : []),
    { label: 'Merge duplicate', Icon: Copy, action: onMerge, tone: '' },
  ]
  return <div className={styles.root}>
    <div className={styles.grid}>{actions.map(({ label, Icon, action, tone }) => <button key={label} type="button" className={styles.button} data-tone={tone} data-wide={label === 'Merge duplicate'} disabled={busy} onClick={action}><Icon size={14} aria-hidden="true" />{label}</button>)}</div>
    <div className={styles.menu}><Menu.Root onOpenChange={open => { if (open) selecting.current = false }}>
      <Menu.Trigger className={styles.button} aria-busy={busy} aria-label={`Actions for ${name}`}>{busy ? 'Updating…' : 'Actions'}<ChevronDown size={14} aria-hidden="true" /></Menu.Trigger>
      <Menu.Portal><Menu.Positioner className={styles.positioner} align="end" sideOffset={5} collisionPadding={12}>
        <Menu.Popup className={styles.popup} aria-label={`Institution actions for ${name}`} finalFocus={() => selecting.current ? false : true}>
          {actions.map(({ label, Icon, action, tone }) => <Menu.Item key={label} className={styles.item} data-tone={tone} disabled={busy} onClick={() => { selecting.current = label === 'Edit' || label === 'Merge duplicate'; action() }}><Icon size={16} aria-hidden="true" />{label}</Menu.Item>)}
        </Menu.Popup>
      </Menu.Positioner></Menu.Portal>
    </Menu.Root></div>
  </div>
}
