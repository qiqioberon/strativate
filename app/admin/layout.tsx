import { requireAccount } from '@/lib/auth/server'
import { AccountProvider } from '@/components/auth/account-provider'
import Link from 'next/link'
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAccount('/admin')
  return <AccountProvider profile={profile}>
    <nav className="admin-section-switcher" aria-label="Navigasi admin cepat">
      <Link href="/admin" data-testid="admin-dashboard-link">Dashboard</Link>
      <Link href="/admin/marketing" data-testid="admin-marketing-link">Konten Marketing</Link>
    </nav>
    {children}
  </AccountProvider>
}
