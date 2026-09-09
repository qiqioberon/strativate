import Link from 'next/link'
import type { CatalogProductSummary } from '@/lib/catalog/types'
import { getProgramEditorial } from '@/lib/program-information'

export function ProgramComparison({ products }: { products: CatalogProductSummary[] }) {
  const mentoringProducts = products.filter((product) =>
    product.productType === 'private_mentoring' || product.productType === 'intensive_mentoring',
  )
  if (!mentoringProducts.length) return null

  return <section className="program-section" aria-labelledby="compare-programs">
    <div className="program-section-heading"><p className="kicker">Bandingkan pilihanmu</p><h2 id="compare-programs">Butuh sesi terarah atau pendampingan rutin?</h2><p>Pilih ritme yang paling sesuai dengan targetmu.</p></div>
    <div className="program-comparison-grid">{mentoringProducts.map((product) => {
      const editorial = getProgramEditorial(product.code)
      return <article className="program-info-card" key={product.id}>
        <p className="kicker">{product.productType === 'private_mentoring' ? 'Fleksibel sesuai kebutuhan' : 'Pendampingan berkelanjutan'}</p>
        <h3>{product.title}</h3><p>{product.shortDescription}</p>
        {editorial && <ul>{editorial.highlights.map((item) => <li key={item}>{item}</li>)}</ul>}
        <Link className="catalog-card-link" href={`/program/${product.slug}`}>Jelajahi {product.title}</Link>
      </article>
    })}</div>
  </section>
}
