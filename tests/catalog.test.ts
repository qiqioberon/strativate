import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assembleCatalogDetail,
  assembleCatalogSummary,
  assembleCommercialItem,
  sortCatalogProducts,
  type CatalogAssemblyRows,
} from '../lib/catalog/assemble'
import { formatRupiah } from '../lib/catalog/format'
import { filterCatalogProducts } from '../lib/catalog/admin'
import { toLegacyCheckoutItem } from '../lib/catalog/compatibility'
import {
  catalogPriceLabel,
  directCheckoutOfferings,
  selectDigitalProducts,
  selectHomepagePrograms,
  selectProgramDirectory,
} from '../lib/catalog/presentation'
import { getPublicCatalogProductFrom, listPublicCatalogFrom, type CatalogPublicDataSource } from '../lib/catalog/public-data'
import { createPendingOrder } from '../lib/demo-store'

const privateProduct = {
  id: 'product-private', code: 'private_mentoring', slug: 'private-mentoring',
  product_type: 'private_mentoring' as const, default_purchase_flow: 'consultation_offer' as const,
  title: 'Mentoring Privat', short_description: 'Bimbingan fleksibel', description: null,
  is_featured: true, sort_order: 10, created_at: '2026-09-09', updated_at: '2026-09-09',
}
const fixedItem = {
  id: 'offering-private-three', product_id: privateProduct.id, code: 'top_student_3',
  kind: 'offering' as const, title: 'Mentor Mahasiswa Berprestasi · 3 sesi', description: null,
  pricing_mode: 'fixed' as const, price_amount: 885000, reference_price_amount: 950000,
  currency_code: 'IDR', is_sellable: true, sort_order: 20,
}
const quotationItem = {
  ...fixedItem, id: 'offering-international', product_id: 'product-intensive', code: 'international_custom',
  title: 'Kompetisi Internasional', pricing_mode: 'quotation_required' as const,
  price_amount: null, reference_price_amount: null,
}

test('admin catalog filter matches title/code and lifecycle/type together', () => {
  const products = [
    { ...privateProduct, status: 'published' as const },
    { ...privateProduct, id: 'digital-draft', code: 'digital_handbook', title: 'Panduan Digital', product_type: 'digital_product' as const, status: 'draft' as const },
  ]
  assert.deepEqual(filterCatalogProducts(products, { query: 'digital', productType: 'digital_product', status: 'draft' }).map((product) => product.id), ['digital-draft'])
  assert.deepEqual(filterCatalogProducts(products, { query: 'private_mentoring', productType: 'all', status: 'published' }).map((product) => product.id), [privateProduct.id])
})

test('formats printed guidebook amounts without recomputing them', () => {
  assert.equal(formatRupiah(885000), 'Rp885.000')
  assert.equal(formatRupiah(1150000), 'Rp1.150.000')
})

test('commercial item pricing is discriminated and quotation has no numeric price', () => {
  const fixed = assembleCommercialItem(fixedItem)
  assert.equal(fixed.pricingMode, 'fixed')
  assert.equal(fixed.priceAmount, 885000)
  const quotation = assembleCommercialItem(quotationItem)
  assert.equal(quotation.pricingMode, 'quotation_required')
  assert.equal('priceAmount' in quotation, false)
})

test('private offering keeps stable commercial identity and independent per-session price', () => {
  const rows: CatalogAssemblyRows = {
    items: [fixedItem],
    privateOfferings: [{
      id: fixedItem.id, product_id: privateProduct.id,
      mentor_tier_id: 'tier-top', mentor_tier_code: 'top_student', mentor_tier_label: 'Mentor Mahasiswa Berprestasi',
      session_package_id: 'package-three', session_package_code: 'sessions_3', session_package_label: '3 sesi',
      session_count: 3, per_session_price_amount: 285000,
      session_duration_minutes: 75, min_participants: 1, max_participants: 4,
    }],
    intensiveOfferings: [], deliveryOptions: [], itemBenefits: [],
    addOnApplicability: [], bundleComponents: [], digitalDetails: [],
    addOns: [], bundles: [],
  }
  const detail = assembleCatalogDetail(privateProduct, rows)
  assert.equal(detail.offerings[0].id, 'offering-private-three')
  assert.equal(detail.privateOfferings[0].perSessionPriceAmount, 285000)
  assert.equal(detail.privateOfferings[0].priceAmount, 885000)
  assert.deepEqual(detail.privateDetails, { sessionDurationMinutes: 75, minParticipants: 1, maxParticipants: 4 })
})

