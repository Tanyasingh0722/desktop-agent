import { useEffect, useRef, useCallback } from 'react'
import type { Mood } from '../types'

interface UseSleepTimerOptions {
  mood: Mood
  isActive: boolean // true if drawer or checkin is open, or notifications exist
  onSleep: () => void
  sleepTimeoutMs?: number // Default 3 mins (180,000 ms)
}

/**
 * useSleepTimer — automatically puts Ash to sleep after 10 minutes of inactivity.
 *
 * Edge cases handled:
 * - Only triggers if mood === 'idle' and !isActive
 * - Resets on any activity (drawer toggle, notification, pet, mouse/keyboard interaction with companion)
 * - Clears when mood shifts away from idle
 */
export function useSleepTimer({
  mood,
  isActive,
  onSleep,
  sleepTimeoutMs = 3 * 60 * 1000 // 3 minutes
}: UseSleepTimerOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSleepTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const resetSleepTimer = useCallback(() => {
    clearSleepTimer()
    if (mood === 'idle' && !isActive) {
      timerRef.current = setTimeout(() => {
        onSleep()
      }, sleepTimeoutMs)
    }
  }, [mood, isActive, onSleep, sleepTimeoutMs, clearSleepTimer])

  useEffect(() => {
    if (mood === 'idle' && !isActive) {
      resetSleepTimer()
    } else {
      clearSleepTimer()
    }

    return () => clearSleepTimer()
  }, [mood, isActive, resetSleepTimer, clearSleepTimer])

  return { resetSleepTimer }
}
