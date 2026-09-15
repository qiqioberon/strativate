const WHATSAPP_PATTERN = /^\+628\d{7,11}$/

export function normalizeWhatsAppNumber(input: string): string | null {
  const compact = input.trim().replace(/[\s().-]+/g, '')
  if (!compact) return null

  let normalized = compact
  if (compact.startsWith('08')) normalized = `+62${compact.slice(1)}`
  else if (compact.startsWith('628')) normalized = `+${compact}`

  return WHATSAPP_PATTERN.test(normalized) ? normalized : null
}

export function whatsAppNumberError(input: string): string | null {
  if (!input.trim()) return null
  return normalizeWhatsAppNumber(input)
    ? null
    : 'Gunakan nomor WhatsApp Indonesia, misalnya 08123456789, 628123456789, atau +628123456789.'
}
