'use client'

import { Crop, ImagePlus, UploadCloud } from 'lucide-react'
import { useId } from 'react'
import { createPortal } from 'react-dom'
import { DirectImageCropper } from '@/components/admin/direct-image-cropper'
import type { AdminImageTarget, AdminImageUpload } from '@/components/admin/use-admin-image-upload'

export function AdminImageUploadField({ image, target, storedUrl, sourcePath, alt = 'Image preview', disabled = false, onApplied }: {
  image: AdminImageUpload
  target: AdminImageTarget
  storedUrl?: string | null
  sourcePath?: string | null
  alt?: string
  disabled?: boolean
  onApplied?: () => void
}) {
  const id = useId()
  const preview = image.previewUrl || storedUrl
  const busy = disabled || image.loadingSource
  return <div className="editorial-cover-editor">
    {preview ? <div className="editorial-cover-preview">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt={alt} style={{ aspectRatio: `${target.width} / ${target.height}`, objectFit: 'cover' }} />
      <div className="editorial-cover-preview__actions">
        <button type="button" className="button button-outline button-compact" disabled={busy} onClick={() => document.getElementById(id)?.click()}><ImagePlus aria-hidden="true" /> Replace</button>
        <button type="button" className="button button-outline button-compact" disabled={busy || (!image.originalFile && !sourcePath)} onClick={() => void image.adjust(sourcePath)}><Crop aria-hidden="true" /> {image.loadingSource ? 'Loading original…' : 'Adjust crop'}</button>
      </div>
      {!image.originalFile && !sourcePath ? <p className="editorial-cover-legacy-note">Original source is unavailable for this existing image. Replace the image once to enable future crop adjustments.</p> : null}
    </div> : <label className="editorial-cover-dropzone" htmlFor={id} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy) image.choose(event.dataTransfer.files[0] ?? null) }}>
      <UploadCloud aria-hidden="true" /><strong>Drop an image here or click to upload</strong>
      <span>JPG / PNG / WebP · max {target.maxBytes / 1024 / 1024} MB</span>
    </label>}
    <input id={id} aria-label="Select image" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { image.choose(event.target.files?.[0] ?? null); event.target.value = '' }} />
    <small>Final output: {target.width} × {target.height} px · WebP</small>
    {image.cropperProps.sourceFile ? createPortal(<DirectImageCropper {...image.cropperProps} onApply={result => { image.cropperProps.onApply(result); onApplied?.() }} />, document.body) : null}
  </div>
}
