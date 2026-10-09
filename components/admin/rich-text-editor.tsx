'use client'

import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
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
  Unlink,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  editorDocumentToRichText,
  richTextToEditorDocument,
  sanitizeRichTextUrl,
  type RichTextDocument,
} from '@/lib/content/rich-text'

type Props = {
  disabled?: boolean
  initialValue: RichTextDocument
  onChange: (value: RichTextDocument) => void
}

type LinkDraft = {
  from: number
  to: number
  existing: boolean
  text: string
  url: string
  newTab: boolean
  preservedMarks: { type: string; attrs?: Record<string, unknown> }[]
}

const allowedPasteTags = new Set(['p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'blockquote', 'a'])

function sanitizePastedHtml(html: string) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  document.querySelectorAll('script,style,iframe,object,embed,img,video,audio,svg,math,meta,link').forEach(node => node.remove())

  const elements = Array.from(document.body.querySelectorAll('*')).reverse()
  for (const element of elements) {
    const originalTag = element.tagName.toLowerCase()
    const style = element.getAttribute('style') ?? ''
    const isBold = /font-weight\s*:\s*(bold|[6-9]00)/i.test(style)
    const isItalic = /font-style\s*:\s*italic/i.test(style)
    const alignment = style.match(/text-align\s*:\s*(left|center|right)/i)?.[1]?.toLowerCase()
    let target = element

    if (originalTag === 'br') {
      element.replaceWith(document.createTextNode(' '))
      continue
    }
    if (originalTag === 'div' || originalTag === 'h1' || originalTag === 'h5' || originalTag === 'h6') {
      const replacement = document.createElement('p')
      replacement.append(...Array.from(element.childNodes))
      element.replaceWith(replacement)
      target = replacement
    } else if (!allowedPasteTags.has(originalTag)) {
      let replacement: DocumentFragment | HTMLElement = document.createDocumentFragment()
      replacement.append(...Array.from(element.childNodes))
      if (isBold) {
        const strong = document.createElement('strong')
        strong.append(replacement)
        replacement = strong
      }
      if (isItalic) {
        const emphasis = document.createElement('em')
        emphasis.append(replacement)
        replacement = emphasis
      }
      element.replaceWith(replacement)
      continue
    }

    const tag = target.tagName.toLowerCase()
    const href = tag === 'a' ? sanitizeRichTextUrl(target.getAttribute('href') ?? '') : null
    const newTab = tag === 'a' && target.getAttribute('target') === '_blank'
    Array.from(target.attributes).forEach(attribute => target.removeAttribute(attribute.name))
    if (tag === 'a' && href) {
      target.setAttribute('href', href)
      if (newTab) {
        target.setAttribute('target', '_blank')
        target.setAttribute('rel', 'noreferrer')
      }
    } else if (tag === 'a') {
      target.replaceWith(...Array.from(target.childNodes))
      continue
    }
    if (alignment && ['p', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol'].includes(tag)) {
      target.setAttribute('style', `text-align:${alignment}`)
    }
    if (isBold && !['strong', 'b'].includes(tag)) {
      const strong = document.createElement('strong')
      strong.append(...Array.from(target.childNodes))
      target.append(strong)
    }
    if (isItalic && !['em', 'i'].includes(tag)) {
      const emphasis = document.createElement('em')
      emphasis.append(...Array.from(target.childNodes))
      target.append(emphasis)
    }
  }
  return document.body.innerHTML
}

function ToolbarButton({
  label,
  active,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    className={active ? 'is-active' : undefined}
    disabled={disabled}
    onMouseDown={event => event.preventDefault()}
    onClick={onClick}
  >{children}</button>
}

export function RichTextEditor({ initialValue, onChange, disabled = false }: Props) {
  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null)
  const [linkError, setLinkError] = useState('')
  const [, setToolbarRevision] = useState(0)
  const content = useMemo(() => richTextToEditorDocument(initialValue), [initialValue])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: false,
        strike: false,
        underline: false,
        code: false,
        codeBlock: false,
        hardBreak: false,
        horizontalRule: false,
        trailingNode: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: true,
        protocols: ['http', 'https'],
        isAllowedUri: url => Boolean(sanitizeRichTextUrl(url)),
        HTMLAttributes: { rel: 'noreferrer' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph', 'blockquote', 'bulletList', 'orderedList'], alignments: ['left', 'center', 'right'] }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'rich-editor__surface',
        role: 'textbox',
        'aria-label': 'Publication body',
        'aria-multiline': 'true',
        'data-placeholder': 'Write the publication body…',
      },
      transformPastedHTML: sanitizePastedHtml,
      handleDOMEvents: {
        click: (_view, event) => {
          if ((event.target as HTMLElement | null)?.closest('a')) event.preventDefault()
          return false
        },
      },
    },
    onUpdate: ({ editor: current }) => onChange(editorDocumentToRichText(current.getJSON())),
    onSelectionUpdate: () => setToolbarRevision(value => value + 1),
    onTransaction: () => setToolbarRevision(value => value + 1),
  })

  useEffect(() => { editor?.setEditable(!disabled) }, [disabled, editor])

  if (!editor) return <div className="rich-editor rich-editor--loading" aria-busy="true" />
  const activeEditor = editor

  const textAlignment = activeEditor.isActive({ textAlign: 'center' }) ? 'center'
    : activeEditor.isActive({ textAlign: 'right' }) ? 'right'
      : 'left'

  const blockType = activeEditor.isActive('heading', { level: 2 }) ? 'h2'
    : activeEditor.isActive('heading', { level: 3 }) ? 'h3'
      : activeEditor.isActive('heading', { level: 4 }) ? 'h4'
        : 'p'

  function changeBlock(value: string) {
    if (value === 'p') activeEditor.chain().focus().setParagraph().run()
    else activeEditor.chain().focus().toggleHeading({ level: Number(value.slice(1)) as 2 | 3 | 4 }).run()
  }

  function openLinkDialog() {
    let { from, to } = activeEditor.state.selection
    const existing = activeEditor.isActive('link')
    if (existing) {
      activeEditor.chain().focus().extendMarkRange('link').run()
      from = activeEditor.state.selection.from
      to = activeEditor.state.selection.to
    }
    const attributes = existing ? activeEditor.getAttributes('link') as { href?: string; target?: string } : {}
    const selectedNode = from < to ? activeEditor.state.doc.nodeAt(from) : null
    const preservedMarks = selectedNode?.marks
      .filter(mark => mark.type.name !== 'link')
      .map(mark => ({ type: mark.type.name, attrs: { ...mark.attrs } })) ?? []
    setLinkDraft({
      from,
      to,
      existing,
      text: activeEditor.state.doc.textBetween(from, to, ' '),
      url: attributes.href ?? '',
      newTab: attributes.target === '_blank' || !existing,
      preservedMarks,
    })
    setLinkError('')
  }

  function applyLink() {
    if (!linkDraft) return
    const href = sanitizeRichTextUrl(linkDraft.url)
    if (!linkDraft.text.trim()) {
      setLinkError('Enter text to display.')
      return
    }
    if (!href) {
      setLinkError('Use a valid http:// or https:// URL.')
      return
    }
    const linkAttrs = {
      href,
      target: linkDraft.newTab ? '_blank' : null,
      rel: linkDraft.newTab ? 'noopener noreferrer' : null,
    }
    const currentText = activeEditor.state.doc.textBetween(linkDraft.from, linkDraft.to, ' ')
    if (linkDraft.from < linkDraft.to && currentText === linkDraft.text) {
      activeEditor.chain()
        .focus()
        .setTextSelection({ from: linkDraft.from, to: linkDraft.to })
        .setLink(linkAttrs)
        .run()
    } else {
      activeEditor.chain().focus().insertContentAt(
        { from: linkDraft.from, to: linkDraft.to },
        {
          type: 'text',
          text: linkDraft.text,
          marks: [...linkDraft.preservedMarks, { type: 'link', attrs: linkAttrs }],
        },
      ).run()
    }
    setLinkDraft(null)
    setLinkError('')
  }

  function removeLink() {
    if (!linkDraft) return
    activeEditor.chain().focus().setTextSelection({ from: linkDraft.from, to: linkDraft.to }).unsetLink().run()
    setLinkDraft(null)
    setLinkError('')
  }

  return <div className="rich-editor" data-testid="publication-rich-text-editor">
    <div className="rich-editor__controls">
      <div className="rich-editor__toolbar" role="toolbar" aria-label="Article formatting">
        <label className="rich-editor__block-select">
          <span className="sr-only">Text style</span>
          <select value={blockType} onChange={event => changeBlock(event.target.value)} aria-label="Text style">
            <option value="p">Paragraph</option>
            <option value="h2">H2</option>
            <option value="h3">H3</option>
            <option value="h4">H4</option>
          </select>
        </label>
        <span className="rich-editor__separator" aria-hidden="true" />
        <ToolbarButton label="Bold" active={activeEditor.isActive('bold')} onClick={() => activeEditor.chain().focus().toggleBold().run()}><Bold aria-hidden="true" /></ToolbarButton>
        <ToolbarButton label="Italic" active={activeEditor.isActive('italic')} onClick={() => activeEditor.chain().focus().toggleItalic().run()}><Italic aria-hidden="true" /></ToolbarButton>
        <ToolbarButton label="Bullet list" active={activeEditor.isActive('bulletList')} onClick={() => activeEditor.chain().focus().toggleBulletList().run()}><List aria-hidden="true" /></ToolbarButton>
        <ToolbarButton label="Numbered list" active={activeEditor.isActive('orderedList')} onClick={() => activeEditor.chain().focus().toggleOrderedList().run()}><ListOrdered aria-hidden="true" /></ToolbarButton>
        <ToolbarButton label="Blockquote" active={activeEditor.isActive('blockquote')} onClick={() => activeEditor.chain().focus().toggleBlockquote().run()}><Quote aria-hidden="true" /></ToolbarButton>
        <ToolbarButton label="Link" active={activeEditor.isActive('link')} onClick={openLinkDialog}><Link2 aria-hidden="true" /></ToolbarButton>
        <span className="rich-editor__separator" aria-hidden="true" />
        <ToolbarButton label="Align left" active={textAlignment === 'left'} onClick={() => activeEditor.chain().focus().setTextAlign('left').run()}><AlignLeft aria-hidden="true" /></ToolbarButton>
        <ToolbarButton label="Align center" active={textAlignment === 'center'} onClick={() => activeEditor.chain().focus().setTextAlign('center').run()}><AlignCenter aria-hidden="true" /></ToolbarButton>
        <ToolbarButton label="Align right" active={textAlignment === 'right'} onClick={() => activeEditor.chain().focus().setTextAlign('right').run()}><AlignRight aria-hidden="true" /></ToolbarButton>
        <span className="rich-editor__separator" aria-hidden="true" />
        <ToolbarButton label="Undo" disabled={!activeEditor.can().chain().focus().undo().run()} onClick={() => activeEditor.chain().focus().undo().run()}><Undo2 aria-hidden="true" /></ToolbarButton>
        <ToolbarButton label="Redo" disabled={!activeEditor.can().chain().focus().redo().run()} onClick={() => activeEditor.chain().focus().redo().run()}><Redo2 aria-hidden="true" /></ToolbarButton>
      </div>
      {linkDraft ? <div
        className="rich-editor__link-popover"
        role="dialog"
        aria-label={linkDraft.existing ? 'Edit link' : 'Insert link'}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setLinkDraft(null)
            activeEditor.commands.focus()
          }
          if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
            event.preventDefault()
            event.stopPropagation()
            if (!event.nativeEvent.isComposing) applyLink()
          }
        }}
      >
        <label>Text to display<input autoFocus value={linkDraft.text} onChange={event => setLinkDraft(current => current ? { ...current, text: event.target.value } : current)} /></label>
        <label>URL<input type="url" value={linkDraft.url} onChange={event => setLinkDraft(current => current ? { ...current, url: event.target.value } : current)} placeholder="https://…" /></label>
        <label className="rich-editor__link-check"><input type="checkbox" checked={linkDraft.newTab} onChange={event => setLinkDraft(current => current ? { ...current, newTab: event.target.checked } : current)} /> Open in new tab</label>
        {linkError ? <p role="alert">{linkError}</p> : null}
        <div>
          {linkDraft.existing ? <button type="button" className="button button-danger button-compact" onClick={removeLink}><Unlink aria-hidden="true" /> Remove link</button> : null}
          <button type="button" className="button button-outline button-compact" onClick={() => { setLinkDraft(null); activeEditor.commands.focus() }}>Cancel</button>
          <button type="button" className="button button-primary button-compact" onClick={applyLink}>{linkDraft.existing ? 'Update link' : 'Apply link'}</button>
        </div>
      </div> : null}
    </div>
    <EditorContent editor={activeEditor} />
  </div>
}
