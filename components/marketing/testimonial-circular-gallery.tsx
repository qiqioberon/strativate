'use client'

/*
 * Adapted for Strativate from React Bits Circular Gallery.
 * Copyright (c) 2026 David Haz · MIT + Commons Clause License Condition v1.0.
 * Full third-party notice: /THIRD_PARTY_NOTICES.md
 */

import Image from 'next/image'
import { ArrowRight, Quote, X } from 'lucide-react'
import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl'
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  getTestimonialDragScrollDelta,
  getTestimonialDragThreshold,
  getTestimonialGalleryGeometry,
  getTestimonialHorizontalWheelDelta,
  getTestimonialReleaseMomentum,
  resolveTestimonialDragIntent,
  resolveTestimonialPointerRelease,
  type TestimonialDragIntent,
} from '@/lib/marketing/testimonial-gallery-input'
import { usePageMotionReady } from '@/components/navigation/use-page-motion-ready'
import type { MarketingTestimonialView } from '@/lib/marketing/testimonial-types'

type GL = Renderer['gl']
type HoverRect = { left: number; top: number; width: number; height: number; rotation: number }
type GalleryHover = { index: number; mediaIndex: number; rect: HoverRect } | null
type GalleryIntroState = 'pending' | 'running' | 'complete'

const GALLERY_INTRO_DURATION_MS = 620
const GALLERY_INTRO_STAGGER_MS = 110
const GALLERY_INTRO_MIN_LIFT_PX = 64
const GALLERY_INTRO_MAX_LIFT_PX = 96

function cssTimeToMs(value: string) {
  const trimmed = value.trim()
  if (trimmed.endsWith('ms')) return Number.parseFloat(trimmed) || 0
  if (trimmed.endsWith('s')) return (Number.parseFloat(trimmed) || 0) * 1000
  return 0
}

