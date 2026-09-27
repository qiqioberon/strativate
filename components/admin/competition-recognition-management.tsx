'use client'

import { ArrowDown, ArrowUp, CircleAlert, ImagePlus, Pencil, RefreshCw, Trash2, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { formError } from '@/lib/auth/errors'
import {
  buildCompetitionRecognitionPayload,
  getNextCompetitionRecognitionOrder,
  isCompetitionRecognitionSetupRequired,
  moveCompetitionRecognitionIdToPosition,
  reorderCompetitionRecognitionIds,
  safeCompetitionLogoFileName,
  validateCompetitionRecognitionDraft,
  type CompetitionRecognitionDraftErrors,
} from '@/lib/marketing/competition-recognition-admin'
import { createClient } from '@/lib/supabase/client'
import type { CompetitionRecognition } from '@/lib/supabase/database.types'

const migrationName = '202609270001_competition_recognitions.sql'
const bucket = 'marketing-editorial'

export function CompetitionRecognitionManagement() {
  const supabase = useMemo(() => createClient(), [])
  const [recognitions, setRecognitions] = useState<CompetitionRecognition[]>([])
  const [editing, setEditing] = useState<CompetitionRecognition | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<CompetitionRecognitionDraftErrors>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const busy = busyAction !== null

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSetupRequired(false)
    setLoadFailed(false)
    const { data, error: loadError } = await supabase
      .from('competition_recognitions')
      .select('*')
      .order('display_order')
      .order('created_at')
    if (loadError) {
      setRecognitions([])
      if (isCompetitionRecognitionSetupRequired(loadError)) setSetupRequired(true)
      else {
        setLoadFailed(true)
        setError(formError(loadError, 'Competition recognitions could not be loaded. Check the connection and try again.'))
      }
    } else setRecognitions(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedFile])

  function resetEditor() {
    setEditing(null)
    setSelectedFile(null)
    setFieldErrors({})
  }

  function beginEditing(recognition: CompetitionRecognition) {
    setEditing(recognition)
    setSelectedFile(null)
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  async function reorderEditedRecognition(recognitionId: string, position: number) {
    const ids = moveCompetitionRecognitionIdToPosition(recognitions, recognitionId, position)
    if (ids.every((id, index) => id === recognitions[index]?.id)) return null
    const { error: reorderError } = await supabase.rpc('reorder_competition_recognitions', { p_ids: ids })
    return reorderError
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const values = new FormData(form)
    const competitionName = String(values.get('competition_name'))
    const position = editing ? String(values.get('position')) : undefined
    const validation = validateCompetitionRecognitionDraft({
      competitionName,
      position,
      recognitionCount: editing ? recognitions.length : undefined,
      file: selectedFile,
      hasStoredLogo: Boolean(editing?.logo_path),
    })
    setFieldErrors(validation)
    setError('')
    setNotice('')
    if (Object.keys(validation).length) return

    const wasEditing = Boolean(editing)
    const requestedPosition = editing && position !== undefined ? Number(position) : null
    setBusyAction('save')
    let uploadedPath: string | null = null
    try {
      if (selectedFile) {
        uploadedPath = `recognition-logos/${crypto.randomUUID()}-${safeCompetitionLogoFileName(selectedFile.name, selectedFile.type)}`
        const { error: uploadError } = await supabase.storage.from('marketing-editorial').upload(uploadedPath, selectedFile, {
          cacheControl: '3600',
          contentType: selectedFile.type,
          upsert: false,
        })
        if (uploadError) throw uploadError
      }

      const payload = buildCompetitionRecognitionPayload({
        competitionName,
        logoPath: uploadedPath,
        storedLogoPath: editing?.logo_path ?? null,
        isActive: values.get('is_active') === 'on',
      })
      const result = editing
        ? await supabase.from('competition_recognitions').update(payload).eq('id', editing.id)
        : await supabase.from('competition_recognitions').insert({ ...payload, display_order: getNextCompetitionRecognitionOrder(recognitions) })
      if (result.error) throw result.error

      let warning = ''
      if (editing && requestedPosition !== null) {
        const reorderError = await reorderEditedRecognition(editing.id, requestedPosition)
        if (reorderError) warning += ' The recognition was saved, but its position could not be updated.'
      }
      if (editing && uploadedPath && editing.logo_path !== uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from(bucket).remove([editing.logo_path])
        if (cleanupError) warning += ' The old logo still needs manual Storage cleanup.'
      }
      resetEditor()
      form.reset()
      setNotice(`${wasEditing ? 'Recognition updated.' : 'Recognition added.'}${warning}`)
      await load()
    } catch (caught) {
      let cleanupWarning = ''
      if (uploadedPath) {
        const { data: persisted, error: reconciliationError } = await supabase
          .from('competition_recognitions')
          .select('id,logo_path')
          .eq('logo_path', uploadedPath)
          .maybeSingle()
        if (persisted) {
          let warning = ''
          if (editing && requestedPosition !== null) {
            const reorderError = await reorderEditedRecognition(editing.id, requestedPosition)
            if (reorderError) warning += ' The recognition was saved, but its position could not be updated.'
          }
          if (editing && editing.logo_path !== uploadedPath) {
            const { error: cleanupError } = await supabase.storage.from(bucket).remove([editing.logo_path])
            if (cleanupError) warning += ' The old logo still needs manual Storage cleanup.'
          }
          resetEditor()
          form.reset()
          setNotice(`${wasEditing ? 'Recognition updated.' : 'Recognition added.'}${warning}`)
          await load()
          return
        }
        if (reconciliationError) {
          cleanupWarning = ' The new file was not removed because its database status could not be confirmed. Review the recognition list and Storage before retrying.'
        } else {
          const { error: cleanupError } = await supabase.storage.from(bucket).remove([uploadedPath])
          if (cleanupError) cleanupWarning = ' The new file also needs manual Storage cleanup.'
        }
      }
      setError(`${formError(caught)}${cleanupWarning}`)
    } finally {
      setBusyAction(null)
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (busy) return
    const ids = reorderCompetitionRecognitionIds(recognitions, index, direction)
    if (ids.every((id, position) => id === recognitions[position]?.id)) return
    setBusyAction(`move-${recognitions[index].id}`)
    setError('')
    setNotice('')
    const { error: reorderError } = await supabase.rpc('reorder_competition_recognitions', { p_ids: ids })
    if (reorderError) setError(formError(reorderError))
    else {
      setNotice('Recognition order updated.')
      await load()
    }
    setBusyAction(null)
  }

  async function toggleActive(recognition: CompetitionRecognition) {
    if (busy) return
    setBusyAction(`toggle-${recognition.id}`)
    setError('')
    setNotice('')
    const { error: updateError } = await supabase.from('competition_recognitions').update({ is_active: !recognition.is_active }).eq('id', recognition.id)
    if (updateError) setError(formError(updateError))
    else {
      setNotice(recognition.is_active ? 'Recognition hidden from the homepage.' : 'Recognition shown on the homepage.')
      await load()
    }
    setBusyAction(null)
  }

  async function remove(recognition: CompetitionRecognition) {
    if (busy || !window.confirm(`Delete recognition “${recognition.competition_name}” and its logo?`)) return
    setBusyAction(`delete-${recognition.id}`)
    setError('')
    setNotice('')
    const { error: rowError } = await supabase.from('competition_recognitions').delete().eq('id', recognition.id)
    if (rowError) setError(formError(rowError))
    else {
      let warning = ''
      const remainingIds = recognitions.filter(item => item.id !== recognition.id).map(item => item.id)
      if (remainingIds.length) {
        const { error: reorderError } = await supabase.rpc('reorder_competition_recognitions', { p_ids: remainingIds })
        if (reorderError) warning += ' Remaining positions need review.'
      }
      const { error: storageError } = await supabase.storage.from(bucket).remove([recognition.logo_path])
      if (storageError) warning += ' The logo still needs manual Storage cleanup.'
      setNotice(`Recognition deleted.${warning}`)
      if (editing?.id === recognition.id) resetEditor()
      await load()
    }
    setBusyAction(null)
  }

  const publicUrl = useCallback((path: string) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl, [supabase])
  const editorPreview = previewUrl ?? (editing ? publicUrl(editing.logo_path) : null)
  const editingPosition = editing ? recognitions.findIndex(item => item.id === editing.id) + 1 : null

  return <section className="competition-recognition-admin" data-testid="competition-recognition-admin-section" aria-busy={busy || loading}>
    <div className="role-page-title"><p className="kicker">Content · Homepage</p><h2>Competition Recognition</h2><p>Manage approved competition-finalist logos, their homepage visibility, and display order.</p></div>
    {loading ? <div className="role-card competition-recognition-admin__state" role="status"><RefreshCw aria-hidden="true"/> Loading competition recognitions…</div> : null}
    {!loading && setupRequired ? <div className="role-card competition-recognition-admin__state" role="alert"><CircleAlert aria-hidden="true"/><div><h3>Database setup required</h3><p>Apply migration <code>{migrationName}</code> before managing recognition logos.</p></div><button type="button" className="button button-outline" onClick={() => void load()}>Try again</button></div> : null}
    {!loading && loadFailed ? <div className="role-card competition-recognition-admin__state" role="alert"><CircleAlert aria-hidden="true"/><div><h3>Competition recognitions could not be loaded</h3><p>{error}</p></div><button type="button" className="button button-outline" onClick={() => void load()}>Try again</button></div> : null}
    {!loading && !setupRequired && !loadFailed ? <div className="competition-recognition-admin__layout">
      <form className="role-card competition-recognition-admin__form" key={editing?.id ?? 'new'} onSubmit={save} noValidate>
        <div className="role-card-heading"><div><p className="kicker">{editing ? 'Edit recognition' : 'New recognition'}</p><h3>{editing?.competition_name ?? 'Add competition recognition'}</h3></div><ImagePlus aria-hidden="true"/></div>
        <label>Competition name <span>Required</span><input name="competition_name" required maxLength={180} defaultValue={editing?.competition_name ?? ''} aria-invalid={Boolean(fieldErrors.competitionName)}/>{fieldErrors.competitionName ? <small className="form-error">{fieldErrors.competitionName}</small> : null}</label>
        <label>Logo <span>{editing ? 'Optional replacement' : 'Required'}</span><input name="logo" type="file" accept="image/jpeg,image/png,image/webp" required={!editing} onChange={event => setSelectedFile(event.target.files?.[0] ?? null)} aria-invalid={Boolean(fieldErrors.file)}/><small>JPG, PNG, or WebP. Maximum 5 MB.</small>{fieldErrors.file ? <small className="form-error">{fieldErrors.file}</small> : null}</label>
        <div className="competition-recognition-admin__preview">{editorPreview ? (
          // Admin previews can use local object URLs or Supabase public URLs outside Next Image's static host allowlist.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={editorPreview} alt={editing?.competition_name ?? 'New competition logo preview'}/>
        ) : <Trophy aria-hidden="true"/>}</div>
        {editing ? <label>Position <span>Required</span><input name="position" type="number" min={1} max={recognitions.length} step={1} required defaultValue={editingPosition ?? 1} aria-invalid={Boolean(fieldErrors.position)}/>{fieldErrors.position ? <small className="form-error">{fieldErrors.position}</small> : null}</label> : null}
        <label className="competition-recognition-admin__active"><input name="is_active" type="checkbox" defaultChecked={editing?.is_active ?? true}/><span>Active on homepage</span></label>
        <div className="button-row"><button className="button button-primary" disabled={busy} data-testid="competition-recognition-add-button">{editing ? 'Save changes' : 'Add recognition'}</button>{editing ? <button type="button" className="button button-outline" onClick={resetEditor} disabled={busy}>Cancel</button> : null}</div>
      </form>
      <section className="role-card competition-recognition-admin__list"><div className="role-card-heading"><div><p className="kicker">Homepage order</p><h3>{recognitions.length} recognitions</h3></div><button type="button" className="button button-outline" onClick={() => void load()} disabled={busy}>Refresh</button></div>
        {!recognitions.length ? <div className="empty-state"><Trophy aria-hidden="true"/><h3>No recognition logos yet.</h3><p>The public statement remains visible without an empty logo wall.</p></div> : null}
        {recognitions.map((recognition, index) => <article key={recognition.id} className="competition-recognition-admin__row"><div className="competition-recognition-admin__logo">
          {/* Supabase public URLs are generated dynamically and are not limited to Next Image's static host allowlist. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={publicUrl(recognition.logo_path)} alt={recognition.competition_name}/>
        </div><div><strong>{recognition.competition_name}</strong><small>Position {index + 1} · {recognition.is_active ? 'Active' : 'Inactive'}</small></div><div className="competition-recognition-admin__actions"><button type="button" role="switch" aria-checked={recognition.is_active} onClick={() => void toggleActive(recognition)} disabled={busy}>{recognition.is_active ? 'Active' : 'Inactive'}</button><button type="button" onClick={() => void move(index, -1)} disabled={busy || index === 0} data-testid={`competition-recognition-${recognition.id}-move-up-button`}><ArrowUp aria-hidden="true"/>Up</button><button type="button" onClick={() => void move(index, 1)} disabled={busy || index === recognitions.length - 1} data-testid={`competition-recognition-${recognition.id}-move-down-button`}><ArrowDown aria-hidden="true"/>Down</button><button type="button" onClick={() => beginEditing(recognition)} disabled={busy} data-testid={`competition-recognition-${recognition.id}-edit-button`}><Pencil aria-hidden="true"/>Edit</button><button type="button" onClick={() => void remove(recognition)} disabled={busy} data-testid={`competition-recognition-${recognition.id}-delete-button`}><Trash2 aria-hidden="true"/>Delete</button></div></article>)}
      </section>
    </div> : null}
    {error && !loadFailed ? <p className="form-error" role="alert">{error}</p> : null}{notice ? <p className="form-success" role="status">{notice}</p> : null}
  </section>
}
