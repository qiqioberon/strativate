'use client'

/*
 * Adapted for Strativate from React Bits Circular Gallery.
 * Copyright (c) 2026 David Haz · MIT + Commons Clause License Condition v1.0.
 * Full third-party notice: /THIRD_PARTY_NOTICES.md
 */

import Image from 'next/image'
import { ArrowRight, Quote, X } from 'lucide-react'
import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { MarketingTestimonialView } from '@/lib/marketing/testimonial-types'

type GL = Renderer['gl']
type HoverRect = { left: number; top: number; width: number; height: number }
type GalleryHover = { index: number; rect: HoverRect } | null

function lerp(from: number, to: number, ease: number) {
  return from + (to - from) * ease
}

class TestimonialMedia {
  extra = 0
  speed = 0
  geometry: Plane
  gl: GL
  image: string
  index: number
  sourceIndex: number
  length: number
  scene: Transform
  screen: { width: number; height: number }
  viewport: { width: number; height: number }
  bend: number
  program!: Program
  plane!: Mesh
  scale = 1
  padding = 1.7
  width = 0
  widthTotal = 0
  x = 0

  constructor({
    geometry,
    gl,
    image,
    index,
    sourceIndex,
    length,
    scene,
    screen,
    viewport,
    bend,
  }: {
    geometry: Plane
    gl: GL
    image: string
    index: number
    sourceIndex: number
    length: number
    scene: Transform
    screen: { width: number; height: number }
    viewport: { width: number; height: number }
    bend: number
  }) {
    this.geometry = geometry
    this.gl = gl
    this.image = image
    this.index = index
    this.sourceIndex = sourceIndex
    this.length = length
    this.scene = scene
    this.screen = screen
    this.viewport = viewport
    this.bend = bend
    this.createShader()
    this.createMesh()
    this.onResize()
  }

