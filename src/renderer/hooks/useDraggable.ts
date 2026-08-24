import { useEffect, useRef, useState } from 'react'

export function useDraggable(onDragStart?: () => void, onDragEnd?: () => void) {
  const [dragFrame, setDragFrame] = useState(0)
  const isDragging = useRef(false)
  const hasMoved = useRef(false)
  const lastScreenPos = useRef<{ x: number; y: number } | null>(null)
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true
    hasMoved.current = false
    lastScreenPos.current = { x: e.screenX, y: e.screenY }
    window.ashAPI?.setIgnoreMouseEvents(false)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) {}
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (isDragging.current && lastScreenPos.current) {
      const dx = e.screenX - lastScreenPos.current.x
      const dy = e.screenY - lastScreenPos.current.y
      lastScreenPos.current = { x: e.screenX, y: e.screenY }

      if (dx !== 0 || dy !== 0) {
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
        window.ashAPI.moveWindowBy(dx, dy)
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent | PointerEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    lastScreenPos.current = null
    if ('pointerId' in e && 'releasePointerCapture' in e.currentTarget!) {
      try { (e.currentTarget as any).releasePointerCapture(e.pointerId) } catch (err) {}
    }
    if (animTimer.current) clearTimeout(animTimer.current)
    
    if (hasMoved.current) {
      setDragFrame(4)
      setTimeout(() => {
        setDragFrame(0)
        if (onDragEnd) onDragEnd()
      }, 200)
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
