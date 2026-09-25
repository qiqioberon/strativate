'use client'

import {
  ArrowRight,
  CircleHelp,
  Compass,
  House,
  LayoutDashboard,
  Library,
  LogIn,
  Menu,
  Newspaper,
  ShoppingCart,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { BrandLogo } from '@/components/brand/brand-logo'
import { CartEntryLink } from '@/components/commerce/cart-entry-link'
import { buttonVariants } from '@/components/ui/button'
import type {
  MarketingNavigationItem,
  NavigationIcon,
} from '@/lib/content/marketing-content'
import { cn } from '@/lib/utils'

const icons = {
  house: House,
  compass: Compass,
  users: Users,
  library: Library,
  sparkles: Sparkles,
  help: CircleHelp,
  newspaper: Newspaper,
  trophy: Trophy,
} satisfies Record<NavigationIcon, typeof House>

function isActiveRoute(pathname: string, href: string) {
  return href === '/'
    ? pathname === '/'
    : pathname === href || pathname.startsWith(`${href}/`)
}

export function SiteHeader({
  navigation,
  showCart = false,
  accountHref = null,
}: {
  navigation: readonly MarketingNavigationItem[]
  showCart?: boolean
  accountHref?: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const authenticated = Boolean(accountHref)

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

  useEffect(() => {
    const hrefs = Array.from(new Set([
      ...navigation.map((item) => item.href),
      ...(accountHref ? [accountHref] : []),
      '/auth',
    ]))

    hrefs.forEach((href) => router.prefetch(href))
  }, [accountHref, navigation, router])

  return (
    <header className="marketing-header">
      <div className="marketing-header__inner">
        <Link
          className="marketing-brand"
          href="/"
          prefetch={true}
          aria-label="Strativate home"
        >
          <BrandLogo priority />
        </Link>

        <nav className="marketing-nav" aria-label="Main navigation">
          {navigation.map((item) => {
            const Icon = icons[item.icon]
            const active = isActiveRoute(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={cn('marketing-nav__link', active && 'is-active')}
                aria-current={active ? 'page' : undefined}
                data-testid={`desktop-nav-${item.icon}-link`}
              >
                <Icon aria-hidden="true" size={16} strokeWidth={1.9} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="marketing-header__actions">
          <CartEntryLink showCart={showCart} />
          {authenticated && accountHref ? (
            <Link
              className={cn(
                buttonVariants({ variant: 'primary', size: 'marketing' }),
                'marketing-dashboard-link',
              )}
              href={accountHref}
              prefetch={true}
              data-testid="desktop-dashboard-link"
            >
              <LayoutDashboard aria-hidden="true" size={16} />
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'marketing' }),
                  'marketing-login',
                )}
                href="/auth"
                prefetch={true}
                data-testid="desktop-login-link"
              >
                <LogIn aria-hidden="true" size={16} />
                <span>Sign in</span>
              </Link>
              <Link
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'marketing' }),
                  'marketing-start',
                )}
                href="/auth"
                prefetch={true}
                data-testid="desktop-start-learning-link"
              >
                Start learning
                <ArrowRight data-icon="arrow" aria-hidden="true" size={16} />
              </Link>
            </>
          )}
          <button
            type="button"
            className="marketing-menu-button"
            aria-label={
              mobileOpen ? 'Close navigation menu' : 'Open navigation menu'
            }
            aria-expanded={mobileOpen}
            aria-controls="marketing-mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
            data-testid="mobile-menu-toggle-button"
          >
            {mobileOpen ? (
              <X aria-hidden="true" size={21} />
            ) : (
              <Menu aria-hidden="true" size={21} />
            )}
          </button>
        </div>
      </div>

      <div
        className={cn('marketing-mobile-panel', mobileOpen && 'is-open')}
        id="marketing-mobile-navigation"
      >
        <nav aria-label="Mobile navigation">
          {navigation.map((item) => {
            const Icon = icons[item.icon]
            const active = isActiveRoute(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={cn('marketing-mobile-link', active && 'is-active')}
                aria-current={active ? 'page' : undefined}
                data-testid={`mobile-nav-${item.icon}-link`}
              >
                <span className="marketing-mobile-link__icon">
                  <Icon aria-hidden="true" size={17} />
                </span>
                <span>{item.label}</span>
                <ArrowRight
                  className="marketing-mobile-link__arrow"
                  aria-hidden="true"
                  size={15}
                />
              </Link>
            )
          })}
          {showCart ? (
            <Link
              className="marketing-mobile-link marketing-mobile-cart-link"
              href="/cart"
              prefetch={true}
              data-testid="mobile-cart-link"
            >
              <span className="marketing-mobile-link__icon">
                <ShoppingCart aria-hidden="true" size={17} />
              </span>
              <span>Cart</span>
              <ArrowRight
                className="marketing-mobile-link__arrow"
                aria-hidden="true"
                size={15}
              />
            </Link>
          ) : null}
          <div className="marketing-mobile-panel__actions">
            {authenticated && accountHref ? (
              <Link
                className={buttonVariants({
                  variant: 'primary',
                  size: 'marketing',
                })}
                href={accountHref}
                prefetch={true}
                data-testid="mobile-dashboard-link"
              >
                <LayoutDashboard aria-hidden="true" size={16} /> Dashboard
              </Link>
            ) : (
              <>
                <Link
                  className={buttonVariants({
                    variant: 'outline',
                    size: 'marketing',
                  })}
                  href="/auth"
                  prefetch={true}
                  data-testid="mobile-login-link"
                >
                  <LogIn aria-hidden="true" size={16} /> Sign in
                </Link>
                <Link
                  className={buttonVariants({
                    variant: 'primary',
                    size: 'marketing',
                  })}
                  href="/auth"
                  prefetch={true}
                  data-testid="mobile-start-learning-link"
                >
                  Start learning{' '}
                  <ArrowRight data-icon="arrow" aria-hidden="true" size={16} />
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
