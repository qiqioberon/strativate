import { ArrowUpRight, Compass, HelpCircle, Newspaper, Sparkles, Trophy, Users } from 'lucide-react'
import Link from 'next/link'

import { BrandLogo } from '@/components/brand/brand-logo'
import { publicContact } from '@/lib/content/brand'

const footerLinks = [
  { label: 'Programs', href: '/program', icon: Compass },
  { label: 'Mentors', href: '/mentor', icon: Users },
  { label: 'Publications', href: '/publications', icon: Newspaper },
  { label: 'Competitions', href: '/competitions', icon: Trophy },
  { label: 'About Us', href: '/tentang-kami', icon: Sparkles },
  { label: 'FAQ', href: '/tanya-jawab', icon: HelpCircle },
]

export function SiteFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-container marketing-footer__grid">
        <div className="marketing-footer__lead">
          <Link className="marketing-brand marketing-footer__brand" href="/" aria-label="Strativate home">
            <BrandLogo />
          </Link>
          <p>Build practical skills, sharpen your strategy, and prepare for what comes next.</p>
        </div>

        <div className="marketing-footer__links" aria-label="Site links">
          {footerLinks.map(({ label, href, icon: Icon }) => (
            <Link href={href} key={href} data-testid={`footer-${href.slice(1) || 'home'}-link`}>
              <Icon aria-hidden="true" size={15} />
              <span>{label}</span>
              <ArrowUpRight aria-hidden="true" size={14} />
            </Link>
          ))}
        </div>

        <div className="marketing-footer__note">
          <span className="marketing-kicker">Strativate</span>
          <strong>Prepare with purpose.<br />Move with confidence.</strong>
          <div className="marketing-footer__contact">
            <a href={publicContact.whatsapp} data-testid="footer-whatsapp-link">{publicContact.phone}</a>
            <a href={publicContact.emailHref} data-testid="footer-email-link">{publicContact.email}</a>
            <a href={publicContact.instagram} target="_blank" rel="noreferrer" data-testid="footer-instagram-link">@strativate.id</a>
          </div>
        </div>
      </div>
      <div className="marketing-container marketing-footer__bottom">
        <span>© {new Date().getFullYear()} Strativate</span>
        <span>Public content follows approved source material.</span>
      </div>
    </footer>
  )
}
