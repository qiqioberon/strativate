import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { DM_Sans, IBM_Plex_Mono, Outfit } from 'next/font/google'

import { brandDescription } from '@/lib/content/brand'

import './globals.css'
import './auth/auth.css'
import './program-information.css'
import './marketing.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://strativate.id'),
  title: { default: 'Strativate', template: '%s | Strativate' },
  description: brandDescription,
  openGraph: { title: 'Strativate', description: brandDescription, locale: 'id_ID', type: 'website' },
}

const bodyFont = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })
const headingFont = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-ibm-plex' })

export const viewport: Viewport = { colorScheme: 'light', themeColor: '#FF7A00' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className="bg-background" data-scroll-behavior="smooth">
      <body className={`${bodyFont.variable} ${headingFont.variable} ${monoFont.variable} ${bodyFont.className} antialiased`}>
        {children}
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  )
}
