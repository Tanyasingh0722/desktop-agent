import React, { useState, useEffect, useRef, useCallback } from 'react'
import HeavyRain from '../assets/sprites/song_set/Heavy-Rain.mp3'
import Rain from '../assets/sprites/song_set/Rain.mp3'
import BeachWaves from '../assets/sprites/song_set/beach-waves.mp3'
import Nightingale from '../assets/sprites/song_set/nightingale-song.mp3'
import Ocean from '../assets/sprites/song_set/ocean.mp3'

const SONGS = [
  { name: 'Heavy Rain', src: HeavyRain },
  { name: 'Rain', src: Rain },
  { name: 'Beach Waves', src: BeachWaves },
  { name: 'Nightingale', src: Nightingale },
  { name: 'Ocean', src: Ocean },
]

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

type EyeState = 'center' | 'left' | 'right' | 'closed'

function PixelAvatar({ scale }: { scale: number }) {
  const P = 18

  const [eyeState, setEyeState] = useState<EyeState>('center')

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setEyeState('closed')
      setTimeout(() => {
        setEyeState(prev => prev === 'closed' ? 'center' : prev)
      }, 200) // Blink duration
    }, 4500) // Blink every 4.5s

    const moveInterval = setInterval(() => {
      const dirs: EyeState[] = ['left', 'right', 'center']
      const rand = dirs[Math.floor(Math.random() * dirs.length)]
      setEyeState(prev => prev === 'closed' ? prev : rand)
    }, 3000)

    return () => {
      clearInterval(blinkInterval)
      clearInterval(moveInterval)
    }
  }, [])

  const getGrid = (state: EyeState) => {
    // 1: Body (slate gray), 2: Eye white/glow (cyan), 3: Pupil/Nose (dark), 4: Accent (light gray)
    let eye1 = [1, 1, 2, 2, 1, 1, 2, 2, 1, 1]
    let eye2 = [1, 1, 2, 3, 1, 1, 2, 3, 1, 1] // center/rightish

    if (state === 'left') {
      eye1 = [1, 1, 2, 2, 1, 1, 2, 2, 1, 1]
      eye2 = [1, 1, 3, 2, 1, 1, 3, 2, 1, 1]
    } else if (state === 'right') {
      eye1 = [1, 1, 2, 2, 1, 1, 2, 2, 1, 1]
      eye2 = [1, 1, 2, 3, 1, 1, 2, 3, 1, 1]
    } else if (state === 'center') {
      // both pupils somewhat centered, or just right default
      eye1 = [1, 1, 2, 2, 1, 1, 2, 2, 1, 1]
      eye2 = [1, 1, 3, 3, 1, 1, 3, 3, 1, 1] // larger pupils for center
    } else if (state === 'closed') {
      eye1 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
      eye2 = [1, 1, 3, 3, 1, 1, 3, 3, 1, 1] // closed eye slits
    }

    return [
      // Ears
      [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
      [1, 4, 1, 0, 0, 0, 0, 1, 4, 1],
      // Head
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      // Eyes
      eye1,
      eye2,
      // Face
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      // Belly / Snout
      [1, 4, 4, 4, 4, 4, 4, 4, 4, 1],
      [1, 4, 4, 4, 3, 3, 4, 4, 4, 1], // nose
      // Legs
      [1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
      [1, 1, 0, 0, 1, 1, 0, 0, 1, 1],
    ]
  }

  const grid = getGrid(eyeState)

  const COLS = 10
  const ROWS = 12
  const W = COLS * P
  const H = ROWS * P

  const colorMap: Record<number, string> = {
    1: '#4F6C96',   // Vibrant slate blue body
    2: '#33FFFF',   // Bright neon cyan eye whites
    3: '#0B1021',   // Deep dark slate pupil/nose
    4: '#96B3D6',   // Frosty light blue accents
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

  // ── Audio State ────────────────────────────────────────────────────────────
  const [isMuted, setIsMuted] = useState(false)
  const [currentSongIdx, setCurrentSongIdx] = useState(0)
  const bgAudioRef = useRef<HTMLAudioElement | null>(null)

  // ── Chime Effect (Mount Only) ──────────────────────────────────────────────
  useEffect(() => {
    // We attempt to play the chime when the session begins
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime) // C5
      oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.1) // C6
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2.0)
      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      oscillator.start()
      oscillator.stop(audioCtx.currentTime + 2.0)
    } catch (e) {
      console.warn("Start chime failed", e)
    }
  }, []) // Empty dependency array means this runs once when overlay opens

  // ── Background Music Effect ────────────────────────────────────────────────
  useEffect(() => {
    if (!bgAudioRef.current) {
      bgAudioRef.current = new Audio()
      bgAudioRef.current.loop = true
      bgAudioRef.current.volume = 0.4
    }
    
    bgAudioRef.current.src = SONGS[currentSongIdx].src
    
    if (!isMuted && !done) {
      bgAudioRef.current.play().catch(e => console.log('Audio autoplay prevented:', e))
    } else {
      bgAudioRef.current.pause()
    }
  }, [currentSongIdx, isMuted, done])

  // Stop audio and clean up on unmount
  useEffect(() => {
    return () => {
      if (bgAudioRef.current) {
        bgAudioRef.current.pause()
        bgAudioRef.current = null
      }
    }
  }, [])

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
          <PixelAvatar scale={done ? 1 : ghostScale} />
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

      {/* Audio Controls */}
      <div className="audio-controls-container">
        <button 
          className="audio-mute-btn" 
          onClick={() => setIsMuted(!isMuted)}
          aria-label={isMuted ? "Unmute" : "Mute"}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        <div className="audio-song-selector">
          {SONGS.map((song, idx) => (
            <div 
              key={song.name}
              className={`song-dot ${idx === currentSongIdx ? 'active' : ''}`}
              onClick={() => setCurrentSongIdx(idx)}
              title={song.name}
              aria-label={`Select ${song.name}`}
            />
          ))}
        </div>
        <span className="song-label">{SONGS[currentSongIdx].name}</span>
      </div>

      {/* Done state */}
      {done && (
        <div className="break-done-msg">
          <p className="break-done-text">Great session. Back to it 🐾</p>
        </div>
      )}
    </div>
  )
}
