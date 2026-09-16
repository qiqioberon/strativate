import { Suspense } from 'react'

import { AccountProvider } from '@/components/auth/account-provider'
import { BrandedRouteLoading } from '@/components/navigation/branded-route-loading'
import { requireAccount } from '@/lib/auth/server'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<BrandedRouteLoading label="Menyiapkan dashboard" />}>
      <DashboardAccountBoundary>{children}</DashboardAccountBoundary>
    </Suspense>
  )
}

async function DashboardAccountBoundary({ children }: { children: React.ReactNode }) {
  const { profile, user } = await requireAccount('/dashboard')
  return <AccountProvider profile={profile} email={user.email ?? null}>{children}</AccountProvider>
}
