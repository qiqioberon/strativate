import { Suspense } from 'react'

import { AccountProvider } from '@/components/auth/account-provider'
import { BrandedRouteLoading } from '@/components/navigation/branded-route-loading'
import { requireAccount } from '@/lib/auth/server'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="en">
      <Suspense fallback={<BrandedRouteLoading label="Preparing Admin dashboard" />}>
        <AdminAccountBoundary>{children}</AdminAccountBoundary>
      </Suspense>
    </div>
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
