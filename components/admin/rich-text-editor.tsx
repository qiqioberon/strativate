'use client'

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react'
import { useRef, useState, type ClipboardEvent, type FormEvent, type MouseEvent } from 'react'

import {
  parseRichTextDocument,
  sanitizeRichTextUrl,
  type RichTextAlignment,
  type RichTextDocument,
  type RichTextInline,
  type RichTextMark,
} from '@/lib/content/rich-text'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[character] ?? character))
}

function inlineToHtml(content: RichTextInline[] | undefined) {
  return (content ?? []).map(inline => {
    let html = escapeHtml(inline.text)
    for (const mark of inline.marks ?? []) {
      if (mark.type === 'bold') html = `<strong>${html}</strong>`
      if (mark.type === 'italic') html = `<em>${html}</em>`
      if (mark.type === 'link') {
        const href = sanitizeRichTextUrl(mark.href)
        if (href) html = `<a href="${escapeHtml(href)}"${mark.newTab ? ' target="_blank" rel="noreferrer"' : ''}>${html}</a>`
      }
    }
    return html
  }).join('')
}

function documentToEditorHtml(document: RichTextDocument) {
  return document.blocks.map(block => {
    const align = block.align === 'left' ? '' : ` style="text-align:${block.align}"`
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      const tag = block.type === 'bulletList' ? 'ul' : 'ol'
      const items = (block.items ?? []).map(item => `<li>${inlineToHtml(item) || '<br>'}</li>`).join('')
      return `<${tag}${align}>${items || '<li><br></li>'}</${tag}>`
    }
    const tag = block.type === 'paragraph' ? 'p' : block.type
    return `<${tag}${align}>${inlineToHtml(block.content) || '<br>'}</${tag}>`
  }).join('')
}

function markKey(marks: RichTextMark[] | undefined) {
  return JSON.stringify(marks ?? [])
}

function mergeInline(items: RichTextInline[]) {
  const merged: RichTextInline[] = []
  for (const item of items) {
    const previous = merged.at(-1)
    if (previous && markKey(previous.marks) === markKey(item.marks)) previous.text += item.text
    else merged.push({ text: item.text, marks: item.marks })
  }
  return merged
}

function readInline(node: Node, marks: RichTextMark[] = []): RichTextInline[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ''
    return text ? [{ text, marks: marks.length ? marks : undefined }] : []
  }
  if (!(node instanceof HTMLElement)) return []
  const nextMarks = [...marks]
  const tag = node.tagName.toLowerCase()
  if (tag === 'strong' || tag === 'b') nextMarks.push({ type: 'bold' })
  if (tag === 'em' || tag === 'i') nextMarks.push({ type: 'italic' })
  if (tag === 'a') {
    const href = sanitizeRichTextUrl(node.getAttribute('href') ?? '')
    if (href) nextMarks.push({ type: 'link', href, newTab: node.getAttribute('target') === '_blank' })
  }
  if (tag === 'br') return [{ text: '\n', marks: nextMarks.length ? nextMarks : undefined }]
  return mergeInline(Array.from(node.childNodes).flatMap(child => readInline(child, nextMarks)))
}

function readAlignment(element: HTMLElement): RichTextAlignment {
  const value = element.style.textAlign
  return value === 'center' || value === 'right' ? value : 'left'
}

function serializeEditor(element: HTMLElement): RichTextDocument {
  const blocks = Array.from(element.childNodes).flatMap(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim() ?? ''
      return text ? [{ type: 'paragraph' as const, align: 'left' as const, content: [{ text }] }] : []
    }
    if (!(node instanceof HTMLElement)) return []
    const tag = node.tagName.toLowerCase()
    const align = readAlignment(node)
    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(node.children)
        .filter(child => child.tagName.toLowerCase() === 'li')
        .map(item => mergeInline(Array.from(item.childNodes).flatMap(child => readInline(child))))
      return [{ type: tag === 'ul' ? 'bulletList' as const : 'orderedList' as const, align, items }]
    }
    const type = tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'blockquote' ? tag : 'paragraph'
    return [{ type, align, content: mergeInline(Array.from(node.childNodes).flatMap(child => readInline(child))) }]
  })
  return parseRichTextDocument({ version: 1, blocks })
}

type Props = {
  initialValue: RichTextDocument
  onChange: (value: RichTextDocument) => void
}

