'use client'

/*
 * Adapted for Strativate from React Bits Shape Grid.
 * Copyright (c) 2026 David Haz · MIT + Commons Clause License Condition v1.0.
 * Full third-party notice: /THIRD_PARTY_NOTICES.md
 */

import { useEffect, useRef } from 'react'

type CanvasStrokeStyle = string | CanvasGradient | CanvasPattern
type GridOffset = { x: number; y: number }
type ShapeGridDirection = 'diagonal' | 'up' | 'right' | 'down' | 'left'
type ShapeGridShape = 'square' | 'hexagon' | 'circle' | 'triangle'

type ShapeGridProps = {
  direction?: ShapeGridDirection
  speed?: number
  borderColor?: CanvasStrokeStyle
  squareSize?: number
  hoverFillColor?: CanvasStrokeStyle
  shape?: ShapeGridShape
  hoverTrailAmount?: number
  fadeColor?: string
}

function ShapeGrid({
  direction = 'right',
  speed = 1,
  borderColor = '#999',
  squareSize = 40,
  hoverFillColor = '#222',
  shape = 'square',
  hoverTrailAmount = 0,
  fadeColor = '#120F17',
}: ShapeGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const requestRef = useRef<number | null>(null)
  const gridOffset = useRef<GridOffset>({ x: 0, y: 0 })
  const hoveredSquareRef = useRef<GridOffset | null>(null)
  const trailCells = useRef<GridOffset[]>([])
  const cellOpacities = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const isHex = shape === 'hexagon'
    const isTri = shape === 'triangle'
    const hexHoriz = squareSize * 1.5
    const hexVert = squareSize * Math.sqrt(3)
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = reducedMotionQuery.matches
    let isVisible = false
    let isPageVisible = !document.hidden

    const drawHex = (cx: number, cy: number, size: number) => {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const vx = cx + size * Math.cos(angle)
        const vy = cy + size * Math.sin(angle)
        if (i === 0) ctx.moveTo(vx, vy)
        else ctx.lineTo(vx, vy)
      }
      ctx.closePath()
    }

    const drawCircle = (cx: number, cy: number, size: number) => {
      ctx.beginPath()
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
      ctx.closePath()
    }

    const drawTriangle = (cx: number, cy: number, size: number, flip: boolean) => {
      ctx.beginPath()
      if (flip) {
        ctx.moveTo(cx, cy + size / 2)
        ctx.lineTo(cx + size / 2, cy - size / 2)
        ctx.lineTo(cx - size / 2, cy - size / 2)
      } else {
        ctx.moveTo(cx, cy - size / 2)
        ctx.lineTo(cx + size / 2, cy + size / 2)
        ctx.lineTo(cx - size / 2, cy + size / 2)
      }
      ctx.closePath()
    }

    const updateCellOpacities = (instant = false) => {
      const targets = new Map<string, number>()

      if (hoveredSquareRef.current) {
        targets.set(`${hoveredSquareRef.current.x},${hoveredSquareRef.current.y}`, 1)
      }

      if (hoverTrailAmount > 0) {
        for (let i = 0; i < trailCells.current.length; i++) {
          const trail = trailCells.current[i]
          const key = `${trail.x},${trail.y}`
          if (!targets.has(key)) {
            targets.set(key, (trailCells.current.length - i) / (trailCells.current.length + 1))
          }
        }
      }

      if (instant) {
        cellOpacities.current.clear()
        for (const [key, target] of targets) cellOpacities.current.set(key, target)
        return
      }

      for (const [key] of targets) {
        if (!cellOpacities.current.has(key)) cellOpacities.current.set(key, 0)
      }

      for (const [key, opacity] of cellOpacities.current) {
        const target = targets.get(key) || 0
        const next = opacity + (target - opacity) * 0.15
        if (next < 0.005) cellOpacities.current.delete(key)
        else cellOpacities.current.set(key, next)
      }
    }

    const drawGrid = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (isHex) {
        const colShift = Math.floor(gridOffset.current.x / hexHoriz)
        const offsetX = ((gridOffset.current.x % hexHoriz) + hexHoriz) % hexHoriz
        const offsetY = ((gridOffset.current.y % hexVert) + hexVert) % hexVert
        const cols = Math.ceil(canvas.width / hexHoriz) + 3
        const rows = Math.ceil(canvas.height / hexVert) + 3

        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const cx = col * hexHoriz + offsetX
            const cy = row * hexVert + ((col + colShift) % 2 !== 0 ? hexVert / 2 : 0) + offsetY
            const cellKey = `${col},${row}`
            const alpha = cellOpacities.current.get(cellKey)

            if (alpha) {
              ctx.globalAlpha = alpha
              drawHex(cx, cy, squareSize)
              ctx.fillStyle = hoverFillColor
              ctx.fill()
              ctx.globalAlpha = 1
            }

            drawHex(cx, cy, squareSize)
            ctx.strokeStyle = borderColor
            ctx.stroke()
          }
        }
      } else if (isTri) {
        const halfW = squareSize / 2
        const colShift = Math.floor(gridOffset.current.x / halfW)
        const rowShift = Math.floor(gridOffset.current.y / squareSize)
        const offsetX = ((gridOffset.current.x % halfW) + halfW) % halfW
        const offsetY = ((gridOffset.current.y % squareSize) + squareSize) % squareSize
        const cols = Math.ceil(canvas.width / halfW) + 4
        const rows = Math.ceil(canvas.height / squareSize) + 4

        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const cx = col * halfW + offsetX
            const cy = row * squareSize + squareSize / 2 + offsetY
            const flip = ((col + colShift + row + rowShift) % 2 + 2) % 2 !== 0
            const cellKey = `${col},${row}`
            const alpha = cellOpacities.current.get(cellKey)

            if (alpha) {
              ctx.globalAlpha = alpha
              drawTriangle(cx, cy, squareSize, flip)
              ctx.fillStyle = hoverFillColor
              ctx.fill()
              ctx.globalAlpha = 1
            }

            drawTriangle(cx, cy, squareSize, flip)
            ctx.strokeStyle = borderColor
            ctx.stroke()
          }
        }
      } else if (shape === 'circle') {
        const offsetX = ((gridOffset.current.x % squareSize) + squareSize) % squareSize
        const offsetY = ((gridOffset.current.y % squareSize) + squareSize) % squareSize
        const cols = Math.ceil(canvas.width / squareSize) + 3
        const rows = Math.ceil(canvas.height / squareSize) + 3

        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const cx = col * squareSize + squareSize / 2 + offsetX
            const cy = row * squareSize + squareSize / 2 + offsetY
            const cellKey = `${col},${row}`
            const alpha = cellOpacities.current.get(cellKey)

            if (alpha) {
              ctx.globalAlpha = alpha
              drawCircle(cx, cy, squareSize)
              ctx.fillStyle = hoverFillColor
              ctx.fill()
              ctx.globalAlpha = 1
            }

            drawCircle(cx, cy, squareSize)
            ctx.strokeStyle = borderColor
            ctx.stroke()
          }
        }
      } else {
        const offsetX = ((gridOffset.current.x % squareSize) + squareSize) % squareSize
        const offsetY = ((gridOffset.current.y % squareSize) + squareSize) % squareSize
        const cols = Math.ceil(canvas.width / squareSize) + 3
        const rows = Math.ceil(canvas.height / squareSize) + 3

        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const sx = col * squareSize + offsetX
            const sy = row * squareSize + offsetY
            const cellKey = `${col},${row}`
            const alpha = cellOpacities.current.get(cellKey)

            if (alpha) {
              ctx.globalAlpha = alpha
              ctx.fillStyle = hoverFillColor
              ctx.fillRect(sx, sy, squareSize, squareSize)
              ctx.globalAlpha = 1
            }

            ctx.strokeStyle = borderColor
            ctx.strokeRect(sx, sy, squareSize, squareSize)
          }
        }
      }

      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.sqrt(canvas.width ** 2 + canvas.height ** 2) / 2,
      )
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
      gradient.addColorStop(1, fadeColor)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const renderFrame = () => {
      updateCellOpacities(reducedMotion)
      drawGrid()
    }

    const updateAnimation = () => {
      const effectiveSpeed = Math.max(speed, 0.1)
      const wrapX = isHex ? hexHoriz * 2 : squareSize
      const wrapY = isHex ? hexVert : isTri ? squareSize * 2 : squareSize

      switch (direction) {
        case 'right':
          gridOffset.current.x = (gridOffset.current.x - effectiveSpeed + wrapX) % wrapX
          break
        case 'left':
          gridOffset.current.x = (gridOffset.current.x + effectiveSpeed + wrapX) % wrapX
          break
        case 'up':
          gridOffset.current.y = (gridOffset.current.y + effectiveSpeed + wrapY) % wrapY
          break
        case 'down':
          gridOffset.current.y = (gridOffset.current.y - effectiveSpeed + wrapY) % wrapY
          break
        case 'diagonal':
          gridOffset.current.x = (gridOffset.current.x - effectiveSpeed + wrapX) % wrapX
          gridOffset.current.y = (gridOffset.current.y - effectiveSpeed + wrapY) % wrapY
          break
      }

      renderFrame()
      requestRef.current = window.requestAnimationFrame(updateAnimation)
    }

    const tryStop = () => {
      if (requestRef.current === null) return
      window.cancelAnimationFrame(requestRef.current)
      requestRef.current = null
    }

    const tryStart = () => {
      if (!isVisible || !isPageVisible) return
      if (reducedMotion) {
        tryStop()
        renderFrame()
        return
      }
      if (requestRef.current === null) requestRef.current = window.requestAnimationFrame(updateAnimation)
    }

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      renderFrame()
    }

    const rememberTrail = () => {
      if (!hoveredSquareRef.current || hoverTrailAmount <= 0) return
      trailCells.current.unshift({ ...hoveredSquareRef.current })
      if (trailCells.current.length > hoverTrailAmount) trailCells.current.length = hoverTrailAmount
    }

    const setHoveredCell = (col: number, row: number) => {
      if (
        hoveredSquareRef.current &&
        hoveredSquareRef.current.x === col &&
        hoveredSquareRef.current.y === row
      ) return

      rememberTrail()
      hoveredSquareRef.current = { x: col, y: row }
      if (reducedMotion) renderFrame()
    }

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top

      if (isHex) {
        const colShift = Math.floor(gridOffset.current.x / hexHoriz)
        const offsetX = ((gridOffset.current.x % hexHoriz) + hexHoriz) % hexHoriz
        const offsetY = ((gridOffset.current.y % hexVert) + hexVert) % hexVert
        const adjustedX = mouseX - offsetX
        const adjustedY = mouseY - offsetY
        const col = Math.round(adjustedX / hexHoriz)
        const rowOffset = (col + colShift) % 2 !== 0 ? hexVert / 2 : 0
        const row = Math.round((adjustedY - rowOffset) / hexVert)
        setHoveredCell(col, row)
        return
      }

      if (isTri) {
        const halfW = squareSize / 2
        const offsetX = ((gridOffset.current.x % halfW) + halfW) % halfW
        const offsetY = ((gridOffset.current.y % squareSize) + squareSize) % squareSize
        const adjustedX = mouseX - offsetX
        const adjustedY = mouseY - offsetY
        setHoveredCell(Math.round(adjustedX / halfW), Math.floor(adjustedY / squareSize))
        return
      }

      const offsetX = ((gridOffset.current.x % squareSize) + squareSize) % squareSize
      const offsetY = ((gridOffset.current.y % squareSize) + squareSize) % squareSize
      const adjustedX = mouseX - offsetX
      const adjustedY = mouseY - offsetY

      if (shape === 'circle') {
        setHoveredCell(Math.round(adjustedX / squareSize), Math.round(adjustedY / squareSize))
      } else {
        setHoveredCell(Math.floor(adjustedX / squareSize), Math.floor(adjustedY / squareSize))
      }
    }

    const handleMouseLeave = () => {
      rememberTrail()
      hoveredSquareRef.current = null
      if (reducedMotion) renderFrame()
    }

    const onVisibility = () => {
      isPageVisible = !document.hidden
      if (isPageVisible) tryStart()
      else tryStop()
    }

    const onReducedMotion = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches
      canvas.dataset.motion = reducedMotion ? 'reduced' : 'animated'
      if (reducedMotion) {
        tryStop()
        renderFrame()
      } else {
        tryStart()
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
        if (isVisible) tryStart()
        else tryStop()
      },
      { threshold: 0 },
    )

    canvas.dataset.motion = reducedMotion ? 'reduced' : 'animated'
    window.addEventListener('resize', resizeCanvas)
    document.addEventListener('visibilitychange', onVisibility)
    reducedMotionQuery.addEventListener('change', onReducedMotion)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    resizeCanvas()
    observer.observe(canvas)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      document.removeEventListener('visibilitychange', onVisibility)
      reducedMotionQuery.removeEventListener('change', onReducedMotion)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      observer.disconnect()
      tryStop()
    }
  }, [direction, speed, borderColor, hoverFillColor, squareSize, shape, hoverTrailAmount, fadeColor])

  return (
    <canvas
      ref={canvasRef}
      className="homepage-shape-grid"
      aria-hidden="true"
      data-react-bits="shape-grid"
      data-testid="hero-shape-grid"
    />
  )
}

export function HeroShapeGrid() {
  return (
    <ShapeGrid
      direction="diagonal"
      speed={0.45}
      borderColor="rgba(255,255,255,.28)"
      squareSize={48}
      hoverFillColor="rgba(255,244,224,.22)"
      shape="square"
      hoverTrailAmount={6}
      fadeColor="rgba(104,26,0,.16)"
    />
  )
}
