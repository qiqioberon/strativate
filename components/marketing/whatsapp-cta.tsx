'use client'

import { MessageCircle } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { buildWhatsAppHref, whatsappMessageForPath } from '@/lib/marketing/whatsapp'

export function WhatsAppCta() {
  const pathname = usePathname()
  const href = buildWhatsAppHref(whatsappMessageForPath(pathname))

  return (
    <a
      className="marketing-whatsapp"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Konsultasi melalui WhatsApp"
      data-testid="global-whatsapp-cta"
    >
      <span className="marketing-whatsapp__pulse" aria-hidden="true" />
      <MessageCircle aria-hidden="true" size={21} />
      <span>Konsultasi WhatsApp</span>
    </a>
  )
}
