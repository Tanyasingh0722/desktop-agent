import React, { useState, useEffect } from 'react'

export interface PomodoroProps {
  onFocusComplete?: () => void
  onBreakComplete?: () => void
}

export default function Pomodoro({ onFocusComplete, onBreakComplete }: PomodoroProps) {
  const FOCUS_TIME = 25 * 60
  const BREAK_TIME = 5 * 60

  const [timeLeft, setTimeLeft] = useState(FOCUS_TIME)
  const [isRunning, setIsRunning] = useState(false)
  const [mode, setMode] = useState<'focus' | 'break'>('focus')

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1)
      }, 1000)
    } else if (isRunning && timeLeft === 0) {
      // Timer finished!
      setIsRunning(false)
      if (mode === 'focus') {
        onFocusComplete?.()
        setMode('break')
        setTimeLeft(BREAK_TIME)
      } else {
        onBreakComplete?.()
        setMode('focus')
        setTimeLeft(FOCUS_TIME)
      }
    }
    return () => clearInterval(timer)
  }, [isRunning, timeLeft, mode, onFocusComplete, onBreakComplete])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="pomodoro-widget">
      <div className="pomodoro-header">
        <span className="pomodoro-mode">{mode === 'focus' ? 'FOCUS' : 'BREAK'}</span>
        <span className="pomodoro-time">{formatTime(timeLeft)}</span>
      </div>
      <div className="pomodoro-controls">
        <button className="pomodoro-btn" onClick={() => setIsRunning(!isRunning)}>
          {isRunning ? 'Pause' : 'Start'}
        </button>
        <button 
          className="pomodoro-btn" 
          onClick={() => {
            setIsRunning(false)
            setMode(mode === 'focus' ? 'break' : 'focus')
            setTimeLeft(mode === 'focus' ? BREAK_TIME : FOCUS_TIME)
          }}
        >
          {mode === 'focus' ? 'Break' : 'Focus'}
        </button>
      </div>
    </div>
  )
}
