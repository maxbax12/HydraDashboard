import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { MarketInfo, LiquidityPosition, Orderbook } from '@/proto'

interface OrderbookState {
  markets: MarketInfo[]
  orderbooks: { [marketId: string]: Orderbook }
  orders: { [orderId: string]: LiquidityPosition }
  trades: Trade[]
  isLoading: boolean
}

interface Trade {
  id: string
  marketId: string
  price: string
  quantity: string
  timestamp: number
  side: 'buy' | 'sell'
}

interface OrderbookUpdate {
  marketId: string
  orderbook: Orderbook
}

const initialState: OrderbookState = {
  markets: [],
  orderbooks: {},
  orders: {},
  trades: [],
  isLoading: false,
}

const orderbookSlice = createSlice({
  name: 'orderbook',
  initialState,
  reducers: {
    setMarkets: (state, action: PayloadAction<MarketInfo[]>) => {
      state.markets = action.payload
    },
    setOrderbook: (state, action: PayloadAction<OrderbookUpdate>) => {
      const { marketId, orderbook } = action.payload
      state.orderbooks[marketId] = orderbook
    },
    setOrders: (state, action: PayloadAction<{ [orderId: string]: LiquidityPosition }>) => {
      state.orders = action.payload
    },
    updateOrders: (state, action: PayloadAction<{ [orderId: string]: LiquidityPosition }>) => {
      Object.assign(state.orders, action.payload)
    },
    removeOrders: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach(orderId => {
        delete state.orders[orderId]
      })
    },
    setTrades: (state, action: PayloadAction<Trade[]>) => {
      state.trades = action.payload
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
  },
})

export const { setMarkets, setOrderbook, setOrders, updateOrders, removeOrders, setTrades, setLoading } = orderbookSlice.actions
export default orderbookSlice.reducer