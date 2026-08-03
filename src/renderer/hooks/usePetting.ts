import { useState, useCallback, useRef } from 'react'

/**
 * usePetting — detects petting gestures on the companion.
 *
 * Petting is detected as rapid repeated clicks (3+ in 1 second).
 * Click-and-hold is intentionally NOT treated as petting because
 * holding down is how dragging works — if we fire on hold, the
 * companion flickers to the SVG placeholder while being dragged.
 *
 * Returns isPetting state and handlers to attach to the companion element.
 */
export function usePetting(onPet: () => void) {
  const [isPetting, setIsPetting] = useState(false)
  const clickTimes = useRef<number[]>([])
  const hasMoved = useRef(false)
  const RAPID_CLICKS = 3
  const RAPID_WINDOW = 1000   // ms

  const triggerPet = useCallback(() => {
    setIsPetting(true)
    onPet()
    setTimeout(() => setIsPetting(false), 500)
  }, [onPet])

  const handleMouseDown = useCallback(() => {
    // Reset move tracker on each new press
    hasMoved.current = false
  }, [])

  const handleMouseMove = useCallback(() => {
    // Mark that the pointer has moved — this is a drag, not a tap
    hasMoved.current = true
  }, [])

  const handleMouseUp = useCallback(() => {
    // Only count as a click if the pointer didn't move (i.e. not a drag)
    if (hasMoved.current) return

    const now = Date.now()
    clickTimes.current.push(now)

    // Remove clicks older than the window
    clickTimes.current = clickTimes.current.filter(
      (t) => now - t < RAPID_WINDOW
    )

    if (clickTimes.current.length >= RAPID_CLICKS) {
      clickTimes.current = []
      triggerPet()
    }
  }, [triggerPet])

  const handleMouseLeave = useCallback(() => {
    // No hold timer to cancel anymore
  }, [])

  return {
    isPetting,
    pettingHandlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave
    }
  }
}
