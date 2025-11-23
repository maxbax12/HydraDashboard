import { configureStore } from '@reduxjs/toolkit'
import appSlice from './slices/appSlice'
import networkSlice from './slices/networkSlice'
import balanceSlice from './slices/balanceSlice'
import transactionSlice from './slices/transactionSlice'
import channelSlice from './slices/channelSlice'
import peerSlice from './slices/peerSlice'
import orderbookSlice from './slices/orderbookSlice'

export const store = configureStore({
  reducer: {
    app: appSlice,
    network: networkSlice,
    balance: balanceSlice,
    transaction: transactionSlice,
    channel: channelSlice,
    peer: peerSlice,
    orderbook: orderbookSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch