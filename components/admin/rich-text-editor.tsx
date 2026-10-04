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
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'

import {
  editorDocumentToRichText,
  richTextToEditorDocument,
  sanitizeRichTextUrl,
  type RichTextDocument,
} from '@/lib/content/rich-text'

type Props = {
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

export function RichTextEditor({ initialValue, onChange }: Props) {
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

  if (!editor) return <div className="rich-editor rich-editor--loading" aria-busy="true" />

  const blockType = editor.isActive('heading', { level: 2 }) ? 'h2'
    : editor.isActive('heading', { level: 3 }) ? 'h3'
      : editor.isActive('heading', { level: 4 }) ? 'h4'
        : 'p'

  function changeBlock(value: string) {
    if (value === 'p') editor.chain().focus().setParagraph().run()
    else editor.chain().focus().toggleHeading({ level: Number(value.slice(1)) as 2 | 3 | 4 }).run()
  }

  function openLinkDialog() {
    let { from, to } = editor.state.selection
    const existing = editor.isActive('link')
    if (existing) {
      editor.chain().focus().extendMarkRange('link').run()
      from = editor.state.selection.from
      to = editor.state.selection.to
    }
    const attributes = existing ? editor.getAttributes('link') as { href?: string; target?: string } : {}
    setLinkDraft({
      from,
      to,
      existing,
      text: editor.state.doc.textBetween(from, to, ' '),
      url: attributes.href ?? '',
      newTab: attributes.target === '_blank' || !existing,
    })
    setLinkError('')
  }

  function applyLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
    editor.chain().focus().insertContentAt(
      { from: linkDraft.from, to: linkDraft.to },
      {
        type: 'text',
        text: linkDraft.text,
        marks: [{ type: 'link', attrs: { href, target: linkDraft.newTab ? '_blank' : null, rel: linkDraft.newTab ? 'noreferrer' : null } }],
      },
    ).run()
    setLinkDraft(null)
    setLinkError('')
  }

  function removeLink() {
    if (!linkDraft) return
    editor.chain().focus().setTextSelection({ from: linkDraft.from, to: linkDraft.to }).unsetLink().run()
    setLinkDraft(null)
    setLinkError('')
  }

  return <div className="rich-editor" data-testid="publication-rich-text-editor">
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
      <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold aria-hidden="true" /></ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic aria-hidden="true" /></ToolbarButton>
      <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List aria-hidden="true" /></ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered aria-hidden="true" /></ToolbarButton>
      <ToolbarButton label="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote aria-hidden="true" /></ToolbarButton>
      <ToolbarButton label="Link" active={editor.isActive('link')} onClick={openLinkDialog}><Link2 aria-hidden="true" /></ToolbarButton>
      <span className="rich-editor__separator" aria-hidden="true" />
      <ToolbarButton label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft aria-hidden="true" /></ToolbarButton>
      <ToolbarButton label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter aria-hidden="true" /></ToolbarButton>
      <ToolbarButton label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight aria-hidden="true" /></ToolbarButton>
      <span className="rich-editor__separator" aria-hidden="true" />
      <ToolbarButton label="Undo" disabled={!editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}><Undo2 aria-hidden="true" /></ToolbarButton>
      <ToolbarButton label="Redo" disabled={!editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}><Redo2 aria-hidden="true" /></ToolbarButton>
    </div>
    {linkDraft ? <form className="rich-editor__link-popover" onSubmit={applyLink}>
      <label>Text to display<input autoFocus value={linkDraft.text} onChange={event => setLinkDraft(current => current ? { ...current, text: event.target.value } : current)} /></label>
      <label>URL<input type="url" value={linkDraft.url} onChange={event => setLinkDraft(current => current ? { ...current, url: event.target.value } : current)} placeholder="https://…" /></label>
      <label className="rich-editor__link-check"><input type="checkbox" checked={linkDraft.newTab} onChange={event => setLinkDraft(current => current ? { ...current, newTab: event.target.checked } : current)} /> Open in new tab</label>
      {linkError ? <p role="alert">{linkError}</p> : null}
      <div>
        {linkDraft.existing ? <button type="button" className="button button-danger button-compact" onClick={removeLink}><Unlink aria-hidden="true" /> Remove link</button> : null}
        <button type="button" className="button button-outline button-compact" onClick={() => setLinkDraft(null)}>Cancel</button>
        <button type="submit" className="button button-primary button-compact">{linkDraft.existing ? 'Update link' : 'Apply link'}</button>
      </div>
    </form> : null}
    <EditorContent editor={editor} />
  </div>
}
