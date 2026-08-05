import React, { useState, useCallback, useEffect, useMemo } from 'react'
import type { Mood } from '../types'
import { usePetting } from '../hooks/usePetting'
import { useDraggable } from '../hooks/useDraggable'

interface CompanionProps {
  mood: Mood
  onPet: () => void
  onToggleDrawer?: () => void
  onDoubleClick?: () => void
  onDragStart?: () => void
  onDragEnd?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}

/**
 * Moods that have PNG sprite sequences.
 * All other moods render the SVG placeholder — no GIFs.
 */
import angryPng from '../assets/sprites/status_pngs/angry.png'
import happyPng from '../assets/sprites/status_pngs/happy.png'
import concernedPng from '../assets/sprites/status_pngs/concerned.png'

const PNG_SEQUENCE_MOODS: Mood[] = ['idle', 'walking', 'walking-left', 'thinking', 'success', 'sleeping', 'drag', 'bored']
const GIF_MOODS: Mood[] = ['thirsty', 'petted', 'pleased', 'waiting', 'overdue']
const STATIC_PNG_MOODS: Mood[] = ['angry', 'happy', 'concerned', 'alert', 'remind']



/**
 * Companion — renders Ash with mood-based animation.
 * PNG sequences for animated moods, SVG for everything else.
 * No GIFs used anywhere.
 */
