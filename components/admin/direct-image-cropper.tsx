'use client'

import { Crop, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import {
  cropSourcePixels,
  maximumCenteredCrop,
  normalizeCropRect,
  type CropOutput,
  type NormalizedCropRect,
} from '@/lib/media/image-crop'

type Corner = 'nw' | 'ne' | 'sw' | 'se'
type Interaction = {
  pointerId: number
  mode: 'move' | Corner
  startX: number
  startY: number
  crop: NormalizedCropRect
}

type Props = {
  sourceFile: File | null
  initialCrop?: NormalizedCropRect | null
  aspectRatio: number
  outputWidth: number
  outputHeight: number
  title: string
  description?: string
  minimumCropSourceWidth?: number
  minimumCropSourceHeight?: number
  warnBelowOutput?: boolean
  onCancel: () => void
  onApply: (result: CropOutput) => void
}

const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

export function DirectImageCropper({
  sourceFile,
  initialCrop,
  aspectRatio,
  outputWidth,
  outputHeight,
  title,
  description,
  minimumCropSourceWidth = 1,
  minimumCropSourceHeight = 1,
  warnBelowOutput = false,
  onCancel,
  onApply,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const imageRef = useRef<HTMLImageElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<Interaction | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 })
  const [crop, setCrop] = useState<NormalizedCropRect>({ x: 0, y: 0, width: 1, height: 1 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reset = useCallback(() => {
    if (!sourceSize.width || !sourceSize.height) return
    setCrop(maximumCenteredCrop(sourceSize.width, sourceSize.height, aspectRatio))
  }, [aspectRatio, sourceSize.height, sourceSize.width])

  useEffect(() => {
    if (!sourceFile) return
    const url = URL.createObjectURL(sourceFile)
    setSourceUrl(url)
    setSourceSize({ width: 0, height: 0 })
    setBusy(false)
    setError('')
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      URL.revokeObjectURL(url)
      if (dialog?.open) dialog.close()
    }
  }, [sourceFile])

  const sourceCrop = useMemo(
    () => cropSourcePixels(crop, sourceSize.width, sourceSize.height),
    [crop, sourceSize],
  )
  const sourceReady = sourceSize.width > 0 && sourceSize.height > 0
  const belowMinimum = sourceReady && (sourceCrop.width < minimumCropSourceWidth || sourceCrop.height < minimumCropSourceHeight)
  const showQualityWarning = sourceReady && warnBelowOutput && (
    sourceCrop.width < outputWidth || sourceCrop.height < outputHeight
  )

  function loadImage() {
    const image = imageRef.current
    if (!image?.naturalWidth || !image.naturalHeight) return
    const size = { width: image.naturalWidth, height: image.naturalHeight }
    setSourceSize(size)
    setCrop(normalizeCropRect(initialCrop, size.width, size.height, aspectRatio))
  }

  function beginInteraction(event: ReactPointerEvent<HTMLElement>, mode: Interaction['mode']) {
    if (!stageRef.current || busy) return
    event.preventDefault()
    event.stopPropagation()
    stageRef.current.setPointerCapture(event.pointerId)
    interactionRef.current = {
      pointerId: event.pointerId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      crop,
    }
  }

  function moveInteraction(event: ReactPointerEvent<HTMLElement>) {
    const interaction = interactionRef.current
    const stage = stageRef.current
    if (!interaction || interaction.pointerId !== event.pointerId || !stage) return
    event.preventDefault()
    const bounds = stage.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const dx = (event.clientX - interaction.startX) / bounds.width
    const dy = (event.clientY - interaction.startY) / bounds.height

    if (interaction.mode === 'move') {
      setCrop({
        ...interaction.crop,
        x: clamp(interaction.crop.x + dx, 0, 1 - interaction.crop.width),
        y: clamp(interaction.crop.y + dy, 0, 1 - interaction.crop.height),
      })
      return
    }

    const fromLeft = interaction.mode === 'nw' || interaction.mode === 'sw'
    const fromTop = interaction.mode === 'nw' || interaction.mode === 'ne'
    const anchorX = fromLeft ? interaction.crop.x + interaction.crop.width : interaction.crop.x
    const anchorY = fromTop ? interaction.crop.y + interaction.crop.height : interaction.crop.y
    const pointerX = (fromLeft ? interaction.crop.x : interaction.crop.x + interaction.crop.width) + dx
    const pointerY = (fromTop ? interaction.crop.y : interaction.crop.y + interaction.crop.height) + dy
    const normalizedRatio = aspectRatio * sourceSize.height / sourceSize.width
    const maximum = maximumCenteredCrop(sourceSize.width, sourceSize.height, aspectRatio)
    const minimumWidth = Math.max(
      maximum.width * .14,
      minimumCropSourceWidth / sourceSize.width,
      minimumCropSourceHeight / sourceSize.height * normalizedRatio,
    )
    const horizontalWidth = Math.abs(anchorX - pointerX)
    const verticalWidth = Math.abs(anchorY - pointerY) * normalizedRatio
    let width = Math.abs(dx * bounds.width) >= Math.abs(dy * bounds.height) ? horizontalWidth : verticalWidth
    const maxWidthByX = fromLeft ? anchorX : 1 - anchorX
    const maxHeight = fromTop ? anchorY : 1 - anchorY
    width = clamp(width, minimumWidth, Math.min(maxWidthByX, maxHeight * normalizedRatio))
    const height = width / normalizedRatio
    setCrop({
      x: fromLeft ? anchorX - width : anchorX,
      y: fromTop ? anchorY - height : anchorY,
      width,
      height,
    })
  }

  function endInteraction(event: ReactPointerEvent<HTMLElement>) {
    if (interactionRef.current?.pointerId !== event.pointerId) return
    if (stageRef.current?.hasPointerCapture(event.pointerId)) stageRef.current.releasePointerCapture(event.pointerId)
    interactionRef.current = null
  }

  async function applyCrop() {
    const image = imageRef.current
    if (!image?.naturalWidth || !image.naturalHeight || !sourceFile || belowMinimum) return
    setBusy(true)
    setError('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = outputWidth
      canvas.height = outputHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Browser could not prepare the crop canvas.')
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      const source = cropSourcePixels(crop, image.naturalWidth, image.naturalHeight)
      context.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, outputWidth, outputHeight)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', .9))
      if (!blob) throw new Error('The cropped image could not be generated.')
      const baseName = sourceFile.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'photo'
      onApply({
        file: new File([blob], `${baseName}-${outputWidth}x${outputHeight}.webp`, { type: 'image/webp', lastModified: Date.now() }),
        crop,
        sourceWidth: image.naturalWidth,
        sourceHeight: image.naturalHeight,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The cropped image could not be generated.')
      setBusy(false)
    }
  }

  if (!sourceFile) return null

  return <dialog
    ref={dialogRef}
    className="direct-crop-dialog"
    aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}
  >
    <div className="direct-crop-dialog__header">
      <div>
        <p className="kicker">Photo crop</p>
        <h3 id={titleId}>{title}</h3>
        <p>{description ?? `Drag the crop or its corners. Final output: ${outputWidth} × ${outputHeight}.`}</p>
      </div>
      <button type="button" className="editorial-icon-button" onClick={onCancel} disabled={busy} aria-label="Close crop dialog" title="Close"><X aria-hidden="true" /></button>
    </div>
    <div className="direct-crop-dialog__body">
      <div className="direct-crop-workspace">
        <div
          ref={stageRef}
          className="direct-crop-stage"
          onPointerMove={moveInteraction}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imageRef} src={sourceUrl} alt="Full original image to crop" onLoad={loadImage} draggable={false} />
          {sourceSize.width ? <>
            <span className="direct-crop-shade direct-crop-shade--top" style={{ height: `${crop.y * 100}%` }} />
            <span className="direct-crop-shade direct-crop-shade--bottom" style={{ top: `${(crop.y + crop.height) * 100}%` }} />
            <span className="direct-crop-shade direct-crop-shade--left" style={{ top: `${crop.y * 100}%`, width: `${crop.x * 100}%`, height: `${crop.height * 100}%` }} />
            <span className="direct-crop-shade direct-crop-shade--right" style={{ top: `${crop.y * 100}%`, left: `${(crop.x + crop.width) * 100}%`, height: `${crop.height * 100}%` }} />
            <div
              className="direct-crop-selection"
              style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}
              onPointerDown={event => beginInteraction(event, 'move')}
              aria-label="Movable crop selection"
            >
              <span className="direct-crop-grid" aria-hidden="true" />
              {corners.map(corner => <span
                key={corner}
                className={`direct-crop-handle direct-crop-handle--${corner}`}
                onPointerDown={event => beginInteraction(event, corner)}
                aria-hidden="true"
              />)}
            </div>
          </> : null}
        </div>
      </div>
      <div className="direct-crop-meta">
        <span>{Math.round(sourceCrop.width)} × {Math.round(sourceCrop.height)} source px</span>
        <button type="button" onClick={reset} disabled={busy}><RotateCcw aria-hidden="true" /> Reset</button>
      </div>
      {belowMinimum ? <p className="form-error" role="alert">The selected crop is too small. Enlarge it before applying.</p> : null}
      {showQualityWarning ? <p className="direct-crop-warning" role="status">Selected crop may look blurry at the final size.</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
    <div className="direct-crop-dialog__footer">
      <button type="button" className="button button-outline button-compact" onClick={onCancel} disabled={busy}>Cancel</button>
      <button type="button" className="button button-primary button-compact" onClick={() => void applyCrop()} disabled={busy || belowMinimum || !sourceSize.width}><Crop aria-hidden="true" /> {busy ? 'Applying…' : 'Apply crop'}</button>
    </div>
  </dialog>
}
