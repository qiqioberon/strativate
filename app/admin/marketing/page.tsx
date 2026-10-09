import { HeroPosterManagement } from '@/components/admin/hero-poster-management'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function AdminMarketingPage() {
  return (
    <main className="admin-marketing-page">
      <Link className="admin-marketing-back" href="/admin">
        <ArrowLeft aria-hidden="true" size={16} />
        Back to Admin dashboard
      </Link>
      <HeroPosterManagement />
    </main>
  )
}
