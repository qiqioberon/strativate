'use client'

import { ArrowDown, ArrowUp, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { formError } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
import type { MentorExpertise } from '@/lib/supabase/database.types'

import styles from './mentor-expertise-management.module.css'

type StatusFilter = 'all' | 'active' | 'inactive'

type EditorState = {
  id: string | null
  name: string
  isActive: boolean
  sortOrder: number | null
}

const emptyEditor: EditorState = { id: null, name: '', isActive: true, sortOrder: null }

export function MentorExpertiseManagement() {
  const [rows, setRows] = useState<MentorExpertise[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editor, setEditor] = useState<EditorState>(emptyEditor)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: loadError } = await createClient()
        .from('mentor_expertise')
        .select('*')
        .order('sort_order')
        .order('name')
      if (loadError) throw loadError
      setRows(data || [])
    } catch (caught) {
      setError(formError(caught, 'Mentor expertise belum dapat dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('id-ID')
    return rows.filter(row => {
      if (statusFilter === 'active' && !row.is_active) return false
      if (statusFilter === 'inactive' && row.is_active) return false
      if (!normalized) return true
      return `${row.name} ${row.slug}`.toLocaleLowerCase('id-ID').includes(normalized)
    })
  }, [query, rows, statusFilter])

  function openCreate() {
    setEditor(emptyEditor)
    setError('')
    setMessage('')
    dialogRef.current?.showModal()
  }

  function openEdit(row: MentorExpertise) {
    setEditor({ id: row.id, name: row.name, isActive: row.is_active, sortOrder: row.sort_order })
    setError('')
    setMessage('')
    dialogRef.current?.showModal()
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = editor.name.trim()
    if (!name) { setError('Nama expertise wajib diisi.'); return }
    setBusyId(editor.id || 'new')
    setError('')
    setMessage('')
    try {
      const { data, error: saveError } = await createClient().rpc('admin_upsert_mentor_expertise', {
        p_name: name,
        p_id: editor.id,
        p_is_active: editor.isActive,
        p_sort_order: editor.sortOrder,
      })
      if (saveError) throw saveError
      if (!data) throw new Error('Expertise tidak dikembalikan setelah disimpan.')
      dialogRef.current?.close()
      setMessage(editor.id ? 'Expertise berhasil diperbarui.' : 'Expertise berhasil ditambahkan.')
      await load()
    } catch (caught) {
      setError(formError(caught, 'Expertise belum dapat disimpan.'))
    } finally {
      setBusyId(null)
    }
  }

  async function setActive(row: MentorExpertise, isActive: boolean) {
    setBusyId(row.id)
    setError('')
    setMessage('')
    try {
      const { error: saveError } = await createClient().rpc('admin_upsert_mentor_expertise', {
        p_name: row.name,
        p_id: row.id,
        p_is_active: isActive,
        p_sort_order: row.sort_order,
      })
      if (saveError) throw saveError
      setRows(current => current.map(item => item.id === row.id ? { ...item, is_active: isActive } : item))
      setMessage(`${row.name} ${isActive ? 'diaktifkan' : 'dinonaktifkan'}.`)
    } catch (caught) {
      setError(formError(caught, 'Status expertise belum dapat diperbarui.'))
    } finally {
      setBusyId(null)
    }
  }

  async function move(row: MentorExpertise, direction: -1 | 1) {
    const currentIndex = rows.findIndex(item => item.id === row.id)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= rows.length) return
    const nextRows = [...rows]
    ;[nextRows[currentIndex], nextRows[nextIndex]] = [nextRows[nextIndex], nextRows[currentIndex]]
    setBusyId(row.id)
    setError('')
    setMessage('')
    try {
      const { data, error: reorderError } = await createClient().rpc('admin_reorder_mentor_expertise', {
        p_ids: nextRows.map(item => item.id),
      })
      if (reorderError) throw reorderError
      setRows(data || nextRows.map((item, index) => ({ ...item, sort_order: (index + 1) * 10 })))
      setMessage('Urutan expertise berhasil diperbarui.')
    } catch (caught) {
      setError(formError(caught, 'Urutan expertise belum dapat diperbarui.'))
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function remove(row: MentorExpertise) {
    if (!window.confirm(`Hapus expertise “${row.name}”? Expertise yang masih dipakai profil mentor tidak dapat dihapus dan harus dinonaktifkan.`)) return
    setBusyId(row.id)
    setError('')
    setMessage('')
    try {
      const { data, error: deleteError } = await createClient().rpc('admin_delete_mentor_expertise', { p_id: row.id })
      if (deleteError) throw deleteError
      if (data === 'deactivate_required') {
        setMessage(`${row.name} masih digunakan profil mentor. Nonaktifkan expertise ini bila tidak ingin dipilih lagi.`)
      } else {
        setRows(current => current.filter(item => item.id !== row.id))
        setMessage(`${row.name} berhasil dihapus.`)
      }
    } catch (caught) {
      setError(formError(caught, 'Expertise belum dapat dihapus.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className={styles.page} data-testid="mentor-expertise-management">
      <header className={styles.header}>
        <div>
          <p className="kicker">Data master</p>
          <h2>Mentor Expertise</h2>
          <p>Kelola label expertise yang dapat dipilih mentor untuk profil publiknya. Slug tetap stabil setelah record dibuat.</p>
        </div>
        <button type="button" className="button button-primary" onClick={openCreate}><Plus aria-hidden="true" size={16} />Tambah expertise</button>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}><Search aria-hidden="true" size={16} /><span className="sr-only">Cari expertise</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari nama atau slug" /></label>
        <label className={styles.filter}>Status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}><option value="all">Semua</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {message ? <p className={styles.message} role="status">{message}</p> : null}
      {loading ? <p role="status">Memuat mentor expertise…</p> : null}

      {!loading && rows.length === 0 ? <div className={styles.empty}>No expertise has been configured yet.</div> : null}
      {!loading && rows.length > 0 && visibleRows.length === 0 ? <div className={styles.empty}>Tidak ada expertise yang cocok dengan filter ini.</div> : null}

      {!loading && visibleRows.length ? <div className={styles.list} role="list">
        {visibleRows.map(row => {
          const canonicalIndex = rows.findIndex(item => item.id === row.id)
          const busy = busyId === row.id
          return <article className={styles.row} role="listitem" key={row.id} data-testid={`mentor-expertise-row-${row.slug}`}>
            <div className={styles.identity}><strong>{row.name}</strong><code>{row.slug}</code></div>
            <div className={styles.meta}><span>Urutan {row.sort_order}</span><span className={`ops-status ops-status--${row.is_active ? 'positive' : 'neutral'}`}>{row.is_active ? 'Aktif' : 'Nonaktif'}</span></div>
            <div className={styles.actions}>
              <button type="button" className={styles.iconButton} onClick={() => void move(row, -1)} disabled={busy || canonicalIndex <= 0} aria-label={`Naikkan ${row.name}`}><ArrowUp aria-hidden="true" size={15} /></button>
              <button type="button" className={styles.iconButton} onClick={() => void move(row, 1)} disabled={busy || canonicalIndex === rows.length - 1} aria-label={`Turunkan ${row.name}`}><ArrowDown aria-hidden="true" size={15} /></button>
              <button type="button" className="button button-outline" onClick={() => openEdit(row)} disabled={busy}><Pencil aria-hidden="true" size={14} />Edit</button>
              <button type="button" className="button button-outline" onClick={() => void setActive(row, !row.is_active)} disabled={busy}>{row.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
              <button type="button" className={styles.deleteButton} onClick={() => void remove(row)} disabled={busy}><Trash2 aria-hidden="true" size={14} />Hapus</button>
            </div>
          </article>
        })}
      </div> : null}

      <dialog ref={dialogRef} className={styles.dialog} onClose={() => setEditor(emptyEditor)} aria-labelledby="mentor-expertise-dialog-title" data-testid="mentor-expertise-dialog">
        <form className={styles.dialogSurface} onSubmit={save}>
          <header className={styles.dialogHeader}><div><p className="kicker">Mentor Expertise</p><h2 id="mentor-expertise-dialog-title">{editor.id ? 'Edit expertise' : 'Tambah expertise'}</h2></div><button type="button" className={styles.closeButton} onClick={() => dialogRef.current?.close()} aria-label="Tutup dialog"><X aria-hidden="true" size={18} /></button></header>
          <div className={styles.dialogBody}>
            <label>Nama expertise<input autoFocus required maxLength={100} value={editor.name} onChange={event => setEditor(current => ({ ...current, name: event.target.value }))} /></label>
            {editor.id ? <label>Stable slug<input readOnly value={rows.find(row => row.id === editor.id)?.slug || ''} /></label> : <p className={styles.helper}>Slug dibuat otomatis saat expertise pertama kali dibuat dan tidak berubah ketika nama diedit.</p>}
            <label className={styles.checkbox}><input type="checkbox" checked={editor.isActive} onChange={event => setEditor(current => ({ ...current, isActive: event.target.checked }))} />Aktif</label>
          </div>
          <footer className={styles.dialogActions}><button type="button" className="button button-outline" onClick={() => dialogRef.current?.close()} disabled={busyId !== null}>Batal</button><button className="button button-primary" disabled={busyId !== null}>{busyId ? 'Menyimpan…' : 'Simpan'}</button></footer>
        </form>
      </dialog>
    </section>
  )
}