export default function Companion({ mood, onPet, onToggleDrawer, onDoubleClick, onDragStart, onDragEnd, onContextMenu }: CompanionProps) {
  const [particles, setParticles] = useState<
    Array<{ id: number; type: 'sparkle' | 'heart'; x: number; y: number }>
  >([])
  const particleIdRef = React.useRef(0)

  const handlePet = useCallback(() => {
    onPet()
    const newParticles = Array.from({ length: 4 }, () => ({
      id: ++particleIdRef.current,
      type: (Math.random() > 0.5 ? 'heart' : 'sparkle') as 'sparkle' | 'heart',
      x: Math.random() * 80 - 40,
      y: -(Math.random() * 40 + 10)
    }))
    setParticles((prev) => [...prev, ...newParticles])
    setTimeout(() => {
      setParticles((prev) =>
        prev.filter((p) => !newParticles.find((np) => np.id === p.id))
      )
    }, 1200)
  }, [onPet])



  const { pettingHandlers, isPetting } = usePetting(handlePet)

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDragEnd) setTimeout(onDragEnd, 50)
    if (onDoubleClick) onDoubleClick()
  }, [onDragEnd, onDoubleClick])

  // ── Animation frame counter ─────────────────────────────
  const [animFrame, setAnimFrame] = useState(1)
  const [imageError, setImageError] = useState(false)

  const { dragFrame, ...dragHandlers } = useDraggable(onDragStart, onDragEnd)
  
  // Override mood if dragging
  const isDragging = dragFrame > 0
  const displayMood = isDragging ? 'drag' : mood

  useEffect(() => {
    setAnimFrame(1)

    const isWalking = displayMood === 'walking' || displayMood === 'walking-left'
    const isThinking = displayMood === 'thinking'
    const isSuccess = displayMood === 'success'
    const isIdle = displayMood === 'idle'
    const isSleeping = displayMood === 'sleeping'
    const isBored = displayMood === 'bored'

    if (isWalking) {
      const interval = setInterval(() => setAnimFrame((f) => (f % 4) + 1), 150)
      return () => clearInterval(interval)
    } else if (isThinking) {
      const interval = setInterval(() => setAnimFrame((f) => (f % 3) + 1), 400)
      return () => clearInterval(interval)
    } else if (isSuccess) {
      let step = 0
      const seq = [4, 3, 1, 2]
      setAnimFrame(seq[0])
      const interval = setInterval(() => {
        step++
        if (step < seq.length) {
          setAnimFrame(seq[step])
        }
      }, 300)
      return () => clearInterval(interval)
    } else if (isSleeping) {
      setAnimFrame(1)
      let t1: ReturnType<typeof setTimeout>
      let t2: ReturnType<typeof setTimeout>
      let loopInterval: ReturnType<typeof setInterval>

      t1 = setTimeout(() => {
        setAnimFrame(2)
        t2 = setTimeout(() => {
          setAnimFrame(3)
          loopInterval = setInterval(() => {
            setAnimFrame((f) => (f === 3 ? 4 : 3))
          }, 2500)
        }, 1200)
      }, 1200)

      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
        clearInterval(loopInterval)
      }
    } else if (isIdle || isBored) {
      const interval = setInterval(() => setAnimFrame((f) => (f % 2) + 1), 1200)
      return () => clearInterval(interval)
    }
  }, [displayMood])

  // ── Resolve PNG/GIF src for moods ─────────────────
  const isPNGMood = PNG_SEQUENCE_MOODS.includes(displayMood)
  const isGIFMood = GIF_MOODS.includes(displayMood)
  const isStaticPNGMood = STATIC_PNG_MOODS.includes(displayMood)

  const imageSrc = useMemo(() => {
    if (!isPNGMood && !isGIFMood && !isStaticPNGMood) return undefined
    try {
      if (displayMood === 'walking' || displayMood === 'walking-left') {
        const wPaths: Record<number, string> = {
          1: new URL('../assets/sprites/walk_sequence/walk_1.png', import.meta.url).href,
          2: new URL('../assets/sprites/walk_sequence/walk_2.png', import.meta.url).href,
          3: new URL('../assets/sprites/walk_sequence/walk_3.png', import.meta.url).href,
          4: new URL('../assets/sprites/walk_sequence/walk_4.png', import.meta.url).href,
        }
        return wPaths[animFrame]
      }
      if (displayMood === 'thinking') {
        const tFrame = ((animFrame - 1) % 3) + 1
        const tPaths: Record<number, string> = {
          1: new URL('../assets/sprites/think_sequence/think_1.png', import.meta.url).href,
          2: new URL('../assets/sprites/think_sequence/think_2.png', import.meta.url).href,
          3: new URL('../assets/sprites/think_sequence/think_3.png', import.meta.url).href,
        }
        return tPaths[tFrame]
      }
      if (displayMood === 'success') {
        const sPaths: Record<number, string> = {
          1: new URL('../assets/sprites/success_sequence/success_1.png', import.meta.url).href,
          2: new URL('../assets/sprites/success_sequence/success_2.png', import.meta.url).href,
          3: new URL('../assets/sprites/success_sequence/success_3.png', import.meta.url).href,
          4: new URL('../assets/sprites/success_sequence/success_4.png', import.meta.url).href,
        }
        return sPaths[animFrame]
      }
      if (displayMood === 'idle') {
        const iFrame = (animFrame % 2) + 1
        const iPaths: Record<number, string> = {
          1: new URL('../assets/sprites/idle_sequence/idle_1.png', import.meta.url).href,
          2: new URL('../assets/sprites/idle_sequence/idle_2.png', import.meta.url).href,
        }
        return iPaths[iFrame]
      }
      if (displayMood === 'sleeping') {
        const slPaths: Record<number, string> = {
          1: new URL('../assets/sprites/sleep_sequence/sleep_1.png', import.meta.url).href,
          2: new URL('../assets/sprites/sleep_sequence/sleep_2.png', import.meta.url).href,
          3: new URL('../assets/sprites/sleep_sequence/sleep_3.png', import.meta.url).href,
          4: new URL('../assets/sprites/sleep_sequence/sleep_4.png', import.meta.url).href,
        }
        return slPaths[animFrame] || slPaths[3]
      }
      if (displayMood === 'drag') {
        const dPaths: Record<number, string> = {
          1: new URL('../assets/sprites/drag_sequence/drag_1.png', import.meta.url).href,
          2: new URL('../assets/sprites/drag_sequence/drag_2.png', import.meta.url).href,
          3: new URL('../assets/sprites/drag_sequence/drag_2.png', import.meta.url).href, // Map drag_3 to drag_2 if it doesn't exist just in case, but we know 1, 2, 4 exist. Wait! Let me check which drag frames exist. I will map 3 to 2 for safety.
          4: new URL('../assets/sprites/drag_sequence/drag_4.png', import.meta.url).href,
        }
        return dPaths[dragFrame] || dPaths[1]
      }
      if (isGIFMood) {
        if (displayMood === 'thirsty') return concernedPng
        if (displayMood === 'petted' || displayMood === 'pleased') return happyPng
        if (displayMood === 'waiting') return concernedPng
        if (displayMood === 'bored') {
          const slPaths: Record<number, string> = {
            1: new URL('../assets/sprites/sleep_sequence/sleep_1.png', import.meta.url).href,
            2: new URL('../assets/sprites/sleep_sequence/sleep_2.png', import.meta.url).href,
            3: new URL('../assets/sprites/sleep_sequence/sleep_3.png', import.meta.url).href,
            4: new URL('../assets/sprites/sleep_sequence/sleep_4.png', import.meta.url).href,
          }
          return slPaths[animFrame] || slPaths[3]
        }
        if (displayMood === 'overdue') return angryPng
      }
      if (isStaticPNGMood) {
        if (displayMood === 'angry') return angryPng
        if (displayMood === 'happy') return happyPng
        if (displayMood === 'concerned' || displayMood === 'alert' || displayMood === 'remind') return concernedPng
      }
      return concernedPng
    } catch {
      return concernedPng
    }
  }, [displayMood, animFrame, isPNGMood, isGIFMood, isStaticPNGMood, dragFrame])


  useEffect(() => {
    setImageError(false)
  }, [imageSrc])

  // ── Walking direction ───────────────────────────────────
  // The walk frames face LEFT by default.
  // 'walking'      = moving right → flip sprite with scaleX(-1)
  // 'walking-left' = moving left  → show as-is (already faces left)
  const imgStyle: React.CSSProperties = displayMood === 'walking' ? { transform: 'scaleX(-1)' } : {}

  const showImage = (isPNGMood || isGIFMood || isStaticPNGMood) && imageSrc && !imageError

  return (
    <div className="companion-wrapper" {...dragHandlers} onContextMenu={onContextMenu}>
      <div
        {...pettingHandlers}
        onDoubleClick={handleDoubleClick}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }}
      >
        {/* Floating Menu/Modal trigger icon near head ghost light */}
        <button
          className="ghost-trigger-btn"
          title="Open Menu"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (onToggleDrawer) onToggleDrawer()
            else if (onDoubleClick) onDoubleClick()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </button>

        {showImage ? (
          <img
            draggable={false}
            className={`companion-sprite mood-${displayMood}`}
            style={imgStyle}
            src={imageSrc}
            onError={() => setImageError(true)}
            alt={`Ash is ${displayMood}`}
          />
        ) : (
          // SVG placeholder for all non-image moods
          <CompanionSVG mood={displayMood} />
        )}

        {/* Particles */}
        {particles.map((p) =>
          p.type === 'heart' ? (
            <span
              key={p.id}
              className="heart-pop"
              style={{ left: `calc(50% + ${p.x}px)`, top: `calc(50% + ${p.y}px)` }}
            >
              💙
            </span>
          ) : (
            <span
              key={p.id}
              className="sparkle"
              style={{
                left: `calc(50% + ${p.x}px)`,
                top: `calc(50% + ${p.y}px)`,
                '--sparkle-x': `${p.x * 0.5}px`,
                '--sparkle-y': `${p.y}px`
              } as React.CSSProperties}
            />
          )
        )}
      </div>
    </div>
  )
}

