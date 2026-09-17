import { createHmac } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  PASSWORD_RECOVERY_COOLDOWN_SECONDS,
  isRecoveryEmail,
  normalizeRecoveryEmail,
  recoveryRedirectUrl,
} from '@/lib/auth/password-recovery'

type RateLimitDecision = { allowed: boolean; retry_after_seconds: number }

const noStoreHeaders = { 'Cache-Control': 'private, no-store' }

function clientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip')?.trim() || null
}

function hashIdentifier(scope: 'email' | 'ip', value: string, secret: string) {
  return createHmac('sha256', secret).update(`${scope}:${value}`).digest('hex')
}

async function consumeRateLimit(email: string, ip: string | null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const serviceKey = process.env.SUPABASE_SECRET_KEY
  const hmacSecret = process.env.AUTH_RATE_LIMIT_SECRET || serviceKey
  if (!supabaseUrl || !serviceKey || !hmacSecret) throw new Error('password-recovery-rate-limit-config')

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_password_recovery_rate_limit`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      p_email_hash: hashIdentifier('email', email, hmacSecret),
      p_ip_hash: ip ? hashIdentifier('ip', ip, hmacSecret) : null,
    }),
    cache: 'no-store',
  })

  if (!response.ok) throw new Error('password-recovery-rate-limit-unavailable')
  const rows = await response.json() as RateLimitDecision[]
  return rows[0] || { allowed: false, retry_after_seconds: PASSWORD_RECOVERY_COOLDOWN_SECONDS }
}

export async function POST(request: NextRequest) {
  let email = ''
  try {
    const body = await request.json() as { email?: unknown }
    email = normalizeRecoveryEmail(typeof body.email === 'string' ? body.email : '')
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: noStoreHeaders })
  }

  if (!isRecoveryEmail(email)) {
    return NextResponse.json({ ok: false }, { status: 400, headers: noStoreHeaders })
  }

  try {
    const decision = await consumeRateLimit(email, clientIp(request))
    if (!decision.allowed) {
      return NextResponse.json({ ok: false, retryAfterSeconds: Math.max(1, decision.retry_after_seconds || PASSWORD_RECOVERY_COOLDOWN_SECONDS) }, { status: 429, headers: noStoreHeaders })
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: recoveryRedirectUrl(request.nextUrl.origin),
    })

    if (error) {
      if (error.status === 429) {
        return NextResponse.json({ ok: false, retryAfterSeconds: PASSWORD_RECOVERY_COOLDOWN_SECONDS }, { status: 429, headers: noStoreHeaders })
      }
      console.error('Password recovery email request failed.', { status: error.status, code: error.code })
      return NextResponse.json({ ok: false }, { status: 503, headers: noStoreHeaders })
    }

    return NextResponse.json({ ok: true, cooldownSeconds: PASSWORD_RECOVERY_COOLDOWN_SECONDS }, { headers: noStoreHeaders })
  } catch (error) {
    console.error('Password recovery request failed before email delivery.', error instanceof Error ? error.message : 'unknown-error')
    return NextResponse.json({ ok: false }, { status: 503, headers: noStoreHeaders })
  }
}
