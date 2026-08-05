import React from 'react'

export interface NotificationItem {
  id: string
  message: string
  emoji?: string
  isQuestion?: boolean
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  onCancel?: () => void
}

interface NotificationStackProps {
  notifications: NotificationItem[]
  onDismiss: (id: string) => void
}

/**
 * NotificationStack — renders a vertical stack of pixel speech bubbles.
 * Newest message slides in from below and pushes older ones up.
 * Retains the original gaming / pixel art aesthetic.
 */
export default function NotificationStack({ notifications, onDismiss }: NotificationStackProps) {
  return (
    <div className="notif-stack" aria-live="polite">
      {notifications.map((notif) => (
        <NotifBubble
          key={notif.id}
          notif={notif}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  )
}

function NotifBubble({
  notif,
  onDismiss
}: {
  notif: NotificationItem
  onDismiss: (id: string) => void
}) {
  return (
    <div className={`notif-bubble ${notif.isQuestion ? 'notif-question' : ''}`}>
      <div className="notif-body">
        {notif.emoji && <span className="notif-emoji">{notif.emoji}</span>}
        <span className="notif-text">{notif.message}</span>
        {!notif.isQuestion && (
          <button
            className="notif-close-btn"
            onClick={() => onDismiss(notif.id)}
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>

      {notif.isQuestion && (
        <div className="notif-actions">
          <button
            className="notif-action-btn notif-confirm"
            onClick={() => {
              notif.onConfirm?.()
              onDismiss(notif.id)
            }}
          >
            {notif.confirmText ?? 'Yes'}
          </button>
          <button
            className="notif-action-btn notif-cancel"
            onClick={() => {
              notif.onCancel?.()
              onDismiss(notif.id)
            }}
          >
            {notif.cancelText ?? 'No'}
          </button>
        </div>
      )}
    </div>
  )
}
