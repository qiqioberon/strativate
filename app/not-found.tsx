import Link from 'next/link'

export default function NotFound() {
  return <main className="page-main">
    <div className="page-intro">
      <p className="kicker">404 · Halaman tidak ditemukan</p>
      <h1>Halaman ini <em>tidak tersedia.</em></h1>
      <p>Periksa kembali alamatnya atau kembali ke beranda Strativate.</p>
    </div>
    <Link href="/" className="button button-primary">Kembali ke beranda</Link>
  </main>
}
