import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AppState {
  isConnected: boolean
  currentNetwork: string
  autoRefresh: boolean
  refreshInterval: number
  logs: LogEntry[]
}

interface LogEntry {
  timestamp: string
  level: 'INFO' | 'WARNING' | 'ERROR'
  message: string
}

const initialState: AppState = {
  isConnected: false,
  currentNetwork: '',
  autoRefresh: true,
  refreshInterval: 5000,
  logs: [],
}

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload
    },
    setCurrentNetwork: (state, action: PayloadAction<string>) => {
      state.currentNetwork = action.payload
    },
    setAutoRefresh: (state, action: PayloadAction<boolean>) => {
      state.autoRefresh = action.payload
    },
    setRefreshInterval: (state, action: PayloadAction<number>) => {
      state.refreshInterval = action.payload
    },
    addLog: (state, action: PayloadAction<LogEntry>) => {
      state.logs.unshift(action.payload)
      // Keep only last 1000 log entries
      if (state.logs.length > 1000) {
        state.logs = state.logs.slice(0, 1000)
      }
    },
    clearLogs: (state) => {
      state.logs = []
    },
  },
})

export const {
  setConnectionStatus,
  setCurrentNetwork,
  setAutoRefresh,
  setRefreshInterval,
  addLog,
  clearLogs,
} = appSlice.actions

export default appSlice.reducer