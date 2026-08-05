import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Home, ClipboardList, Clock, Settings as SettingsIcon, Mic, MicOff, Sparkles, Trash2, Layers, Check, ShieldAlert, RotateCcw } from 'lucide-react'
import type { Task, Settings } from '../types'
import { isMultiActionInput, parseTasksWithLLM, cleanTaskPhrase } from '../lib/task-parser'

/* ─── Types ─────────────────────────────────────── */
type Tab = 'goal' | 'tasks' | 'focus' | 'settings'
type FocusMode = 'focus' | 'break'

interface TodoDrawerProps {
  isOpen: boolean
  tasks: Task[]
  carriedTasks: Task[]
  onToggleTask: (id: string) => void
  onDeleteTask: (id: string) => void
  onReorderTasks?: (ids: string[]) => void
  onAddTask: (taskData: { text: string; category?: 'today' | 'future' }) => void
  onClose: () => void
  onTaskComplete?: () => void
  onChangeMood?: (mood: any) => void
  verticalAnchor?: 'top' | 'bottom'
  pomodoro?: any
}

/* ─── Helpers ───────────────────────────────────── */
function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()
}
function formatTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function formatTimeMono(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function relativeDate(isoDate: string): string {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (isoDate === yesterday) return 'From Yesterday'
  const d = new Date(isoDate)
  return `From ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
}
function pad(n: number) { return String(n).padStart(2, '0') }

/* ─── Goal Tab ──────────────────────────────────── */
function GoalTab() {
  const [now, setNow] = useState(new Date())
  const [goal, setGoal] = useState(() => localStorage.getItem('ash-goal') ?? '')
  const [completed, setCompleted] = useState(() => localStorage.getItem('ash-goal-completed') === 'true')
  const [editing, setEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = '120px'
      textareaRef.current.style.height = `${Math.max(120, textareaRef.current.scrollHeight)}px`
    }
  }, [goal, editing])

  const save = useCallback(() => {
    localStorage.setItem('ash-goal', goal.trim())
    setGoal(goal.trim())
    setEditing(false)
  }, [goal])

  const completeGoal = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCompleted(true)
    localStorage.setItem('ash-goal-completed', 'true')
  }

  const clearGoal = () => {
    setGoal('')
    setCompleted(false)
    localStorage.setItem('ash-goal', '')
    localStorage.setItem('ash-goal-completed', 'false')
    setEditing(true)
  }

  return (
    <div className="drawer-tab goal-tab">
      {editing ? (
        <textarea
          ref={textareaRef}
          className="goal-textarea"
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder="TYPE YOUR QUEST..."
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              save()
            }
          }}
          autoFocus
        />
      ) : (
        <>
          <div
            className={`goal-display ${goal ? 'has-goal' : 'empty-goal'}`}
            onClick={() => { if (!completed) setEditing(true) }}
            title={completed ? "Quest complete!" : "Click to edit"}
          >
            <span className={completed ? "goal-completed-text" : ""}>
              {goal || "TYPE YOUR QUEST..."}
            </span>
            {goal && !completed && (
              <span className="goal-tick" onClick={completeGoal} title="Mark as done" style={{cursor: 'pointer'}}>
                ✓
              </span>
            )}
            {completed && (
              <span className="goal-tick" style={{color: '#888'}}>
                ✓
              </span>
            )}
          </div>
          {completed && (
            <button className="goal-clear-btn" onClick={clearGoal}>
              ＋ New Quest
            </button>
          )}
        </>
      )}
    </div>
  )
}

interface ParsedConfirmationItem {
  id: string
  text: string
  checked: boolean
}

/* ─── Tasks Tab ─────────────────────────────────── */
function TasksTab({
  tasks, carriedTasks, onToggleTask, onDeleteTask, onReorderTasks, onAddTask, onTaskComplete
}: {
  tasks: Task[]
  carriedTasks: Task[]
  onToggleTask: (id: string) => void
  onDeleteTask: (id: string) => void
  onReorderTasks?: (ids: string[]) => void
  onAddTask: (d: { text: string; category?: 'today' | 'future' }) => void
  onTaskComplete?: () => void
}) {
  const [input, setInput] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [parsedConfirmation, setParsedConfirmation] = useState<{
    rawInput: string
    items: ParsedConfirmationItem[]
  } | null>(null)

  const [doneExpanded, setDoneExpanded] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().split('T')[0]
  const activeTasksProp = tasks.filter(t => t.status === 'pending' && t.createdDate === today)
  const [activeTasks, setActiveTasks] = useState(activeTasksProp)

  useEffect(() => {
    if (!draggingId) setActiveTasks(activeTasksProp)
  }, [tasks, draggingId])

  const pastTasks = tasks.filter(t => t.status === 'pending' && t.createdDate < today)
  const doneTasks = tasks.filter(t => t.status === 'done')

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this environment.')
      return
    }

    if (isListening) {
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'
      recognition.onstart = () => setIsListening(true)
      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript
        if (transcript) {
          setInput(prev => (prev ? `${prev} ${transcript}` : transcript))
        }
        setIsListening(false)
      }
      recognition.onerror = () => setIsListening(false)
      recognition.onend = () => setIsListening(false)
      recognition.start()
    } catch (err) {
      console.error('Speech recognition error:', err)
      setIsListening(false)
    }
  }

  const handleAdd = async () => {
    const rawText = input.trim()
    if (!rawText || isParsing) return

    if (isMultiActionInput(rawText)) {
      setIsParsing(true)
      try {
        const extracted = await parseTasksWithLLM(rawText)
        setIsParsing(false)
        if (extracted.length > 1) {
          setParsedConfirmation({
            rawInput: rawText,
            items: extracted.map((text, idx) => ({ id: `${Date.now()}-${idx}`, text, checked: true }))
          })
          return
        } else if (extracted.length === 1) {
          onAddTask({ text: extracted[0], category: 'today' })
          setInput('')
          return
        }
      } catch (err) {
        setIsParsing(false)
      }
    }

    onAddTask({ text: cleanTaskPhrase(rawText) || rawText, category: 'today' })
    setInput('')
  }

  const handleConfirmSplit = () => {
    if (!parsedConfirmation) return
    const checkedItems = parsedConfirmation.items.filter(item => item.checked && item.text.trim().length > 0)
    for (const item of checkedItems) {
      onAddTask({ text: item.text.trim(), category: 'today' })
    }
    setParsedConfirmation(null)
    setInput('')
  }

  const handleMergeSelected = () => {
    if (!parsedConfirmation) return
    const checkedIndices: number[] = []
    const checkedTexts: string[] = []

    parsedConfirmation.items.forEach((item, idx) => {
      if (item.checked && item.text.trim()) {
        checkedIndices.push(idx)
        checkedTexts.push(item.text.trim())
      }
    })

    if (checkedTexts.length <= 1) return

    const mergedText = checkedTexts.join(', ')
    const newItems: ParsedConfirmationItem[] = []
    let mergedAdded = false

    parsedConfirmation.items.forEach((item, idx) => {
      if (checkedIndices.includes(idx)) {
        if (!mergedAdded) {
          newItems.push({ id: `merged-${Date.now()}`, text: mergedText, checked: true })
          mergedAdded = true
        }
      } else {
        newItems.push(item)
      }
    })

    setParsedConfirmation({
      ...parsedConfirmation,
      items: newItems
    })
  }

  const handleToggle = (task: Task) => {
    onToggleTask(task.id)
    if (task.status === 'pending') onTaskComplete?.()
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDragEnter = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggingId || draggingId === targetId) return
    const draggedIndex = activeTasks.findIndex(t => t.id === draggingId)
    const targetIndex = activeTasks.findIndex(t => t.id === targetId)
    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newTasks = [...activeTasks]
      const [removed] = newTasks.splice(draggedIndex, 1)
      newTasks.splice(targetIndex, 0, removed)
      setActiveTasks(newTasks)
    }
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    onReorderTasks?.(activeTasks.map(t => t.id))
  }

  if (parsedConfirmation) {
    const checkedCount = parsedConfirmation.items.filter(i => i.checked && i.text.trim()).length
    return (
      <div className="drawer-tab tasks-tab task-split-confirmation">
        <div className="confirmation-header">
          <div className="confirmation-title">
            <Sparkles size={14} style={{ color: '#8B5CF6' }} />
            <span>CONFIRM PARSED TASKS ({parsedConfirmation.items.length})</span>
          </div>
          <div className="confirmation-privacy-note">
            <ShieldAlert size={11} />
            <span>Parsed via Gemini API. Tasks stored locally.</span>
          </div>
        </div>

        <div className="confirmation-items-list">
          {parsedConfirmation.items.map((item) => (
            <div key={item.id} className={`confirmation-item-row ${!item.checked ? 'item-disabled' : ''}`}>
              <input
                type="checkbox"
                className="confirmation-checkbox"
                checked={item.checked}
                onChange={(e) => {
                  const updated = parsedConfirmation.items.map(i => i.id === item.id ? { ...i, checked: e.target.checked } : i)
                  setParsedConfirmation({ ...parsedConfirmation, items: updated })
                }}
              />
              <input
                type="text"
                className="confirmation-item-input"
                value={item.text}
                disabled={!item.checked}
                onChange={(e) => {
                  const updated = parsedConfirmation.items.map(i => i.id === item.id ? { ...i, text: e.target.value } : i)
                  setParsedConfirmation({ ...parsedConfirmation, items: updated })
                }}
              />
              <button
                className="confirmation-item-delete"
                title="Remove task"
                onClick={() => {
                  const updated = parsedConfirmation.items.filter(i => i.id !== item.id)
                  if (updated.length === 0) {
                    setParsedConfirmation(null)
                  } else {
                    setParsedConfirmation({ ...parsedConfirmation, items: updated })
                  }
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="confirmation-actions-row">
          <button
            className="confirmation-btn btn-merge"
            disabled={checkedCount < 2}
            onClick={handleMergeSelected}
            title="Combine checked items into one task"
          >
            <Layers size={13} />
            <span>Merge</span>
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="confirmation-btn btn-cancel"
            onClick={() => setParsedConfirmation(null)}
          >
            Cancel
          </button>
          <button
            className="confirmation-btn btn-confirm"
            disabled={checkedCount === 0}
            onClick={handleConfirmSplit}
          >
            <Check size={13} />
            <span>Add {checkedCount} {checkedCount === 1 ? 'Task' : 'Tasks'}</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="drawer-tab tasks-tab">
      <div className="tasks-scroll">
        {/* Active / Today tasks */}
        {activeTasks.length > 0 && (
          <div className="tasks-section">
            <div className="tasks-section-label">⚔ Active Quests</div>
            {activeTasks.map((t, index) => (
              <SwipeableTaskRow 
                key={t.id} 
                task={t} 
                index={index}
                onToggle={handleToggle} 
                onDelete={() => onDeleteTask(t.id)} 
                onDragStart={(e) => handleDragStart(e, t.id)}
                onDragEnter={(e) => handleDragEnter(e, t.id)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
              />
            ))}
          </div>
        )}

        {/* Past / Carried-over tasks */}
        {pastTasks.length > 0 && (
          <div className="tasks-section">
            <div className="tasks-section-label">⚠ Overdue Quests</div>
            {pastTasks.map(t => (
              <SwipeableTaskRow key={t.id} task={t} onToggle={handleToggle} onDelete={() => onDeleteTask(t.id)} sub={relativeDate(t.createdDate)} past />
            ))}
          </div>
        )}

        {/* Done tasks Accordion */}
        {doneTasks.length > 0 && (
          <div className="tasks-section accordion-section">
            <div 
              className="tasks-section-label accordion-header"
              onClick={() => setDoneExpanded(!doneExpanded)}
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
            >
              <span>✓ Completed ({doneTasks.length})</span>
              <span>{doneExpanded ? '▲' : '▼'}</span>
            </div>
            {doneExpanded && (
              <div className="accordion-content">
                {doneTasks.map(t => (
                  <SwipeableTaskRow key={t.id} task={t} onToggle={handleToggle} onDelete={() => onDeleteTask(t.id)} done />
                ))}
              </div>
            )}
          </div>
        )}

        {tasks.length === 0 && (
          <div className="tasks-empty">✦ No active quests{`\n`}Summon one below!</div>
        )}
      </div>

      {/* Add task input — pinned to bottom */}
      <div className="add-task-row">
        <button
          className={`add-task-mic ${isListening ? 'listening' : ''}`}
          onClick={toggleListening}
          title={isListening ? 'Listening...' : 'Voice dictation'}
          type="button"
        >
          {isListening ? <MicOff size={14} className="mic-icon-active" /> : <Mic size={14} />}
        </button>
        <input
          ref={inputRef}
          className="add-task-input"
          placeholder={isParsing ? "PARSING QUEST..." : isListening ? "LISTENING..." : "SUMMON NEW QUEST..."}
          value={input}
          disabled={isParsing}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        />
        <button className="add-task-plus" onClick={handleAdd} disabled={isParsing || !input.trim()} aria-label="Add task">
          {isParsing ? <Sparkles size={14} className="spin-icon" /> : '+'}
        </button>
      </div>
    </div>
  )
}

function SwipeableTaskRow({ task, index, onToggle, onDelete, sub, past, done, onDragStart, onDragEnter, onDragEnd, onDragOver }: {
  task: Task
  index?: number
  onToggle: (t: Task) => void
  onDelete: () => void
  sub?: string
  past?: boolean
  done?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnter?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
}) {
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggable, setIsDraggable] = useState(false)
  const startX = useRef(0)
  const currentX = useRef(0)
  const dragDistance = useRef(0)

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    startX.current = e.clientX - offset
    dragDistance.current = 0
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    dragDistance.current += Math.abs(e.movementX)
    let newOffset = e.clientX - startX.current
    if (newOffset > 0) newOffset = 0
    if (newOffset < -120) newOffset = -120
    setOffset(newOffset)
    currentX.current = newOffset
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setIsDragging(false)
    if (currentX.current < -60) {
      setOffset(-120)
    } else {
      setOffset(0)
    }
    
    // If it was just a click (barely moved) and it's closed, toggle the task
    if (dragDistance.current < 5 && currentX.current > -10) {
      onToggle(task)
    }
  }

  let dateText = sub
  let hasWarning = false
  if (done && task.completedDate) {
    const d = new Date(task.completedDate)
    dateText = `Done ${d.toLocaleDateString([], {month: 'short', day: 'numeric'})} at ${d.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}`
  } else if (past && !done) {
    hasWarning = true
  }

  return (
    <div className="swipeable-task-container"
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      <div className="task-actions-bg">
        <button className="task-action-btn action-complete" onClick={() => { onToggle(task); setOffset(0) }}>
          {done ? <RotateCcw size={20} strokeWidth={2.5} /> : <Check size={20} strokeWidth={2.5} />}
        </button>
        <button className="task-action-btn action-delete" onClick={onDelete}>
          <Trash2 size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div 
        className={`task-row swipe-front ${past ? 'task-row-past' : ''} ${done ? 'task-row-done' : ''}`}
        style={{ transform: `translateX(${offset}px)`, transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {index !== undefined && (
          <div 
            className="task-num-badge"
            onPointerEnter={() => setIsDraggable(true)}
            onPointerLeave={() => setIsDraggable(false)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {index + 1}
          </div>
        )}
        <div className={`task-checkbox ${done ? 'checked' : ''}`}>
          {done && <span className="task-check-mark">✓</span>}
        </div>
        <div className="task-text-col">
          <span className="task-text">
            {task.text} {hasWarning && <span title="Overdue task" style={{marginLeft: 4}}>⚠️</span>}
          </span>
          {dateText && <span className="task-sub">{dateText}</span>}
        </div>
      </div>
    </div>
  )
}

/* ─── Focus Tab (Pomodoro) ──────────────────────── */
function FocusTab({ pomodoro }: { pomodoro: any }) {
  const {
    focusMins, breakMins, mode, timeLeft, running, sessions, totalFocusSecs,
    startStop, switchToBreak, switchToFocus, setTimes
  } = pomodoro

  const [editingTime, setEditingTime] = useState(false)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const totalSecs = mode === 'focus' ? focusMins * 60 : breakMins * 60
  const progress = 1 - timeLeft / totalSecs
  const RADIUS = 88
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS

  const startEditTime = () => {
    if (running) return
    setEditValue(String(mode === 'focus' ? focusMins : breakMins))
    setEditingTime(true)
    setTimeout(() => editInputRef.current?.select(), 30)
  }

  const commitEdit = () => {
    const mins = parseInt(editValue, 10)
    if (!isNaN(mins) && mins > 0 && mins <= 120) {
      if (mode === 'focus') { setTimes(mins, breakMins) }
      else { setTimes(focusMins, mins) }
    }
    setEditingTime(false)
  }

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const totalFocusMins = Math.floor(totalFocusSecs / 60)

  return (
    <div className="drawer-tab focus-tab">
      <div className="focus-quest-label">QUEST FOCUS</div>

      {/* Ring */}
      <div className="focus-ring-wrap">
        <svg width="210" height="210" viewBox="0 0 210 210">
          {/* Background track */}
          <circle cx="105" cy="105" r={RADIUS} fill="none" stroke="#ebebeb" strokeWidth="10" />
          {/* Progress arc */}
          <circle
            cx="105" cy="105" r={RADIUS}
            fill="none"
            stroke="#111"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            transform="rotate(-90 105 105)"
            style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }}
          />
        </svg>
        <div className="focus-ring-center">
          {editingTime ? (
            <input
              ref={editInputRef}
              className="focus-time-edit"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit() }}
              maxLength={3}
              type="number"
            />
          ) : (
            <div
              className={`focus-time ${!running ? 'focus-time-clickable' : ''}`}
              onClick={startEditTime}
              title={!running ? 'Click to set time' : ''}
            >
              {pad(mins)}:{pad(secs)}
            </div>
          )}
          <div className="focus-mode-label">{mode === 'focus' ? 'POMODORO' : 'REST'}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="focus-stats">
        <div className="focus-stat">
          <span className="focus-stat-val">{sessions}/4</span>
          <span className="focus-stat-key">SESSIONS</span>
        </div>
        <div className="focus-stat">
          <span className="focus-stat-val">{totalFocusMins}m</span>
          <span className="focus-stat-key">TOTAL</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="focus-buttons">
        <button className="focus-btn-primary" onClick={startStop}>
          {running ? '⏸ PAUSE' : mode === 'focus' ? '▶ START DEEP WORK' : '▶ START REST'}
        </button>
        {timeLeft !== totalSecs ? (
          <button className="focus-btn-secondary" onClick={pomodoro.reset}>
            ↺ RESET
          </button>
        ) : (
          <button className="focus-btn-secondary" onClick={mode === 'focus' ? switchToBreak : switchToFocus}>
            {mode === 'focus' ? 'SHORT BREAK' : '▶ FOCUS MODE'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Settings Tab ──────────────────────────────── */
function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    window.ashAPI?.getSettings().then(setSettings)
  }, [])


  const handleChange = (field: keyof Settings, value: any) => {
    if (!settings) return
    setErrorMsg(null)
    console.log('[DEBUG handleChange] field:', field, 'value:', value);
    setSettings({ ...settings, [field]: value })
  }

  const handleSave = async () => {
    if (!settings) return

    // 5. VALIDATION: Clamp / Validate min/max bounds (1 to 240 mins)
    const clamp = (val: any, min = 1, max = 240) => {
      let num = Number(val);
      if (isNaN(num)) num = min;
      return Math.min(Math.max(num || min, min), max);
    }


    const validatedWater = clamp(settings.waterIntervalMinutes)
    const validatedScreen = clamp(settings.screenTimeThresholdMinutes)
    const validatedTaskGoal = clamp(settings.taskGoalCheckInIntervalMinutes)

    const updatedSettings: Settings = {
      ...settings,
      waterIntervalMinutes: validatedWater,
      screenTimeThresholdMinutes: validatedScreen,
      taskGoalCheckInIntervalMinutes: validatedTaskGoal,
      snoozeDurationMinutes: Math.max(1, settings.snoozeDurationMinutes || 10),
      snoozeThreshold: Math.max(1, settings.snoozeThreshold || 3)
    }

    console.log('[DEBUG handleSave] BEFORE SAVE settings:', settings);
    console.log('[DEBUG handleSave] clamp water:', validatedWater, 'screen:', validatedScreen, 'task:', validatedTaskGoal);
    console.log('[DEBUG handleSave] AFTER SAVE updatedSettings:', updatedSettings);

    setIsSaving(true)
    setSettings(updatedSettings)
    await window.ashAPI?.updateSettings(updatedSettings)
    setTimeout(() => setIsSaving(false), 500)
  }

  if (!settings) return null

  return (
    <div className="drawer-tab settings-tab">
      <div className="settings-tab-header">SETTINGS</div>

      {errorMsg && (
        <div style={{ color: '#DC2626', fontSize: '11px', fontWeight: 600, textAlign: 'center' }}>
          {errorMsg}
        </div>
      )}

      {/* 1. RECURRING NUDGES */}
      <div className="settings-group">
        <div className="settings-group-title">RECURRING NUDGES</div>

        {/* Water Reminder */}
        <div className="settings-card-row">
          <div className="settings-card-header">
            <label>WATER REMINDER (MINS)</label>
            <label className="switch-toggle">
              <input
                type="checkbox"
                checked={settings.waterEnabled ?? true}
                onChange={e => handleChange('waterEnabled', e.target.checked)}
              />
              <span className="switch-slider"></span>
            </label>
          </div>
          <input
            type="number"
            className="settings-input-box"
            min="1"
            max="240"
            disabled={!(settings.waterEnabled ?? true)}
            value={settings.waterIntervalMinutes}
            onChange={e => handleChange('waterIntervalMinutes', Math.max(1, Number(e.target.value)))}
          />
        </div>

        {/* Screen Time Threshold */}
        <div className="settings-card-row">
          <div className="settings-card-header">
            <label>SCREEN TIME THRESHOLD (MINS)</label>
            <label className="switch-toggle">
              <input
                type="checkbox"
                checked={settings.screenTimeEnabled ?? true}
                onChange={e => handleChange('screenTimeEnabled', e.target.checked)}
              />
              <span className="switch-slider"></span>
            </label>
          </div>
          <input
            type="number"
            className="settings-input-box"
            min="1"
            max="240"
            disabled={!(settings.screenTimeEnabled ?? true)}
            value={settings.screenTimeThresholdMinutes}
            onChange={e => handleChange('screenTimeThresholdMinutes', Math.max(1, Number(e.target.value)))}
          />
        </div>

        {/* Task & Goal Check-ins */}
        <div className="settings-card-row">
          <div className="settings-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label>TASK & GOAL CHECK-INS (MINS)</label>
              <span className="new-badge">NEW</span>
            </div>
            <label className="switch-toggle">
              <input
                type="checkbox"
                checked={settings.taskGoalCheckInEnabled ?? true}
                onChange={e => handleChange('taskGoalCheckInEnabled', e.target.checked)}
              />
              <span className="switch-slider"></span>
            </label>
          </div>
          <input
            type="number"
            className="settings-input-box"
            min="1"
            max="240"
            disabled={!(settings.taskGoalCheckInEnabled ?? true)}
            value={settings.taskGoalCheckInIntervalMinutes ?? 90}
            onChange={e => handleChange('taskGoalCheckInIntervalMinutes', Math.max(1, Number(e.target.value)))}
          />
          <div className="settings-help-text">
            How often the wolf checks in on your to-do list and goals. Individual tasks with their own due time will still nudge separately at that time.
          </div>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1.5px solid #111', margin: '0', opacity: 0.1 }} />

      {/* 2. SNOOZE BEHAVIOR */}
      <div className="settings-group">
        <div className="settings-group-title">
          <span>SNOOZE BEHAVIOR</span>
          <span className="new-badge">NEW</span>
        </div>

        <div className="steppers-row">
          {/* Snooze duration stepper */}
          <div className="stepper-col">
            <label>Snooze for</label>
            <div className="stepper-box">
              <button
                className="stepper-btn"
                onClick={() => handleChange('snoozeDurationMinutes', Math.max(1, (settings.snoozeDurationMinutes || 10) - 1))}
              >-</button>
              <span className="stepper-value">{settings.snoozeDurationMinutes || 10} min</span>
              <button
                className="stepper-btn"
                onClick={() => handleChange('snoozeDurationMinutes', Math.min(60, (settings.snoozeDurationMinutes || 10) + 1))}
              >+</button>
            </div>
          </div>


          {/* Snoozes before mood shift stepper */}
          <div className="stepper-col">
            <label>Snoozes before mood shifts</label>
            <div className="stepper-box">
              <button
                className="stepper-btn"
                onClick={() => handleChange('snoozeThreshold', Math.max(1, (settings.snoozeThreshold || 3) - 1))}
              >-</button>
              <span className="stepper-value">{settings.snoozeThreshold || 3}</span>
              <button
                className="stepper-btn"
                onClick={() => handleChange('snoozeThreshold', Math.min(10, (settings.snoozeThreshold || 3) + 1))}
              >+</button>
            </div>
          </div>
        </div>

        <div className="settings-help-text">
          After {settings.snoozeThreshold || 3} snoozes in a row on the same reminder, the wolf's mood shifts (a little sulky) instead of just repeating the nudge.
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1.5px solid #111', margin: '0', opacity: 0.1 }} />

      {/* 3. QUIET HOURS */}
      <div className="settings-group">
        <div className="settings-group-title">
          <span>QUIET HOURS</span>
          <span className="new-badge">NEW</span>
        </div>

        <div className="settings-card-header">
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#374151' }}>PAUSE ALL NUDGES</label>
          <label className="switch-toggle">
            <input
              type="checkbox"
              checked={settings.quietHoursEnabled ?? true}
              onChange={e => handleChange('quietHoursEnabled', e.target.checked)}
            />
            <span className="switch-slider"></span>
          </label>
        </div>

        {settings.quietHoursEnabled && (
          <div className="quiet-hours-grid">
            <div className="quiet-hours-col">
              <label>From</label>
              <div className="time-input-wrap">
                <input
                  type="time"
                  className="settings-input-box"
                  value={settings.quietHoursFrom || '22:00'}
                  onChange={e => handleChange('quietHoursFrom', e.target.value)}
                />
              </div>
            </div>

            <div className="quiet-hours-col">
              <label>To</label>
              <div className="time-input-wrap">
                <input
                  type="time"
                  className="settings-input-box"
                  value={settings.quietHoursTo || '08:00'}
                  onChange={e => handleChange('quietHoursTo', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1.5px solid #111', margin: '0', opacity: 0.1 }} />

      {/* 4. DAILY CHECK-IN */}
      <div className="settings-group">
        <div className="settings-group-title">DAILY CHECK-IN</div>
        <div className="time-input-wrap">
          <input
            type="time"
            className="settings-input-box"
            value={settings.checkInTime || '09:00'}
            onChange={e => handleChange('checkInTime', e.target.value)}
          />
        </div>
        <div className="settings-help-text">
          One daily summary of what's pending, separate from the recurring nudges above.
        </div>
      </div>

      {/* ACTIONS */}
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button className="settings-save-btn" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'SAVING...' : 'SAVE SETTINGS'}
        </button>

        <button className="settings-turnoff-btn" onClick={() => window.ashAPI?.quitApp()}>
          TURN OFF COMPANION
        </button>
      </div>
    </div>
  )
}

/* ─── Main Drawer ───────────────────────────────── */
export default function TodoDrawer({
  isOpen, tasks, carriedTasks,
  onToggleTask, onDeleteTask, onReorderTasks, onAddTask,
  onClose, onTaskComplete, onChangeMood,
  verticalAnchor = 'bottom',
  pomodoro
}: TodoDrawerProps) {
  const [tab, setTab] = useState<Tab>('goal')
  const contentRef = useRef<HTMLDivElement>(null)
  const [panelHeight, setPanelHeight] = useState<number | 'auto'>('auto')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const handleTaskComplete = () => {
    onTaskComplete?.()
  }

  useEffect(() => {
    if (!contentRef.current) return
    const observer = new ResizeObserver((entries) => {
      const contentHeight = entries[0].target.getBoundingClientRect().height
      const targetHeight = contentHeight + 140
      const clampedHeight = Math.min(Math.max(targetHeight, 520), 540)
      setPanelHeight(clampedHeight)
    })
    observer.observe(contentRef.current)
    return () => observer.disconnect()
  }, [tab])

  return (
    <div style={{ position: 'relative' }}>
      <div 
        className={`drawer-panel drawer-${verticalAnchor} ${isOpen ? 'drawer-panel-open' : ''}`} 
        style={{ 
          pointerEvents: isOpen ? 'auto' : 'none',
          height: panelHeight === 'auto' ? 'auto' : `${panelHeight}px`
        }}
      >
        {/* ── Close button — top-right corner inside the panel ── */}
        <button
          className="drawer-close-external"
          onClick={onClose}
          aria-label="Close"
        >×</button>

        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* ── Quest Log Header ── */}
          <div className="drawer-quest-header">
            <span className="drawer-quest-date">{formatDate(now)}</span>
            <div className="drawer-quest-title-row">
              <span className="drawer-quest-title">
                {tab === 'focus' ? 'Quest Focus' : 'Quest Log'}
              </span>
              <span className="drawer-quest-time">{formatTime(now)}</span>
            </div>
          </div>

          {/* Scrollable Content Wrapper */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: '16px' }}>
            <div ref={contentRef} style={{ display: 'flex', flexDirection: 'column', height: tab === 'tasks' ? '100%' : 'auto', padding: '0 16px' }}>
              {tab === 'goal' && <GoalTab />}
              {tab === 'tasks' && (
                <TasksTab
                  tasks={tasks}
                  carriedTasks={carriedTasks}
                  onToggleTask={onToggleTask}
                  onDeleteTask={onDeleteTask}
                  onReorderTasks={onReorderTasks}
                  onAddTask={onAddTask}
                  onTaskComplete={handleTaskComplete}
                />
              )}
              {tab === 'focus' && <FocusTab pomodoro={pomodoro} />}
              {tab === 'settings' && <SettingsTab />}
            </div>
          </div>

          {/* ── Tab Bar (Bottom Pinned) ── */}
          <div className="drawer-tabs">
            <button className={`drawer-tab-btn ${tab === 'goal' ? 'active' : ''}`} onClick={() => setTab('goal')}>
              <Home size={14} />
              <span>Goal</span>
            </button>
            <button className={`drawer-tab-btn ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>
              <ClipboardList size={14} />
              <span>Quests</span>
            </button>
            <button className={`drawer-tab-btn ${tab === 'focus' ? 'active' : ''}`} onClick={() => setTab('focus')}>
              <Clock size={14} />
              <span>Timer</span>
            </button>
            <button className={`drawer-tab-btn ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
              <SettingsIcon size={14} />
              <span>Config</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
