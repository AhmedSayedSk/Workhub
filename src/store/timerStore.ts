import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TimerState {
  isRunning: boolean
  isPaused: boolean
  startTime: number | null
  pausedDuration: number
  currentSubtaskId: string | null
  currentTaskId: string | null
  currentProjectId: string | null
  currentTaskName: string | null
  currentProjectName: string | null
}

interface TimerActions {
  startTimer: (params: {
    subtaskId: string
    taskId: string
    projectId: string
    taskName: string
    projectName: string
  }) => void
  pauseTimer: () => void
  resumeTimer: () => void
  stopTimer: () => {
    subtaskId: string | null
    taskId: string | null
    projectId: string | null
    duration: number
  }
  resetTimer: () => void
  getElapsedTime: () => number
}

type TimerStore = TimerState & TimerActions

const initialState: TimerState = {
  isRunning: false,
  isPaused: false,
  startTime: null,
  pausedDuration: 0,
  currentSubtaskId: null,
  currentTaskId: null,
  currentProjectId: null,
  currentTaskName: null,
  currentProjectName: null,
}

export const useTimerStore = create<TimerStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      startTimer: ({ subtaskId, taskId, projectId, taskName, projectName }) => {
        set({
          isRunning: true,
          isPaused: false,
          startTime: Date.now(),
          pausedDuration: 0,
          currentSubtaskId: subtaskId,
          currentTaskId: taskId,
          currentProjectId: projectId,
          currentTaskName: taskName,
          currentProjectName: projectName,
        })
      },

      pauseTimer: () => {
        const state = get()
        if (!state.isRunning || state.isPaused) return

        const elapsed = Date.now() - (state.startTime || 0)
        set({
          isPaused: true,
          pausedDuration: state.pausedDuration + elapsed,
          startTime: null,
        })
      },

      resumeTimer: () => {
        const state = get()
        if (!state.isPaused) return

        set({
          isPaused: false,
          startTime: Date.now(),
        })
      },

      stopTimer: () => {
        const state = get()
        const elapsed = get().getElapsedTime()
        const duration = Math.floor(elapsed / 60000) // Convert to minutes

        const result = {
          subtaskId: state.currentSubtaskId,
          taskId: state.currentTaskId,
          projectId: state.currentProjectId,
          duration,
        }

        set(initialState)

        return result
      },

      resetTimer: () => {
        set(initialState)
      },

      getElapsedTime: () => {
        const state = get()
        if (!state.isRunning && !state.isPaused) return 0

        let elapsed = state.pausedDuration

        if (state.startTime && !state.isPaused) {
          elapsed += Date.now() - state.startTime
        }

        return elapsed
      },
    }),
    {
      name: 'workhub-timer',
    }
  )
)
