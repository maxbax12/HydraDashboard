import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface NetworkState {
  networks: Network[]
  currentNetwork: string | null
  isLoading: boolean
}

interface Network {
  id: string
  name: string
  type: 'bitcoin' | 'ethereum' | 'arbitrum'
  isConnected: boolean
  blockHeight: number
  syncStatus: number
}

const initialState: NetworkState = {
  networks: [],
  currentNetwork: null,
  isLoading: false,
}

const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setNetworks: (state, action: PayloadAction<Network[]>) => {
      state.networks = action.payload
    },
    setCurrentNetwork: (state, action: PayloadAction<string>) => {
      state.currentNetwork = action.payload
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
  },
})

export const { setNetworks, setCurrentNetwork, setLoading } = networkSlice.actions
export default networkSlice.reducer