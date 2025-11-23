import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface BalanceState {
  balances: Balance[]
  totalUsdValue: number
  isLoading: boolean
}

interface Balance {
  asset: string
  onChain: number
  offChain: number
  total: number
  usdValue: number
}

const initialState: BalanceState = {
  balances: [],
  totalUsdValue: 0,
  isLoading: false,
}

const balanceSlice = createSlice({
  name: 'balance',
  initialState,
  reducers: {
    setBalances: (state, action: PayloadAction<Balance[]>) => {
      state.balances = action.payload
      state.totalUsdValue = action.payload.reduce((sum, balance) => sum + balance.usdValue, 0)
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
  },
})

export const { setBalances, setLoading } = balanceSlice.actions
export default balanceSlice.reducer