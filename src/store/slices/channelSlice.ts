import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface ChannelState {
  channels: Channel[]
  isLoading: boolean
}

interface Channel {
  id: string
  peerNodeId: string
  capacity: number
  localBalance: number
  remoteBalance: number
  status: 'opening' | 'active' | 'closing' | 'closed'
  asset: string
}

const initialState: ChannelState = {
  channels: [],
  isLoading: false,
}

const channelSlice = createSlice({
  name: 'channel',
  initialState,
  reducers: {
    setChannels: (state, action: PayloadAction<Channel[]>) => {
      state.channels = action.payload
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
  },
})

export const { setChannels, setLoading } = channelSlice.actions
export default channelSlice.reducer