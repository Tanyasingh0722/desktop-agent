import { useState, useCallback, useEffect } from 'react'
import type { Task } from '../types'

/**
 * useTasks — task CRUD operations via IPC to main process store.
 */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [carryOver, setCarryOver] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  /** Fetch all tasks from store */
  const refresh = useCallback(async () => {
    try {
      const allTasks = await window.ashAPI.getTasks()
      setTasks(allTasks)
      const carried = await window.ashAPI.getCarryOver()
      setCarryOver(carried)
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  /** Add new tasks from parsed text */
  const addTasks = useCallback(
    async (taskDataList: (string | { text: string; category?: 'today' | 'future' })[]) => {
      const formatted = taskDataList.map(item => 
        typeof item === 'string' ? { text: item, category: 'today' as const } : item
      )
      await window.ashAPI.addTasks(formatted)
      await refresh()
    },
    [refresh]
  )

  /** Toggle a task's done/pending status */
  const toggleTask = useCallback(
    async (id: string) => {
      await window.ashAPI.toggleTask(id)
      await refresh()
    },
    [refresh]
  )

  /** Delete a task */
  const deleteTask = useCallback(
    async (id: string) => {
      await window.ashAPI.deleteTask(id)
      await refresh()
    },
    [refresh]
  )

  /** Reorder tasks */
  const reorderTasks = useCallback(
    async (ids: string[]) => {
      await window.ashAPI.reorderTasks(ids)
      await refresh()
    },
    [refresh]
  )

  /** Dismiss carried-over tasks (drop them) */
  const dismissCarryOver = useCallback(
    async (ids: string[]) => {
      await window.ashAPI.dismissCarryOver(ids)
      await refresh()
    },
    [refresh]
  )

  // Load on mount
  useEffect(() => {
    refresh()
  }, [refresh])

  // Derived values
  const todayTasks = tasks.filter((t) => !t.carriedOverFrom)
  const carriedTasks = tasks.filter((t) => t.carriedOverFrom !== null)
  const pendingCount = tasks.filter((t) => t.status === 'pending').length
  const doneCount = tasks.filter((t) => t.status === 'done').length

  return {
    tasks,
    todayTasks,
    carriedTasks,
    carryOver,
    pendingCount,
    doneCount,
    loading,
    addTasks,
    toggleTask,
    deleteTask,
    reorderTasks,
    dismissCarryOver,
    refresh
  }
}
