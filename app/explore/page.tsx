import { CatalogBrowser } from '@/components/catalog/catalog-browser'
import { ProgramComparison } from '@/components/programs/program-comparison'
import { listPublicCatalog } from '@/lib/catalog/public'

export default async function ExplorePage() {
  const products = await listPublicCatalog()
  return <main className="catalog-page">
    <header className="catalog-hero"><div><p className="kicker">STRATIVATE / PILIH PROGRAM</p><h1>Temukan dukungan<br /><em>untuk targetmu.</em></h1><p className="catalog-lede">Bandingkan mentoring, kelas, dan materi belajar yang membantumu menyusun strategi, melatih ide, dan tampil lebih siap.</p></div><div className="catalog-hero-note"><span>{String(products.length).padStart(2, '0')}</span><p>program yang<br />tersedia saat ini</p></div></header>
    <CatalogBrowser products={products} />
    <ProgramComparison products={products} />
  </main>
}
