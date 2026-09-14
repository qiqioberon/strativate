import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCommerceCsv, humanOrderTitle, type AdminCommerceOrder } from '../lib/admin/commerce-reporting'

test('humanOrderTitle uses first product and compact remainder', () => {
  assert.equal(humanOrderTitle(['Produk A', 'Produk B', 'Produk C']), 'Produk A +2 item lainnya')
  assert.equal(humanOrderTitle([]), 'Pesanan Strativate')
})

test('CSV export safely escapes quotes, commas, and new lines', () => {
  const order: AdminCommerceOrder = {
    total_count: 1, order_id: 'order-1', user_id: 'user-1', user_email: 'a@example.com', created_at: '2026-09-15T00:00:00Z', paid_at: null,
    order_status: 'paid', total_amount: 1000, item_count: 1, item_summary: 'Guide', payment: null,
    items: [{ id: 'item-1', commerceItemId: 'product-1', kind: 'digital_product', name: 'Guide, "Alpha"\nEdition', quantity: 1, unitPrice: 1000, subtotal: 1000, createdAt: '2026-09-15T00:00:00Z' }],
  }
  const csv = buildCommerceCsv([order], ['orderId', 'product', 'total'])
  assert.match(csv, /^\uFEFF"Order ID","Product","Total"/)
  assert.match(csv, /"Guide, ""Alpha""\nEdition"/)
  assert.match(csv, /"1000"/)
})
