'use client'

import { Crop, Minus, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  sourceFile: File | null
  onCancel: () => void
  onApply: (file: File) => void
}

function drawCrop(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  zoom: number,
  panX: number,
  panY: number,
) {
  const baseScale = Math.max(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight)
  const effectiveScale = baseScale * zoom
  const sourceWidth = Math.min(image.naturalWidth, targetWidth / effectiveScale)
  const sourceHeight = Math.min(image.naturalHeight, targetHeight / effectiveScale)
  const maxX = Math.max(0, (image.naturalWidth - sourceWidth) / 2)
  const maxY = Math.max(0, (image.naturalHeight - sourceHeight) / 2)
  const sourceX = Math.max(0, Math.min(image.naturalWidth - sourceWidth, (image.naturalWidth - sourceWidth) / 2 - (panX / 100) * maxX))
  const sourceY = Math.max(0, Math.min(image.naturalHeight - sourceHeight, (image.naturalHeight - sourceHeight) / 2 - (panY / 100) * maxY))

  context.clearRect(0, 0, targetWidth, targetHeight)
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight)
}

export function EditorialCoverCropper({ sourceFile, onCancel, onApply }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const drawPreview = useCallback(() => {
    const image = imageRef.current
    const canvas = previewCanvasRef.current
    if (!image?.naturalWidth || !image.naturalHeight || !canvas) return
    canvas.width = 800
    canvas.height = 450
    const context = canvas.getContext('2d')
    if (!context) return
    drawCrop(context, image, canvas.width, canvas.height, zoom, panX, panY)
  }, [panX, panY, zoom])

  useEffect(() => {
    if (!sourceFile) return
    const url = URL.createObjectURL(sourceFile)
    setSourceUrl(url)
    setZoom(1)
    setPanX(0)
    setPanY(0)
    setBusy(false)
    setError('')
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      URL.revokeObjectURL(url)
      if (dialog?.open) dialog.close()
    }
  }, [sourceFile])

  useEffect(() => {
    drawPreview()
  }, [drawPreview, sourceUrl])

  async function applyCrop() {
    const image = imageRef.current
    if (!image?.naturalWidth || !image.naturalHeight || !sourceFile) return
    setBusy(true)
    setError('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1600
      canvas.height = 900
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Crop canvas is unavailable.')
      drawCrop(context, image, canvas.width, canvas.height, zoom, panX, panY)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.88))
      if (!blob) throw new Error('The cropped cover could not be generated.')
      const baseName = sourceFile.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'cover'
      onApply(new File([blob], `${baseName}-1600x900.webp`, { type: 'image/webp', lastModified: Date.now() }))
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : 'The cropped cover could not be generated.')
      setBusy(false)
    }
  }

  if (!sourceFile) return null

  return <dialog
    ref={dialogRef}
    className="editorial-crop-dialog"
    aria-labelledby="editorial-crop-title"
    onCancel={event => { event.preventDefault(); onCancel() }}
  >
    <div className="editorial-crop-dialog__header">
      <div>
        <p className="kicker">Cover image</p>
        <h3 id="editorial-crop-title">Crop Cover</h3>
        <p>Pan and zoom inside the fixed 16:9 frame. Final output is approximately 1600 × 900.</p>
      </div>
      <button type="button" className="editorial-icon-button" onClick={onCancel} aria-label="Close crop dialog"><X aria-hidden="true" /></button>
    </div>
    <div className="editorial-crop-dialog__body">
      <div className="editorial-crop-frame" aria-label="16 by 9 crop preview">
        {sourceUrl ? <img ref={imageRef} className="editorial-crop-source" src={sourceUrl} alt="" onLoad={drawPreview} /> : null}
        <canvas ref={previewCanvasRef} aria-hidden="true" />
        <span aria-hidden="true"><Crop /></span>
      </div>
      <div className="editorial-crop-controls">
        <label><span>Zoom</span><div><Minus aria-hidden="true" /><input type="range" min="1" max="3" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))} /><Plus aria-hidden="true" /></div></label>
        <label><span>Horizontal pan</span><input type="range" min="-100" max="100" step="1" value={panX} onChange={event => setPanX(Number(event.target.value))} /></label>
        <label><span>Vertical pan</span><input type="range" min="-100" max="100" step="1" value={panY} onChange={event => setPanY(Number(event.target.value))} /></label>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
    <div className="editorial-crop-dialog__footer">
      <button type="button" className="button button-outline" onClick={onCancel} disabled={busy}>Cancel</button>
      <button type="button" className="button button-primary" onClick={() => void applyCrop()} disabled={busy}><Crop aria-hidden="true" /> {busy ? 'Applying…' : 'Apply Crop'}</button>
    </div>
  </dialog>
}
