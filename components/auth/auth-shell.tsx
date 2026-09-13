import { ArrowLeft, Trophy } from 'lucide-react'
import { BrandLogo } from '@/components/brand/brand-logo'

export function AuthShell({ children }: { children: React.ReactNode }) {
  return <main className="auth-page">
    <div className="auth-card">
      <div className="auth-brand"><BrandLogo /></div>
      <a className="auth-back" href="/" aria-label="Kembali ke beranda" data-testid="auth-back-link"><ArrowLeft className="auth-back__icon" aria-hidden="true" size={18} />Kembali ke Strativate</a>
      {children}
    </div>
    <aside className="auth-side" aria-label="Strativate">
      <div className="auth-side__grid" aria-hidden="true" data-testid="auth-visual-grid"><span /><span /><span /><i /><i /></div>
      <div className="auth-side__content">
        <BrandLogo variant="mark" className="auth-side__mark" priority />
        <div className="auth-side__badge"><Trophy aria-hidden="true" size={24} /></div>
        <p>Raih kemenangan.<br /><strong>Melangkah lebih jauh.</strong></p>
      </div>
    </aside>
  </main>
}
