import { ArrowUpRight, Compass, HelpCircle, Library, Sparkles, Users } from 'lucide-react'
import Link from 'next/link'

import { BrandLogo } from '@/components/brand/brand-logo'
import { publicContact } from '@/lib/content/brand'

const footerLinks = [
  { label: 'Program', href: '/program', icon: Compass },
  { label: 'Mentor', href: '/mentor', icon: Users },
  { label: 'Produk Digital', href: '/produk-digital', icon: Library },
  { label: 'Tentang Kami', href: '/tentang-kami', icon: Sparkles },
  { label: 'Tanya Jawab', href: '/tanya-jawab', icon: HelpCircle },
]

export function SiteFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-container marketing-footer__grid">
        <div className="marketing-footer__lead">
          <Link className="marketing-brand marketing-footer__brand" href="/" aria-label="Beranda Strativate">
            <BrandLogo />
          </Link>
          <p>Persiapan kompetisi yang terasa lebih terarah, dari langkah pertama sampai evaluasi berikutnya.</p>
        </div>

        <div className="marketing-footer__links" aria-label="Tautan situs">
          {footerLinks.map(({ label, href, icon: Icon }) => (
            <Link href={href} key={href}>
              <Icon aria-hidden="true" size={15} />
              <span>{label}</span>
              <ArrowUpRight aria-hidden="true" size={14} />
            </Link>
          ))}
        </div>

        <div className="marketing-footer__note">
          <span className="marketing-kicker">Strativate</span>
          <strong>Raih kemenangan.<br />Melangkah lebih jauh.</strong>
          <div className="marketing-footer__contact">
            <a href={publicContact.whatsapp}>{publicContact.phone}</a>
            <a href={publicContact.emailHref}>{publicContact.email}</a>
            <a href={publicContact.instagram} target="_blank" rel="noreferrer">@strativate.id</a>
          </div>
        </div>
      </div>
      <div className="marketing-container marketing-footer__bottom">
        <span>© {new Date().getFullYear()} Strativate</span>
        <span>Konten publik mengikuti sumber yang telah disetujui.</span>
      </div>
    </footer>
  )
}
