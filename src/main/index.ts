import { app, BrowserWindow, ipcMain, screen, powerMonitor, globalShortcut } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { createTray } from './tray'
import { initStore } from './store'
import { registerIpcHandlers } from './ipc-handlers'
import { startTimers, resetWaterTimer, recordInteraction, stopTimers, recalculateTimers } from './timers'
import { startContextMonitoring, getCurrentContext } from './context'
import { startIDEMonitoring } from './ide-monitor'

/** The single main companion window */
let mainWindow: BrowserWindow | null = null

export let isNotificationActive = false
export function setIsNotificationActive(active: boolean) {
  isNotificationActive = active
}

export let triggerRoam = () => {}
let isRoaming = false


function createWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  // Companion window: small, transparent, frameless, always on top
  const WINDOW_SIZE = 120

  mainWindow = new BrowserWindow({
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    x: screenWidth - WINDOW_SIZE - 40,
    y: screenHeight - WINDOW_SIZE - 40,
    show: false,
    type: 'panel', // macOS: prevents hiding in Mission Control
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // macOS: stay on top of fullscreen apps and across all workspaces
  mainWindow.setAlwaysOnTop(true, 'floating')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Allow clicking through transparent areas on macOS while receiving hover events
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Snap to bottom-right corner on startup (after renderer is ready)
  mainWindow.webContents.once('did-finish-load', () => {
    if (!mainWindow) return
    const display = screen.getPrimaryDisplay()
    const { x, y, width, height } = display.workArea
    const bounds = mainWindow.getBounds()
    const PADDING = 20
    mainWindow.setBounds({
      x: Math.round(x + width - bounds.width - PADDING),
      y: Math.round(y + height - bounds.height - PADDING),
      width: bounds.width,
      height: bounds.height
    })
    mainWindow.show()
  })

  // Helper for companion anchor calculation based on unexpanded or expanded window position
  function getCompanionAnchor(): 'left' | 'right' {
    if (!mainWindow) return 'right'
    const bounds = mainWindow.getBounds()
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
    const screenCenterX = display.workArea.x + display.workArea.width / 2

    let companionCenterX: number
    if (bounds.width <= 200) {
      companionCenterX = bounds.x + bounds.width / 2
    } else {
      const rightEdge = bounds.x + bounds.width
      companionCenterX = (rightEdge > screenCenterX) ? (rightEdge - 60) : (bounds.x + 60)
    }

    return companionCenterX < screenCenterX ? 'left' : 'right'
  }

  function getCompanionVerticalAnchor(): 'top' | 'bottom' {
    if (!mainWindow) return 'bottom'
    const bounds = mainWindow.getBounds()
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
    const screenCenterY = display.workArea.y + display.workArea.height / 2

    let companionCenterY: number
    if (bounds.height <= 200) {
      companionCenterY = bounds.y + bounds.height / 2
    } else {
      const bottomEdge = bounds.y + bounds.height
      companionCenterY = (bottomEdge > screenCenterY) ? (bottomEdge - 60) : (bounds.y + 60)
    }

    return companionCenterY < screenCenterY ? 'top' : 'bottom'
  }

  // Handle window resize requests from renderer (for drawer / modal expansion)
  ipcMain.on('window:resize', (_event, width: number, height: number, anchor?: 'left' | 'right', verticalAnchor?: 'top' | 'bottom') => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()

      // Respect passed anchor/verticalAnchor from renderer if provided, else compute
      const effectiveAnchor = anchor || getCompanionAnchor()
      const effectiveVerticalAnchor = verticalAnchor || getCompanionVerticalAnchor()

      // Calculate where the companion outer edge sits on screen to keep companion stationary
      const fixedX = effectiveAnchor === 'right' ? (bounds.x + bounds.width) : bounds.x
      const fixedY = effectiveVerticalAnchor === 'bottom' ? (bounds.y + bounds.height) : bounds.y

      let newX = effectiveAnchor === 'right' ? (fixedX - width) : fixedX
      let newY = effectiveVerticalAnchor === 'bottom' ? (fixedY - height) : fixedY

      // Clamp target bounds to display work area
      const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
      const { x: wa_x, y: wa_y, width: wa_w, height: wa_h } = display.workArea

      newX = Math.max(wa_x, Math.min(wa_x + wa_w - width, newX))
      newY = Math.max(wa_y, Math.min(wa_y + wa_h - height, newY))

      mainWindow.setBounds({
        x: Math.round(newX),
        y: Math.round(newY),
        width,
        height
      })
    }
  })

  ipcMain.on('app:quit', () => {
    app.quit()
  })

  // Handle JS-based window dragging
  ipcMain.on('window:move-by', (_event, dx: number, dy: number) => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()

      let targetX = Math.round(bounds.x + dx)
      let targetY = Math.round(bounds.y + dy)

      mainWindow.setBounds({
        x: targetX,
        y: targetY,
        width: bounds.width,
        height: bounds.height
      })
    }
  })

  // Helper for smooth window animation
  let activeAnimation: ReturnType<typeof setTimeout> | null = null

  const animateWindowBounds = (targetBounds: Electron.Rectangle, durationMs: number = 300, onComplete?: () => void) => {
    if (!mainWindow) return
    if (activeAnimation) {
      clearTimeout(activeAnimation)
      activeAnimation = null
      isRoaming = false
    }

    const startBounds = mainWindow.getBounds()
    const startTime = Date.now()
    
    // Smooth easing function (easeOutCubic)
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

    const animate = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      const now = Date.now()
      const elapsed = now - startTime
      const progress = Math.min(elapsed / durationMs, 1)
      const easedProgress = easeOutCubic(progress)

      const currentX = startBounds.x + (targetBounds.x - startBounds.x) * easedProgress
      const currentY = startBounds.y + (targetBounds.y - startBounds.y) * easedProgress

      mainWindow.setBounds({
        x: Math.round(currentX),
        y: Math.round(currentY),
        width: targetBounds.width,
        height: targetBounds.height
      })

      if (progress < 1) {
        activeAnimation = setTimeout(animate, 16) // ~60fps
      } else {
        activeAnimation = null
        isRoaming = false
        if (onComplete) onComplete()
      }
    }
    
    animate()
  }

  let consecutiveEvadeCount = 0
  let lastEvadeTime = Date.now()

  // Exported roam function — strictly horizontal walking, far corner on 3rd evade
  triggerRoam = () => {
    if (!mainWindow || isNotificationActive || isRoaming) return
    isRoaming = true

    const bounds = mainWindow.getBounds()
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
    const { x: wa_x, width: wa_w } = display.workArea
    const cursor = screen.getCursorScreenPoint()
    const now = Date.now()

    // Reset evade count if user hasn't disturbed Ash for more than 10 seconds
    if (now - lastEvadeTime > 10000) {
      consecutiveEvadeCount = 0
    }
    lastEvadeTime = now
    consecutiveEvadeCount++

    let targetX = bounds.x
    const targetY = bounds.y // Strictly horizontal walking — vertical stays fixed

    if (consecutiveEvadeCount >= 3) {
      // User has been working here and bumped Ash 3 times.
      // Walk directly to the far opposite end corner!
      consecutiveEvadeCount = 0
      const isCursorOnRightHalf = cursor.x > (wa_x + wa_w / 2)
      if (isCursorOnRightHalf) {
        targetX = wa_x + 20 // Far left corner
      } else {
        targetX = wa_x + wa_w - bounds.width - 20 // Far right corner
      }
    } else {
      // Short horizontal shift (200px) away from cursor
      const deltaX = (bounds.x + bounds.width / 2) - cursor.x
      const SHIFT_DIST = 200

      if (deltaX >= 0) {
        targetX = bounds.x + SHIFT_DIST
      } else {
        targetX = bounds.x - SHIFT_DIST
      }

      // Clamp within work area bounds
      targetX = Math.max(wa_x + 10, Math.min(wa_x + wa_w - bounds.width - 10, targetX))

      // If hitting wall, step in opposite direction
      if (Math.abs(targetX - bounds.x) < 20) {
        targetX = deltaX >= 0 ? bounds.x - SHIFT_DIST : bounds.x + SHIFT_DIST
        targetX = Math.max(wa_x + 10, Math.min(wa_x + wa_w - bounds.width - 10, targetX))
      }
    }

    const distance = Math.abs(targetX - bounds.x)
    const isMovingLeft = targetX < bounds.x
    const durationMs = Math.max(400, (distance / 300) * 1000)

    mainWindow.webContents.send('mood:change', isMovingLeft ? 'walking-left' : 'walking')

    animateWindowBounds({
      x: Math.round(targetX),
      y: Math.round(targetY),
      width: bounds.width,
      height: bounds.height
    }, durationMs, () => {
      isRoaming = false
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('mood:change', 'idle')
        mainWindow.webContents.send('anchor:update')
      }
    })
  }

  // Handle snapping to nearest corner
  ipcMain.on('window:snap-to-corner', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
      const { x, y, width, height } = display.workArea

      const winCenterX = bounds.x + bounds.width / 2
      const winCenterY = bounds.y + bounds.height / 2
      const screenCenterX = x + width / 2
      const screenCenterY = y + height / 2

      const isLeft = winCenterX < screenCenterX
      const isTop = winCenterY < screenCenterY

      const PADDING = 40

      const targetX = isLeft ? x + PADDING : x + width - bounds.width - PADDING
      const targetY = isTop ? y + PADDING : y + height - bounds.height - PADDING

      animateWindowBounds({
        x: Math.round(targetX),
        y: Math.round(targetY),
        width: bounds.width,
        height: bounds.height
      })
    }
  })

  // Handle resetting position to center of primary display
  ipcMain.on('window:reset-position', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      const primaryDisplay = screen.getPrimaryDisplay()
      const { x, y, width, height } = primaryDisplay.workArea
      
      const targetX = x + (width - bounds.width) / 2
      const targetY = y + (height - bounds.height) / 2
      
      animateWindowBounds({
        x: Math.round(targetX),
        y: Math.round(targetY),
        width: bounds.width,
        height: bounds.height
      })
    }
  })

  // Handle click-through on transparent pixels
  ipcMain.on('set-ignore-mouse-events', (event, ignore: boolean, options?: { forward: boolean }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.setIgnoreMouseEvents(ignore, options)
    }
  })

  // Reliable anchor calculation based on COMPANION POSITION
  ipcMain.handle('window:get-anchor', () => {
    return getCompanionAnchor()
  })

  // Vertical anchor — based on COMPANION POSITION
  ipcMain.handle('window:get-vertical-anchor', () => {
    return getCompanionVerticalAnchor()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

// ── App lifecycle ──────────────────────────────────────

app.whenReady().then(async () => {
  // Set to automatically start on login (only in production)
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe')
    })
  }

  // Initialize local data store
  await initStore()

  // Create the companion window
  const win = createWindow()

  // Register all IPC handlers
  registerIpcHandlers(win)

  // Create system tray
  createTray(win)

  // Start timers (water, check-in, boredom)
  startTimers(win)

  // Start context monitoring (active app, tabs, window bounds)
  startContextMonitoring(win)

  // Start IDE monitoring for permission requests
  startIDEMonitoring(win)

  // Global hotkey to manually force Ash to evade
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    if (!win || win.isDestroyed()) return
    triggerRoam()
  })

  // Polling for typing/activity evasion using powerMonitor
  let lastMoveByActivity = Date.now()
  let lastCursorPos = { x: 0, y: 0 }
  let nearStationaryStartTime: number | null = null
  const EVASION_COOLDOWN = 1500 // 1.5 seconds

  setInterval(() => {
    if (!win || win.isDestroyed()) return
    const idleTime = powerMonitor.getSystemIdleTime()
    const now = Date.now()
    
    const cursor = screen.getCursorScreenPoint()
    const bounds = win.getBounds()

    // Calculate cursor velocity (distance moved since last check ~80ms)
    const cursorSpeed = Math.hypot(cursor.x - lastCursorPos.x, cursor.y - lastCursorPos.y)
    lastCursorPos = { x: cursor.x, y: cursor.y }

    // Do not evade if the user is interacting with the companion (drawer or notification is open)
    if (bounds.width > 200) return

    const isNear = 
      cursor.x >= bounds.x - 100 && cursor.x <= bounds.x + bounds.width + 100 &&
      cursor.y >= bounds.y - 100 && cursor.y <= bounds.y + bounds.height + 100

    const isDirectlyOver = 
      cursor.x >= bounds.x && cursor.x <= bounds.x + bounds.width &&
      cursor.y >= bounds.y && cursor.y <= bounds.y + bounds.height

    if (isNear) {
      // Intent tracking: if cursor slows down or stops near/over Ash, user wants to interact!
      if (cursorSpeed < 10 || isDirectlyOver) {
        if (nearStationaryStartTime === null) {
          nearStationaryStartTime = now
        }
        // Freeze movement if stationary for > 80ms or directly over Ash so user can double-click/interact!
        if (now - nearStationaryStartTime > 80 || isDirectlyOver) {
          return
        }
      } else {
        // Cursor is moving actively towards/past Ash — reset catch window
        nearStationaryStartTime = null
      }

      // System active (idleTime === 0) & cooldown passed -> flee
      if (idleTime === 0 && now - lastMoveByActivity > EVASION_COOLDOWN) {
        lastMoveByActivity = now
        triggerRoam()
      }
    } else {
      nearStationaryStartTime = null
    }
  }, 80)

  // Handle pet interactions — reset timers
  ipcMain.on('interaction:pet', () => {
    setIsNotificationActive(false)
    recordInteraction(win)
    console.log('🐺 Ash was petted!')
  })

  // Handle mood dismissal — reset water timer
  ipcMain.on('mood:dismiss', () => {
    setIsNotificationActive(false)
    resetWaterTimer(win)
    console.log('🐺 Mood dismissed')
  })

  // ── Break window ──────────────────────────────────────────────────────────

  let breakWindow: BrowserWindow | null = null

  /** Open a fullscreen breathing break window */
  ipcMain.on('break:start', (_event, durationSeconds: number = 180) => {
    if (breakWindow && !breakWindow.isDestroyed()) {
      breakWindow.focus()
      return
    }

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.bounds

    breakWindow = new BrowserWindow({
      width,
      height,
      x: primaryDisplay.bounds.x,
      y: primaryDisplay.bounds.y,
      frame: false,
      titleBarStyle: 'hidden',         // suppress macOS native title bar chrome
      transparent: false,
      resizable: false,
      movable: false,
      fullscreen: false,               // manual bounds cover screen — avoids fullscreen animation
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      backgroundColor: '#F5F4F0',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })


    // Stay on top of fullscreen apps across all spaces
    breakWindow.setAlwaysOnTop(true, 'screen-saver')
    breakWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    // Load the dedicated break.html
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      // ELECTRON_RENDERER_URL is the Vite dev server origin (e.g. http://localhost:5173)
      const baseUrl = process.env['ELECTRON_RENDERER_URL'].replace(/\/$/, '')
      breakWindow.loadURL(`${baseUrl}/break.html?duration=${durationSeconds}`)
    } else {
      breakWindow.loadFile(join(__dirname, '../renderer/break.html'), {
        query: { duration: String(durationSeconds) }
      })
    }

    // When break window closes for any reason, notify companion window
    const onBreakClosed = (completed: boolean) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('break:ended', completed)
        // Reset notification active flag so timers resume
        setIsNotificationActive(false)
      }
      breakWindow = null
      console.log(`🧘 Break window closed (completed: ${completed})`)
    }

    breakWindow.on('closed', () => {
      onBreakClosed(false)
    })

    // Mark notification active while break is running (suppresses new notifications)
    setIsNotificationActive(true)
    console.log(`🧘 Break window opened (${durationSeconds}s)`)
  })

  /** Close the break window — called from the break renderer via ashAPI.endBreak() */
  ipcMain.on('break:end', (_event, completed: boolean = false) => {
    if (breakWindow && !breakWindow.isDestroyed()) {
      // Remove our 'closed' listener first to prevent double-firing onBreakClosed
      breakWindow.removeAllListeners('closed')
      breakWindow.close()
      breakWindow = null

      if (win && !win.isDestroyed()) {
        win.webContents.send('break:ended', completed)
        setIsNotificationActive(false)
      }
      console.log(`🧘 Break ended (completed: ${completed})`)
    }
  })

  // Auto-close break window if system suspends
  powerMonitor.on('suspend', () => {
    if (breakWindow && !breakWindow.isDestroyed()) {
      breakWindow.removeAllListeners('closed')
      breakWindow.close()
      breakWindow = null
      if (win && !win.isDestroyed()) {
        win.webContents.send('break:ended', false)
        setIsNotificationActive(false)
      }
    }
  })



  // macOS: re-create window if dock icon clicked and no windows open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  // Handle wake/resume events for a creative greeting
  const handleWakeUp = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    
    // Recalculate timers that might have frozen during sleep
    recalculateTimers(mainWindow)
    recordInteraction(mainWindow)

    // Wake-up creative greeting: switch to 'pleased' mood and do a happy jump
    mainWindow.webContents.send('mood:change', 'pleased')
    
    const bounds = mainWindow.getBounds()
    const originalY = bounds.y
    const steps = [ -15, -25, -15, 0, -10, -20, -10, 0 ]
    let stepIndex = 0
    
    const jumpInterval = setInterval(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (stepIndex >= steps.length) {
          clearInterval(jumpInterval)
          mainWindow.setBounds({ ...bounds, y: originalY })
        } else {
          mainWindow.setBounds({ ...bounds, y: originalY + steps[stepIndex] })
          stepIndex++
        }
      } else {
        clearInterval(jumpInterval)
      }
    }, 60)
  }

  powerMonitor.on('resume', handleWakeUp)
  powerMonitor.on('unlock-screen', handleWakeUp)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export { mainWindow }
