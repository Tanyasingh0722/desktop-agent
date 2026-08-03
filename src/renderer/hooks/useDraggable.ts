import { useEffect, useRef, useState } from 'react'

export function useDraggable(onDragStart?: () => void, onDragEnd?: () => void) {
  const [dragFrame, setDragFrame] = useState(0)
  const isDragging = useRef(false)
  const hasMoved = useRef(false)
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true
    hasMoved.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (isDragging.current) {
      if (e.movementX !== 0 || e.movementY !== 0) {
        if (!hasMoved.current) {
          // First movement: start drag animation sequence
          hasMoved.current = true
          if (onDragStart) onDragStart()
          setDragFrame(1)
          if (animTimer.current) clearTimeout(animTimer.current)
          animTimer.current = setTimeout(() => {
            setDragFrame(2)
            animTimer.current = setTimeout(() => {
              setDragFrame(3)
            }, 200)
          }, 200)
        }
        window.ashAPI.moveWindowBy(e.movementX, e.movementY)
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent | PointerEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    if ('pointerId' in e && 'releasePointerCapture' in e.currentTarget!) {
      try { (e.currentTarget as any).releasePointerCapture(e.pointerId) } catch (e) {}
    }
    if (animTimer.current) clearTimeout(animTimer.current)
    
    if (hasMoved.current) {
      window.ashAPI.getAnchor()
      setDragFrame(4)
      setTimeout(() => {
        setDragFrame(0)
        if (onDragEnd) onDragEnd()
      }, 400)
    } else {
      // Just a click, no drag happened
      setDragFrame(0)
    }
  }

  const onPointerCancel = (e: React.PointerEvent) => {
    if (isDragging.current) {
      onPointerUp(e)
    }
  }

  useEffect(() => {
    const handleGlobalUp = (e: PointerEvent) => {
      onPointerUp(e)
    }
    window.addEventListener('pointerup', handleGlobalUp)
    return () => window.removeEventListener('pointerup', handleGlobalUp)
  }, [onDragEnd])

  return { onPointerDown, onPointerMove, onPointerUp: onPointerUp as any, onPointerCancel, dragFrame }
}
