import { BrowserWindow, ipcMain } from 'electron'
import {
  getTasks,
  addTasks,
  toggleTask,
  deleteTask,
  getCarryOverTasks,
  dismissCarryOver,
  reorderTasks,
  getSettings,
  updateSettings,
  getCheckInStatus,
  markCheckInDone
} from './store'
import { stopTimers, startTimers } from './timers'
import type { Settings } from '../renderer/types'

/**
 * Register all IPC handlers — called once at app startup.
 * Uses ipcMain.handle for request/response and ipcMain.on for fire-and-forget.
 */
export function registerIpcHandlers(win: BrowserWindow): void {
  // ── Tasks ─────────────────────────────────────────
  ipcMain.handle('tasks:get', () => {
    return getTasks()
  })

  ipcMain.handle('tasks:add', (_event, tasksData: { text: string; category?: 'today' | 'future' }[]) => {
    return addTasks(tasksData)
  })

  ipcMain.handle('tasks:toggle', (_event, id: string) => {
    return toggleTask(id)
  })

  ipcMain.handle('tasks:delete', (_event, id: string) => {
    return deleteTask(id)
  })

  ipcMain.handle('tasks:get-carryover', () => {
    return getCarryOverTasks()
  })

  ipcMain.handle('tasks:dismiss-carryover', (_event, ids: string[]) => {
    dismissCarryOver(ids)
  })

  ipcMain.handle('tasks:reorder', (_event, ids: string[]) => {
    reorderTasks(ids)
  })

  // ── Settings ──────────────────────────────────────
  ipcMain.handle('settings:get', () => {
    return getSettings()
  })

  ipcMain.handle('settings:update', (_event, partial: Partial<Settings>) => {
    const updated = updateSettings(partial)
    stopTimers()
    startTimers(win)
    return updated
  })

  // ── Check-in ──────────────────────────────────────
  ipcMain.handle('checkin:status', () => {
    return getCheckInStatus()
  })

  ipcMain.handle('checkin:done', () => {
    markCheckInDone()
  })

  // Note: interaction:pet and mood:dismiss are registered in index.ts
  // to integrate with timers (reset water timer on dismiss, record interaction on pet)
}
