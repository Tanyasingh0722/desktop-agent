import { Mood } from '../types'

/**
 * Mood state machine — defines valid transitions between moods.
 *
 * The companion can be in one mood at a time. Some moods are "sticky"
 * (require explicit dismissal), others are transient (auto-return to idle).
 */

export interface MoodTransition {
  from: Mood
  to: Mood
  trigger: string
}

/** Moods that auto-return to idle after a timeout */
export const TRANSIENT_MOODS: Partial<Record<Mood, number>> = {
  pleased: 2000,    // 2 seconds
  petted: 1500,     // 1.5 seconds
  happy: 1500       // 1.5 seconds
}

/** Moods that require explicit dismissal (petting or action) */
export const STICKY_MOODS: Mood[] = [
  'waiting',
  'thirsty',
  'alert',
  'concerned',
  'overdue',
  'bored',
  'angry',
  'remind'
]

/** Check if a mood is transient (auto-returns to idle) */
export function isTransientMood(mood: Mood): boolean {
  return mood in TRANSIENT_MOODS
}

/** Check if a mood can be dismissed by petting */
export function isDismissibleByPet(mood: Mood): boolean {
  return STICKY_MOODS.includes(mood)
}

/** Get timeout for a transient mood, or null if sticky */
export function getTransientTimeout(mood: Mood): number | null {
  return TRANSIENT_MOODS[mood] ?? null
}

/**
 * Resolve what mood to go to after a pet interaction.
 * Always goes to 'petted' first, then returns to 'idle' after timeout.
 */
export function resolvePetMood(): Mood {
  return 'petted'
}

/**
 * Get the sprite filename for a mood.
 * Placeholder PNGs for now — will be swapped for GIFs later.
 */
export function getSpriteForMood(mood: Mood): string {
  return `${mood}.png`
}