  createShader() {
    const texture = new Texture(this.gl, { generateMipmaps: true })
    this.program = new Program(this.gl, {
      depthTest: false,
      depthWrite: false,
      vertex: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform float uTime;
        uniform float uSpeed;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z = (sin(p.x * 4.0 + uTime) + cos(p.y * 2.0 + uTime)) * uSpeed * 0.22;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform vec2 uImageSizes;
        uniform vec2 uPlaneSizes;
        uniform sampler2D tMap;
        varying vec2 vUv;

        float roundedBoxSDF(vec2 p, vec2 b, float r) {
          vec2 d = abs(p) - b;
          return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
        }

        void main() {
          vec2 ratio = vec2(
            min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
            min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
          );
          vec2 uv = vec2(
            vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
            vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
          );
          vec4 color = texture2D(tMap, uv);
          float distance = roundedBoxSDF(vUv - 0.5, vec2(0.445), 0.055);
          float alpha = 1.0 - smoothstep(-0.002, 0.002, distance);
          gl_FragColor = vec4(color.rgb, color.a * alpha);
        }
      `,
      uniforms: {
        tMap: { value: texture },
        uPlaneSizes: { value: [0, 0] },
        uImageSizes: { value: [1, 1] },
        uSpeed: { value: 0 },
        uTime: { value: 100 * Math.random() },
      },
      transparent: true,
    })

    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.src = this.image
    image.onload = () => {
      texture.image = image
      this.program.uniforms.uImageSizes.value = [image.naturalWidth, image.naturalHeight]
    }
  }

  createMesh() {
    this.plane = new Mesh(this.gl, { geometry: this.geometry, program: this.program })
    this.plane.setParent(this.scene)
  }

  update(scroll: { current: number; last: number }, direction: 'right' | 'left') {
    this.plane.position.x = this.x - scroll.current - this.extra
    const x = this.plane.position.x
    const halfViewport = this.viewport.width / 2

    if (this.bend === 0) {
      this.plane.position.y = 0
      this.plane.rotation.z = 0
    } else {
      const absoluteBend = Math.abs(this.bend)
      const radius = (halfViewport * halfViewport + absoluteBend * absoluteBend) / (2 * absoluteBend)
      const effectiveX = Math.min(Math.abs(x), halfViewport)
      const arc = radius - Math.sqrt(Math.max(0, radius * radius - effectiveX * effectiveX))
      if (this.bend > 0) {
        this.plane.position.y = -arc
        this.plane.rotation.z = -Math.sign(x) * Math.asin(effectiveX / radius)
      } else {
        this.plane.position.y = arc
        this.plane.rotation.z = Math.sign(x) * Math.asin(effectiveX / radius)
      }
    }

    this.speed = scroll.current - scroll.last
    this.program.uniforms.uTime.value += 0.035
    this.program.uniforms.uSpeed.value = Math.min(1.4, Math.abs(this.speed) * 1.6)

    const planeOffset = this.plane.scale.x / 2
    const viewportOffset = this.viewport.width / 2
    const isBefore = this.plane.position.x + planeOffset < -viewportOffset
    const isAfter = this.plane.position.x - planeOffset > viewportOffset
    if (direction === 'right' && isBefore) this.extra -= this.widthTotal
    if (direction === 'left' && isAfter) this.extra += this.widthTotal
  }

  onResize({
    screen,
    viewport,
  }: {
    screen?: { width: number; height: number }
    viewport?: { width: number; height: number }
  } = {}) {
    if (screen) this.screen = screen
    if (viewport) this.viewport = viewport
    this.scale = Math.max(0.72, Math.min(1.05, this.screen.height / 720))
    this.plane.scale.y = (this.viewport.height * (620 * this.scale)) / this.screen.height
    this.plane.scale.x = (this.viewport.width * (455 * this.scale)) / this.screen.width
    this.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y]
    this.width = this.plane.scale.x + this.padding
    this.widthTotal = this.width * this.length
    this.x = this.width * this.index
  }

  getScreenRect(): HoverRect {
    const width = (this.plane.scale.x / this.viewport.width) * this.screen.width
    const height = (this.plane.scale.y / this.viewport.height) * this.screen.height
    const centerX = this.screen.width / 2 + (this.plane.position.x / this.viewport.width) * this.screen.width
    const centerY = this.screen.height / 2 - (this.plane.position.y / this.viewport.height) * this.screen.height
    return {
      left: centerX - width / 2,
      top: centerY - height / 2,
      width,
      height,
    }
  }
}

class TestimonialGalleryApp {
  container: HTMLElement
  items: MarketingTestimonialView[]
  bend: number
  autoSpeed: number
  scroll = { ease: 0.055, current: 0, target: 0, last: 0, position: 0 }
  renderer!: Renderer
  gl!: GL
  camera!: Camera
  scene!: Transform
  geometry!: Plane
  medias: TestimonialMedia[] = []
  screen = { width: 1, height: 1 }
  viewport = { width: 1, height: 1 }
  raf = 0
  isDown = false
  moved = false
  startX = 0
  paused = false
  hoveredIndex: number | null = null
  onHover: (value: GalleryHover) => void
  onOpen: (index: number) => void

  constructor(
    container: HTMLElement,
    items: MarketingTestimonialView[],
    {
      bend = 2.4,
      autoSpeed = 0.012,
      reducedMotion = false,
      onHover,
      onOpen,
    }: {
      bend?: number
      autoSpeed?: number
      reducedMotion?: boolean
      onHover: (value: GalleryHover) => void
      onOpen: (index: number) => void
    },
  ) {
    this.container = container
    this.items = items
    this.bend = bend
    this.autoSpeed = reducedMotion ? 0 : autoSpeed
    this.onHover = onHover
    this.onOpen = onOpen
    this.createRenderer()
    this.createCamera()
    this.createScene()
    this.onResize()
    this.geometry = new Plane(this.gl, { heightSegments: 32, widthSegments: 64 })
    this.createMedias()
    this.addEventListeners()
    this.update()
  }

  createRenderer() {
    this.renderer = new Renderer({
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    })
    this.gl = this.renderer.gl
    this.gl.clearColor(0, 0, 0, 0)
    this.container.prepend(this.renderer.gl.canvas as HTMLCanvasElement)
  }

  createCamera() {
    this.camera = new Camera(this.gl)
    this.camera.fov = 45
    this.camera.position.z = 20
  }

  createScene() {
    this.scene = new Transform()
  }

  createMedias() {
    const repeated = this.items.length === 1
      ? [...this.items, ...this.items, ...this.items, ...this.items]
      : [...this.items, ...this.items]
    this.medias = repeated.map((item, index) => new TestimonialMedia({
      geometry: this.geometry,
      gl: this.gl,
      image: item.imageUrl,
      index,
      sourceIndex: index % this.items.length,
      length: repeated.length,
      scene: this.scene,
      screen: this.screen,
      viewport: this.viewport,
      bend: this.bend,
    }))
  }

  onResize = () => {
    this.screen = {
      width: Math.max(1, this.container.clientWidth),
      height: Math.max(1, this.container.clientHeight),
    }
    if (!this.renderer || !this.camera) return
    this.renderer.setSize(this.screen.width, this.screen.height)
    this.camera.perspective({ aspect: this.screen.width / this.screen.height })
    const fov = (this.camera.fov * Math.PI) / 180
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z
    this.viewport = { width: height * this.camera.aspect, height }
    this.medias.forEach(media => media.onResize({ screen: this.screen, viewport: this.viewport }))
  }

  hitTest(clientX: number, clientY: number) {
    const root = this.container.getBoundingClientRect()
    const x = clientX - root.left
    const y = clientY - root.top
    const hits = this.medias
      .map(media => ({ media, rect: media.getScreenRect() }))
      .filter(({ rect }) => x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height)
      .sort((a, b) => {
        const centerA = Math.abs((a.rect.left + a.rect.width / 2) - x)
        const centerB = Math.abs((b.rect.left + b.rect.width / 2) - x)
        return centerA - centerB
      })
    return hits[0] ?? null
  }

  showHover(hit: { media: TestimonialMedia; rect: HoverRect }) {
    this.paused = true
    this.scroll.target = this.scroll.current
    this.hoveredIndex = hit.media.sourceIndex
    this.onHover({ index: hit.media.sourceIndex, rect: hit.rect })
  }

  clearHover() {
    this.hoveredIndex = null
    this.onHover(null)
    this.paused = false
  }

  onPointerDown = (event: PointerEvent) => {
    if ((event.target as HTMLElement | null)?.closest('[data-testimonial-overlay-action]')) return
    this.isDown = true
    this.moved = false
    this.startX = event.clientX
    this.scroll.position = this.scroll.current
    this.paused = true
    this.hoveredIndex = null
    this.onHover(null)
    this.container.setPointerCapture?.(event.pointerId)
  }

  onPointerMove = (event: PointerEvent) => {
    if (this.isDown) {
      const distance = (this.startX - event.clientX) * 0.018
      if (Math.abs(this.startX - event.clientX) > 5) this.moved = true
      this.scroll.target = this.scroll.position + distance
      return
    }
    if (event.pointerType === 'touch') return
    const hit = this.hitTest(event.clientX, event.clientY)
    if (hit) {
      if (this.hoveredIndex !== hit.media.sourceIndex) this.showHover(hit)
      return
    }
    if (this.hoveredIndex !== null) this.clearHover()
  }

  onPointerUp = (event: PointerEvent) => {
    if (!this.isDown) return
    this.isDown = false
    if (!this.moved) {
      const hit = this.hitTest(event.clientX, event.clientY)
      if (hit) {
        this.showHover(hit)
        return
      }
    }
    this.paused = false
  }

  onPointerLeave = () => {
    if (!this.isDown && this.hoveredIndex !== null) this.clearHover()
  }

  onWheel = (event: WheelEvent) => {
    if (this.hoveredIndex !== null) return
    this.scroll.target += Math.sign(event.deltaY || event.deltaX) * 0.8
  }

  centeredMedia() {
    return [...this.medias].sort((a, b) => Math.abs(a.plane.position.x) - Math.abs(b.plane.position.x))[0]
  }

  onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      this.paused = true
      this.onHover(null)
      const width = this.medias[0]?.width ?? 1
      this.scroll.target += event.key === 'ArrowRight' ? width : -width
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const media = this.centeredMedia()
      if (!media) return
      event.preventDefault()
      this.onOpen(media.sourceIndex)
    }
  }

  onFocus = () => {
    this.paused = true
  }

  onBlur = (event: FocusEvent) => {
    if (this.container.contains(event.relatedTarget as Node | null)) return
    if (this.hoveredIndex === null) this.paused = false
  }

  addEventListeners() {
    window.addEventListener('resize', this.onResize)
    this.container.addEventListener('pointerdown', this.onPointerDown)
    this.container.addEventListener('pointermove', this.onPointerMove)
    this.container.addEventListener('pointerup', this.onPointerUp)
    this.container.addEventListener('pointercancel', this.onPointerUp)
    this.container.addEventListener('pointerleave', this.onPointerLeave)
    this.container.addEventListener('wheel', this.onWheel, { passive: true })
    this.container.addEventListener('keydown', this.onKeyDown)
    this.container.addEventListener('focus', this.onFocus)
    this.container.addEventListener('blur', this.onBlur)
  }

  update = () => {
    if (!this.paused && !this.isDown) this.scroll.target += this.autoSpeed
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease)
    const direction = this.scroll.current >= this.scroll.last ? 'right' : 'left'
    this.medias.forEach(media => media.update(this.scroll, direction))
    this.renderer.render({ scene: this.scene, camera: this.camera })
    this.scroll.last = this.scroll.current
    this.raf = window.requestAnimationFrame(this.update)
  }

  destroy() {
    window.cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    this.container.removeEventListener('pointerdown', this.onPointerDown)
    this.container.removeEventListener('pointermove', this.onPointerMove)
    this.container.removeEventListener('pointerup', this.onPointerUp)
    this.container.removeEventListener('pointercancel', this.onPointerUp)
    this.container.removeEventListener('pointerleave', this.onPointerLeave)
    this.container.removeEventListener('wheel', this.onWheel)
    this.container.removeEventListener('keydown', this.onKeyDown)
    this.container.removeEventListener('focus', this.onFocus)
    this.container.removeEventListener('blur', this.onBlur)
    const canvas = this.renderer?.gl?.canvas as HTMLCanvasElement | undefined
    canvas?.remove()
  }
}

export function TestimonialCircularGallery({ items }: { items: MarketingTestimonialView[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [hover, setHover] = useState<GalleryHover>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const selected = selectedIndex === null ? null : items[selectedIndex] ?? null
  const hoveredIndex = hover?.index ?? null
  const hoveredItem = hoveredIndex === null ? null : items[hoveredIndex] ?? null
  const overlayStyle = useMemo(() => {
    if (!hover) return undefined
    return {
      left: `${hover.rect.left}px`,
      top: `${hover.rect.top}px`,
      width: `${hover.rect.width}px`,
      height: `${hover.rect.height}px`,
    }
  }, [hover])

  const open = useCallback((index: number) => {
    setSelectedIndex(index)
    window.requestAnimationFrame(() => dialogRef.current?.showModal())
  }, [])

  const close = useCallback(() => {
    dialogRef.current?.close()
    setSelectedIndex(null)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || items.length === 0) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const app = new TestimonialGalleryApp(container, items, {
      reducedMotion,
      onHover: setHover,
      onOpen: open,
    })
    return () => {
      app.destroy()
    }
  }, [items, open])

  if (items.length === 0) return null

  return (
    <>
      <div
        ref={containerRef}
        className="marketing-testimonial-gallery"
        tabIndex={0}
        role="region"
        aria-label="Galeri cerita peserta. Gunakan tombol panah untuk menjelajah dan Enter untuk membuka testimoni."
        data-testid="testimonial-circular-gallery"
      >
        {hoveredItem && overlayStyle && hoveredIndex !== null ? (
          <div className="marketing-testimonial-gallery__overlay" style={overlayStyle} aria-hidden="false">
            <div className="marketing-testimonial-gallery__overlay-content">
              <span>{hoveredItem.competition_name}</span>
              <strong>{hoveredItem.achievement}</strong>
              <button
                type="button"
                onClick={() => open(hoveredIndex)}
                data-testimonial-overlay-action
                data-testid="testimonial-open-button"
              >
                Lihat testimoni <ArrowRight aria-hidden="true" size={15} />
              </button>
            </div>
          </div>
        ) : null}
        <span className="marketing-testimonial-gallery__hint" aria-hidden="true">
          Geser untuk menjelajah · arahkan atau sentuh kartu untuk melihat pencapaian
        </span>
      </div>

      <dialog
        ref={dialogRef}
        className="marketing-testimonial-dialog"
        aria-labelledby="testimonial-dialog-title"
        onCancel={event => {
          event.preventDefault()
          close()
        }}
        onClose={() => setSelectedIndex(null)}
        onClick={event => {
          if (event.target === event.currentTarget) close()
        }}
        data-testid="testimonial-dialog"
      >
        {selected ? (
          <div className="marketing-testimonial-dialog__panel">
            <div className="marketing-testimonial-dialog__media">
              <Image src={selected.imageUrl} alt={selected.alt_text} fill sizes="(max-width: 720px) 92vw, 46vw" unoptimized />
            </div>
            <div className="marketing-testimonial-dialog__content">
              <button type="button" className="marketing-testimonial-dialog__close" onClick={close} aria-label="Tutup testimoni">
                <X aria-hidden="true" size={18} />
              </button>
              <p className="marketing-kicker">Cerita dari peserta</p>
              <h2 id="testimonial-dialog-title">{selected.competition_name}</h2>
              <strong className="marketing-testimonial-dialog__achievement">{selected.achievement}</strong>
              <Quote aria-hidden="true" size={25} />
              <blockquote>{selected.testimonial}</blockquote>
              {selected.participant_label ? <p className="marketing-testimonial-dialog__participant">{selected.participant_label}</p> : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  )
}
