import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface PeerState {
  peers: Peer[]
  isLoading: boolean
}

interface Peer {
  id: string
  address: string
  isConnected: boolean
  network: string
  lastSeen: number
}

const initialState: PeerState = {
  peers: [],
  isLoading: false,
}

const peerSlice = createSlice({
  name: 'peer',
  initialState,
  reducers: {
    setPeers: (state, action: PayloadAction<Peer[]>) => {
      state.peers = action.payload
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
  },
})

export const { setPeers, setLoading } = peerSlice.actions
export default peerSlice.reducer