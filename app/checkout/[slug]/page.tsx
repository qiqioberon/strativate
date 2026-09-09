import { notFound, permanentRedirect } from 'next/navigation'
import { LegacyCheckout } from '@/components/checkout/legacy-checkout'
import { toLegacyCheckoutItem } from '@/lib/catalog/compatibility'
import { getPublicCatalogProduct } from '@/lib/catalog/public'
import { resolveMentoringSlug } from '@/lib/program-routes'

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ item?: string }>
}) {
  const { slug } = await params
  const mentoringSlug = resolveMentoringSlug(slug)
  if (mentoringSlug) permanentRedirect(`/program/${mentoringSlug}`)

  const product = await getPublicCatalogProduct(slug)
  if (!product) notFound()
  if (product.defaultPurchaseFlow !== 'direct_checkout') permanentRedirect(`/program/${product.slug}`)

  const requestedId = (await searchParams).item
  const offeringId = requestedId ?? (product.offerings.length === 1 ? product.offerings[0].id : undefined)
  if (!offeringId) notFound()
  const item = toLegacyCheckoutItem(product, offeringId)
  if (!item) notFound()
  return <LegacyCheckout item={item} />
}