test('bundle composition remains typed relationships rather than description parsing', () => {
  const intensiveProduct = { ...privateProduct, id: 'product-intensive', code: 'intensive_mentoring', slug: 'intensive-mentoring', product_type: 'intensive_mentoring' as const }
  const bundle = { ...fixedItem, id: 'bundle-assurance', product_id: intensiveProduct.id, code: 'competition_assurance_bundle', kind: 'bundle' as const, title: 'Paket Jaminan Kompetisi', price_amount: 3000000, reference_price_amount: null }
  const rows: CatalogAssemblyRows = {
    items: [quotationItem, bundle], privateOfferings: [],
    intensiveOfferings: [{ id: quotationItem.id, product_id: intensiveProduct.id, scope: 'international_custom', sessions_per_month: null }],
    deliveryOptions: [], itemBenefits: [], addOnApplicability: [],
    bundleComponents: [
      { product_id: intensiveProduct.id, bundle_id: bundle.id, bundle_code: bundle.code, component_kind: 'offering', component_id: 'super-id', component_code: 'super_intensive_national', component_title: 'Super Intensif', quantity: 1 },
      { product_id: intensiveProduct.id, bundle_id: bundle.id, bundle_code: bundle.code, component_kind: 'add_on', component_id: 'guarantee-id', component_code: 'win_guarantee_protection', component_title: 'Perlindungan Jaminan Kemenangan', quantity: 1 },
    ],
    digitalDetails: [], addOns: [],
    bundles: [{ id: bundle.id, product_id: intensiveProduct.id, kind: 'bundle', is_conditional: true, public_condition_summary: 'Syarat dan kelayakan berlaku.' }],
  }
  const detail = assembleCatalogDetail(intensiveProduct, rows)
  assert.equal(detail.bundles[0].id, 'bundle-assurance')
  assert.deepEqual(detail.bundles[0].components.map(component => component.kind), ['offering', 'add_on'])
  assert.equal(detail.intensiveOfferings[0].pricingMode, 'quotation_required')
})

test('catalog summaries sort quotation after fixed prices without treating it as zero', () => {
  const fixedSummary = assembleCatalogSummary(privateProduct, [fixedItem])
  const quoteProduct = { ...privateProduct, id: 'quote-product', code: 'quote', slug: 'quote', title: 'Konsultasi' }
  const quoteSummary = assembleCatalogSummary(quoteProduct, [{ ...quotationItem, product_id: quoteProduct.id }])
  assert.deepEqual(sortCatalogProducts([quoteSummary, fixedSummary], 'price_asc').map(product => product.id), [privateProduct.id, quoteProduct.id])
})

test('starting price comes from a base offering, not a cheaper add-on', () => {
  const summary = assembleCatalogSummary(privateProduct, [
    fixedItem,
    { ...fixedItem, id: 'addon-cheap', code: 'addon', kind: 'add_on', price_amount: 150000 },
  ])
  assert.equal(summary.startingPriceAmount, 885000)
})

test('legacy checkout compatibility accepts only a fixed sellable offering UUID', () => {
  const detail = assembleCatalogDetail(privateProduct, {
    items: [fixedItem], privateOfferings: [], intensiveOfferings: [], deliveryOptions: [],
    itemBenefits: [], addOnApplicability: [], bundleComponents: [], digitalDetails: [], addOns: [], bundles: [],
  })
  assert.deepEqual(toLegacyCheckoutItem(detail, fixedItem.id), {
    productId: privateProduct.id,
    commercialItemId: fixedItem.id,
    slug: privateProduct.slug,
    title: privateProduct.title,
    productType: privateProduct.product_type,
    priceAmount: 885000,
    priceLabel: 'Rp885.000',
  })
  const quoteDetail = assembleCatalogDetail({ ...privateProduct, id: 'product-intensive', product_type: 'intensive_mentoring' }, {
    items: [quotationItem], privateOfferings: [], intensiveOfferings: [], deliveryOptions: [],
    itemBenefits: [], addOnApplicability: [], bundleComponents: [], digitalDetails: [], addOns: [], bundles: [],
  })
  assert.equal(toLegacyCheckoutItem(quoteDetail, quotationItem.id), null)
})

test('simulated checkout keeps product and commercial identities distinct', () => {
  const pending = createPendingOrder({
    type: 'Digital Product', title: 'Panduan', productId: 'product-digital', commercialItemId: 'offering-digital',
    subject: 'Panduan', price: 'Rp99.000', amount: 99000, sessions: 0,
  })
  assert.equal(pending.productId, 'product-digital')
  assert.equal(pending.commercialItemId, 'offering-digital')
})

