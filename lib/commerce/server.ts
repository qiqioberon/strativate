import 'server-only'

import { DIGITAL_PRODUCT_IMAGE_BUCKET } from '@/lib/digital-products/config'
import { createClient } from '@/lib/supabase/server'
import type {
  DigitalProduct,
  DigitalProductContentType,
  Order,
  OwnedDigitalProduct,
} from '@/lib/supabase/database.types'
import { summarizeCart } from './model'
import type {
  ActiveCart,
  OrderWithItems,
  OwnedDigitalProductView,
  PublicDigitalProduct,
} from './types'

type OwnedDigitalProductRpcRow = OwnedDigitalProduct & {
  current_content_type: DigitalProductContentType | null
  content_ready: boolean
}

function commerceError(message: string, code?: string) {
  return new Error(code ? `${message} (${code})` : message)
}

export async function listPublicDigitalProducts(): Promise<PublicDigitalProduct[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('digital_products')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .order('id')
  if (error) throw commerceError('Produk Digital belum dapat dimuat.', error.code)
  return (data ?? []).map(product => withPublicCover(supabase, product))
}

export async function getPublicDigitalProduct(slug: string): Promise<PublicDigitalProduct | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('digital_products')
    .select('*')
    .eq('is_published', true)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw commerceError('Produk Digital belum dapat dimuat.', error.code)
  return data ? withPublicCover(supabase, data) : null
}

function withPublicCover(
  supabase: Awaited<ReturnType<typeof createClient>>,
  product: DigitalProduct,
): PublicDigitalProduct {
  return {
    ...product,
    imageUrl: supabase.storage
      .from(DIGITAL_PRODUCT_IMAGE_BUCKET)
      .getPublicUrl(product.image_path).data.publicUrl,
  }
}

export async function getActiveCart(): Promise<ActiveCart> {
  const supabase = await createClient()
  const { data: cart, error: cartError } = await supabase.rpc('get_or_create_active_cart')
  if (cartError || !cart) throw commerceError('Keranjang belum dapat dimuat.', cartError?.code)
  const { data: rows, error: itemError } = await supabase.rpc('get_active_cart')
  if (itemError) throw commerceError('Isi keranjang belum dapat dimuat.', itemError.code)
  return summarizeCart(cart.id, rows ?? [], path => supabase.storage
    .from(DIGITAL_PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(path).data.publicUrl)
}

export async function createOrderFromCart(cartId: string): Promise<OrderWithItems> {
  const supabase = await createClient()
  const { data: order, error } = await supabase.rpc('create_order_from_cart', { p_cart_id: cartId })
  if (error || !order) throw commerceError('Pesanan belum dapat dibuat.', error?.code)
  return getOrderWithItems(order.id, order)
}

export async function getOrderWithItems(
  orderId: string,
  knownOrder?: Order,
): Promise<OrderWithItems> {
  const supabase = await createClient()
  let order = knownOrder
  if (!order) {
    const result = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
    if (result.error) throw commerceError('Pesanan belum dapat dimuat.', result.error.code)
    order = result.data ?? undefined
  }
  if (!order) throw commerceError('Pesanan tidak ditemukan.')
  const { data: items, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', order.id)
    .order('created_at')
    .order('id')
  if (error) throw commerceError('Rincian pesanan belum dapat dimuat.', error.code)
  return { ...order, items: items ?? [] }
}

export async function listUserOrders(): Promise<OrderWithItems[]> {
  const supabase = await createClient()
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (orderError) throw commerceError('Riwayat pesanan belum dapat dimuat.', orderError.code)
  if (!orders?.length) return []

  const { data: items, error: itemError } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', orders.map(order => order.id))
    .order('created_at')
    .order('id')
  if (itemError) throw commerceError('Rincian riwayat pesanan belum dapat dimuat.', itemError.code)

  const itemsByOrder = new Map<string, NonNullable<typeof items>>()
  for (const item of items ?? []) {
    const current = itemsByOrder.get(item.order_id) ?? []
    current.push(item)
    itemsByOrder.set(item.order_id, current)
  }
  return orders.map(order => ({ ...order, items: itemsByOrder.get(order.id) ?? [] }))
}

export async function listOwnedDigitalProducts(): Promise<OwnedDigitalProductView[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_owned_digital_products')
  if (error) throw commerceError('Produk Digital yang dimiliki belum dapat dimuat.', error.code)
  const rows = (data ?? []) as OwnedDigitalProductRpcRow[]
  return rows.map(product => ({
    ...product,
    product_id: product.commerce_item_id,
    contentType: product.current_content_type,
    contentReady: product.content_ready,
    imageUrl: product.current_image_path
      ? supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).getPublicUrl(product.current_image_path).data.publicUrl
      : null,
  }))
}

export async function getOwnedDigitalProduct(productId: string) {
  const products = await listOwnedDigitalProducts()
  return products.find(product => product.product_id === productId) ?? null
}
