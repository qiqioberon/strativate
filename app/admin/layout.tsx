import { Suspense } from 'react'

import { AccountProvider } from '@/components/auth/account-provider'
import { BrandedRouteLoading } from '@/components/navigation/branded-route-loading'
import { requireAccount } from '@/lib/auth/server'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<BrandedRouteLoading label="Menyiapkan dashboard admin" />}>
      <AdminAccountBoundary>{children}</AdminAccountBoundary>
    </Suspense>
  )
}

async function AdminAccountBoundary({ children }: { children: React.ReactNode }) {
  const { profile, user } = await requireAccount('/admin')
  return (
    <AccountProvider profile={profile} email={user.email ?? null}>
      {children}
    </AccountProvider>
  )
}
