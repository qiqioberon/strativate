export default async function ProductDetailFixture({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <main><h1>Detail Produk</h1><p data-testid="fixture-product-slug">{slug}</p></main>
}
