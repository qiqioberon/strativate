'use client'

import {
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import {
  calculateCoverImagePlacement,
  normalizeImageFit,
  type ImageFit,
} from '@/lib/media/image-fit'

import styles from './image-fit-editor.module.css'

type ImageFitEditorProps = {
  src: string
  alt: string
  fit: ImageFit
  onFitChange: (fit: ImageFit) => void
  targetWidth: number
  targetHeight: number
  minZoom?: number
  maxZoom?: number
  editable?: boolean
  testId?: string
}

export function ImageFitEditor({
  src,
  alt,
  fit,
  onFitChange,
  targetWidth,
  targetHeight,
  minZoom = 1,
  maxZoom = 3,
  editable = true,
  testId = 'image-fit-editor',
}: ImageFitEditorProps) {
  const [sourceDimensions, setSourceDimensions] = useState<{ width: number; height: number } | null>(null)
  const dragRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    startX: number
    startY: number
  } | null>(null)

  const placement = useMemo(() => {
    if (!editable || !sourceDimensions) return null
    return calculateCoverImagePlacement(
      sourceDimensions.width,
      sourceDimensions.height,
      targetWidth,
      targetHeight,
      fit,
      minZoom,
      maxZoom,
    )
  }, [editable, fit, maxZoom, minZoom, sourceDimensions, targetHeight, targetWidth])

  function updateFit(next: Partial<ImageFit>) {
    onFitChange(normalizeImageFit({ ...fit, ...next }, minZoom, maxZoom))
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!editable) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      startX: fit.x,
      startY: fit.y,
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!editable || !drag || drag.pointerId !== event.pointerId) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return

    updateFit({
      x: drag.startX - ((event.clientX - drag.clientX) / bounds.width) * 100,
      y: drag.startY - ((event.clientY - drag.clientY) / bounds.height) * 100,
    })
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
  }

  const imageStyle = editable && placement ? {
    position: 'absolute' as const,
    left: (placement.x / targetWidth) * 100 + '%',
    top: (placement.y / targetHeight) * 100 + '%',
    width: (placement.width / targetWidth) * 100 + '%',
    height: (placement.height / targetHeight) * 100 + '%',
    objectFit: 'fill' as const,
  } : {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  }

  return (
    <div className={styles.editor} data-testid={testId}>
      <div
        className={styles.frame}
        style={{ aspectRatio: `${targetWidth} / ${targetHeight}` }}
        data-draggable={editable ? 'true' : 'false'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={event => {
            const image = event.currentTarget
            setSourceDimensions({ width: image.naturalWidth, height: image.naturalHeight })
          }}
          style={imageStyle}
        />
        {editable ? <span className={styles.frameHint}>Drag to reposition</span> : null}
      </div>

      {editable ? (
        <div className={styles.controls} data-testid={testId + '-controls'}>
          <div className={styles.meta}>
            <span>Sesuaikan cover agar memenuhi frame card. Drag preview atau gunakan kontrol berikut.</span>
            <strong>{targetWidth} × {targetHeight} px · 4:5</strong>
          </div>
          <label>
            Posisi horizontal
            <input
              type="range"
              min="0"
              max="100"
              value={fit.x}
              onChange={event => updateFit({ x: Number(event.target.value) })}
            />
          </label>
          <label>
            Posisi vertikal
            <input
              type="range"
              min="0"
              max="100"
              value={fit.y}
              onChange={event => updateFit({ y: Number(event.target.value) })}
            />
          </label>
          <label>
            Zoom
            <input
              type="range"
              min={minZoom}
              max={maxZoom}
              step=".05"
              value={fit.zoom}
              onChange={event => updateFit({ zoom: Number(event.target.value) })}
            />
          </label>
          <button
            type="button"
            className="button button-outline"
            onClick={() => onFitChange({ x: 50, y: 50, zoom: 1 })}
          >
            Reset to Fit
          </button>
        </div>
      ) : null}
    </div>
  )
}
