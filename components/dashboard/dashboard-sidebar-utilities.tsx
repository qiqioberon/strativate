'use client'

import Link from 'next/link'
import { Home } from 'lucide-react'
import { SignOut } from '@/components/auth/sign-out'
import styles from './dashboard-shared.module.css'

export function DashboardSidebarUtilities() {
  return (
    <div className={styles.sidebarUtilities}>
      <Link className={styles.sidebarLink} href="/">
        <Home aria-hidden="true" />
        Kembali ke Beranda
      </Link>
      <SignOut className={styles.signOut} withIcon />
    </div>
  )
}
