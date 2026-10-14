import { createClient } from '@/lib/supabase/server'
import { receiptFilename } from '@/lib/commerce/payment-receipt'
import { generatePaymentReceipt } from '@/lib/commerce/payment-receipt-pdf'

export const runtime = 'nodejs'
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie' }

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const client = await createClient()
    const { data: { user }, error: authError } = await client.auth.getUser()
    if (authError || !user) return Response.json({ error: 'Please sign in to access your receipt.' }, { status: 401, headers: PRIVATE_HEADERS })
    const { id } = await params
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
      return Response.json({ error: 'Order unavailable.' }, { status: 404, headers: PRIVATE_HEADERS })
    }
    const download = new URL(request.url).searchParams.get('download')
    if (download !== null && download !== '1') return Response.json({ error: 'Invalid receipt request.' }, { status: 400, headers: PRIVATE_HEADERS })
    const { data, error } = await client.rpc('get_payment_receipt', { p_order_id: id })
    if (error || !data) {
      const status = error?.code === '22023' ? 409 : error?.code === 'P0002' || error?.code === '42501' ? 404 : 500
      return Response.json({ error: status === 409 ? 'Receipts are available only for paid orders.' : status === 404 ? 'Order unavailable.' : 'Unable to prepare the receipt. Please try again.' }, { status, headers: PRIVATE_HEADERS })
    }
    const bytes = await generatePaymentReceipt(data)
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download === '1' ? 'attachment' : 'inline'}; filename="${receiptFilename(id)}"`,
      },
    })
  } catch {
    return Response.json({ error: 'Unable to generate the receipt. Please try again or contact support.' }, { status: 500, headers: PRIVATE_HEADERS })
  }
}
