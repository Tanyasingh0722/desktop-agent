/**
 * Notification helpers — separated from the component to satisfy React Fast Refresh.
 * A module can only export React components OR non-component values, not both.
 */

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Get notification content for a mood */
export function getNotificationForMood(
  mood: string,
  detail?: string
): { message: string; emoji: string; isQuestion?: boolean; confirmText?: string; cancelText?: string } | null {
  switch (mood) {
    case 'concerned':
      if (detail === 'water') {
        return {
          message: pickRandom([
            "Psst — go grab some water 💧",
            "Hydration check! When did you last drink?",
            "Your body is 60% water. Top it up!",
            "Ash is thirsty. Are you? 🥤"
          ]),
          emoji: '💧',
          isQuestion: true,
          confirmText: 'Okay, drink it',
          cancelText: 'No'
        }
      }
      if (detail === 'screen') {
        return {
          message: pickRandom([
            "You've been at this a while — take a breather 🧘",
            "Screen break time! Stand up & stretch 🙆",
            "Your eyes need a rest. Look away for a sec 👀",
            "Ash's eyes are tired. Let's take a break!"
          ]),
          emoji: '👀',
          isQuestion: true,
          confirmText: 'Okay',
          cancelText: 'No'
        }
      }
      return {
        message: 'Something is bothering Ash...',
        emoji: '🤔'
      }
    case 'angry':
      if (detail === 'distraction') {
        return {
          message: 'Hey! Less streaming, more working on your tasks! 😠',
          emoji: '😠'
        }
      }
      if (detail === 'reset') {
        return {
          message: 'Giving up on your focus session already? Pathetic. 🙄',
          emoji: '🙄'
        }
      }
      return {
        message: 'Ash is grumpy!',
        emoji: '😠'
      }
    case 'happy':
      if (detail === 'focus') {
        return {
          message: 'Great job focusing! Keep it up! ✨',
          emoji: '🌟'
        }
      }
      return null
    case 'remind':
      if (detail === 'ide-permission') {
        return { message: 'Antigravity is asking for permission!', emoji: '⚠️' }
      }
      return {
        message: detail ? detail : 'Hey, remember to stay on track!',
        emoji: '🔥'
      }
    case 'thirsty': // fallback
      return {
        message: pickRandom([
          "Psst — go grab some water 💧",
          "Hydration check! When did you last drink?"
        ]),
        emoji: '💧',
        isQuestion: true,
        confirmText: 'Okay, drink it',
        cancelText: 'No'
      }
    case 'alert':
      return {
        message: detail ? detail : '📅 You have a meeting coming up!',
        emoji: '📅'
      }
    case 'overdue':
      return { message: "Tasks from yesterday are still waiting 📋", emoji: '📋' }
    case 'success':
      return {
        message: 'Good job! Keep it up! 🌟',
        emoji: '✨'
      }
    case 'bored':
      return {
        message: pickRandom([
          "Poke me, I'm getting lonely over here 🐾",
          "Helloooo? Anyone there?",
          "I'm bored. Are you bored? Let's be bored together.",
          "Come back! I miss you 🥺"
        ]),
        emoji: '😴'
      }
    case 'waiting':
      return {
        message: pickRandom([
          "Ready for the next hunt? 🐺",
          "Woof! What are we tackling today?",
          "Rise & shine — let's set our sights on some goals ✨",
          "A new day, a fresh trail to track. What's the plan?"
        ]),
        emoji: '🐾',
        isQuestion: true,
        confirmText: 'Yes',
        cancelText: 'Skip'
      }
    default:
      return null
  }
}