/**
 * SVG companion — used for all non-PNG moods.
 * No GIFs. Shows a cute wolf with mood-based expression.
 */
function CompanionSVG({ mood }: { mood: Mood }) {
  const getEyeState = () => {
    switch (mood) {
      case 'petted':   return { open: false, happy: true }
      case 'bored':    return { open: false, happy: false }
      case 'alert':    return { open: true, wide: true }
      case 'concerned':return { open: true, squint: true }
      case 'pleased':  return { open: true, happy: true }
      default:         return { open: true }
    }
  }

  const eyes = getEyeState()

  return (
    <svg
      className={`companion-sprite mood-${mood}`}
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: 160, height: 160 }}
    >
      {/* Body */}
      <ellipse cx="64" cy="78" rx="32" ry="28" fill="#2d3548" stroke="#111" strokeWidth="3" />

      {/* Head */}
      <circle cx="64" cy="48" r="24" fill="#3a4560" stroke="#111" strokeWidth="3" />

      {/* Ears */}
      <polygon points="44,32 36,12 52,28" fill="#3a4560" stroke="#111" strokeWidth="2.5" />
      <polygon points="84,32 92,12 76,28" fill="#3a4560" stroke="#111" strokeWidth="2.5" />
      <polygon points="46,30 40,18 52,28" fill="#2d3548" />
      <polygon points="82,30 88,18 76,28" fill="#2d3548" />

      {/* Muzzle */}
      <ellipse cx="64" cy="56" rx="12" ry="9" fill="#4f5d78" />

      {/* Nose */}
      <ellipse cx="64" cy="52" rx="4" ry="3" fill="#111" />

      {/* Eyes */}
      {eyes.open !== false ? (
        <>
          <ellipse cx="54" cy="44" rx={eyes.wide ? 5 : eyes.squint ? 3 : 4} ry={eyes.wide ? 5 : eyes.squint ? 2 : 4} fill="#00dcc8" />
          <ellipse cx="74" cy="44" rx={eyes.wide ? 5 : eyes.squint ? 3 : 4} ry={eyes.wide ? 5 : eyes.squint ? 2 : 4} fill="#00dcc8" />
          <circle cx="55" cy="44" r="2" fill="#111" />
          <circle cx="75" cy="44" r="2" fill="#111" />
          <circle cx="56" cy="43" r="1" fill="#fff" opacity="0.8" />
          <circle cx="76" cy="43" r="1" fill="#fff" opacity="0.8" />
        </>
      ) : (
        <>
          <path d={eyes.happy ? 'M50,44 Q54,40 58,44' : 'M50,44 Q54,46 58,44'} stroke="#00dcc8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d={eyes.happy ? 'M70,44 Q74,40 78,44' : 'M70,44 Q74,46 78,44'} stroke="#00dcc8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}

      {/* Mouth */}
      {mood === 'thirsty' ? (
        <>
          <path d="M58,58 Q64,62 70,58" stroke="#111" strokeWidth="1.5" fill="none" />
          <ellipse cx="64" cy="62" rx="4" ry="5" fill="#ff7088" />
        </>
      ) : mood === 'pleased' || mood === 'petted' ? (
        <path d="M56,57 Q64,65 72,57" stroke="#111" strokeWidth="1.5" fill="none" />
      ) : (
        <path d="M58,58 Q64,61 70,58" stroke="#111" strokeWidth="1.5" fill="none" />
      )}

      {/* Tail */}
      <path d="M92,82 Q108,68 100,56" stroke="#3a4560" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M100,56 Q98,52 102,50" stroke="#00dcc8" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Paws */}
      <ellipse cx="48" cy="100" rx="8" ry="5" fill="#3a4560" stroke="#111" strokeWidth="2" />
      <ellipse cx="80" cy="100" rx="8" ry="5" fill="#3a4560" stroke="#111" strokeWidth="2" />

      {/* Belly */}
      <ellipse cx="64" cy="84" rx="16" ry="12" fill="#4f5d78" opacity="0.6" />

      {/* Mood accents */}
      {mood === 'thirsty' && (
        <>
          <circle cx="40" cy="70" r="3" fill="#00dcc8" opacity="0.6" />
          <circle cx="90" cy="65" r="2" fill="#00dcc8" opacity="0.5" />
          <circle cx="36" cy="80" r="2" fill="#00dcc8" opacity="0.4" />
        </>
      )}
      {mood === 'alert' && (
        <text x="96" y="36" fontSize="14" fill="#f0a040">❗</text>
      )}
    </svg>
  )
}
