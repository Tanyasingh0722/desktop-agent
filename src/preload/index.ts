import { contextBridge, ipcRenderer } from 'electron'
import type { Mood, Task, Settings } from '../renderer/types'

/**
 * Preload script — exposes a safe, typed API to the renderer
 * via contextBridge. No direct Node/Electron access in renderer.
 */
const api = {
  // ── Mood ──────────────────────────────────────────
  onMoodChange: (callback: (mood: Mood, detail?: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, mood: Mood, detail?: string) => {
      callback(mood, detail)
    }
    ipcRenderer.on('mood:change', handler)
    return () => ipcRenderer.removeListener('mood:change', handler)
  },
  dismissMood: () => ipcRenderer.send('mood:dismiss'),

  // ── Petting ───────────────────────────────────────
  pet: () => ipcRenderer.send('interaction:pet'),

  // ── Tasks ─────────────────────────────────────────
  getTasks: (): Promise<Task[]> => ipcRenderer.invoke('tasks:get'),
  addTasks: (tasksData: { text: string; category?: 'today' | 'future' }[]): Promise<Task[]> => ipcRenderer.invoke('tasks:add', tasksData),
  toggleTask: (id: string): Promise<Task> => ipcRenderer.invoke('tasks:toggle', id),
  deleteTask: (id: string): Promise<void> => ipcRenderer.invoke('tasks:delete', id),
  reorderTasks: (ids: string[]): Promise<void> => ipcRenderer.invoke('tasks:reorder', ids),
  getCarryOver: (): Promise<Task[]> => ipcRenderer.invoke('tasks:get-carryover'),
  dismissCarryOver: (ids: string[]): Promise<void> =>
    ipcRenderer.invoke('tasks:dismiss-carryover', ids),

  // ── Settings ──────────────────────────────────────
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:update', partial),

  // ── Check-in ──────────────────────────────────────
  getCheckInStatus: (): Promise<{ done: boolean; date: string | null }> =>
    ipcRenderer.invoke('checkin:status'),
  markCheckInDone: (): Promise<void> => ipcRenderer.invoke('checkin:done'),

  // ── Window ────────────────────────────────────────
  resizeWindow: (width: number, height: number, anchor: 'left' | 'right' = 'right', verticalAnchor: 'top' | 'bottom' = 'bottom') =>
    ipcRenderer.send('window:resize', width, height, anchor, verticalAnchor),
  moveWindowBy: (dx: number, dy: number) =>
    ipcRenderer.send('window:move-by', dx, dy),
  snapToCorner: () => 
    ipcRenderer.send('window:snap-to-corner'),
  resetPosition: () =>
    ipcRenderer.send('window:reset-position'),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  getAnchor: (): Promise<'left' | 'right'> =>
    ipcRenderer.invoke('window:get-anchor'),
  getVerticalAnchor: (): Promise<'top' | 'bottom'> =>
    ipcRenderer.invoke('window:get-vertical-anchor'),
  quitApp: () => ipcRenderer.send('app:quit'),

  // ── Anchor sync ───────────────────────────────────
  onAnchorUpdate: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('anchor:update', handler)
    return () => ipcRenderer.removeListener('anchor:update', handler)
  },

  // ── Context ───────────────────────────────────────
  onContextUpdate: (callback: (context: { activeApp: string, activeTab: string, windowBounds: any }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, context: any) => {
      callback(context)
    }
    ipcRenderer.on('context:update', handler)
    return () => ipcRenderer.removeListener('context:update', handler)
  },

  // ── Break window ──────────────────────────────────────────────────────────
  /** Open the fullscreen breathing break. duration in seconds (default 180). */
  startBreak: (durationSeconds: number = 180) =>
    ipcRenderer.send('break:start', durationSeconds),
  /** Close the break window (called from within the break window itself). */
  endBreak: (completed: boolean = false) =>
    ipcRenderer.send('break:end', completed),
  /** Listen for the break window closing (fired in the main companion window). */
  onBreakEnd: (callback: (completed: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, completed: boolean) => {
      callback(completed)
    }
    ipcRenderer.on('break:ended', handler)
    return () => ipcRenderer.removeListener('break:ended', handler)
  }
}

export type AshAPI = typeof api

contextBridge.exposeInMainWorld('ashAPI', api)
