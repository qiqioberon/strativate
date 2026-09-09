import { AuthShell } from '@/components/auth/auth-shell'
import { SignOut } from '@/components/auth/sign-out'
export default function AuthError() {
  return <AuthShell><div className="auth-heading"><p className="kicker">Tautan sudah tidak berlaku</p><h1>Coba <em>lagi.</em></h1><p>Tautan masuk ini mungkin sudah digunakan atau kedaluwarsa. Kembali ke halaman masuk untuk meminta tautan baru, lalu cek kotak masuk dan folder spam.</p></div><a href="/auth" className="button button-primary">Kembali ke halaman masuk</a><SignOut className="auth-back" /></AuthShell>
}
