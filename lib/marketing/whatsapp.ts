import { publicContact } from '@/lib/content/brand'

const messages = {
  home: 'Hello Strativate, I would like help choosing the right program.',
  program: 'Hello Strativate, I would like to learn more about your programs.',
  private: 'Hello Strativate, I would like to learn more about Private Mentoring.',
  intensive: 'Hello Strativate, I would like to learn more about Intensive Mentoring.',
  mentor: 'Hello Strativate, I would like help choosing a suitable mentor.',
  about: 'Hello Strativate, I would like to learn more about Strativate.',
  faq: 'Hello Strativate, I have a question about Strativate and would like some help.',
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
