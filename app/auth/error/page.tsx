import { AuthShell } from '@/components/auth/auth-shell'
import { SignOut } from '@/components/auth/sign-out'
export default function AuthError() {
  return <AuthShell><div className="auth-heading"><p className="kicker">Tautan tidak berlaku</p><h1>Coba <em>kembali.</em></h1><p>Tautan masuk mungkin sudah dipakai atau kedaluwarsa. Minta tautan baru atau masuk kembali. Jika profil belum tersedia, hubungi administrator.</p></div><a href="/auth" className="button button-primary">Kembali ke halaman masuk</a><SignOut className="auth-back" /></AuthShell>
}
