import type { ReactNode } from 'react'

import { sanitizeRichTextUrl, type RichTextDocument, type RichTextInline } from '@/lib/content/rich-text'

function renderInline(content: RichTextInline[] | undefined, keyPrefix: string) {
  return (content ?? []).map((inline, index) => {
    let node: ReactNode = inline.text
    for (const mark of inline.marks ?? []) {
      if (mark.type === 'bold') node = <strong>{node}</strong>
      if (mark.type === 'italic') node = <em>{node}</em>
      if (mark.type === 'link') {
        const href = sanitizeRichTextUrl(mark.href)
        if (href) node = <a href={href} target={mark.newTab ? '_blank' : undefined} rel={mark.newTab ? 'noreferrer' : undefined}>{node}</a>
      }
    }
    return <span key={`${keyPrefix}-${index}`}>{node}</span>
  })
}

export function RichTextRenderer({ document }: { document: RichTextDocument }) {
  return <div className="editorial-article-body">
    {document.blocks.map((block, index) => {
      const style = block.align === 'left' ? undefined : { textAlign: block.align }
      const key = `block-${index}`
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        const Tag = block.type === 'bulletList' ? 'ul' : 'ol'
        return <Tag key={key} style={style}>{(block.items ?? []).map((item, itemIndex) => <li key={`${key}-item-${itemIndex}`}>{renderInline(item, `${key}-item-${itemIndex}`)}</li>)}</Tag>
      }
      if (block.type === 'h2') return <h2 key={key} style={style}>{renderInline(block.content, key)}</h2>
      if (block.type === 'h3') return <h3 key={key} style={style}>{renderInline(block.content, key)}</h3>
      if (block.type === 'h4') return <h4 key={key} style={style}>{renderInline(block.content, key)}</h4>
      if (block.type === 'blockquote') return <blockquote key={key} style={style}>{renderInline(block.content, key)}</blockquote>
      return <p key={key} style={style}>{renderInline(block.content, key)}</p>
    })}
  </div>
}
