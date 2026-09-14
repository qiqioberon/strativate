import { NextResponse } from 'next/server'

import {
  DIGITAL_PRODUCT_CONTENT_BUCKET,
  DIGITAL_PRODUCT_CONTENT_SIGNED_URL_SECONDS,
} from '@/lib/digital-products/config'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function maskedEmail(email: string | undefined) {
  if (!email) return 'Akun Strativate'
  const [local, domain] = email.split('@')
  if (!domain) return 'Akun Strativate'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}***@${domain}`
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return NextResponse.json({ message: 'Silakan masuk untuk membuka materi.' }, { status: 401 })
  }

  const { data: grant, error } = await supabase
    .rpc('create_digital_product_access_session', { p_product_id: id })
    .single()

  if (error || !grant) {
    return NextResponse.json({ message: 'Materi ini belum dapat diakses oleh akun Anda.' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: signed, error: signingError } = await admin.storage
    .from(DIGITAL_PRODUCT_CONTENT_BUCKET)
    .createSignedUrl(grant.content_path, DIGITAL_PRODUCT_CONTENT_SIGNED_URL_SECONDS)

  if (signingError || !signed?.signedUrl) {
    return NextResponse.json({ message: 'Materi sedang tidak dapat dimuat. Coba lagi sebentar.' }, { status: 503 })
  }

  const orderReference = grant.order_id ? `Order #${grant.order_id.slice(0, 8).toUpperCase()}` : 'Admin preview'
  return NextResponse.json({
    url: signed.signedUrl,
    expiresAt: new Date(Date.now() + DIGITAL_PRODUCT_CONTENT_SIGNED_URL_SECONDS * 1000).toISOString(),
    contentType: grant.content_type,
    mimeType: grant.content_mime_type,
    fileName: grant.content_file_name,
    sessionId: grant.session_id,
    watermark: `${maskedEmail(authData.user.email)} • ${orderReference}`,
  })
}
