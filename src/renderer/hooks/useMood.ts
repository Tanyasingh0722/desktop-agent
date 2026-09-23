import { useState, useCallback, useEffect, useRef } from 'react'
import type { Mood } from '../types'
import { isTransientMood, getTransientTimeout, isDismissibleByPet, STICKY_MOODS } from '../lib/mood-machine'

/**
 * useMood — manages the companion's current mood state.
 *
 * - Listens to IPC mood:change events from main process
 * - Handles transient moods (auto-return to idle)
 * - Handles petting (always transitions to 'petted' → idle)
 */
export function useMood() {
  const [mood, setMood] = useState<Mood>('idle')
  const [visualOverride, setVisualOverride] = useState<Mood | null>(null)
  const [detail, setDetail] = useState<string | undefined>()
  const transientTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Clear any pending transient timer */
  const clearTransient = useCallback(() => {
    if (transientTimer.current) {
      clearTimeout(transientTimer.current)
      transientTimer.current = null
    }
  }, [])

  /** Set mood and handle auto-return for transient moods */
  const changeMood = useCallback(
    (newMood: Mood, newDetail?: string) => {
      clearTransient()
      setMood(newMood)
      setVisualOverride(null)
      setDetail(newDetail)

      if (isTransientMood(newMood)) {
        const timeout = getTransientTimeout(newMood)
        if (timeout) {
          transientTimer.current = setTimeout(() => {
            setMood('idle')
            setDetail(undefined)
          }, timeout)
        }
      }
    },
    [clearTransient]
  )

  /** Pet the companion — always happy, then back to idle */
  const pet = useCallback(() => {
    changeMood('happy')
    // Notify main process
    window.ashAPI?.pet()
  }, [changeMood])

  /** Dismiss current sticky mood */
  const dismiss = useCallback(() => {
    if (isDismissibleByPet(mood)) {
      pet()
    }
  }, [mood, pet])

  /** Listen for mood changes from main process */
  useEffect(() => {
    const cleanup = window.ashAPI?.onMoodChange((newMood: Mood, newDetail?: string) => {
      // Intercept stale main process moods (if user didn't restart dev server)
      if (newMood === 'angry' && (newDetail === 'water' || newDetail === 'screen')) {
        newMood = 'concerned'
      }

      // If we are currently in a sticky mood, allow random background roaming visually but keep the logical mood
      const isRandomRoam = newMood === 'walking' || newMood === 'walking-left' || newMood === 'idle'
      if (STICKY_MOODS.includes(mood) && isRandomRoam) {
        if (newMood === 'idle') {
          setVisualOverride(null)
        } else {
          setVisualOverride(newMood)
        }
        return
      }
      changeMood(newMood, newDetail)
    })
    return () => { cleanup?.() }
  }, [changeMood, mood])

  // Flashing animation for 'remind' mood
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    let flashCount = 0
    if (mood === 'remind') {
      interval = setInterval(() => {
        setVisualOverride(prev => {
          // Do not interrupt an active walking animation
          if (prev !== null && prev !== 'idle') return prev
          return prev === 'idle' ? null : 'idle'
        })
        flashCount++
        // Stop flashing after 3 full cycles (6 toggles) and remain in remind
        if (flashCount >= 6) {
          if (interval) clearInterval(interval)
          setVisualOverride(prev => {
            if (prev !== null && prev !== 'idle') return prev
            return null
          })
          
          // Optionally auto-dismiss after 6 seconds (if it's not a sticky permission request)
          if (detail !== 'ide-permission') {
            setTimeout(() => {
               changeMood('idle')
            }, 3000)
          }
        }
      }, 500)
    } else {
      // If we exit remind, clear override just in case
      if (visualOverride === 'idle' && !STICKY_MOODS.includes(mood)) {
        setVisualOverride(null)
      }
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [mood, detail, changeMood])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTransient()
  }, [clearTransient])

  return { mood, visualMood: visualOverride || mood, detail, changeMood, pet, dismiss }
}
