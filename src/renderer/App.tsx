import React, { useState, useCallback, useEffect } from 'react'
import Companion from './components/Companion'
import Notification from './components/Notification'
import { getNotificationForMood } from './lib/notifications'
import TodoDrawer from './components/TodoDrawer'
import CheckInPrompt from './components/CheckInPrompt'
import { useMood } from './hooks/useMood'
import { useTasks } from './hooks/useTasks'
import { usePomodoro } from './hooks/usePomodoro'


/**
 * App — root component that orchestrates the companion, drawer, and prompts.
 *
 * Layout:
 * - The outer app-container is a flex row (or flex row-reverse depending on anchor)
 * - Companion is always pinned to its anchor corner
 * - Todo drawer / check-in opens BESIDE the companion horizontally
 * - Notification toast floats above the companion sprite
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
  const [anchor, setAnchor] = useState<'left' | 'right'>('right')
  const [verticalAnchor, setVerticalAnchor] = useState<'top' | 'bottom'>('bottom')
  const [focusCountdown, setFocusCountdown] = useState<number | null>(null)
  const [currentContext, setCurrentContext] = useState<{activeApp: string, activeTab: string, windowBounds: any} | null>(null)

  const handleFocusComplete = useCallback(() => {
    changeMood('success')
  }, [changeMood])

  const handleMinuteWarning = useCallback((secsLeft: number) => {
    setFocusCountdown(secsLeft)
    if (secsLeft === 0) setFocusCountdown(null)
  }, [])

  const handleReset = useCallback(() => {
    changeMood('angry', 'reset')
    setTimeout(() => {
      changeMood('idle')
      window.ashAPI?.dismissMood()
    }, 4000)
  }, [changeMood])

  const pomodoro = usePomodoro(handleFocusComplete, handleMinuteWarning, handleReset)

  // ── Notification logic ────────────────────────────
  const notif = getNotificationForMood(mood, detail)
  const isCountdownActive = focusCountdown !== null && focusCountdown > 0
  const showNotification = notif !== null || isCountdownActive

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

  // ── Sync anchor when Ash finishes roaming ──────────
  useEffect(() => {
    const unsub = window.ashAPI?.onAnchorUpdate(() => {
      refreshAnchor()
    })
    return () => { unsub?.() }
  }, [refreshAnchor])

  // ── Contextual Reminders ───────────────────────────
  const lastContextReminderRef = React.useRef(0)
  const distractionStartTimeRef = React.useRef<number | null>(null)

  useEffect(() => {
    if (!window.ashAPI?.onContextUpdate) return
    const unsub = window.ashAPI.onContextUpdate((context: any) => {
      setCurrentContext(context)
    })
    return () => { unsub?.() }
  }, [])

  useEffect(() => {
    if (!currentContext) return
    // Debounce contextual reminders (max 1 every 15 seconds)
    if (Date.now() - lastContextReminderRef.current < 15 * 1000) return

    const appStr = (currentContext.activeApp || '').toLowerCase()
    const tabStr = (currentContext.activeTab || '').toLowerCase()

    const distractions = ['youtube', 'netflix', 'hotstar', 'prime video', 'twitch', 'hulu', 'disney']
    const isDistraction = distractions.some(d => appStr.includes(d) || tabStr.includes(d))

    if (isDistraction) {
      if (distractionStartTimeRef.current === null) {
        distractionStartTimeRef.current = Date.now()
      }
      const elapsedMinutes = (Date.now() - distractionStartTimeRef.current) / (1000 * 60)
      
      // Only get angry if streaming continuously for 30+ minutes
      if (elapsedMinutes >= 30) {
        if (Date.now() - lastContextReminderRef.current >= 15 * 1000) {
          lastContextReminderRef.current = Date.now()
          changeMood('angry', 'distraction')
          setTimeout(() => {
             changeMood('idle')
             window.ashAPI?.dismissMood()
          }, 8000)
        }
      }
      return
    } else {
      // User stopped streaming, reset distraction timer
      distractionStartTimeRef.current = null
    }

    const pendingTasks = tasks.filter(t => t.status === 'pending')
    if (pendingTasks.length === 0) return

    for (const task of pendingTasks) {
      const words = task.text.toLowerCase().split(' ').filter(w => w.length > 2)
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
  // The companion is always 180×180 in its "slot".
  // Drawer/checkin sits beside it horizontally → window expands width not height.
  // Only height expands when the drawer content is taller than 180px.
  useEffect(() => {
    if (checkInVisible) {
      // Companion (180) + gap (8) + checkin panel (360 wide, 400 tall)
      window.ashAPI?.resizeWindow(560, 420, anchor, verticalAnchor)
    } else if (drawerOpen) {
      // Companion (180) + gap (8) + drawer (360 wide, capped at 540 tall)
      window.ashAPI?.resizeWindow(560, 540, anchor, verticalAnchor)
    } else if (showNotification) {
      // Companion (180) + notification bubble beside
      window.ashAPI?.resizeWindow(460, 360, anchor, verticalAnchor)
    } else {
      window.ashAPI?.resizeWindow(120, 120, anchor, verticalAnchor)
    }
  }, [checkInVisible, drawerOpen, showNotification, anchor, verticalAnchor])

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
        target.closest('.notification-toast')
      )

      if (isInteractive || drawerOpen || checkInVisible) {
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
        setDrawerOpen(false)
        setCheckInVisible(false)
        window.ashAPI?.resizeWindow(120, 120, anchor, verticalAnchor)
      }
    }

    window.addEventListener('mousedown', handleGlobalMouseDown, true)
    return () => window.removeEventListener('mousedown', handleGlobalMouseDown, true)
  }, [drawerOpen, checkInVisible, anchor, verticalAnchor])

  const handleCompanionClick = useCallback(() => {
    if (mood === 'waiting') {
      setCheckInVisible(true)
    } else {
      setDrawerOpen((prev) => !prev)
    }
  }, [mood])

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
    setDrawerOpen(false)
    window.ashAPI?.resizeWindow(120, 120, anchor, verticalAnchor)
  }, [anchor, verticalAnchor])

  // ── Layout logic ─────────────────────────────────────────────────────────
  // When anchor=right, Ash is on the right → modal opens to the LEFT of him.
  //   flex direction: row-reverse  (companion on right, modal grows left)
  // When anchor=left, Ash is on the left → modal opens to the RIGHT of him.
  //   flex direction: row          (companion on left, modal grows right)
  const panelOpen = drawerOpen || checkInVisible
  const flexDirection = anchor === 'right' ? 'row-reverse' : 'row'
  const vertAlign = verticalAnchor === 'top' ? 'flex-start' : 'flex-end'

  const handleAppContainerClick = useCallback((e: React.MouseEvent) => {
    // If user clicked inside companion, side panel, checkin prompt, or notification, do not close
    const target = e.target as HTMLElement
    const isInsideContent = !!(
      target.closest('.companion-column') ||
      target.closest('.side-panel') ||
      target.closest('.notification-toast')
    )

    if (!isInsideContent && (drawerOpen || checkInVisible)) {
      setDrawerOpen(false)
      setCheckInVisible(false)
      window.ashAPI?.resizeWindow(120, 120, anchor, verticalAnchor)
    }
  }, [drawerOpen, checkInVisible, anchor, verticalAnchor])

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
        {/* Notification toast — sits above companion, high z-index */}
        {showNotification && isCountdownActive && !notif ? (
          <Notification
            visible={true}
            message={`Almost done! ${focusCountdown}s left ⏳`}
          />
        ) : (
          <Notification
            visible={showNotification}
            message={notif?.message || ''}
            emoji={notif?.emoji}
            isQuestion={notif?.isQuestion}
            confirmText={notif?.confirmText}
            cancelText={notif?.cancelText}
            onConfirm={() => {
              if (mood === 'waiting') {
                setCheckInVisible(true)
              } else {
                changeMood('happy')
                setTimeout(() => changeMood('idle'), 3500)
                window.ashAPI?.dismissMood()
              }
            }}
            onCancel={() => {
              if (mood === 'waiting') {
                handleCheckInSkip()
              } else {
                changeMood('angry')
                setTimeout(() => changeMood('idle'), 3500)
                window.ashAPI?.dismissMood()
              }
            }}
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

      {/* ── Side panel — drawer or check-in, beside Ash ── */}
      {panelOpen && (
        <div
          className={`side-panel anchor-${anchor} vertical-${verticalAnchor}`}
          style={{ pointerEvents: 'auto' }}
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
