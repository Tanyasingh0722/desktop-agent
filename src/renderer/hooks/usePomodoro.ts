import { useState, useEffect, useRef } from 'react'

export type FocusMode = 'focus' | 'break'

const DEFAULT_FOCUS = 25
const DEFAULT_BREAK = 5

export function usePomodoro(
  onFocusComplete?: () => void, 
  onMinuteWarning?: (secsLeft: number) => void,
  onReset?: () => void
) {
  const [focusMins, setFocusMins] = useState(DEFAULT_FOCUS)
  const [breakMins, setBreakMins] = useState(DEFAULT_BREAK)
  const [mode, setMode] = useState<FocusMode>('focus')
  const [timeLeft, setTimeLeft] = useState(DEFAULT_FOCUS * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const [totalFocusSecs, setTotalFocusSecs] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            if (mode === 'focus') {
              setSessions(s => s + 1)
              setTotalFocusSecs(t => t + focusMins * 60)
              onFocusComplete?.()
              setMode('break')
              setTimeLeft(breakMins * 60)
            } else {
              setMode('focus')
              setTimeLeft(focusMins * 60)
            }
            return 0
          }
          if (mode === 'focus' && prev <= 61 && prev > 0) {
            onMinuteWarning?.(prev - 1)
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, mode, focusMins, breakMins, onFocusComplete, onMinuteWarning])

  const startStop = () => setRunning(r => !r)

  const switchToBreak = () => {
    setRunning(false)
    setMode('break')
    setTimeLeft(breakMins * 60)
  }

  const switchToFocus = () => {
    setRunning(false)
    setMode('focus')
    setTimeLeft(focusMins * 60)
  }

  const setTimes = (f: number, b: number) => {
    setFocusMins(f)
    setBreakMins(b)
    if (mode === 'focus') setTimeLeft(f * 60)
    else setTimeLeft(b * 60)
  }

  const reset = () => {
    setRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    const wasFocus = mode === 'focus'
    const wasRunning = timeLeft < (wasFocus ? focusMins * 60 : breakMins * 60)
    
    if (wasFocus) setTimeLeft(focusMins * 60)
    else setTimeLeft(breakMins * 60)
    
    onMinuteWarning?.(0)
    if (wasFocus && wasRunning) {
      onReset?.()
    }
  }

  return {
    focusMins, breakMins, mode, timeLeft, running, sessions, totalFocusSecs,
    startStop, switchToBreak, switchToFocus, setTimes, reset
  }
}
