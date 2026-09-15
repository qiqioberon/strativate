import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'

import { ToastProvider } from '@/components/ui/toast-provider'
import { brandDescription } from '@/lib/content/brand'

import './globals.css'
import './auth/auth.css'
import './program-information.css'
import './marketing.css'
import './digital-product-ux.css'
import './digital-product-commerce.css'
import './operations-dashboard.css'
import './admin-layout-fixes.css'
import './hero-kinetic.css'
import './error-page.css'
import './mentor-marquee.css'
import './mentor-management.css'
import './admin-mentoring-tables.css'
import './mentor-weekly-controls.css'
import './profile-management.css'
import './calendar-integration.css'
import './calendar-mobile-polish.css'
import './marketing-mobile-product-polish.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://strativate.id'),
  title: { default: 'Strativate', template: '%s | Strativate' },
  description: brandDescription,
  openGraph: { title: 'Strativate', description: brandDescription, locale: 'id_ID', type: 'website' },
}

const poppins = Poppins({ subsets: ['latin'], weight: ['400','500','600','700','800','900'], variable: '--font-poppins' })
export const viewport: Viewport = { colorScheme:'light', themeColor:'#FF7A00' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" className="bg-background" data-scroll-behavior="smooth"><body className={`${poppins.variable} ${poppins.className} antialiased`}><ToastProvider>{children}{process.env.VERCEL && <Analytics />}</ToastProvider></body></html>
}
