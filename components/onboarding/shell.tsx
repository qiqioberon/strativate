import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/brand/brand-logo'
import { SignOut } from '@/components/auth/sign-out'

export function OnboardingShell({ children }: { children: ReactNode }) {
  return <main className="onboarding-shell">
    <div className="onboarding-shell__ambient" aria-hidden="true">
      <span className="onboarding-shell__orb onboarding-shell__orb--one" />
      <span className="onboarding-shell__orb onboarding-shell__orb--two" />
      <span className="onboarding-shell__line" />
    </div>

    <header className="onboarding-shell__header">
      <BrandLogo priority />
      <div className="onboarding-shell__exit-wrap"><SignOut className="onboarding-shell__exit" withIcon /></div>
    </header>

    <div className="onboarding-shell__layout">
      <section className="onboarding-shell__content">
        {children}
      </section>

      <aside className="onboarding-shell__aside" aria-label="Panduan awal Strativate">
        <BrandLogo variant="mark" className="onboarding-shell__mark" />
        <div>
          <p className="kicker">Mulai dengan tenang</p>
          <h2>Satu langkah pada satu waktu.</h2>
          <p>Data yang kamu isi membantu Strativate menyiapkan pengalaman yang lebih relevan tanpa membuat proses pendaftaran terasa panjang.</p>
        </div>
        <div className="onboarding-shell__aside-points" aria-hidden="true">
          <span>Profil</span>
          <span>Institusi</span>
          <span>Minat</span>
        </div>
      </aside>
    </div>
  </main>
}
