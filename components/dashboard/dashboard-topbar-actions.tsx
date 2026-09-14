'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, PencilLine } from 'lucide-react'
import { useAccount } from '@/components/auth/account-provider'
import { SignOut } from '@/components/auth/sign-out'
import { displayName } from '@/lib/auth/rules'
import type { AppRole } from '@/lib/supabase/database.types'
import styles from './dashboard-shared.module.css'

type Panel = 'notification' | 'account' | null

type NotificationTemplate = {
  title: string
  detail: string
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Admin',
  mentor: 'Mentor',
  mentee: 'User',
}

const notificationTemplates: Record<AppRole, NotificationTemplate[]> = {
  admin: [
    { title: 'Aktivitas mentor', detail: 'Pembaruan terkait mentor akan muncul di sini saat backend notifikasi tersedia.' },
    { title: 'Pesanan & sistem', detail: 'Pembaruan operasional baru akan ditampilkan di panel ini.' },
  ],
  mentor: [
    { title: 'Sesi mentoring', detail: 'Pembaruan sesi dan peserta akan muncul di sini saat backend notifikasi tersedia.' },
    { title: 'Perubahan jadwal', detail: 'Informasi perubahan jadwal akan ditampilkan di panel ini.' },
  ],
  mentee: [
    { title: 'Pesanan & akses', detail: 'Pembaruan pesanan dan akses produk akan muncul di sini saat backend notifikasi tersedia.' },
    { title: 'Jadwal mentoring', detail: 'Informasi sesi mentoring akan ditampilkan di panel ini.' },
  ],
}

export function DashboardTopbarActions({
  role,
  onEditProfile,
}: {
  role: AppRole
  onEditProfile: () => void
}) {
  const account = useAccount()
  const [openPanel, setOpenPanel] = useState<Panel>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const name = displayName(account)
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'S'

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpenPanel(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPanel(null)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const toggle = (panel: Exclude<Panel, null>) => {
    setOpenPanel(current => current === panel ? null : panel)
  }

  return (
    <div className={styles.topbarActions} ref={rootRef}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label="Buka notifikasi"
        aria-haspopup="dialog"
        aria-expanded={openPanel === 'notification'}
        aria-controls="dashboard-notification-popover"
        onClick={() => toggle('notification')}
      >
        <Bell aria-hidden="true" />
        <span className={styles.notificationDot} aria-hidden="true" />
      </button>

      <button
        type="button"
        className={styles.accountButton}
        aria-label="Buka menu akun"
        aria-haspopup="dialog"
        aria-expanded={openPanel === 'account'}
        aria-controls="dashboard-account-popover"
        onClick={() => toggle('account')}
      >
        <span className={styles.triggerAvatar} aria-hidden="true">{initials}</span>
        <span className={styles.accountName}>{name}</span>
        <ChevronDown className={styles.chevron} aria-hidden="true" />
      </button>

      {openPanel === 'notification' && (
        <section
          id="dashboard-notification-popover"
          className={styles.popover}
          role="dialog"
          aria-label="Notifikasi"
        >
          <div className={styles.popoverHeader}>
            <strong>Notifikasi</strong>
            <span>Panel ini sudah siap dihubungkan ke backend notifikasi ketika tersedia.</span>
          </div>
          <div className={styles.notificationList}>
            {notificationTemplates[role].map(item => (
              <div className={styles.notificationItem} key={item.title}>
                <span className={styles.notificationIcon}><Bell aria-hidden="true" /></span>
                <div>
                  <span className={styles.templateBadge}>Template</span>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {openPanel === 'account' && (
        <section
          id="dashboard-account-popover"
          className={styles.popover}
          role="dialog"
          aria-label="Informasi akun"
        >
          <div className={styles.accountSummary}>
            <span className={styles.accountAvatar} aria-hidden="true">{initials}</span>
            <div className={styles.accountIdentity}>
              <strong>{name}</strong>
              <span>{account.email || 'Email akun tidak tersedia'}</span>
              <span className={styles.roleBadge}>{roleLabels[account.role]}</span>
            </div>
          </div>
          <div className={styles.divider} />
          <button
            type="button"
            className={styles.profileAction}
            onClick={() => {
              setOpenPanel(null)
              onEditProfile()
            }}
          >
            <PencilLine aria-hidden="true" />
            Edit Profil
          </button>
          <div className={styles.divider} />
          <SignOut className={styles.accountSignOut} withIcon />
        </section>
      )}
    </div>
  )
}
