export type RichTextAlignment = 'left' | 'center' | 'right'
export type RichTextBlockType = 'paragraph' | 'h2' | 'h3' | 'h4' | 'blockquote' | 'bulletList' | 'orderedList'

export type RichTextMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'link'; href: string; newTab?: boolean }

export type RichTextInline = {
  text: string
  marks?: RichTextMark[]
}

export type RichTextBlock = {
  type: RichTextBlockType
  align: RichTextAlignment
  content?: RichTextInline[]
  items?: RichTextInline[][]
}

export type RichTextDocument = {
  version: 1
  blocks: RichTextBlock[]
}

const blockTypes = new Set<RichTextBlockType>(['paragraph', 'h2', 'h3', 'h4', 'blockquote', 'bulletList', 'orderedList'])
const alignments = new Set<RichTextAlignment>(['left', 'center', 'right'])

export function sanitizeRichTextUrl(value: string) {
  const href = value.trim()
  if (!href) return null
  try {
    const parsed = new URL(href)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

function sanitizeMarks(value: unknown): RichTextMark[] | undefined {
  if (!Array.isArray(value)) return undefined
  const marks: RichTextMark[] = []
  for (const mark of value) {
    if (!mark || typeof mark !== 'object') continue
    const candidate = mark as Record<string, unknown>
    if (candidate.type === 'bold') marks.push({ type: 'bold' })
    if (candidate.type === 'italic') marks.push({ type: 'italic' })
    if (candidate.type === 'link' && typeof candidate.href === 'string') {
      const href = sanitizeRichTextUrl(candidate.href)
      if (href) marks.push({ type: 'link', href, newTab: candidate.newTab === true })
    }
  }
  return marks.length ? marks : undefined
}

function sanitizeInline(value: unknown): RichTextInline[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Record<string, unknown>
    if (typeof candidate.text !== 'string') return []
    return [{ text: candidate.text, marks: sanitizeMarks(candidate.marks) }]
  })
}

function sanitizeBlock(value: unknown): RichTextBlock | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.type !== 'string' || !blockTypes.has(candidate.type as RichTextBlockType)) return null
  const type = candidate.type as RichTextBlockType
  const align = typeof candidate.align === 'string' && alignments.has(candidate.align as RichTextAlignment)
    ? candidate.align as RichTextAlignment
    : 'left'
  if (type === 'bulletList' || type === 'orderedList') {
    const items = Array.isArray(candidate.items) ? candidate.items.map(sanitizeInline).filter(item => item.length) : []
    return { type, align, items }
  }
  return { type, align, content: sanitizeInline(candidate.content) }
}

export function emptyRichTextDocument(): RichTextDocument {
  return { version: 1, blocks: [{ type: 'paragraph', align: 'left', content: [] }] }
}

export function plainTextToRichText(value: string): RichTextDocument {
  const paragraphs = value
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
  return {
    version: 1,
    blocks: paragraphs.length
      ? paragraphs.map(paragraph => ({ type: 'paragraph' as const, align: 'left' as const, content: [{ text: paragraph }] }))
      : [{ type: 'paragraph', align: 'left', content: [] }],
  }
}

export function parseRichTextDocument(value: unknown, fallback = ''): RichTextDocument {
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>
    if (candidate.version === 1 && Array.isArray(candidate.blocks)) {
      const blocks = candidate.blocks.map(sanitizeBlock).filter((block): block is RichTextBlock => Boolean(block))
      if (blocks.length) return { version: 1, blocks }
    }
  }
  return plainTextToRichText(fallback)
}

function inlinePlainText(content: RichTextInline[] | undefined) {
  return (content ?? []).map(item => item.text).join('')
}

export function richTextToPlainText(document: RichTextDocument) {
  return document.blocks.map(block => {
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      return (block.items ?? []).map(item => inlinePlainText(item)).join('\n')
    }
    return inlinePlainText(block.content)
  }).filter(Boolean).join('\n\n')
}

export function richTextHasContent(document: RichTextDocument) {
  return richTextToPlainText(document).trim().length > 0
}
