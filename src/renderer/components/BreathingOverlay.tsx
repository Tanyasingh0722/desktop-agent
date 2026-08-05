import React, { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

type BreathPhase = 'breathe-in' | 'hold-in' | 'breathe-out' | 'hold-out'

interface BreathingOverlayProps {
  durationSeconds?: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASE_DURATIONS: Record<BreathPhase, number> = {
  'breathe-in': 4000,
  'hold-in': 4000,
  'breathe-out': 4000,
  'hold-out': 4000,
}

const PHASE_ORDER: BreathPhase[] = ['breathe-in', 'hold-in', 'breathe-out', 'hold-out']

const PHASE_LABELS: Record<BreathPhase, string> = {
  'breathe-in': 'BREATHE IN',
  'hold-in': 'HOLD',
  'breathe-out': 'BREATHE OUT',
  'hold-out': 'HOLD',
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Pixel Ghost SVG ───────────────────────────────────────────────────────────
/**
 * Classic Pac-Man-style pixel ghost.
 * P=18 gives a large, crisp appearance matching the reference design.
 * Grid: 10 wide × 12 tall
 * Colors: 1=body blue, 2=eye white, 3=eye pupil (black), 0=transparent
 */
function PixelGhost({ scale }: { scale: number }) {
  const P = 18 // each pixel cell = 18×18 px

  const grid = [
    // dome
    [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    // eyes — white blocks with offset pupils
    [1, 1, 2, 2, 1, 1, 2, 2, 1, 1],
    [1, 1, 2, 3, 1, 1, 2, 3, 1, 1],
    // body
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    // scalloped bottom — 3 feet, 2 gaps
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1],
    [1, 0, 0, 0, 1, 1, 0, 0, 0, 1],
  ]

  const COLS = 10
  const ROWS = 12
  const W = COLS * P
  const H = ROWS * P

  const colorMap: Record<number, string> = {
    1: '#5B8BF5',   // bright pixel blue
    2: '#FFFFFF',   // eye white
    3: '#111111',   // pupil
  }

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{
        transform: `scale(${scale})`,
        transition: 'transform 4s cubic-bezier(0.4, 0, 0.2, 1)',
        imageRendering: 'pixelated',
        display: 'block',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {grid.map((row, rowIdx) =>
        row.map((cell, colIdx) => {
          if (cell === 0) return null
          return (
            <rect
              key={`${rowIdx}-${colIdx}`}
              x={colIdx * P}
              y={rowIdx * P}
              width={P}
              height={P}
              fill={colorMap[cell]}
            />
          )
        })
      )}
    </svg>
  )
}

// ── Hold-to-Leave Button ──────────────────────────────────────────────────────
/**
 * Hold for 2 seconds to leave. A black fill sweeps left→right via rAF.
 * Text appears black on white, and white over the black fill
 * (mix-blend-mode: difference trick).
 */
const HOLD_DURATION = 2000

function HoldToLeaveButton({ onLeave }: { onLeave: () => void }) {
  const fillRef = useRef<HTMLDivElement>(null)
  const holdStartRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const [holding, setHolding] = useState(false)

  const cancelHold = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    holdStartRef.current = null
    setHolding(false)
    // Reset the fill div width directly
    if (fillRef.current) fillRef.current.style.width = '0%'
  }, [])

  const startHold = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setHolding(true)
    holdStartRef.current = Date.now()

    const tick = () => {
      if (holdStartRef.current === null) return
      const elapsed = Date.now() - holdStartRef.current
      const pct = Math.min(elapsed / HOLD_DURATION, 1)

      // Directly mutate the fill element — no React re-render needed
      if (fillRef.current) {
        fillRef.current.style.width = `${pct * 100}%`
      }

      if (pct >= 1) {
        // Complete
        if (fillRef.current) fillRef.current.style.width = '0%'
        holdStartRef.current = null
        setHolding(false)
        onLeave()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [onLeave])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <button
      id="leave-session-btn"
      className={`leave-btn ${holding ? 'leave-btn-holding' : ''}`}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      aria-label="Hold for 2 seconds to leave breathing session"
    >
      {/* Fill layer — width driven by rAF, no CSS transitions */}
      <div ref={fillRef} className="leave-fill" aria-hidden="true" />
      {/* Text uses mix-blend-mode: difference so it inverts over the black fill */}
      <span className="leave-btn-text">LEAVE SESSION</span>
    </button>
  )
}

// ── Main Overlay ──────────────────────────────────────────────────────────────

export default function BreathingOverlay({ durationSeconds = 180 }: BreathingOverlayProps) {
  const [phase, setPhase] = useState<BreathPhase>('breathe-in')
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds)
  const [done, setDone] = useState(false)
  const phaseIndexRef = useRef(0)
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Ghost scale per phase ──────────────────────────────────────────────────
  const ghostScale = (() => {
    switch (phase) {
      case 'breathe-in':  return 1.15
      case 'hold-in':     return 1.15
      case 'breathe-out': return 0.82
      case 'hold-out':    return 0.82
    }
  })()

  // ── Phase state machine ────────────────────────────────────────────────────
  const advancePhase = useCallback(() => {
    phaseIndexRef.current = (phaseIndexRef.current + 1) % PHASE_ORDER.length
    const nextPhase = PHASE_ORDER[phaseIndexRef.current]
    setPhase(nextPhase)
    phaseTimerRef.current = setTimeout(advancePhase, PHASE_DURATIONS[nextPhase])
  }, [])

  useEffect(() => {
    phaseTimerRef.current = setTimeout(advancePhase, PHASE_DURATIONS['breathe-in'])
    return () => { if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current) }
  }, [advancePhase])

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (done) return
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          setDone(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [done])

  // ── Session complete: auto-close after 2s ──────────────────────────────────
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => { window.ashAPI?.endBreak(true) }, 2000)
    return () => clearTimeout(t)
  }, [done])

  // ── Leave handler ──────────────────────────────────────────────────────────
  const handleLeave = useCallback(() => { window.ashAPI?.endBreak(false) }, [])

  // ── Glow ring class ───────────────────────────────────────────────────────
  const ringClass = (() => {
    if (phase === 'breathe-in')  return 'breath-ring ring-expand'
    if (phase === 'hold-in')     return 'breath-ring ring-hold-in'
    if (phase === 'breathe-out') return 'breath-ring ring-shrink'
    return 'breath-ring ring-hold-out'
  })()

  return (
    <div id="breathing-overlay" className="breathing-overlay">

      {/* Countdown — top-right only, no session ID */}
      {!done && (
        <div className="break-header">
          <span className={`break-countdown ${secondsLeft <= 30 ? 'break-countdown-urgent' : ''}`}>
            {formatTime(secondsLeft)}
          </span>
        </div>
      )}

      {/* Phase label */}
      <p className="breath-label" aria-live="polite">
        {done ? 'WELL DONE ✓' : PHASE_LABELS[phase]}
      </p>

      {/* Ghost + animated ring */}
      <div className="ghost-stage">
        <div className={ringClass} aria-hidden="true" />
        <div className="ghost-container">
          <PixelGhost scale={done ? 1 : ghostScale} />
        </div>
      </div>

      {/* Phase progress dots */}
      {!done && (
        <div className="phase-dots" aria-hidden="true">
          {PHASE_ORDER.map((p) => (
            <div
              key={p}
              className={`phase-dot ${phase === p ? 'phase-dot-active' : ''}`}
            />
          ))}
        </div>
      )}

      {/* Hold-to-leave button */}
      {!done && <HoldToLeaveButton onLeave={handleLeave} />}

      {/* Done state */}
      {done && (
        <div className="break-done-msg">
          <p className="break-done-text">Great session. Back to it 🐾</p>
        </div>
      )}
    </div>
  )
}
