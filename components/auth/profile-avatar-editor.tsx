/* eslint-disable @next/next/no-img-element */
'use client'

import { Crop, Save, UploadCloud, X } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'

import { DirectImageCropper } from '@/components/admin/direct-image-cropper'
import { cropRectFromJson, type CropOutput, type NormalizedCropRect } from '@/lib/media/image-crop'
import { accountMessage, type AccountLanguage } from '@/lib/auth/account-presentation'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

type Metadata = { hasAvatar: boolean; hasSource: boolean; crop: unknown }

export function ProfileAvatarEditor({ open, onClose, onSaved, language = 'id' }: { open: boolean; onClose: () => void; onSaved: (url: string, cleanupWarning?: string | null) => void; language?: AccountLanguage }) {
  const en = language === 'en'
  const text = (english: string, indonesian: string) => en ? english : indonesian
  const photoError = (message: string) => accountMessage(message, language, 'Your photo could not be saved. Check your connection and try again.')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [newSourceFile, setNewSourceFile] = useState<File | null>(null)
  const [editableSourceFile, setEditableSourceFile] = useState<File | null>(null)
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null)
  const [cropInitial, setCropInitial] = useState<NormalizedCropRect | null>(null)
  const [crop, setCrop] = useState<NormalizedCropRect | null>(null)
  const [preview, setPreview] = useState('')
  const [hasAvatar, setHasAvatar] = useState(false)
  const [hasSource, setHasSource] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (open) return
    setNewSourceFile(null)
    setEditableSourceFile(null)
    setCropSourceFile(null)
    setCropInitial(null)
    setCrop(null)
    setPreview('')
    setDragging(false)
    setBusy(false)
    setError('')
  }, [open])

  useEffect(() => {
    if (!open) return
    let active = true
    setError('')
    void fetch('/api/profile/avatar?meta=1', { cache: 'no-store' }).then(async response => {
      if (!response.ok) return
      const metadata = await response.json() as Metadata
      if (!active) return
      setHasAvatar(metadata.hasAvatar)
      setHasSource(metadata.hasSource)
      setCropInitial(cropRectFromJson(metadata.crop))
    })
    return () => { active = false }
  }, [open])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function choose(next: File | null) {
    setError('')
    if (!next) return
    if (!ALLOWED.has(next.type)) { setError(text('Choose a JPG, PNG, or WebP photo.', 'Format foto harus JPG, PNG, atau WebP.')); return }
    if (next.size <= 0 || next.size > MAX_BYTES) { setError(text('Choose a photo no larger than 8 MB.', 'Ukuran foto maksimal 8 MB.')); return }
    setNewSourceFile(next)
    setEditableSourceFile(next)
    setCropInitial(null)
    setCropSourceFile(next)
  }

  function drop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setDragging(false)
    choose(event.dataTransfer.files[0] ?? null)
  }

  async function adjustExisting() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/profile/avatar?source=1', { cache: 'no-store' })
      if (!response.ok) throw new Error('Sumber asli foto profil tidak tersedia.')
      const blob = await response.blob()
      const source = new File([blob], 'avatar-source', { type: blob.type || 'image/jpeg' })
      setNewSourceFile(null)
      setEditableSourceFile(source)
      setCropSourceFile(source)
    } catch (caught) {
      setError(photoError(caught instanceof Error ? caught.message : 'Sumber asli foto profil tidak tersedia.'))
    } finally {
      setBusy(false)
    }
  }

  function applyCrop(result: CropOutput) {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(result.file))
    setCrop(result.crop)
    setCropInitial(result.crop)
    setCropSourceFile(null)
  }

  async function save() {
    if (!crop) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      if (newSourceFile) form.set('file', newSourceFile)
      form.set('crop', JSON.stringify(crop))
      const response = await fetch('/api/profile/avatar', { method: 'POST', body: form })
      const body = await response.json() as { avatarUrl?: string; cleanupWarning?: string | null; error?: string }
      if (!response.ok || !body.avatarUrl) throw new Error(body.error || 'Foto profil belum dapat disimpan.')
      onSaved(body.avatarUrl, body.cleanupWarning ? accountMessage(body.cleanupWarning, language, 'Your photo was saved.') : null)
      setNewSourceFile(null)
      setEditableSourceFile(null)
      setCrop(null)
      setPreview('')
      onClose()
    } catch (value) {
      setError(photoError(value instanceof Error ? value.message : 'Foto profil belum dapat disimpan.'))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <dialog ref={dialogRef} className="avatar-editor-dialog" aria-labelledby="avatar-editor-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }} onClose={onClose}>
      <div className="avatar-editor-card">
        <header><div>{!en ? <p className="kicker">Foto profil</p> : null}<h3 id="avatar-editor-title">{text('Edit profile photo', 'Atur foto profil')}</h3><p>{text('JPG, PNG, or WebP · maximum 8 MB', 'JPG, PNG, atau WebP · maksimal 8 MB. Hasil akhir disimpan 512×512.')}</p></div><button type="button" className="ops-icon-button" aria-label={text('Close photo editor', 'Tutup editor foto')} title={text('Close', 'Tutup')} disabled={busy} onClick={onClose}><X aria-hidden="true" /></button></header>
        {preview ? <div className="avatar-crop-result"><img src={preview} alt={text('Profile photo preview', 'Pratinjau crop foto profil')} /><button type="button" className="button button-outline button-compact" onClick={() => setCropSourceFile(editableSourceFile)} disabled={!editableSourceFile || busy}><Crop aria-hidden="true" /> Adjust crop</button></div> : <button type="button" className={'avatar-dropzone ' + (dragging ? 'is-dragging' : '')} disabled={busy} onClick={() => inputRef.current?.click()} onDragEnter={event => { event.preventDefault(); setDragging(true) }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={drop}><UploadCloud aria-hidden="true" /><strong>{text('Click or drag a photo here', 'Klik atau tarik foto ke sini')}</strong><span>{text('Use a clear photo of your face.', 'Gunakan foto wajah yang jelas agar mudah dikenali.')}</span></button>}
        {hasAvatar && !preview ? <div className="avatar-existing-actions">
          {hasSource ? <button type="button" className="button button-outline button-compact" onClick={() => void adjustExisting()} disabled={busy}><Crop aria-hidden="true" /> {en ? 'Adjust crop' : 'Adjust existing crop'}</button> : <p>{en ? 'Replace your photo to adjust its crop.' : 'Original source is unavailable for this existing image. Replace the image once to enable future crop adjustments.'}</p>}
        </div> : null}
        <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { choose(event.target.files?.[0] ?? null); event.target.value = '' }} />
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <footer><button type="button" className="button button-outline" disabled={busy} onClick={() => preview ? inputRef.current?.click() : onClose()}>{preview ? text('Replace photo', 'Ganti foto') : text('Cancel', 'Batal')}</button><button type="button" className="button button-primary" disabled={!crop || busy} onClick={() => void save()}><Save aria-hidden="true" />{busy ? text('Saving…', 'Menyimpan…') : text('Save photo', 'Simpan foto')}</button></footer>
      </div>
    </dialog>
    <DirectImageCropper
      sourceFile={cropSourceFile}
      initialCrop={cropInitial}
      aspectRatio={1}
      outputWidth={512}
      outputHeight={512}
      minimumCropSourceWidth={128}
      minimumCropSourceHeight={128}
      title="Adjust profile photo"
      description="Drag the square crop or its corners. The selected source area must remain at least 128×128 px."
      onCancel={() => setCropSourceFile(null)}
      onApply={applyCrop}
    />
  </>
}
