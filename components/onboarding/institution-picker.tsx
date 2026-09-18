'use client'

import { ArrowRight, Check } from 'lucide-react'
import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Institution, InstitutionType } from '@/lib/supabase/database.types'
import { formError } from '@/lib/auth/errors'
import { exactInstitutionMatches, normalizeInstitutionName } from '@/lib/onboarding/rules'

export const institutionLabels: Record<InstitutionType, string> = { university: 'Universitas', sma: 'SMA', smk: 'SMK' }

export function InstitutionPicker({ selected, onSelect, disabled }: { selected: Institution | null; onSelect: (value: Institution | null) => void; disabled: boolean }) {
  const listId = useId()
  const [query, setQuery] = useState(selected?.name || '')
  const [type, setType] = useState<InstitutionType>('university')
  const [results, setResults] = useState<Institution[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState(false)
  const normalized = normalizeInstitutionName(query)

  useEffect(() => {
    if (!open || normalized.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const timer = setTimeout(async () => {
      try {
        const { data, error: searchError } = await createClient().rpc('search_institutions', { p_query: normalized }).abortSignal(controller.signal)
        if (controller.signal.aborted) return
        if (searchError) throw searchError
        setResults(data || [])
        setActive(-1)
      } catch (searchError) {
        if (!controller.signal.aborted) setError(formError(searchError, 'Pencarian institusi gagal. Ketik ulang untuk mencoba lagi.'))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [normalized, open])

  function choose(value: Institution) {
    onSelect(value)
    setQuery(value.name)
    setOpen(false)
    setError('')
    setDuplicateWarning(false)
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActive(index => Math.max(0, Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault()
      if (active >= 0 && results[active]) choose(results[active])
    }
  }

  async function submitInstitution() {
    if (submitting || disabled || normalized.length < 2) return
    setSubmitting(true)
    setError('')
    try {
      const db = createClient()
      const { data: candidates, error: searchError } = await db.rpc('search_institutions', { p_query: normalized })
      if (searchError) throw searchError
      setResults(candidates || [])
      const duplicates = exactInstitutionMatches(normalized, type, (candidates || []).filter(item => item.approval_status === 'approved'))
      if (duplicates.length && !allowDuplicate) {
        setDuplicateWarning(true)
        return
      }
      const { data, error: submitError } = await db.rpc('submit_institution', { p_name: normalized, p_type: type, p_allow_duplicate: allowDuplicate })
      if (submitError) {
        if (submitError.code === '23505') {
          setDuplicateWarning(true)
          setError('Ada institusi dengan nama yang sama. Pilih hasil pencarian atau konfirmasi bahwa institusimu berbeda.')
          return
        }
        throw submitError
      }
      if (!data) throw new Error('Missing submission')
      choose(data)
    } catch (submitError) {
      setError(formError(submitError, 'Institusi belum dapat diajukan. Periksa koneksi dan coba lagi.'))
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="institution-picker">
    <label className="onboarding-hero-field">
      <span className="sr-only">Institusi</span>
      <input
        value={query}
        maxLength={250}
        disabled={disabled || submitting}
        role="combobox"
        aria-label="Institusi"
        aria-autocomplete="list"
        aria-expanded={open && normalized.length >= 2}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? listId + '-' + active : undefined}
        autoComplete="off"
        placeholder="Cari universitas atau sekolah…"
        onFocus={() => setOpen(true)}
        onKeyDown={keyDown}
        onChange={event => {
          setQuery(event.target.value)
          onSelect(null)
          setOpen(true)
          setAllowDuplicate(false)
          setDuplicateWarning(false)
        }}
      />
    </label>

    {selected && <div className="institution-selected" role="status">
      <Check aria-hidden="true" size={17} />
      <span><strong>{selected.name}</strong><small>{institutionLabels[selected.type]}{selected.city ? ' · ' + selected.city : ''}{selected.approval_status === 'pending' ? ' · Pengajuanmu sedang ditinjau' : ''}</small></span>
    </div>}

    {open && normalized.length >= 2 && <>
      <div id={listId} role="listbox" aria-label="Hasil pencarian institusi" className="institution-results">
        {loading && <p className="institution-results__status" role="status">Mencari institusi…</p>}
        {!loading && results.map((item, index) => <button
          type="button"
          id={listId + '-' + index}
          role="option"
          aria-selected={active === index}
          key={item.id}
          disabled={submitting || disabled}
          onClick={() => choose(item)}
        >
          <span><strong>{item.name}</strong><small>{institutionLabels[item.type]}{item.city ? ' · ' + item.city : ''}{item.approval_status === 'pending' ? ' · Pengajuanmu' : ''}</small></span>
          <ArrowRight aria-hidden="true" size={18} />
        </button>)}
        {!loading && !results.length && !error && <p className="institution-results__status">Institusi tidak ditemukan.</p>}
      </div>

      {!selected && <div className="institution-create">
        <p>Belum ada di daftar? Kamu tetap bisa mengajukannya.</p>
        <label>
          <span>Tipe institusi</span>
          <select value={type} disabled={disabled || submitting} onChange={event => { setType(event.target.value as InstitutionType); setAllowDuplicate(false) }}>
            {Object.entries(institutionLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        {duplicateWarning && <div className="institution-duplicate">
          <p>Ada nama yang sama. Periksa tipe dan kota pada hasil pencarian.</p>
          <label className="institution-duplicate__check">
            <input type="checkbox" checked={allowDuplicate} onChange={event => setAllowDuplicate(event.target.checked)} />
            <span>Institusi saya berbeda meskipun namanya sama.</span>
          </label>
        </div>}
        <button type="button" className="onboarding-text-action" disabled={disabled || submitting || loading || normalized.length < 2} onClick={submitInstitution}>
          {submitting ? 'Mengajukan…' : 'Gunakan “' + normalized + '”'}
        </button>
        <small>Pengajuan baru akan ditinjau admin.</small>
      </div>}
    </>}

    {error && <p className="onboarding-error" role="alert">{error}</p>}
  </div>
}
