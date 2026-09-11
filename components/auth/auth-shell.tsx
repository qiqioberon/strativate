import { Trophy } from 'lucide-react'
import { BrandLogo } from '@/components/brand/brand-logo'
export function AuthShell({ children }: { children: React.ReactNode }) {
  return <main className="auth-page"><div className="auth-card"><a href="/" className="brand" aria-label="Kembali ke beranda"><BrandLogo /></a>{children}<a className="auth-back" href="/">Kembali ke Strativate</a></div><div className="auth-side"><Trophy size={30} /><p>Raih kemenangan.<br /><strong>Melangkah lebih jauh.</strong></p></div></main>
}
