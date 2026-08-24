import React, { useState, useCallback, useEffect, useRef } from 'react'
import Companion from './components/Companion'
import NotificationStack, { type NotificationItem } from './components/Notification'
import { getNotificationForMood } from './lib/notifications'
import TodoDrawer from './components/TodoDrawer'
import CheckInPrompt from './components/CheckInPrompt'
import { useMood } from './hooks/useMood'
import { useTasks } from './hooks/useTasks'
import { usePomodoro } from './hooks/usePomodoro'
import { useSleepTimer } from './hooks/useSleepTimer'

let _notifId = 0
function nextId() { return `notif-${++_notifId}` }

/**
 * App — root component that orchestrates the companion, drawer, and prompts.
 *
 * Layout:
 * - The outer app-container is a flex row (or flex row-reverse depending on anchor)
 * - Companion is always pinned to its anchor corner
 * - Todo drawer / check-in opens BESIDE the companion horizontally
 * - Notification stack floats above the companion sprite
 */
export default function App() {
  const { mood, visualMood, detail, changeMood, pet, dismiss } = useMood()
  const {
    tasks,
    todayTasks,
    carriedTasks,
    addTasks,
    toggleTask,
    deleteTask,
    reorderTasks,
    dismissCarryOver
  } = useTasks()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [checkInVisible, setCheckInVisible] = useState(false)
  const [panelVisible, setPanelVisible] = useState(false) // true while panel is open OR animating closed
  const [anchor, setAnchor] = useState<'left' | 'right'>('right')
  const [verticalAnchor, setVerticalAnchor] = useState<'top' | 'bottom'>('bottom')
  const [focusCountdown, setFocusCountdown] = useState<number | null>(null)
  const [currentContext, setCurrentContext] = useState<{activeApp: string, activeTab: string, windowBounds: any} | null>(null)
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Notification queue ─────────────────────────────
  const [notifQueue, setNotifQueue] = useState<NotificationItem[]>([])
  // Track which mood+detail combos are already in the queue to avoid dupes
  const activeNotifKeys = useRef<Set<string>>(new Set())

  // Close the panel with a smooth exit: CSS animation plays for 340ms before
  // panelVisible goes false (which triggers the window to shrink).
  // Must be defined early so all effects below can reference it.
  const closePanel = useCallback(() => {
    if (closingTimerRef.current) clearTimeout(closingTimerRef.current)
    setDrawerOpen(false)
    setCheckInVisible(false)
    setFocusCountdown(null)
    setPanelVisible(false)
  }, [])

  // ── Sleep Timer ────────────────────────────────────
  const handleSleep = useCallback(() => {
    changeMood('sleeping')
  }, [changeMood])

  const isUIActive = drawerOpen || checkInVisible || panelVisible || notifQueue.length > 0
  useSleepTimer({
    mood,
    isActive: isUIActive,
    onSleep: handleSleep
  })

  const pushNotif = useCallback((
    item: Omit<NotificationItem, 'id'>,
    key?: string
  ) => {
    const dedupeKey = key ?? `${item.message}`
    activeNotifKeys.current.add(dedupeKey)
    const id = nextId()
    setNotifQueue(prev => [{ ...item, id }]) // Replace or push cleanly
  }, [])

  const dismissNotif = useCallback((id: string) => {
    activeNotifKeys.current.clear()
    setNotifQueue(prev => {
      const next = prev.filter(n => n.id !== id)
      if (next.length === 0) {
        window.ashAPI?.dismissMood()
      }
      return next
    })
  }, [])


  // Auto-dismiss non-question notifications after 7s
  useEffect(() => {
    if (notifQueue.length === 0) return
    const oldest = notifQueue[0]
    if (oldest.isQuestion) return
    const timer = setTimeout(() => dismissNotif(oldest.id), 7000)
    return () => clearTimeout(timer)
  }, [notifQueue, dismissNotif])

  const handleFocusComplete = useCallback(() => {
    changeMood('success')
  }, [changeMood])

  const handleMinuteWarning = useCallback((secsLeft: number | null) => {
    setFocusCountdown(secsLeft)
  }, [])

  const handleReset = useCallback(() => {
    changeMood('angry', 'reset')
    setTimeout(() => {
      changeMood('idle')
      window.ashAPI?.dismissMood()
    }, 4000)
  }, [changeMood])

  const pomodoro = usePomodoro(handleFocusComplete, handleMinuteWarning, handleReset)

  // ── Push countdown notification when timer is in last 60s ─────────
  const prevCountdownRef = useRef<number | null>(null)
  useEffect(() => {
    if (focusCountdown !== null && focusCountdown > 0) {
      // Update in-place if the countdown notif is already showing
      setNotifQueue(prev => {
        const idx = prev.findIndex(n => n.id.startsWith('countdown-'))
        const msg = `Almost done! ${focusCountdown}s left ⏳`
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], message: msg }
          return updated
        }
        // Add a new countdown slot (won't be a regular notif ID)
        return [...prev, { id: 'countdown-live', message: msg, emoji: '⏳' }]
      })
    } else {
      // Remove countdown notif when null or 0
      setNotifQueue(prev => prev.filter(n => n.id !== 'countdown-live'))
    }
    prevCountdownRef.current = focusCountdown
  }, [focusCountdown])

  // ── Push mood-based notifications ─────────────────────────────────
  useEffect(() => {
    const notif = getNotificationForMood(mood, detail)
    if (!notif) {
      // Remove any non-countdown, non-question notifs when mood goes idle
      if (mood === 'idle') {
        setNotifQueue(prev => prev.filter(n => n.isQuestion || n.id === 'countdown-live'))
        activeNotifKeys.current.forEach(k => {
          // Keep question keys and countdown
          const stillPresent = notifQueue.find(n => n.message === k && (n.isQuestion || n.id === 'countdown-live'))
          if (!stillPresent) activeNotifKeys.current.delete(k)
        })
      }
      return
    }
    const key = `${mood}-${detail ?? ''}`
    pushNotif({
      message: notif.message,
      emoji: notif.emoji,
      isQuestion: notif.isQuestion,
      confirmText: notif.confirmText,
      cancelText: notif.cancelText,
      onConfirm: () => {
        distractionStartTimeRef.current = Date.now()
        lastContextReminderRef.current = Date.now()
        if (mood === 'waiting') {
          setCheckInVisible(true)
        } else if (mood === 'concerned' && detail === 'screen') {
          // Launch the full-screen breathing break overlay
          changeMood('idle')
          window.ashAPI?.dismissMood()
          window.ashAPI?.startBreak(180)
        } else {
          changeMood('happy')
          setTimeout(() => changeMood('idle'), 2500)
          window.ashAPI?.dismissMood()
        }
      },
      onCancel: () => {
        distractionStartTimeRef.current = Date.now()
        lastContextReminderRef.current = Date.now()
        if (mood === 'waiting') {
          handleCheckInSkip()
        } else if (mood === 'concerned' && detail === 'water') {
          changeMood('angry', 'refused-water')
          setTimeout(() => {
            changeMood('idle')
            window.ashAPI?.dismissMood()
          }, 3000)
        } else if (mood === 'concerned' && detail === 'screen') {
          changeMood('angry', 'refused-screen')
          setTimeout(() => {
            changeMood('idle')
            window.ashAPI?.dismissMood()
          }, 3000)
        } else {
          changeMood('angry')
          setTimeout(() => {
            changeMood('idle')
            window.ashAPI?.dismissMood()
          }, 2500)
        }
      }
    }, key)
  }, [mood, detail]) // intentional: only re-run when mood/detail change


  // ── Listen for break window closing ───────────────────────────────
  useEffect(() => {
    const unsub = window.ashAPI?.onBreakEnd?.((completed: boolean) => {
      if (completed) {
        // Timer ran out — celebrate!
        changeMood('happy')
        setTimeout(() => changeMood('idle'), 3000)
      } else {
        // User left early — just go idle quietly
        changeMood('idle')
      }
    })
    return () => { unsub?.() }
  }, [changeMood])

  const showNotification = notifQueue.length > 0

  // Helper: fetch both anchors from main (uses window position, not cursor)
  const refreshAnchor = useCallback(() => {
    Promise.all([
      window.ashAPI?.getAnchor() ?? Promise.resolve(anchor),
      window.ashAPI?.getVerticalAnchor() ?? Promise.resolve(verticalAnchor)
    ]).then(([a, v]) => {
      setAnchor(a)
      setVerticalAnchor(v)
    })
  }, []) // no deps — only reads from main process

  // ── Sync anchor on mount and when Ash finishes roaming ──────────
  useEffect(() => {
    refreshAnchor()
    const unsub = window.ashAPI?.onAnchorUpdate(() => {
      refreshAnchor()
    })
    return () => { unsub?.() }
  }, [refreshAnchor])

  // ── Contextual Reminders ───────────────────────────
  const lastContextReminderRef = useRef(0)
  const distractionStartTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!window.ashAPI?.onContextUpdate) return
    const unsub = window.ashAPI.onContextUpdate((context: any) => {
      setCurrentContext(context)
    })
    return () => { unsub?.() }
  }, [])

  useEffect(() => {
    if (!currentContext) return

    const appStr = (currentContext.activeApp || '').toLowerCase()
    const tabStr = (currentContext.activeTab || '').toLowerCase()

    const distractions = ['youtube', 'netflix', 'hotstar', 'prime video', 'twitch', 'hulu', 'disney']
    const isDistraction = distractions.some(d => appStr.includes(d) || tabStr.includes(d))

    if (isDistraction) {
      const DISTRACTION_COOLDOWN_MS = 60 * 1000 // 60 seconds
      if (Date.now() - lastContextReminderRef.current >= DISTRACTION_COOLDOWN_MS) {
        lastContextReminderRef.current = Date.now()
        changeMood('angry', 'distraction')
        setTimeout(() => {
          changeMood('idle')
          window.ashAPI?.dismissMood()
        }, 8000)
      }
      return
    }



    const pendingTasks = tasks.filter(t => t.status === 'pending')
    if (pendingTasks.length === 0) return

    for (const task of pendingTasks) {
      // Guard: only match words 4+ chars to avoid false positives like "the", "tex", etc.
      const words = task.text.toLowerCase().split(' ').filter(w => w.length >= 4)
      for (const w of words) {
        if (appStr.includes(w) || tabStr.includes(w)) {
          lastContextReminderRef.current = Date.now()
          changeMood('happy', 'focus')
          setTimeout(() => {
            changeMood('idle')
            window.ashAPI?.dismissMood()
          }, 6000)
          return
        }
      }
    }
  }, [tasks, currentContext, changeMood])

  // ── Check-in trigger ──────────────────────────────
  useEffect(() => {
    if (mood === 'waiting') {
      const pendingTasks = tasks.filter(t => t.status === 'pending')
      if (pendingTasks.length > 0) {
        // Goal is already given, show text bubble instead of modal!
        const taskText = pendingTasks[0].text
        changeMood('alert', `Your today's goal is: ${taskText}`)
        setTimeout(() => {
          changeMood('idle')
          window.ashAPI?.dismissMood()
        }, 6000)
      } else {
        refreshAnchor()
      }
    }
  }, [mood, tasks, changeMood, refreshAnchor])

  // ── Periodic Task Reminder ─────────────────────────
  const lastTaskReminderRef = useRef<number>(Date.now())
  useEffect(() => {
    const interval = setInterval(() => {
      const pending = tasks.filter(t => t.status === 'pending')
      if (pending.length > 0 && mood === 'idle') {
        const now = Date.now()
        // Remind every 15 minutes if idle
        if (now - lastTaskReminderRef.current >= 15 * 60 * 1000) {
          lastTaskReminderRef.current = now
          const taskText = pending[0].text
          changeMood('remind', `Task reminder: ${taskText}`)
          setTimeout(() => {
            changeMood('idle')
            window.ashAPI?.dismissMood()
          }, 7000)
        }
      }
    }, 60 * 1000)
    return () => clearInterval(interval)
  }, [tasks, mood, changeMood])

  const handleDragEnd = useCallback(() => {
    refreshAnchor()
    changeMood('idle')
    window.ashAPI?.dismissMood()
  }, [refreshAnchor, changeMood])

  useEffect(() => {
    if (showNotification) {
      refreshAnchor()
    }
  }, [showNotification, refreshAnchor])

  // ── Handle window resizing ─────────────────────────
  // panelVisible stays true for the 350ms CSS exit animation — we don't shrink
  // the window until it's false, to prevent the flash-glitch.
  useEffect(() => {
    if (checkInVisible) {
      window.ashAPI?.resizeWindow(560, 420, anchor, verticalAnchor)
    } else if (drawerOpen) {
      window.ashAPI?.resizeWindow(560, 580, anchor, verticalAnchor)
    } else if (panelVisible) {
      // Still showing (animating out) — keep expanded size so companion doesn't flash
      return
    } else if (showNotification) {
      window.ashAPI?.resizeWindow(460, 360, anchor, verticalAnchor)
    } else {
      window.ashAPI?.resizeWindow(120, 120, anchor, verticalAnchor)
    }
  }, [checkInVisible, drawerOpen, panelVisible, showNotification, anchor, verticalAnchor])

  // Handle click-through on transparent body pixels
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const isInteractive = !!(
        target.closest('.companion-column') ||
        target.closest('.companion-wrapper') ||
        target.closest('.ghost-trigger-btn') ||
        target.closest('.side-panel') ||
        target.closest('.drawer-panel') ||
        target.closest('.checkin-prompt') ||
        target.closest('.notif-stack')
      )

      if (isInteractive || drawerOpen || checkInVisible || e.buttons > 0) {
        window.ashAPI?.setIgnoreMouseEvents(false)
      } else {
        window.ashAPI?.setIgnoreMouseEvents(true, { forward: true })
      }
    }

    if (drawerOpen || checkInVisible) {
      window.ashAPI?.setIgnoreMouseEvents(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [drawerOpen, checkInVisible])

  // Close drawer/checkin modal when clicking outside
  useEffect(() => {
    if (!drawerOpen && !checkInVisible) return

    const handleGlobalMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const isInsideModal = !!(
        target.closest('.drawer-panel') ||
        target.closest('.checkin-prompt') ||
        target.closest('.companion-column') ||
        target.closest('.ghost-trigger-btn')
      )

      if (!isInsideModal) {
        closePanel()
      }
    }

    window.addEventListener('mousedown', handleGlobalMouseDown, true)
    return () => window.removeEventListener('mousedown', handleGlobalMouseDown, true)
  }, [drawerOpen, checkInVisible, closePanel])

  const handleCompanionClick = useCallback(() => {
    refreshAnchor()
    if (mood === 'sleeping') {
      changeMood('idle')
      window.ashAPI?.dismissMood()
      return
    }
    if (mood === 'waiting') {
      setCheckInVisible(true)
    } else {
      setDrawerOpen((prev) => !prev)
    }
  }, [mood, changeMood, refreshAnchor])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  const handlePet = useCallback(() => {
    pet()
  }, [pet])

  const handleCheckInSubmit = useCallback(
    async (taskTexts: string[]) => {
      await addTasks(taskTexts.map(text => ({ text, category: 'today' as const })))
      setCheckInVisible(false)
      changeMood('idle')
      window.ashAPI?.markCheckInDone()
    },
    [addTasks, changeMood]
  )

  const handleCheckInSkip = useCallback(() => {
    setCheckInVisible(false)
    changeMood('idle')
    window.ashAPI?.markCheckInDone()
  }, [changeMood])

  const handleTaskComplete = useCallback(() => {
    changeMood('success')
    setTimeout(() => {
      changeMood('idle')
    }, 3500)
  }, [changeMood])

  const handleCloseDrawer = useCallback(() => {
    closePanel()
  }, [closePanel])

  // ── Layout logic ─────────────────────────────────────────────────────────
  // When drawer opens, immediately show the panel.
  // When it closes, panelVisible lingers for 340ms (CSS exit animation).
  useEffect(() => {
    if (drawerOpen || checkInVisible) {
      if (closingTimerRef.current) clearTimeout(closingTimerRef.current)
      setPanelVisible(true)
    }
  }, [drawerOpen, checkInVisible])

  const panelOpen = drawerOpen || checkInVisible
  const flexDirection = anchor === 'right' ? 'row-reverse' : 'row'
  const vertAlign = verticalAnchor === 'top' ? 'flex-start' : 'flex-end'

  const handleAppContainerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const isInsideContent = !!(
      target.closest('.companion-column') ||
      target.closest('.side-panel') ||
      target.closest('.notif-stack')
    )

    if (!isInsideContent && (drawerOpen || checkInVisible)) {
      closePanel()
    }
  }, [drawerOpen, checkInVisible, closePanel])

  return (
    <div
      className={`app-container anchor-${anchor} vertical-${verticalAnchor}`}
      onClick={handleAppContainerClick}
      style={{
        display: 'flex',
        flexDirection,
        alignItems: vertAlign,
        width: '100vw',
        height: '100vh',
        pointerEvents: panelOpen ? 'auto' : 'none'
      }}
    >
      {/* ── Companion column — always fixed 120×120 ── */}
      <div
        className="companion-column"
        style={{
          position: 'relative',
          width: 120,
          height: 120,
          flexShrink: 0,
          pointerEvents: 'auto'
        }}
      >
        {/* Notification stack — sits above companion */}
        {showNotification && (
          <NotificationStack
            notifications={notifQueue}
            onDismiss={dismissNotif}
          />
        )}

        <Companion
          mood={visualMood}
          onPet={handlePet}
          onToggleDrawer={handleCompanionClick}
          onDoubleClick={handleCompanionClick}
          onDragStart={() => {
            setDrawerOpen(false)
            setCheckInVisible(false)
          }}
          onDragEnd={handleDragEnd}
          onContextMenu={handleContextMenu}
        />
      </div>

      {/* ── Side panel — always in DOM, shown/hidden via CSS to prevent flash-glitch ── */}
      {panelVisible && (
        <div
          className={`side-panel anchor-${anchor} vertical-${verticalAnchor} ${!panelOpen ? 'side-panel-closing' : ''}`}
          style={{ pointerEvents: panelOpen ? 'auto' : 'none' }}
        >
          {checkInVisible ? (
            <CheckInPrompt
              visible={checkInVisible}
              onSubmit={handleCheckInSubmit}
              onSkip={handleCheckInSkip}
            />
          ) : (
            <TodoDrawer
              isOpen={drawerOpen}
              tasks={[...carriedTasks, ...todayTasks]}
              carriedTasks={carriedTasks}
              onToggleTask={toggleTask}
              onDeleteTask={deleteTask}
              onReorderTasks={reorderTasks}
              onAddTask={(taskData) => addTasks([taskData])}
              onClose={handleCloseDrawer}
              onTaskComplete={handleTaskComplete}
              onChangeMood={changeMood}
              verticalAnchor={verticalAnchor}
              pomodoro={pomodoro}
            />
          )}
        </div>
      )}
    </div>
  )
}
