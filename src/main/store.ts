import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import type { StoreData, Task, Settings } from '../renderer/types'
import { DEFAULT_SETTINGS } from '../renderer/types'

/**
 * Simple JSON file-based store using lowdb pattern (manual implementation
 * to avoid ESM-only issues with lowdb in Electron's CJS main process).
 *
 * Store file lives at: ~/Library/Application Support/Ash/ash-data.json (macOS)
 *                   or %APPDATA%/Ash/ash-data.json (Windows)
 */

const STORE_FILE = 'ash-data.json'
let storePath: string
let data: StoreData

/** Default empty store */
function defaultStore(): StoreData {
  return {
    tasks: [],
    settings: { ...DEFAULT_SETTINGS },
    lastCheckInDate: null
  }
}

/** Read store from disk */
function readStore(): StoreData {
  try {
    if (existsSync(storePath)) {
      const raw = readFileSync(storePath, 'utf-8')
      return JSON.parse(raw) as StoreData
    }
  } catch (err) {
    console.error('Failed to read store, using defaults:', err)
  }
  return defaultStore()
}

/** Write store to disk */
function writeStore(): void {
  try {
    writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to write store:', err)
  }
}

/** Initialize the store — call once at app startup */
export async function initStore(): Promise<void> {
  const userDataPath = app.getPath('userData')
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }
  storePath = join(userDataPath, STORE_FILE)
  data = readStore()

  // Ensure settings have all keys (handles upgrades adding new keys)
  data.settings = { ...DEFAULT_SETTINGS, ...data.settings }
  writeStore()
}

// ── Task operations ─────────────────────────────────────

export function getTasks(): Task[] {
  return data.tasks
}

export function addTasks(tasksData: { text: string; category?: 'today' | 'future' }[]): Task[] {
  const today = new Date().toISOString().split('T')[0]
  const { v4: uuid } = require('uuid')

  const newTasks: Task[] = tasksData
    .filter((t) => t.text.trim().length > 0)
    .map((item) => ({
      id: uuid(),
      text: item.text.trim(),
      createdDate: today,
      status: 'pending' as const,
      carriedOverFrom: null,
      category: item.category || 'today'
    }))

  data.tasks.push(...newTasks)
  writeStore()
  return newTasks
}

export function toggleTask(id: string): Task | null {
  const task = data.tasks.find((t) => t.id === id)
  if (!task) return null
  if (task.status === 'pending') {
    task.status = 'done'
    task.completedDate = new Date().toISOString()
  } else {
    task.status = 'pending'
    delete task.completedDate
  }
  writeStore()
  return task
}

export function deleteTask(id: string): boolean {
  const idx = data.tasks.findIndex((t) => t.id === id)
  if (idx === -1) return false
  data.tasks.splice(idx, 1)
  writeStore()
  return true
}

export function reorderTasks(taskIds: string[]): void {
  const indices = taskIds.map(id => data.tasks.findIndex(t => t.id === id)).filter(idx => idx !== -1).sort((a, b) => a - b)
  if (indices.length !== taskIds.length) return

  const newOrderedTasks = taskIds.map(id => data.tasks.find(t => t.id === id)!)
  indices.forEach((storeIdx, i) => {
    data.tasks[storeIdx] = newOrderedTasks[i]
  })
  writeStore()
}

/** Get pending tasks from previous days (carry-over candidates) */
export function getCarryOverTasks(): Task[] {
  const today = new Date().toISOString().split('T')[0]
  return data.tasks.filter(
    (t) => t.status === 'pending' && t.createdDate < today
  )
}

/** Mark carried-over tasks — stamp them with today as carriedOverFrom origin */
export function processCarryOver(): void {
  const today = new Date().toISOString().split('T')[0]
  for (const task of data.tasks) {
    if (task.status === 'pending' && task.createdDate < today && !task.carriedOverFrom) {
      task.carriedOverFrom = task.createdDate
    }
  }
  writeStore()
}

/** Dismiss (delete) carried-over tasks by IDs */
export function dismissCarryOver(ids: string[]): void {
  data.tasks = data.tasks.filter((t) => !ids.includes(t.id))
  writeStore()
}

// ── Settings operations ─────────────────────────────────

export function getSettings(): Settings {
  return { ...data.settings }
}

export function updateSettings(partial: Partial<Settings>): Settings {
  data.settings = { ...data.settings, ...partial }
  writeStore()
  return { ...data.settings }
}

// ── Check-in operations ─────────────────────────────────

export function getCheckInStatus(): { done: boolean; date: string | null } {
  const today = new Date().toISOString().split('T')[0]
  return {
    done: data.lastCheckInDate === today,
    date: data.lastCheckInDate
  }
}

export function markCheckInDone(): void {
  data.lastCheckInDate = new Date().toISOString().split('T')[0]
  writeStore()
}
