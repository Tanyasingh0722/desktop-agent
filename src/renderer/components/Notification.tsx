import React from 'react'

interface NotificationProps {
  message: string
  emoji?: string
  visible: boolean
  isQuestion?: boolean
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  onCancel?: () => void
}

/**
 * Notification toast — appears above the companion as a nudge bubble.
 */
export default function Notification({ message, emoji, visible, isQuestion, confirmText, cancelText, onConfirm, onCancel }: NotificationProps) {
  return (
    <div className={`notification-toast ${visible ? 'visible' : ''} ${isQuestion ? 'has-actions' : ''}`}>
      <div className="notification-content">
        {emoji && <span>{emoji}</span>}
        <span className="video-game-text">{message}</span>
      </div>
      {isQuestion && (
        <div className="notification-actions">
          <button className="btn btn-primary btn-game" onClick={onConfirm}>{confirmText || 'Okay'}</button>
          <button className="btn btn-ghost btn-game" onClick={onCancel}>{cancelText || 'No'}</button>
        </div>
      )}
    </div>
  )
}
