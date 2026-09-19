'use client'

import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/brand/brand-logo'
import { SignOut } from '@/components/auth/sign-out'
import { OnboardingMotionProvider, useOnboardingMotion } from './motion'

function OnboardingShellFrame({ children }: { children: ReactNode }) {
  const { scene, routePhase, finalMessage } = useOnboardingMotion()
  return <main className="onboarding-shell" data-scene={scene} data-route-phase={routePhase}>
    <div className="onboarding-ambient" aria-hidden="true" data-testid="onboarding-ambient">
      <span className="onboarding-ambient__glow onboarding-ambient__glow--orange"><span /></span>
      <span className="onboarding-ambient__glow onboarding-ambient__glow--red"><span /></span>
      <span className="onboarding-ambient__ring onboarding-ambient__ring--one"><span /></span>
      <span className="onboarding-ambient__ring onboarding-ambient__ring--two"><span /></span>
      <span className="onboarding-ambient__line"><span /></span>
      <span className="onboarding-ambient__brand"><BrandLogo variant="mark" /></span>
    </div>
    <header className="onboarding-shell__header">
      <BrandLogo priority />
      <div className="onboarding-shell__exit-wrap"><SignOut className="onboarding-shell__exit" /></div>
    </header>
    <div className="onboarding-shell__main">{children}</div>
    {routePhase === 'final-exit' && <div className="onboarding-final-handoff" role="status" aria-live="polite">
      <BrandLogo variant="mark" />
      <p>{finalMessage || 'Semua siap.'}</p>
    </div>}
  </main>
}

export function OnboardingShell({ children }: { children: ReactNode }) {
  return <OnboardingMotionProvider><OnboardingShellFrame>{children}</OnboardingShellFrame></OnboardingMotionProvider>
}
