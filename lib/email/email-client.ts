import 'server-only'

export async function sendTransactionalEmail(input: {
  to: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.STRATIVATE_EMAIL_FROM

  if (!apiKey || !from) throw new Error('transactional-email-not-configured')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
    cache: 'no-store',
  })

  if (!response.ok) throw new Error(`transactional-email-provider-${response.status}`)
  return response.json() as Promise<{ id?: string }>
}
