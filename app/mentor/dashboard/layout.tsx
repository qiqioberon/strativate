import { Suspense } from 'react'

import { AccountProvider } from '@/components/auth/account-provider'
import { BrandedRouteLoading } from '@/components/navigation/branded-route-loading'
import { requireAccount } from '@/lib/auth/server'

import './mentor-operations.css'

export default function MentorDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={<BrandedRouteLoading label="Menyiapkan dashboard mentor" />}>
      <MentorAccountBoundary>{children}</MentorAccountBoundary>
    </Suspense>
  )
}

async function MentorAccountBoundary({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { profile, user } = await requireAccount('/mentor/dashboard')

  return <AccountProvider profile={profile} email={user.email ?? null}>{children}</AccountProvider>
}
