import { publicContact } from '@/lib/content/brand'

const messages = {
  home: 'Halo Strativate, saya ingin berkonsultasi untuk memilih program yang sesuai.',
  program: 'Halo Strativate, saya ingin berkonsultasi tentang program Strativate.',
  private: 'Halo Strativate, saya ingin berkonsultasi tentang Private Mentoring.',
  intensive: 'Halo Strativate, saya ingin berkonsultasi tentang Intensive Mentoring.',
  mentor: 'Halo Strativate, saya ingin berkonsultasi untuk memilih mentor yang sesuai.',
  about: 'Halo Strativate, saya ingin mengetahui lebih lanjut tentang layanan Strativate.',
  faq: 'Halo Strativate, saya masih memiliki pertanyaan dan ingin berkonsultasi.',
} as const

export function whatsappMessageForPath(pathname: string) {
  if (pathname.startsWith('/program/private-mentoring')) return messages.private
  if (pathname.startsWith('/program/intensive-mentoring')) return messages.intensive
  if (pathname.startsWith('/program')) return messages.program
  if (pathname.startsWith('/mentor')) return messages.mentor
  if (pathname.startsWith('/tentang-kami')) return messages.about
  if (pathname.startsWith('/tanya-jawab')) return messages.faq
  return messages.home
}

export function buildWhatsAppHref(message: string) {
  return `${publicContact.whatsapp}?text=${encodeURIComponent(message)}`
}
