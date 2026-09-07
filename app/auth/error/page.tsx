import { AuthShell } from '@/components/auth/auth-shell'
import { SignOut } from '@/components/auth/sign-out'
export default function AuthError() {
  return <AuthShell><div className="auth-heading"><p className="kicker">Tautan sudah tidak berlaku</p><h1>Kita coba <em>lagi.</em></h1><p>Tautan masuk ini mungkin sudah digunakan atau kedaluwarsa. Minta tautan baru, lalu cek kotak masuk dan folder spam. Jika profilmu belum tersedia, hubungi administrator.</p></div><a href="/auth" className="button button-primary">Minta tautan baru</a><SignOut className="auth-back" /></AuthShell>
}
