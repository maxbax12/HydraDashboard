import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface TransactionState {
  transactions: Transaction[]
  isLoading: boolean
}

interface Transaction {
  id: string
  timestamp: number
  type: 'send' | 'receive'
  amount: number
  asset: string
  status: 'pending' | 'confirmed' | 'failed'
  confirmations: number
  fee: number
}

const initialState: TransactionState = {
  transactions: [],
  isLoading: false,
}

const transactionSlice = createSlice({
  name: 'transaction',
  initialState,
  reducers: {
    setTransactions: (state, action: PayloadAction<Transaction[]>) => {
      state.transactions = action.payload
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
  },
})

export const { setTransactions, setLoading } = transactionSlice.actions
export default transactionSlice.reducer