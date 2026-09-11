'use client'

import {
  ArrowRight,
  CircleHelp,
  Compass,
  House,
  Library,
  LogIn,
  Menu,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { BrandLogo } from '@/components/brand/brand-logo'
import { buttonVariants } from '@/components/ui/button'
import { marketingNavigation, type NavigationIcon } from '@/lib/content/marketing-content'
import { cn } from '@/lib/utils'

const icons = {
  house: House,
  compass: Compass,
  users: Users,
  library: Library,
  sparkles: Sparkles,
  help: CircleHelp,
} satisfies Record<NavigationIcon, typeof House>

function isActiveRoute(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

export function SiteHeader() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  return (
    <header className="marketing-header">
      <div className="marketing-header__inner">
        <Link className="marketing-brand" href="/" aria-label="Beranda Strativate">
          <BrandLogo priority />
        </Link>

        <nav className="marketing-nav" aria-label="Navigasi utama">
          {marketingNavigation.map((item) => {
            const Icon = icons[item.icon]
            const active = isActiveRoute(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('marketing-nav__link', active && 'is-active')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon aria-hidden="true" size={16} strokeWidth={1.9} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="marketing-header__actions">
          <Link className="marketing-login" href="/auth">
            <LogIn aria-hidden="true" size={16} />
            <span>Masuk</span>
          </Link>
          <Link className={cn(buttonVariants({ variant: 'primary', size: 'marketing' }), 'marketing-start')} href="/program">
            Mulai belajar
            <ArrowRight data-icon="arrow" aria-hidden="true" size={16} />
          </Link>
          <button
            type="button"
            className="marketing-menu-button"
            aria-label={mobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            aria-expanded={mobileOpen}
            aria-controls="marketing-mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X aria-hidden="true" size={21} /> : <Menu aria-hidden="true" size={21} />}
          </button>
        </div>
      </div>

      <div className={cn('marketing-mobile-panel', mobileOpen && 'is-open')} id="marketing-mobile-navigation">
        <nav aria-label="Navigasi seluler">
          {marketingNavigation.map((item) => {
            const Icon = icons[item.icon]
            const active = isActiveRoute(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('marketing-mobile-link', active && 'is-active')}
                aria-current={active ? 'page' : undefined}
              >
                <span className="marketing-mobile-link__icon"><Icon aria-hidden="true" size={17} /></span>
                <span>{item.label}</span>
                <ArrowRight className="marketing-mobile-link__arrow" aria-hidden="true" size={15} />
              </Link>
            )
          })}
          <div className="marketing-mobile-panel__actions">
            <Link className={buttonVariants({ variant: 'outline', size: 'marketing' })} href="/auth">
              <LogIn aria-hidden="true" size={16} /> Masuk
            </Link>
            <Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/program">
              Mulai belajar <ArrowRight data-icon="arrow" aria-hidden="true" size={16} />
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}
