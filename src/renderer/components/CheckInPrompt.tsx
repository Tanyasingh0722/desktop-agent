import React, { useState, useCallback } from 'react'
import { parseTasks } from '../lib/task-parser'

interface CheckInPromptProps {
  visible: boolean
  onSubmit: (tasks: string[]) => void
  onSkip: () => void
}

/**
 * CheckInPrompt — morning check-in UI.
 * Asks "What's on your plate today?" and parses typed input into tasks.
 */
export default function CheckInPrompt({ visible, onSubmit, onSkip }: CheckInPromptProps) {
  const [text, setText] = useState('')

  const handleSubmit = useCallback(() => {
    const tasks = parseTasks(text)
    if (tasks.length > 0) {
      onSubmit(tasks)
      setText('')
    }
  }, [text, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className={`checkin-prompt ${visible ? 'visible' : ''}`}>
      <div className="checkin-title">🐺 Ready for the hunt?</div>
      <div className="checkin-subtitle">
        What are we tracking today? (separate with commas or new lines)
      </div>

      <textarea
        className="checkin-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="finish token docs, reply to recruiter, drink less coffee..."
        autoFocus
      />

      <div className="checkin-actions">
        <button className="btn btn-ghost" onClick={onSkip}>
          Skip
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!text.trim()}
        >
          Add Tasks ⌘↵
        </button>
      </div>
    </div>
  )
}
