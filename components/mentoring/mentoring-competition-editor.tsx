'use client'

import { Pencil, Save, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MultiValueChipInput } from '@/components/mentoring/multi-value-chip-input'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { menteeMentoringError } from '@/lib/mentoring-presentation'
import { createClient } from '@/lib/supabase/client'
import styles from '@/components/dashboard/mentee-mentoring.module.css'

type CompetitionContext = { parentId: string; competitionNames: string[]; competitionCategoryId: string | null }
type Category = { id: string; name: string; is_active: boolean }
type RpcClient = { rpc: <T>(name: string, args: Record<string, unknown>) => PromiseLike<{ data: T | null; error: { message: string } | null }> }

export function MentoringCompetitionEditor({ kind, parentId, readOnly = false, compact = false, summary = false, language = 'id', confirmDiscard = false }: {
  kind: 'private' | 'intensive'; parentId: string; readOnly?: boolean; compact?: boolean; summary?: boolean; language?: 'id' | 'en'; confirmDiscard?: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const rpc = supabase as unknown as RpcClient
  const english = language === 'en'
  const copy = (en: string, id: string) => english ? en : id
  const [data, setData] = useState<CompetitionContext | null>(null)
  const [names, setNames] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [editing, setEditing] = useState(false)
  const editingRef = useRef(false)
  editingRef.current = editing
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState(false)
  const loadSequence = useRef(0)

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    try {
      const [result, catalog] = await Promise.all([
        rpc.rpc<CompetitionContext>('get_mentoring_competition_names', { p_kind: kind, p_parent_id: parentId }),
        supabase.from('competition_categories').select('id,name,is_active').order('sort_order'),
      ])
      if (sequence !== loadSequence.current) return
      setLoadError(Boolean(result.error || !result.data || catalog.error))
      if (!result.error && result.data && !editingRef.current) {
        setData(result.data)
        setNames(result.data.competitionNames ?? [])
        setCategoryId(result.data.competitionCategoryId ?? '')
      }
      if (!catalog.error) setCategories((catalog.data ?? []) as Category[])
    } catch {
      if (sequence === loadSequence.current) setLoadError(true)
    }
  }, [kind, parentId, rpc, supabase])

  useEffect(() => { setData(null); setEditing(false); setMessage(''); void load(); return () => { loadSequence.current += 1 } }, [load])
  useOperationalInvalidation(['mentoring', 'admin-overview'], () => { void load() })

  async function save() {
    if (busy) return
    if (!names.length) { setMessage(copy('Add at least one competition name.', 'Tambahkan minimal satu nama lomba.')); return }
    setBusy(true)
    setMessage('')
    try {
      const result = await rpc.rpc<CompetitionContext>('set_mentoring_competition_names', { p_kind: kind, p_parent_id: parentId, p_competition_names: names, p_competition_category_id: categoryId || null })
      if (result.error || !result.data) {
        setMessage(english ? menteeMentoringError(result.error?.message, 'Unable to save competition details. Please try again.') : result.error?.message || 'Nama lomba belum dapat disimpan.')
        return
      }
      setData(result.data)
      setNames(result.data.competitionNames)
      setEditing(false)
      setMessage(copy('Saved', 'Nama lomba tersimpan.'))
    } catch { setMessage(copy('Unable to save competition details. Please try again.', 'Nama lomba belum dapat disimpan.')) }
    finally { setBusy(false) }
  }

  const values = data?.competitionNames ?? []
  const savedCategory = categories.find(category => category.id === data?.competitionCategoryId)
  const baseClass = `mentoring-preference-card mentoring-competition-card${compact ? ' is-compact' : ''}${summary ? ' mentoring-competition-summary' : ''}${english ? ` ${styles.competition}` : ''}`
  if (!data) return <section className={baseClass} aria-busy={!loadError}>
    <p className="muted" role={loadError ? 'alert' : 'status'}>{loadError ? copy('Unable to load competition details.', 'Nama lomba belum dapat dimuat.') : copy('Loading competition…', 'Memuat nama lomba…')}</p>
    {loadError ? <button type="button" className="button button-outline button-compact" onClick={() => void load()}>{copy('Try again', 'Coba lagi')}</button> : null}
  </section>

  if (!editing) return <section className={baseClass}>
    <div className="mentoring-preference-card__head">
      <div><span>{copy('Competition name', 'Nama lomba')}</span><div className="mentoring-chip-list">
        {values.length ? values.map(item => <span className="mentoring-chip" key={item}>{item}</span>) : <strong className="mentoring-empty-value">{copy('Competition not added', readOnly ? 'Belum ditentukan' : 'Lengkapi nama lomba')}</strong>}
        {savedCategory ? <span className="mentoring-chip mentoring-chip--category">{savedCategory.name}</span> : null}
      </div></div>
      {!readOnly ? <button className={summary ? 'mentoring-summary-icon-action' : 'button button-outline button-compact'} type="button" onClick={() => { setMessage(''); setEditing(true) }} aria-label={copy(values.length ? 'Edit competition name' : 'Add competition name', values.length ? 'Edit nama lomba' : 'Lengkapi nama lomba')} title={copy(values.length ? 'Edit competition name' : 'Add competition name', values.length ? 'Edit nama lomba' : 'Lengkapi nama lomba')}><Pencil aria-hidden="true" />{summary ? null : copy(values.length ? 'Edit' : 'Add', values.length ? 'Edit' : 'Lengkapi nama lomba')}</button> : null}
    </div>
    {message ? <small role="status">{message}</small> : null}
  </section>

  const dirty = JSON.stringify(names) !== JSON.stringify(values) || categoryId !== (data.competitionCategoryId ?? '')
  function cancelEdit() {
    if (busy || (confirmDiscard && dirty && !window.confirm(copy('Discard unsaved competition changes?', 'Batalkan perubahan kompetisi?')))) return
    setNames(values); setCategoryId(data!.competitionCategoryId ?? ''); setMessage(''); setEditing(false)
  }
  return <section className={`${baseClass} is-editing${summary ? ' mentoring-competition-summary--editing' : ''}`} data-unsaved={dirty?'true':undefined} data-saving={busy?'true':undefined}>
    <fieldset disabled={busy} style={{border:0,margin:0,padding:0,minWidth:0,display:'grid',gap:12}}>
    <MultiValueChipInput label={copy('Competition name', 'Nama lomba')} value={names} onChange={setNames} language={language} />
    <label className="ops-field"><span>{copy('Competition category (optional)', 'Kategori kompetisi (opsional)')}</span><select value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="">{copy('No category', 'Tanpa kategori')}</option>{categories.filter(category => category.is_active || category.id === categoryId).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    <div className="button-row"><button className="button button-primary" type="button" disabled={busy || !names.length} onClick={() => void save()}><Save aria-hidden="true" />{busy ? copy('Saving…', 'Menyimpan…') : copy('Save', 'Simpan nama lomba')}</button><button className="button button-outline" type="button" disabled={busy} onClick={cancelEdit}><X aria-hidden="true" />{copy('Cancel', 'Batal')}</button></div>
    {message ? <small className="form-error" role="alert">{message}</small> : null}
    </fieldset>
  </section>
}
