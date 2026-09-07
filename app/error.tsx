'use client'
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="auth-card"><div className="auth-heading"><h1>Halaman belum dapat <em>dibuka.</em></h1><p>Periksa koneksi internetmu dan coba lagi. Jika masalah berlanjut, hubungi administrator.</p></div><button className="button button-primary" onClick={reset}>Coba lagi</button><a className="auth-back" href="/auth">Kembali ke halaman masuk</a></main>
}
