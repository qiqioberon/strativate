import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/brand/brand-logo'
import { SignOut } from '@/components/auth/sign-out'

export function OnboardingShell({ children }: { children: ReactNode }) {
  return <main className="onboarding-shell">
    <div className="onboarding-ambient" aria-hidden="true">
      <span className="onboarding-ambient__glow onboarding-ambient__glow--orange" />
      <span className="onboarding-ambient__glow onboarding-ambient__glow--red" />
      <span className="onboarding-ambient__ring onboarding-ambient__ring--one" />
      <span className="onboarding-ambient__ring onboarding-ambient__ring--two" />
      <span className="onboarding-ambient__line" />
      <span className="onboarding-ambient__mark">S</span>
    </div>
    <header className="onboarding-shell__header">
      <BrandLogo priority />
      <div className="onboarding-shell__exit-wrap"><SignOut className="onboarding-shell__exit" /></div>
    </header>
    <div className="onboarding-shell__main">{children}</div>
  </main>
}