export function RichTextEditor({ initialValue, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<Range | null>(null)
  const [initialHtml] = useState(() => documentToEditorHtml(initialValue))
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkNewTab, setLinkNewTab] = useState(true)
  const [linkError, setLinkError] = useState('')

  function sync() {
    if (editorRef.current) onChange(serializeEditor(editorRef.current))
  }

  function rememberSelection() {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editorRef.current) return
    const range = selection.getRangeAt(0)
    if (editorRef.current.contains(range.commonAncestorContainer)) selectionRef.current = range.cloneRange()
  }

  function restoreSelection() {
    if (!selectionRef.current) return
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(selectionRef.current)
  }

  function command(event: MouseEvent<HTMLButtonElement>, name: string, value?: string) {
    event.preventDefault()
    editorRef.current?.focus()
    document.execCommand(name, false, value)
    rememberSelection()
    sync()
  }

  function changeBlock(value: string) {
    restoreSelection()
    editorRef.current?.focus()
    document.execCommand('formatBlock', false, value)
    rememberSelection()
    sync()
  }

  function align(event: MouseEvent<HTMLButtonElement>, value: 'justifyLeft' | 'justifyCenter' | 'justifyRight') {
    command(event, value)
  }

  function beginLink(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    rememberSelection()
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      setLinkError('Select text first, then add the link.')
      setLinkOpen(true)
      return
    }
    setLinkError('')
    setLinkUrl('')
    setLinkNewTab(true)
    setLinkOpen(true)
  }

  function applyLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const href = sanitizeRichTextUrl(linkUrl)
    if (!href) {
      setLinkError('Use a valid http:// or https:// URL.')
      return
    }
    restoreSelection()
    editorRef.current?.focus()
    document.execCommand('createLink', false, href)
    for (const anchor of Array.from(editorRef.current?.querySelectorAll('a') ?? [])) {
      if (anchor.href === href) {
        if (linkNewTab) {
          anchor.target = '_blank'
          anchor.rel = 'noreferrer'
        } else {
          anchor.removeAttribute('target')
          anchor.removeAttribute('rel')
        }
      }
    }
    setLinkOpen(false)
    setLinkError('')
    sync()
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault()
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
    sync()
  }

  return <div className="rich-editor" data-testid="publication-rich-text-editor">
    <div className="rich-editor__toolbar" role="toolbar" aria-label="Article formatting">
      <label className="rich-editor__block-select">
        <span className="sr-only">Text style</span>
        <select
          defaultValue="p"
          onPointerDown={rememberSelection}
          onChange={event => changeBlock(event.target.value)}
          aria-label="Text style"
        >
          <option value="p">Paragraph</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
          <option value="h4">H4</option>
          <option value="blockquote">Quote</option>
        </select>
      </label>
      <span className="rich-editor__separator" aria-hidden="true" />
      <button type="button" title="Bold" aria-label="Bold" onMouseDown={event => command(event, 'bold')}><Bold aria-hidden="true" /></button>
      <button type="button" title="Italic" aria-label="Italic" onMouseDown={event => command(event, 'italic')}><Italic aria-hidden="true" /></button>
      <button type="button" title="Bullet list" aria-label="Bullet list" onMouseDown={event => command(event, 'insertUnorderedList')}><List aria-hidden="true" /></button>
      <button type="button" title="Numbered list" aria-label="Numbered list" onMouseDown={event => command(event, 'insertOrderedList')}><ListOrdered aria-hidden="true" /></button>
      <button type="button" title="Blockquote" aria-label="Blockquote" onMouseDown={event => command(event, 'formatBlock', 'blockquote')}><Quote aria-hidden="true" /></button>
      <button type="button" title="Link" aria-label="Link" onMouseDown={beginLink}><Link2 aria-hidden="true" /></button>
      <span className="rich-editor__separator" aria-hidden="true" />
      <button type="button" title="Align left" aria-label="Align left" onMouseDown={event => align(event, 'justifyLeft')}><AlignLeft aria-hidden="true" /></button>
      <button type="button" title="Align center" aria-label="Align center" onMouseDown={event => align(event, 'justifyCenter')}><AlignCenter aria-hidden="true" /></button>
      <button type="button" title="Align right" aria-label="Align right" onMouseDown={event => align(event, 'justifyRight')}><AlignRight aria-hidden="true" /></button>
      <span className="rich-editor__separator" aria-hidden="true" />
      <button type="button" title="Undo" aria-label="Undo" onMouseDown={event => command(event, 'undo')}><Undo2 aria-hidden="true" /></button>
      <button type="button" title="Redo" aria-label="Redo" onMouseDown={event => command(event, 'redo')}><Redo2 aria-hidden="true" /></button>
    </div>
    {linkOpen ? <form className="rich-editor__link-popover" onSubmit={applyLink}>
      <label>URL<input autoFocus type="url" value={linkUrl} onChange={event => setLinkUrl(event.target.value)} placeholder="https://…" /></label>
      <label className="rich-editor__link-check"><input type="checkbox" checked={linkNewTab} onChange={event => setLinkNewTab(event.target.checked)} /> Open in new tab</label>
      {linkError ? <p>{linkError}</p> : null}
      <div><button type="button" className="button button-outline button-compact" onClick={() => setLinkOpen(false)}>Cancel</button><button type="submit" className="button button-primary button-compact">Apply link</button></div>
    </form> : null}
    <div
      ref={editorRef}
      className="rich-editor__surface"
      contentEditable
      suppressContentEditableWarning
      dangerouslySetInnerHTML={{ __html: initialHtml }}
      onInput={sync}
      onBlur={sync}
      onPaste={handlePaste}
      onKeyUp={rememberSelection}
      onMouseUp={rememberSelection}
      role="textbox"
      aria-multiline="true"
      aria-label="Publication body"
      data-placeholder="Write the publication body…"
    />
  </div>
}