test('public query boundary returns honest empty states and propagates failures', async () => {
  const emptySource: CatalogPublicDataSource = {
    products: async () => [], items: async () => [], privateOfferings: async () => [],
    intensiveOfferings: async () => [], deliveryOptions: async () => [], itemBenefits: async () => [],
    addOnApplicability: async () => [], bundleComponents: async () => [], digitalDetails: async () => [],
    addOns: async () => [], bundles: async () => [],
  }
  assert.deepEqual(await listPublicCatalogFrom(emptySource), [])
  assert.equal(await getPublicCatalogProductFrom(emptySource, 'tidak-ada'), null)

  const brokenSource: CatalogPublicDataSource = { ...emptySource, products: async () => { throw new Error('database unavailable') } }
  await assert.rejects(() => listPublicCatalogFrom(brokenSource), /database unavailable/)
})

test('public query boundary assembles only the requested product from stable rows', async () => {
  const source: CatalogPublicDataSource = {
    products: async () => [privateProduct], items: async () => [fixedItem], privateOfferings: async () => [],
    intensiveOfferings: async () => [], deliveryOptions: async () => [], itemBenefits: async () => [],
    addOnApplicability: async () => [], bundleComponents: async () => [], digitalDetails: async () => [],
    addOns: async () => [], bundles: async () => [],
  }
  const list = await listPublicCatalogFrom(source)
  assert.deepEqual(list.map((product) => product.id), [privateProduct.id])
  const detail = await getPublicCatalogProductFrom(source, privateProduct.slug)
  assert.equal(detail?.commercialItems[0].id, fixedItem.id)
})

test('catalog presentation labels fixed, quotation, and empty offerings without inventing prices', () => {
  const fixed = assembleCatalogSummary(privateProduct, [fixedItem])
  const quotationProduct = {
    ...privateProduct,
    id: 'product-quotation',
    code: 'quotation',
    slug: 'quotation',
  }
  const quotation = assembleCatalogSummary(quotationProduct, [{ ...quotationItem, product_id: quotationProduct.id }])
  const empty = assembleCatalogSummary({
    ...privateProduct,
    id: 'product-empty',
    code: 'empty',
    slug: 'empty',
  }, [])

  assert.equal(catalogPriceLabel(fixed), 'Mulai Rp885.000')
  assert.equal(catalogPriceLabel(quotation), 'Sesuai konsultasi')
  assert.equal(catalogPriceLabel(empty), 'Segera hadir')
})

test('marketing selectors preserve Product Master order, featured state, and product type', () => {
  const products = [
    { ...assembleCatalogSummary(privateProduct, [fixedItem]), id: 'private', sortOrder: 20 },
    { ...assembleCatalogSummary({ ...privateProduct, id: 'intensive', product_type: 'intensive_mentoring' as const }, []), id: 'intensive', sortOrder: 30 },
    { ...assembleCatalogSummary({ ...privateProduct, id: 'big', product_type: 'big_class' as const }, []), id: 'big', sortOrder: 40 },
    { ...assembleCatalogSummary({ ...privateProduct, id: 'digital', product_type: 'digital_product' as const }, []), id: 'digital', sortOrder: 10 },
    { ...assembleCatalogSummary({ ...privateProduct, id: 'not-featured' }, []), id: 'not-featured', isFeatured: false, sortOrder: 5 },
  ]

  assert.deepEqual(selectProgramDirectory(products).map(product => product.id), ['not-featured', 'private', 'intensive', 'big'])
  assert.deepEqual(selectDigitalProducts(products).map(product => product.id), ['digital'])
  assert.deepEqual(selectHomepagePrograms(products).map(product => product.id), ['private', 'intensive', 'big'])
})

test('direct checkout accepts only fixed sellable offerings on direct-checkout products', () => {
  const digitalProduct = {
    ...privateProduct,
    id: 'product-digital',
    code: 'digital',
    slug: 'digital',
    product_type: 'digital_product' as const,
    default_purchase_flow: 'direct_checkout' as const,
  }
  const digitalFixed = { ...fixedItem, id: 'digital-fixed', product_id: digitalProduct.id }
  const digitalQuote = { ...quotationItem, id: 'digital-quote', product_id: digitalProduct.id }
  const digitalHidden = { ...fixedItem, id: 'digital-hidden', product_id: digitalProduct.id, is_sellable: false }
  const rows: CatalogAssemblyRows = {
    items: [digitalFixed, digitalQuote, digitalHidden],
    privateOfferings: [], intensiveOfferings: [], deliveryOptions: [], itemBenefits: [],
    addOnApplicability: [], bundleComponents: [], digitalDetails: [], addOns: [], bundles: [],
  }
  const directDetail = assembleCatalogDetail(digitalProduct, rows)
  const consultationDetail = assembleCatalogDetail({ ...digitalProduct, default_purchase_flow: 'consultation_offer' }, rows)

  assert.deepEqual(directCheckoutOfferings(directDetail).map(item => item.id), ['digital-fixed'])
  assert.deepEqual(directCheckoutOfferings(consultationDetail), [])
})
