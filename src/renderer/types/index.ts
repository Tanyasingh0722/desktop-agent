/* ============================================
 * Ash — Shared Types
 * ============================================ */

/** All possible moods Ash can be in */
export type Mood =
  | 'idle'
  | 'waiting'
  | 'thirsty'
  | 'alert'
  | 'concerned'
  | 'pleased'
  | 'petted'
  | 'overdue'
  | 'bored'
  | 'walking'
  | 'walking-left'
  | 'sleeping'
  | 'happy'
  | 'angry'
  | 'thinking'
  | 'success'
  | 'remind'
  | 'drag'

/** A single task item */
export interface Task {
  id: string
  text: string
  createdDate: string       // ISO date string
  completedDate?: string    // ISO date string when marked done
  status: 'pending' | 'done'
  carriedOverFrom: string | null  // ISO date or null
  category?: 'today' | 'future'
}

/** User-configurable settings */
export interface Settings {
  waterEnabled: boolean
  waterIntervalMinutes: number
  screenTimeEnabled: boolean
  screenTimeThresholdMinutes: number
  taskGoalCheckInEnabled: boolean
  taskGoalCheckInIntervalMinutes: number
  meetingAlertMinutes: number
  checkInTime: string               // "HH:mm" format (daily summary)
  snoozeDurationMinutes: number      // default 10 mins
  snoozeThreshold: number            // default 3 snoozes before mood shifts
  quietHoursEnabled: boolean         // default false
  quietHoursFrom: string             // "22:00" format
  quietHoursTo: string               // "08:00" format
  snoozeCounts?: Record<string, number>
  lastSnoozedTimestamps?: Record<string, string>
  bingeApps: string[]
  bingeThresholdMinutes: number
}

/** Full local data store shape */
export interface StoreData {
  tasks: Task[]
  settings: Settings
  lastCheckInDate: string | null    // ISO date
}

/** Default settings */
export const DEFAULT_SETTINGS: Settings = {
  waterEnabled: true,
  waterIntervalMinutes: 30,
  screenTimeEnabled: true,
  screenTimeThresholdMinutes: 50,
  taskGoalCheckInEnabled: true,
  taskGoalCheckInIntervalMinutes: 90,
  meetingAlertMinutes: 15,
  checkInTime: '09:00',
  snoozeDurationMinutes: 10,
  snoozeThreshold: 3,
  quietHoursEnabled: true,
  quietHoursFrom: '22:00',
  quietHoursTo: '08:00',
  snoozeCounts: {
    water: 0,
    screen: 0,
    task: 0
  },
  lastSnoozedTimestamps: {},
  bingeApps: ['Netflix', 'YouTube', 'Twitch', 'Disney+', 'Prime Video', 'Hulu', 'HBO Max'],
  bingeThresholdMinutes: 120
}

/** IPC channel names — single source of truth */
export const IPC = {
  // Mood
  MOOD_CHANGE: 'mood:change',
  MOOD_DISMISS: 'mood:dismiss',

  // Petting
  INTERACTION_PET: 'interaction:pet',

  // Tasks
  TASKS_GET: 'tasks:get',
  TASKS_ADD: 'tasks:add',
  TASKS_TOGGLE: 'tasks:toggle',
  TASKS_DELETE: 'tasks:delete',
  TASKS_GET_CARRYOVER: 'tasks:get-carryover',
  TASKS_DISMISS_CARRYOVER: 'tasks:dismiss-carryover',
  TASKS_REORDER: 'tasks:reorder',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // Check-in
  CHECKIN_STATUS: 'checkin:status',
  CHECKIN_DONE: 'checkin:done',

  // Window
  WINDOW_TOGGLE_DRAWER: 'window:toggle-drawer',
  WINDOW_RESIZE: 'window:resize'
} as const
