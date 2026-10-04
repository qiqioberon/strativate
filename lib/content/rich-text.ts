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

export type StructuredEditorNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type?: string; attrs?: Record<string, unknown> }[]
  content?: StructuredEditorNode[]
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

function inlineToEditorNodes(content: RichTextInline[] | undefined): StructuredEditorNode[] {
  return (content ?? []).flatMap(item => {
    if (!item.text) return []
    const marks = (item.marks ?? []).flatMap(mark => {
      if (mark.type === 'bold' || mark.type === 'italic') return [{ type: mark.type }]
      const href = sanitizeRichTextUrl(mark.href)
      return href ? [{ type: 'link', attrs: { href, target: mark.newTab ? '_blank' : null, rel: mark.newTab ? 'noreferrer' : null } }] : []
    })
    return [{ type: 'text', text: item.text, ...(marks.length ? { marks } : {}) }]
  })
}

export function richTextToEditorDocument(value: RichTextDocument): StructuredEditorNode {
  const document = parseRichTextDocument(value)
  return {
    type: 'doc',
    content: document.blocks.map(block => {
      const attrs = { textAlign: block.align }
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        return {
          type: block.type,
          attrs,
          content: (block.items?.length ? block.items : [[]]).map(item => ({
            type: 'listItem',
            content: [{ type: 'paragraph', content: inlineToEditorNodes(item) }],
          })),
        }
      }
      if (block.type === 'blockquote') {
        return {
          type: 'blockquote',
          attrs,
          content: [{ type: 'paragraph', content: inlineToEditorNodes(block.content) }],
        }
      }
      return {
        type: block.type === 'paragraph' ? 'paragraph' : 'heading',
        attrs: block.type === 'paragraph' ? attrs : { ...attrs, level: Number(block.type.slice(1)) },
        content: inlineToEditorNodes(block.content),
      }
    }),
  }
}

function editorMarks(value: StructuredEditorNode['marks']): RichTextMark[] | undefined {
  if (!Array.isArray(value)) return undefined
  const marks: RichTextMark[] = []
  for (const mark of value) {
    if (mark.type === 'bold') marks.push({ type: 'bold' })
    if (mark.type === 'italic') marks.push({ type: 'italic' })
    if (mark.type === 'link' && typeof mark.attrs?.href === 'string') {
      const href = sanitizeRichTextUrl(mark.attrs.href)
      if (href) marks.push({ type: 'link', href, newTab: mark.attrs.target === '_blank' })
    }
  }
  return marks.length ? marks : undefined
}

function editorInline(nodes: StructuredEditorNode[] | undefined): RichTextInline[] {
  const items: RichTextInline[] = []
  const visit = (node: StructuredEditorNode) => {
    if (node.type === 'text' && typeof node.text === 'string') {
      const next = { text: node.text, marks: editorMarks(node.marks) }
      const previous = items.at(-1)
      if (previous && JSON.stringify(previous.marks ?? []) === JSON.stringify(next.marks ?? [])) previous.text += next.text
      else items.push(next)
      return
    }
    node.content?.forEach(visit)
  }
  nodes?.forEach(visit)
  return items
}

function editorListItems(nodes: StructuredEditorNode[] | undefined): RichTextInline[][] {
  const items: RichTextInline[][] = []
  for (const item of nodes ?? []) {
    const children = item.type === 'listItem' ? item.content ?? [] : [item]
    let addedDirectBlock = false
    for (const child of children) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        items.push(...editorListItems(child.content))
        continue
      }
      items.push(editorInline(child.content ?? [child]))
      addedDirectBlock = true
    }
    if (!children.length && !addedDirectBlock) items.push([])
  }
  return items
}

function editorAlignment(node: StructuredEditorNode): RichTextAlignment {
  const value = node.attrs?.textAlign
  return value === 'center' || value === 'right' ? value : 'left'
}

export function editorDocumentToRichText(value: unknown): RichTextDocument {
  if (!value || typeof value !== 'object') return emptyRichTextDocument()
  const root = value as StructuredEditorNode
  const blocks: RichTextBlock[] = []
  for (const node of root.content ?? []) {
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      blocks.push({
        type: node.type,
        align: editorAlignment(node),
        items: editorListItems(node.content),
      })
      continue
    }
    if (node.type === 'blockquote') {
      const quoteBlocks = node.content?.length ? node.content : [{ type: 'paragraph', content: [] }]
      for (const child of quoteBlocks) {
        if (child.type === 'bulletList' || child.type === 'orderedList') {
          blocks.push({ type: child.type, align: editorAlignment(child), items: editorListItems(child.content) })
        } else {
          blocks.push({ type: 'blockquote', align: editorAlignment(node), content: editorInline(child.content ?? [child]) })
        }
      }
      continue
    }
    if (node.type === 'heading') {
      const level = Number(node.attrs?.level)
      const type = level === 2 || level === 3 || level === 4 ? `h${level}` as 'h2' | 'h3' | 'h4' : 'paragraph'
      blocks.push({ type, align: editorAlignment(node), content: editorInline(node.content) })
      continue
    }
    if (node.type === 'paragraph') blocks.push({ type: 'paragraph', align: editorAlignment(node), content: editorInline(node.content) })
  }
  return parseRichTextDocument({ version: 1, blocks })
}