function maxTransitionTimeMs(style: CSSStyleDeclaration) {
  const durations = style.transitionDuration.split(',').map(cssTimeToMs)
  const delays = style.transitionDelay.split(',').map(cssTimeToMs)
  const count = Math.max(durations.length, delays.length)
  let max = 0
  for (let index = 0; index < count; index += 1) {
    const duration = durations[index % durations.length] ?? 0
    const delay = delays[index % delays.length] ?? 0
    max = Math.max(max, duration + delay)
  }
  return max
}

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
  width = 0
  widthTotal = 0
  x = 0
  muted = false
  introProgress = 1
  introStartAt: number | null = null
  introDurationMs = 0
  introLiftPx = 0

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
        uniform float uOpacity;
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
          gl_FragColor = vec4(color.rgb, color.a * alpha * uOpacity);
        }
      `,
      uniforms: {
        tMap: { value: texture },
        uPlaneSizes: { value: [0, 0] },
        uImageSizes: { value: [1, 1] },
        uOpacity: { value: 1 },
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

  syncOpacity() {
    this.program.uniforms.uOpacity.value = this.muted ? 0 : this.introProgress
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.syncOpacity()
  }

  prepareIntro() {
    this.introProgress = 0
    this.introStartAt = null
    this.introDurationMs = 0
    this.introLiftPx = 0
    this.syncOpacity()
  }

  startIntro(startAt: number, durationMs: number, liftPx: number) {
    this.introProgress = 0
    this.introStartAt = startAt
    this.introDurationMs = durationMs
    this.introLiftPx = liftPx
    this.syncOpacity()
  }

  finishIntro() {
    this.introProgress = 1
    this.introStartAt = null
    this.introDurationMs = 0
    this.introLiftPx = 0
    this.syncOpacity()
  }

  updateIntro(now: number) {
    if (this.introStartAt === null) return this.introProgress >= 1
    if (now < this.introStartAt) {
      this.introProgress = 0
      this.syncOpacity()
      return false
    }

    const elapsed = now - this.introStartAt
    const linear = Math.min(1, elapsed / Math.max(1, this.introDurationMs))
    this.introProgress = 1 - Math.pow(1 - linear, 3)
    this.syncOpacity()

    if (linear < 1) return false

    this.finishIntro()
    return true
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

    if (this.introProgress < 1 && this.introLiftPx > 0) {
      const lift = (this.viewport.height * this.introLiftPx) / Math.max(1, this.screen.height)
      this.plane.position.y -= lift * (1 - this.introProgress)
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
    const { cardWidth, cardHeight, gap, bend } = getTestimonialGalleryGeometry(this.screen.width)
    this.bend = bend
    this.plane.scale.y = (this.viewport.height * cardHeight) / this.screen.height
    this.plane.scale.x = (this.viewport.width * cardWidth) / this.screen.width
    this.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y]
    this.width = this.plane.scale.x + (this.viewport.width * gap) / this.screen.width
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
      rotation: -this.plane.rotation.z,
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
  startY = 0
  dragVelocity = 0
  dragLastScroll = 0
  dragLastTime = 0
  dragIntent: TestimonialDragIntent | null = null
  pointerType = ''
  paused = false
  touchActive = false
  hoveredIndex: number | null = null
  activeMedia: TestimonialMedia | null = null
  mediaRestoreTimer: number | null = null
  keyboardRevealRequested = false
  reducedMotion: boolean
  introState: GalleryIntroState
  introMedias: TestimonialMedia[] = []
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
    this.reducedMotion = reducedMotion
    this.introState = reducedMotion ? 'complete' : 'pending'
    this.autoSpeed = reducedMotion ? 0 : autoSpeed
    this.onHover = onHover
    this.onOpen = onOpen
    this.createRenderer()
    this.createCamera()
    this.createScene()
    this.onResize()
    this.geometry = new Plane(this.gl, { heightSegments: 32, widthSegments: 64 })
    this.createMedias()
    if (!this.reducedMotion) this.medias.forEach(media => media.prepareIntro())
    this.centerInitialSequence()
    this.syncIntroDataset()
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
    const { cardWidth, gap, bend } = getTestimonialGalleryGeometry(this.screen.width)
    const cardSpan = cardWidth + gap
    const cardsForViewport = Math.ceil(this.screen.width / cardSpan)
    const repeatCount = Math.max(3, Math.ceil((cardsForViewport + 8) / this.items.length))
    const repeated = Array.from({ length: repeatCount }, () => this.items).flat()
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
      bend,
    }))
  }

  centerInitialSequence() {
    const firstMedia = this.medias[0]
    if (!firstMedia) return
    const centerIndex = Math.floor(this.medias.length / 2)
    const offset = firstMedia.width * centerIndex
    this.scroll.current = offset
    this.scroll.target = offset
    this.scroll.last = offset
    this.scroll.position = offset
  }

  syncIntroDataset(order?: number[]) {
    this.container.dataset.introState = this.introState
    if (order) this.container.dataset.introOrder = order.join(',')
  }

  finishIntro() {
    this.medias.forEach(media => media.finishIntro())
    this.introMedias = []
    this.introState = 'complete'
    this.syncIntroDataset()
  }

  beginIntro() {
    if (this.introState !== 'pending') return
    if (this.reducedMotion) {
      this.finishIntro()
      return
    }

    const visible = this.medias
      .map(media => ({ media, rect: media.getScreenRect() }))
      .filter(({ rect }) => rect.left + rect.width > 0 && rect.left < this.screen.width)
      .sort((a, b) => a.rect.left - b.rect.left)

    this.medias.forEach(media => media.finishIntro())

    if (visible.length === 0) {
      this.finishIntro()
      return
    }

    const liftPx = Math.min(
      GALLERY_INTRO_MAX_LIFT_PX,
      Math.max(GALLERY_INTRO_MIN_LIFT_PX, this.screen.height * 0.18),
    )
    const startedAt = performance.now()
    visible.forEach(({ media }, index) => {
      media.startIntro(
        startedAt + index * GALLERY_INTRO_STAGGER_MS,
        GALLERY_INTRO_DURATION_MS,
        liftPx,
      )
    })

    this.introMedias = visible.map(({ media }) => media)
    this.introState = 'running'
    this.syncIntroDataset(visible.map(({ rect }) => Math.round(rect.left)))
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
      .filter(({ rect }) => {
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const deltaX = x - centerX
        const deltaY = y - centerY
        const cosine = Math.cos(rect.rotation)
        const sine = Math.sin(rect.rotation)
        const localX = deltaX * cosine + deltaY * sine
        const localY = -deltaX * sine + deltaY * cosine
        return Math.abs(localX) <= rect.width / 2 && Math.abs(localY) <= rect.height / 2
      })
      .sort((a, b) => {
        const centerA = Math.abs((a.rect.left + a.rect.width / 2) - x)
        const centerB = Math.abs((b.rect.left + b.rect.width / 2) - x)
        return centerA - centerB
      })
    return hits[0] ?? null
  }

  cancelMediaRestore() {
    if (this.mediaRestoreTimer === null) return
    window.clearTimeout(this.mediaRestoreTimer)
    this.mediaRestoreTimer = null
  }

  restoreActiveMedia(delay = 320) {
    this.cancelMediaRestore()
    const media = this.activeMedia
    if (!media) return
    this.mediaRestoreTimer = window.setTimeout(() => {
      media.setMuted(false)
      if (this.activeMedia === media) this.activeMedia = null
      this.mediaRestoreTimer = null
    }, delay)
  }

  showHover(hit: { media: TestimonialMedia; rect: HoverRect }) {
    this.paused = true
    this.keyboardRevealRequested = false
    this.cancelMediaRestore()
    if (this.activeMedia && this.activeMedia !== hit.media) this.activeMedia.setMuted(false)
    this.activeMedia = hit.media
    this.scroll.target = this.scroll.current
    this.scroll.last = this.scroll.current
    this.hoveredIndex = hit.media.sourceIndex
    this.onHover({ index: hit.media.sourceIndex, mediaIndex: hit.media.index, rect: hit.rect })
  }

  showTouch(hit: { media: TestimonialMedia; rect: HoverRect }) {
    this.touchActive = true
    if (this.activeMedia === hit.media && this.hoveredIndex !== null) return
    this.showHover(hit)
  }

  muteActiveMedia(mediaIndex: number) {
    if (!this.activeMedia || this.activeMedia.index !== mediaIndex) return false
    this.activeMedia.setMuted(true)
    return true
  }

  clearHover() {
    this.keyboardRevealRequested = false
    this.hoveredIndex = null
    this.onHover(null)
    this.restoreActiveMedia()
    this.paused = false
  }

  onPointerDown = (event: PointerEvent) => {
    if ((event.target as HTMLElement | null)?.closest('[data-testimonial-overlay-action]')) return
    this.isDown = true
    this.moved = false
    this.startX = event.clientX
    this.startY = event.clientY
    this.pointerType = event.pointerType
    this.dragVelocity = 0
    this.dragLastScroll = this.scroll.current
    this.dragLastTime = event.timeStamp
    this.dragIntent = 'pending'
    this.scroll.target = this.scroll.current
    this.scroll.position = this.scroll.current
  }

  onPointerMove = (event: PointerEvent) => {
    if (this.isDown) {
      const deltaX = this.startX - event.clientX
      const deltaY = this.startY - event.clientY

      if (this.dragIntent === 'pending') {
        const threshold = getTestimonialDragThreshold(this.pointerType)
        this.dragIntent = resolveTestimonialDragIntent(deltaX, deltaY, threshold)
        if (this.dragIntent === 'vertical') return
        if (this.dragIntent === 'horizontal') {
          const dragDelta = getTestimonialDragScrollDelta(deltaX, this.screen.width, this.viewport.width)
          this.scroll.position = this.scroll.current - dragDelta
          this.dragVelocity = 0
          this.dragLastScroll = this.scroll.current
          this.dragLastTime = event.timeStamp
          this.paused = true
          this.touchActive = false
          this.hoveredIndex = null
          this.onHover(null)
          this.restoreActiveMedia()
          try {
            this.container.setPointerCapture?.(event.pointerId)
          } catch {
            // The pointer may already be inactive when a browser finishes dispatching this move.
          }
        }
      }

      if (this.dragIntent === 'horizontal') {
        this.moved = true
        const dragDelta = getTestimonialDragScrollDelta(deltaX, this.screen.width, this.viewport.width)
        const nextScroll = this.scroll.position + dragDelta
        const elapsed = Math.max(1, event.timeStamp - this.dragLastTime)
        const instantVelocity = (nextScroll - this.dragLastScroll) / elapsed
        this.dragVelocity = this.dragVelocity * .65 + instantVelocity * .35
        this.dragLastScroll = nextScroll
        this.dragLastTime = event.timeStamp
        this.scroll.current = nextScroll
        this.scroll.target = nextScroll
      }
      return
    }

    if ((event.target as HTMLElement | null)?.closest('[data-testimonial-popout]')) return
    if (event.pointerType === 'touch') return
    const hit = this.hitTest(event.clientX, event.clientY)
    if (hit) {
      if (this.activeMedia !== hit.media) this.showHover(hit)
      return
    }
    if (this.hoveredIndex !== null) this.clearHover()
  }

  onPointerUp = (event: PointerEvent) => {
    if (!this.isDown) return
    const intent = this.dragIntent
    const pointerType = this.pointerType
    this.isDown = false
    this.dragIntent = null
    this.pointerType = ''

    if (!intent) return
    const release = resolveTestimonialPointerRelease(pointerType, intent, this.moved)
    if (release === 'ignore') return

    if (release === 'activate') {
      const hit = this.hitTest(event.clientX, event.clientY)
      if (hit) {
        if (pointerType === 'touch' || pointerType === 'pen') this.showTouch(hit)
        else this.showHover(hit)
        return
      }
      if (this.touchActive) {
        this.touchActive = false
        this.clearHover()
        return
      }
    }

    if (release === 'resume') {
      const releaseAge = Math.max(0, event.timeStamp - this.dragLastTime)
      const velocity = releaseAge <= 80 ? this.dragVelocity : 0
      const maxMomentum = (this.medias[0]?.width ?? 1) * 1.1
      this.scroll.target = this.scroll.current + getTestimonialReleaseMomentum(velocity, maxMomentum)
    }

    this.dragVelocity = 0
    this.paused = false
  }

  onPointerCancel = () => {
    if (!this.isDown) return
    this.isDown = false
    this.dragVelocity = 0
    this.dragIntent = null
    this.pointerType = ''
    this.scroll.target = this.scroll.current
    this.paused = this.touchActive
  }

  onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen' || this.touchActive) return
    if (!this.isDown && this.hoveredIndex !== null) this.clearHover()
  }

  onDocumentPointerDown = (event: PointerEvent) => {
    if (!this.touchActive || this.container.contains(event.target as Node | null)) return
    this.touchActive = false
    this.clearHover()
  }

  onWheel = (event: WheelEvent) => {
    if (this.hoveredIndex !== null) return
    const horizontalDelta = getTestimonialHorizontalWheelDelta(event.deltaX, event.deltaY)
    if (horizontalDelta === 0) return
    this.scroll.target += horizontalDelta * 0.012
  }

  centeredMedia() {
    return [...this.medias].sort((a, b) => Math.abs(a.plane.position.x) - Math.abs(b.plane.position.x))[0]
  }

  onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      this.paused = true
      this.keyboardRevealRequested = true
      this.hoveredIndex = null
      this.onHover(null)
      this.restoreActiveMedia()
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
    if (this.touchActive || (this.isDown && (this.pointerType === 'touch' || this.pointerType === 'pen'))) return
    const media = this.centeredMedia()
    if (media) {
      this.showHover({ media, rect: media.getScreenRect() })
      return
    }
    this.paused = true
  }

  onBlur = (event: FocusEvent) => {
    if (this.container.contains(event.relatedTarget as Node | null)) return
    this.keyboardRevealRequested = false
    this.hoveredIndex = null
    this.onHover(null)
    this.restoreActiveMedia()
    this.paused = false
  }

  addEventListeners() {
    window.addEventListener('resize', this.onResize)
    this.container.addEventListener('pointerdown', this.onPointerDown)
    this.container.addEventListener('pointermove', this.onPointerMove)
    this.container.addEventListener('pointerup', this.onPointerUp)
    this.container.addEventListener('pointercancel', this.onPointerCancel)
    this.container.addEventListener('pointerleave', this.onPointerLeave)
    this.container.addEventListener('wheel', this.onWheel, { passive: true })
    this.container.addEventListener('keydown', this.onKeyDown)
    this.container.addEventListener('focus', this.onFocus)
    this.container.addEventListener('blur', this.onBlur)
    document.addEventListener('pointerdown', this.onDocumentPointerDown)
  }

  update = () => {
    const now = performance.now()
    if (this.introState === 'running') {
      let complete = true
      this.introMedias.forEach(media => {
        if (!media.updateIntro(now)) complete = false
      })
      if (complete) this.finishIntro()
    }

    if (this.introState === 'complete' && !this.paused && !this.isDown) {
      this.scroll.target += this.autoSpeed
    }
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease)
    const direction = this.scroll.current >= this.scroll.last ? 'right' : 'left'
    this.medias.forEach(media => media.update(this.scroll, direction))
    if (this.keyboardRevealRequested) {
      const width = this.medias[0]?.width ?? 1
      if (Math.abs(this.scroll.target - this.scroll.current) <= width * 0.06) {
        const media = this.centeredMedia()
        if (media) this.showHover({ media, rect: media.getScreenRect() })
      }
    }
    this.renderer.render({ scene: this.scene, camera: this.camera })
    this.scroll.last = this.scroll.current
    this.raf = window.requestAnimationFrame(this.update)
  }

  destroy() {
    window.cancelAnimationFrame(this.raf)
    this.cancelMediaRestore()
    this.activeMedia?.setMuted(false)
    this.activeMedia = null
    window.removeEventListener('resize', this.onResize)
    this.container.removeEventListener('pointerdown', this.onPointerDown)
    this.container.removeEventListener('pointermove', this.onPointerMove)
    this.container.removeEventListener('pointerup', this.onPointerUp)
    this.container.removeEventListener('pointercancel', this.onPointerCancel)
    this.container.removeEventListener('pointerleave', this.onPointerLeave)
    this.container.removeEventListener('wheel', this.onWheel)
    this.container.removeEventListener('keydown', this.onKeyDown)
    this.container.removeEventListener('focus', this.onFocus)
    this.container.removeEventListener('blur', this.onBlur)
    document.removeEventListener('pointerdown', this.onDocumentPointerDown)
    const canvas = this.renderer?.gl?.canvas as HTMLCanvasElement | undefined
    canvas?.remove()
  }
}

export function TestimonialCircularGallery({ items }: { items: MarketingTestimonialView[] }) {
  const motionReady = usePageMotionReady()
  const containerRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const appRef = useRef<TestimonialGalleryApp | null>(null)
  const activeHoverMediaRef = useRef<number | null>(null)
  const hoverExitTimerRef = useRef<number | null>(null)
  const raiseFrameRef = useRef<number | null>(null)
  const [hover, setHover] = useState<GalleryHover>(null)
  const [popoutRaised, setPopoutRaised] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const selected = selectedIndex === null ? null : items[selectedIndex] ?? null
  const hoveredIndex = hover?.index ?? null
  const hoveredItem = hoveredIndex === null ? null : items[hoveredIndex] ?? null
  const overlayStyle = useMemo(() => {
    if (!hover) return undefined
    const inset = 2
    return {
      left: `${hover.rect.left + inset}px`,
      top: `${hover.rect.top + inset}px`,
      width: `${Math.max(0, hover.rect.width - inset * 2)}px`,
      height: `${Math.max(0, hover.rect.height - inset * 2)}px`,
      '--testimonial-rotation': `${hover.rect.rotation}rad`,
    } as CSSProperties
  }, [hover])

  const handleHover = useCallback((value: GalleryHover) => {
    if (hoverExitTimerRef.current !== null) {
      window.clearTimeout(hoverExitTimerRef.current)
      hoverExitTimerRef.current = null
    }
    if (raiseFrameRef.current !== null) {
      window.cancelAnimationFrame(raiseFrameRef.current)
      raiseFrameRef.current = null
    }

    if (value) {
      activeHoverMediaRef.current = value.mediaIndex
      setHover(value)
      setPopoutRaised(false)
      return
    }

    activeHoverMediaRef.current = null
    setPopoutRaised(false)
    hoverExitTimerRef.current = window.setTimeout(() => {
      setHover(null)
      hoverExitTimerRef.current = null
    }, 320)
  }, [])

  const handlePopoutImageReady = useCallback((mediaIndex: number) => {
    if (activeHoverMediaRef.current !== mediaIndex) return
    if (raiseFrameRef.current !== null) window.cancelAnimationFrame(raiseFrameRef.current)

    raiseFrameRef.current = window.requestAnimationFrame(() => {
      raiseFrameRef.current = window.requestAnimationFrame(() => {
        if (activeHoverMediaRef.current !== mediaIndex) {
          raiseFrameRef.current = null
          return
        }
        if (!appRef.current?.muteActiveMedia(mediaIndex)) {
          raiseFrameRef.current = null
          return
        }
        setPopoutRaised(true)
        raiseFrameRef.current = null
      })
    })
  }, [])

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
      onHover: handleHover,
      onOpen: open,
    })
    appRef.current = app
    return () => {
      if (appRef.current === app) appRef.current = null
      app.destroy()
    }
  }, [handleHover, items, open])

  useEffect(() => {
    if (!motionReady) return

    const container = containerRef.current
    const app = appRef.current
    if (!container || !app) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      app.finishIntro()
      return
    }

    const hero = container.closest<HTMLElement>('[data-testid="homepage-hero-section"]')
    let frame: number | null = null
    let fallbackTimer: number | null = null
    let started = false

    const start = () => {
      if (started) return
      started = true
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer)
        fallbackTimer = null
      }
      frame = window.requestAnimationFrame(() => {
        frame = null
        if (appRef.current === app) app.beginIntro()
      })
    }

    if (!hero) {
      start()
      return () => {
        if (frame !== null) window.cancelAnimationFrame(frame)
      }
    }

    const armFallback = () => {
      if (!hero.classList.contains('is-visible') || fallbackTimer !== null || started) return
      const transitionMs = maxTransitionTimeMs(window.getComputedStyle(hero))
      fallbackTimer = window.setTimeout(start, Math.max(40, transitionMs + 48))
    }

    const onTransitionEnd = (event: TransitionEvent) => {
      if (
        event.target === hero &&
        hero.classList.contains('is-visible') &&
        (event.propertyName === 'opacity' || event.propertyName === 'transform')
      ) {
        start()
      }
    }

    hero.addEventListener('transitionend', onTransitionEnd)
    const observer = new MutationObserver(armFallback)
    observer.observe(hero, { attributes: true, attributeFilter: ['class'] })
    armFallback()

    return () => {
      observer.disconnect()
      hero.removeEventListener('transitionend', onTransitionEnd)
      if (frame !== null) window.cancelAnimationFrame(frame)
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer)
    }
  }, [motionReady])

  useEffect(() => () => {
    if (hoverExitTimerRef.current !== null) window.clearTimeout(hoverExitTimerRef.current)
    if (raiseFrameRef.current !== null) window.cancelAnimationFrame(raiseFrameRef.current)
  }, [])

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
          <div
            className={`marketing-testimonial-gallery__overlay${popoutRaised ? ' is-raised' : ''}`}
            style={overlayStyle}
            aria-hidden="false"
            data-testimonial-popout
            data-popout-state={popoutRaised ? 'raised' : 'lifting'}
            data-testid="testimonial-active-popout"
          >
            <Image
              className="marketing-testimonial-gallery__overlay-image"
              src={hoveredItem.imageUrl}
              alt=""
              fill
              sizes="300px"
              unoptimized
              onLoad={() => {
                const mediaIndex = hover?.mediaIndex
                if (mediaIndex === undefined) return
                handlePopoutImageReady(mediaIndex)
              }}
            />
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
              <Image src={selected.imageUrl} alt={selected.altText} fill sizes="(max-width: 720px) 92vw, 46vw" unoptimized />
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
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  )
}
