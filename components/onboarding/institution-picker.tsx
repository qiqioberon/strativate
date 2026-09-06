'use client'
import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Institution, InstitutionType } from '@/lib/supabase/database.types'
import { formError } from '@/lib/auth/errors'
import { exactInstitutionMatches, normalizeInstitutionName } from '@/lib/onboarding/rules'

export const institutionLabels: Record<InstitutionType, string> = { university: 'Universitas', sma: 'SMA', smk: 'SMK' }
export function InstitutionPicker({ selected, onSelect, disabled }: { selected: Institution | null; onSelect: (value: Institution | null) => void; disabled: boolean }) {
  const listId = useId()
  const [query, setQuery] = useState(selected?.name || ''), [type, setType] = useState<InstitutionType>('university')
  const [results, setResults] = useState<Institution[]>([]), [open, setOpen] = useState(false), [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false), [submitting, setSubmitting] = useState(false), [error, setError] = useState('')
  const [allowDuplicate, setAllowDuplicate] = useState(false), [duplicateWarning, setDuplicateWarning] = useState(false)
  const normalized = normalizeInstitutionName(query)
  useEffect(() => {
    if (!open || normalized.length < 2) { setResults([]); setLoading(false); return }
    const controller = new AbortController()
    setLoading(true); setError('')
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await createClient().rpc('search_institutions', { p_query: normalized }).abortSignal(controller.signal)
        if (controller.signal.aborted) return
        if (error) throw error
        setResults(data || []); setActive(-1)
      } catch (error) { if (!controller.signal.aborted) setError(formError(error, 'Pencarian institusi gagal. Ketik ulang untuk mencoba lagi.')) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [normalized, open])
  function choose(value: Institution) { onSelect(value); setQuery(value.name); setOpen(false); setError(''); setDuplicateWarning(false) }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { setOpen(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true)
      setActive(index => Math.max(0, Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault()
      if (active >= 0 && results[active]) choose(results[active])
    }
  }
  async function submitInstitution() {
    setSubmitting(true); setError('')
    try {
      const db = createClient()
      // Recheck just before submission. The RPC also checks concurrent duplicates.
      const { data: candidates, error: searchError } = await db.rpc('search_institutions', { p_query: normalized })
      if (searchError) throw searchError
      setResults(candidates || [])
      const duplicates = exactInstitutionMatches(normalized, type, (candidates || []).filter(i => i.approval_status === 'approved'))
      if (duplicates.length && !allowDuplicate) { setDuplicateWarning(true); return }
      const { data, error } = await db.rpc('submit_institution', { p_name: normalized, p_type: type, p_allow_duplicate: allowDuplicate })
      if (error) {
        if (error.code === '23505') { setDuplicateWarning(true); setError('Ada institusi dengan nama yang sama. Pilih hasil pencarian atau konfirmasi bahwa institusimu berbeda.'); return }
        throw error
      }
      if (!data) throw new Error('Missing submission')
      choose(data)
    } catch (error) { setError(formError(error, 'Institusi belum dapat diajukan. Periksa koneksi dan coba lagi.')) }
    finally { setSubmitting(false) }
  }
  return <div className="institution-picker"><label>Institusi<input value={query} maxLength={250} disabled={disabled || submitting} role="combobox" aria-autocomplete="list" aria-expanded={open && normalized.length >= 2} aria-controls={listId} aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined} autoComplete="off" placeholder="Ketik minimal 2 karakter" onFocus={() => setOpen(true)} onKeyDown={keyDown} onChange={e => { setQuery(e.target.value); onSelect(null); setOpen(true); setAllowDuplicate(false); setDuplicateWarning(false) }} /></label>
    {selected && <p role="status">{institutionLabels[selected.type]}{selected.city ? ` · ${selected.city}` : ''}{selected.approval_status === 'pending' ? ' · Pengajuanmu sedang ditinjau dan sudah dapat digunakan.' : ''}</p>}
    {open && normalized.length >= 2 && <><div id={listId} role="listbox" aria-label="Hasil pencarian institusi" className="institution-results">
      {loading ? <p role="status">Mencari institusi…</p> : results.map((item, index) => <button type="button" id={`${listId}-${index}`} role="option" aria-selected={active === index} key={item.id} disabled={submitting || disabled} onClick={() => choose(item)}>{item.name}<small>{institutionLabels[item.type]}{item.city ? ` · ${item.city}` : ''}{item.approval_status === 'pending' ? ' · Pengajuanmu' : ''}</small></button>)}
      {!loading && !results.length && !error && <p>Institusi tidak ditemukan.</p>}
    </div>{!selected && <div className="editor-panel"><label>Tipe institusi baru<select value={type} disabled={disabled || submitting} onChange={e => { setType(e.target.value as InstitutionType); setAllowDuplicate(false) }}>{Object.entries(institutionLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      {duplicateWarning && <><p>Ada nama yang sama. Periksa tipe dan kota pada hasil pencarian.</p><label className="option-label"><input type="checkbox" checked={allowDuplicate} onChange={e => setAllowDuplicate(e.target.checked)} />Institusi saya berbeda meskipun namanya sama.</label></>}
      <button type="button" className="text-link" disabled={disabled || submitting || loading || normalized.length < 2} onClick={submitInstitution}>{submitting ? 'Mengajukan…' : `+ Gunakan: “${normalized}”`}</button><small>Pengajuan baru akan ditinjau admin.</small>
    </div>}</>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>
}
