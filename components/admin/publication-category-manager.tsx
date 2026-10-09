'use client'

import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import dataStyles from './data-management.module.css'
import { adminFormError as formError } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
import type { Publication, PublicationCategory } from '@/lib/supabase/database.types'

export function PublicationCategoryManager({
  open,
  categories,
  publications,
  onClose,
  onChanged,
}: {
  open: boolean
  categories: PublicationCategory[]
  publications: Publication[]
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [blockedDeleteId, setBlockedDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const usage = useMemo(() => {
    const result = new Map<string, Publication[]>()
    for (const category of categories) result.set(category.id, [])
    for (const publication of publications) {
      if (publication.category_id && result.has(publication.category_id)) {
        result.get(publication.category_id)?.push(publication)
      }
    }
    return result
  }, [categories, publications])

  function requestClose() {
    if (busy) return
    const currentName = categories.find(category => category.id === editingId)?.name ?? ''
    if ((newName.trim() || editingId && editingName !== currentName) && !window.confirm('Discard unsaved category changes?')) return
    setNewName('')
    setEditingId(null)
    setEditingName('')
    onClose()
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError('')
    const result = await supabase.from('publication_categories').insert({ name, sort_order: categories.length + 1 })
    if (result.error) setError(formError(result.error, 'Unable to update the publication category.'))
    else {
      setNewName('')
      await onChanged()
    }
    setBusy(false)
  }

  async function saveRename(id: string) {
    if (busy) return
    const name = editingName.trim()
    if (!name) return
    setBusy(true)
    setError('')
    const result = await supabase.from('publication_categories').update({ name }).eq('id', id)
    if (result.error) setError(formError(result.error, 'Unable to update the publication category.'))
    else {
      setEditingId(null)
      setEditingName('')
      await onChanged()
    }
    setBusy(false)
  }

  async function saveOrder(items: PublicationCategory[]) {
    setBusy(true)
    setError('')
    try {
      for (let index = 0; index < items.length; index += 1) {
        const result = await supabase.from('publication_categories').update({ sort_order: index + 1 }).eq('id', items[index].id)
        if (result.error) throw new Error(result.error.message)
      }
      await onChanged()
    } catch (orderError) {
      setError(formError(orderError, 'Category order could not be saved.'))
    }
    setBusy(false)
  }

  function move(id: string, delta: number) {
    if (busy) return
    const from = categories.findIndex(category => category.id === id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= categories.length) return
    const next = [...categories]
    const moved = next.splice(from, 1)[0]
    next.splice(to, 0, moved)
    void saveOrder(next)
  }

  function dropOn(targetId: string) {
    if (busy) return
    if (!draggingId || draggingId === targetId) return
    const from = categories.findIndex(category => category.id === draggingId)
    const to = categories.findIndex(category => category.id === targetId)
    if (from < 0 || to < 0) return
    const next = [...categories]
    const moved = next.splice(from, 1)[0]
    next.splice(to, 0, moved)
    setDraggingId(null)
    void saveOrder(next)
  }

  async function removeCategory(category: PublicationCategory) {
    if (busy) return
    const usedBy = usage.get(category.id) ?? []
    if (usedBy.length) {
      setBlockedDeleteId(category.id)
      return
    }
    setBusy(true)
    setError('')
    const result = await supabase.from('publication_categories').delete().eq('id', category.id)
    if (result.error) {
      setError(formError(result.error, 'Unable to update the publication category.'))
      setBusy(false)
    } else {
      setBlockedDeleteId(null)
      await saveOrder(categories.filter(item => item.id !== category.id))
    }
  }

  return <dialog
    ref={dialogRef}
    className="editorial-category-dialog"
    aria-labelledby="publication-category-dialog-title"
    onCancel={event => { event.preventDefault(); requestClose() }}
  >
    <div className="editorial-category-dialog__header">
      <div>

        <h3 id="publication-category-dialog-title">Manage categories</h3>
        <p>Rename once and every linked publication will show the new label.</p>
      </div>
      <button type="button" className="editorial-icon-button" onClick={requestClose} disabled={busy} aria-label="Close category manager"><X aria-hidden="true" /></button>
    </div>
    <div className="editorial-category-dialog__body"><fieldset className={dataStyles.editableFields} disabled={busy}>
      <form className="editorial-category-add" onSubmit={addCategory}>
        <label><span>New category</span><input maxLength={80} value={newName} onChange={event => setNewName(event.target.value)} placeholder="e.g. Insights" /></label>
        <button type="submit" className="button button-primary button-compact" disabled={busy || !newName.trim()}><Plus aria-hidden="true" /> Add</button>
      </form>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="editorial-category-list">
        {categories.map((category, index) => {
          const usedBy = usage.get(category.id) ?? []
          return <article
            className="editorial-category-row"
            key={category.id}
            draggable={!busy}
            onDragStart={() => setDraggingId(category.id)}
            onDragEnd={() => setDraggingId(null)}
            onDragOver={event => event.preventDefault()}
            onDrop={() => dropOn(category.id)}
          >
            <button type="button" className="editorial-drag-handle" aria-label={`Drag ${category.name} to reorder`} title="Drag to reorder"><GripVertical aria-hidden="true" /></button>
            <span className="editorial-position">#{String(index + 1).padStart(2, '0')}</span>
            <div className="editorial-category-row__copy">
              {editingId === category.id
                ? <div className="editorial-category-edit">
                    <input autoFocus maxLength={80} value={editingName} onChange={event => setEditingName(event.target.value)} aria-label={`Rename ${category.name}`} />
                    <button type="button" className="editorial-icon-button" onClick={() => void saveRename(category.id)} aria-label="Save category name"><Save aria-hidden="true" /></button>
                    <button type="button" className="editorial-icon-button" onClick={() => setEditingId(null)} aria-label="Cancel rename"><X aria-hidden="true" /></button>
                  </div>
                : <>
                    <strong>{category.name}</strong>
                    <small>{usedBy.length} publication{usedBy.length === 1 ? '' : 's'} use this category.</small>
                  </>}
              {blockedDeleteId === category.id ? <div className="editorial-category-warning">
                <strong>This category is still in use.</strong>
                <p>Move these publications to another category before deleting it.</p>
                {usedBy.slice(0, 5).map(publication => <span key={publication.id}>{publication.title}</span>)}
                {usedBy.length > 5 ? <span>+ {usedBy.length - 5} more</span> : null}
              </div> : null}
            </div>
            <div className="editorial-category-row__actions">
              <button type="button" className="editorial-icon-button" onClick={() => move(category.id, -1)} disabled={busy || index === 0} aria-label={`Move ${category.name} up`}><ArrowUp aria-hidden="true" /></button>
              <button type="button" className="editorial-icon-button" onClick={() => move(category.id, 1)} disabled={busy || index === categories.length - 1} aria-label={`Move ${category.name} down`}><ArrowDown aria-hidden="true" /></button>
              <button type="button" className="editorial-icon-button" onClick={() => { setEditingId(category.id); setEditingName(category.name); setBlockedDeleteId(null) }} aria-label={`Rename ${category.name}`}><Pencil aria-hidden="true" /></button>
              <button type="button" className="editorial-icon-button editorial-icon-button--danger" onClick={() => void removeCategory(category)} disabled={busy} aria-label={`Delete ${category.name}`}><Trash2 aria-hidden="true" /></button>
            </div>
          </article>
        })}
        {!categories.length ? <div className="editorial-compact-empty"><strong>No publication categories yet.</strong><span>Add the first category above.</span></div> : null}
      </div>
    </fieldset></div>
  </dialog>
}
