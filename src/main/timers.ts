import { BrowserWindow, powerMonitor } from 'electron'
import { getSettings, getCheckInStatus, processCarryOver } from './store'
import { setIsNotificationActive, triggerRoam } from './index'

let waterTimer: ReturnType<typeof setInterval> | null = null
let checkInTimer: ReturnType<typeof setTimeout> | null = null
let taskGoalTimer: ReturnType<typeof setInterval> | null = null
let boredomTimer: ReturnType<typeof setTimeout> | null = null
let screenTimeTimer: ReturnType<typeof setInterval> | null = null
let roamTimer: ReturnType<typeof setInterval> | null = null
let lastInteractionTime = Date.now()
let lastScreenTimeTrigger = Date.now()

/** Helper to check if current time falls within Quiet Hours */
function isQuietHoursActive(): boolean {
  const settings = getSettings()
  if (!settings.quietHoursEnabled) return false

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [fromH, fromM] = (settings.quietHoursFrom || '22:00').split(':').map(Number)
  const [toH, toM] = (settings.quietHoursTo || '08:00').split(':').map(Number)

  const fromMinutes = fromH * 60 + fromM
  const toMinutes = toH * 60 + toM

  if (fromMinutes <= toMinutes) {
    return currentMinutes >= fromMinutes && currentMinutes < toMinutes
  } else {
    // Overnight window (e.g. 22:00 to 08:00)
    return currentMinutes >= fromMinutes || currentMinutes < toMinutes
  }
}

/** Start all timers */
export function startTimers(win: BrowserWindow): void {
  startWaterTimer(win)
  startTaskGoalTimer(win)
  startCheckInWatch(win)
  startBoredomWatch(win)
  startScreenTimeWatch(win)
  startRoamWatch(win)
}

/** Stop all timers */
export function stopTimers(): void {
  if (waterTimer) clearInterval(waterTimer)
  if (taskGoalTimer) clearInterval(taskGoalTimer)
  if (checkInTimer) clearTimeout(checkInTimer)
  if (boredomTimer) clearTimeout(boredomTimer)
  if (screenTimeTimer) clearInterval(screenTimeTimer)
  if (roamTimer) clearTimeout(roamTimer)
  waterTimer = null
  taskGoalTimer = null
  checkInTimer = null
  boredomTimer = null
  screenTimeTimer = null
  roamTimer = null
}

/** Recalculate timers on system wake or settings update */
export function recalculateTimers(win: BrowserWindow): void {
  stopTimers()
  startTimers(win)
}



/** Record an interaction (resets boredom timer) */
export function recordInteraction(win: BrowserWindow): void {
  lastInteractionTime = Date.now()
  resetBoredomWatch(win)
}

let lastWaterTrigger = 0

function startWaterTimer(win: BrowserWindow): void {
  const settings = getSettings()
  if (settings.waterEnabled === false) return

  waterTimer = setInterval(() => {
    const s = getSettings()
    if (s.waterEnabled === false) return
    if (isQuietHoursActive()) return

    const intervalMs = (s.waterIntervalMinutes || 30) * 60 * 1000
    const now = Date.now()

    if (now - lastWaterTrigger >= intervalMs && !win.isDestroyed()) {
      lastWaterTrigger = now
      setIsNotificationActive(true)
      win.webContents.send('mood:change', 'concerned', 'water')
    }
  }, 10 * 1000)
}

export function resetWaterTimer(win: BrowserWindow): void {
  lastWaterTrigger = Date.now()
}


// ── Task & Goal Check-in Cadence Timer ───────────────

function startTaskGoalTimer(win: BrowserWindow): void {
  const settings = getSettings()
  if (settings.taskGoalCheckInEnabled === false) return

  const intervalMs = (settings.taskGoalCheckInIntervalMinutes || 90) * 60 * 1000

  taskGoalTimer = setInterval(() => {
    if (isQuietHoursActive()) return
    if (!win.isDestroyed()) {
      setIsNotificationActive(true)
      win.webContents.send('mood:change', 'waiting', 'task-goal-cadence')
    }
  }, intervalMs)
}

// ── Daily Check-in Timer (Summary) ───────────────────

function startCheckInWatch(win: BrowserWindow): void {
  const checkDaily = () => {
    if (isQuietHoursActive()) return
    const { done } = getCheckInStatus()
    if (!done) {
      const settings = getSettings()
      const [hours, minutes] = (settings.checkInTime || '09:00').split(':').map(Number)
      const now = new Date()
      if (now.getHours() === hours && now.getMinutes() === minutes) {
        processCarryOver()
        if (!win.isDestroyed()) {
          setIsNotificationActive(true)
          win.webContents.send('mood:change', 'waiting', 'daily-summary')
        }
      }
    }
  }

  checkInTimer = setInterval(checkDaily, 60 * 1000) as unknown as ReturnType<typeof setTimeout>
}

// ── Boredom Timer ────────────────────────────────────

const BOREDOM_THRESHOLD = 30 * 60 * 1000 // 30 minutes

function startBoredomWatch(win: BrowserWindow): void {
  boredomTimer = setTimeout(() => {
    if (isQuietHoursActive()) return
    const elapsed = Date.now() - lastInteractionTime
    if (elapsed >= BOREDOM_THRESHOLD && !win.isDestroyed()) {
      setIsNotificationActive(true)
      win.webContents.send('mood:change', 'bored')
    }
  }, BOREDOM_THRESHOLD)
}

function resetBoredomWatch(win: BrowserWindow): void {
  if (boredomTimer) clearTimeout(boredomTimer)
  startBoredomWatch(win)
}

// ── Screen Time Watch ────────────────────────────────

function startScreenTimeWatch(win: BrowserWindow): void {
  screenTimeTimer = setInterval(() => {
    const settings = getSettings()
    if (settings.screenTimeEnabled === false) return
    if (isQuietHoursActive()) return

    const thresholdSec = (settings.screenTimeThresholdMinutes || 50) * 60
    const idleTimeSec = powerMonitor.getSystemIdleTime()

    if (idleTimeSec > 300) {
      lastScreenTimeTrigger = Date.now()
      return
    }

    const now = Date.now()
    const thresholdMs = thresholdSec * 1000

    if (now - lastScreenTimeTrigger > thresholdMs && !win.isDestroyed()) {
      setIsNotificationActive(true)
      win.webContents.send('mood:change', 'concerned', 'screen')
      lastScreenTimeTrigger = now
    }
  }, 60 * 1000)
}

// ── Roam Timer ───────────────────────────────────────

function startRoamWatch(win: BrowserWindow): void {
  const scheduleNextRoam = () => {
    const MIN_MS = 3 * 60 * 1000
    const MAX_MS = 5 * 60 * 1000
    const delay = MIN_MS + Math.random() * (MAX_MS - MIN_MS)
    roamTimer = setTimeout(() => {
      if (!win.isDestroyed()) {
        triggerRoam()
      }
      // Schedule the next one after this walk finishes
      scheduleNextRoam()
    }, delay) as unknown as ReturnType<typeof setInterval>
  }
  scheduleNextRoam()
}
