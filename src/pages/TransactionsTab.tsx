import React from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Grid,
  Paper,
  Tooltip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material'
import {
  Refresh,
  OpenInNew,
  TrendingUp,
  TrendingDown,
  Receipt,
  CheckCircle,
  Schedule,
  Error
} from '@mui/icons-material'
import { useRealTransactions, useRealNetworks, useAssetRegistry } from '../hooks/useRealHydraData'
import { formatCryptoAmount, formatUsdAmount, formatTimestamp, formatHash, getStatusColor } from '@/utils/formatting'

// Mock transaction data for development
const mockTransactions = [
  {
    id: '0x1234...5678',
    timestamp: Date.now() - 3600000, // 1 hour ago
    type: 'send' as const,
    amount: 0.1234,
    asset: 'BTC',
    status: 'confirmed' as const,
    confirmations: 6,
    fee: 0.0001,
    to: 'bc1q...xyz123',
    blockHeight: 820450,
    usdValue: 3850.25
  },
  {
    id: '0x5678...9abc',
    timestamp: Date.now() - 7200000, // 2 hours ago
    type: 'receive' as const,
    amount: 1.5678,
    asset: 'ETH',
    status: 'confirmed' as const,
    confirmations: 12,
    fee: 0.002,
    from: '0x123...def456',
    blockHeight: 19200000,
    usdValue: 2450.67
  },
  {
    id: '0x9abc...def0',
    timestamp: Date.now() - 900000, // 15 minutes ago
    type: 'send' as const,
    amount: 500.0,
    asset: 'USDC',
    status: 'pending' as const,
    confirmations: 2,
    fee: 0.5,
    to: '0x456...789abc',
    blockHeight: null,
    usdValue: 500.0
  },
  {
    id: '0xdef0...1234',
    timestamp: Date.now() - 1800000, // 30 minutes ago
    type: 'receive' as const,
    amount: 0.025,
    asset: 'BTC',
    status: 'failed' as const,
    confirmations: 0,
    fee: 0.0001,
    from: 'bc1q...abc789',
    blockHeight: null,
    usdValue: 780.45
  }
]

export default function TransactionsTab() {
  const { data: transactionsResponse, isLoading, error, refetch } = useRealTransactions()
  const { data: networksResponse } = useRealNetworks()
  const networks = networksResponse || []
  const { data: assetRegistry } = useAssetRegistry(networks)
  const [selectedTransaction, setSelectedTransaction] = React.useState<any>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = React.useState(false)

  const handleViewDetails = (transaction: any) => {
    setSelectedTransaction(transaction)
    setDetailsDialogOpen(true)
  }

  const handleCloseDetails = () => {
    setDetailsDialogOpen(false)
    setSelectedTransaction(null)
  }

  const formatTransactionTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'N/A'

    try {
      // According to the proto, timestamp is a Date object
      if (timestamp instanceof Date) {
        return timestamp.toLocaleString()
      }

      // Fallback: try to create a Date from whatever we got
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) {
        console.warn('🕐 Invalid timestamp:', timestamp)
        return 'Invalid Date'
      }

      return date.toLocaleString()
    } catch (error) {
      console.warn('🕐 Error formatting timestamp:', error, timestamp)
      return 'Error'
    }
  }

  // Helper function to get readable network name from chain ID
  const getNetworkName = (protocol: number, networkId: string): string => {
    if (protocol === 0) { // Bitcoin
      return `Bitcoin ${networkId}`
    }

    // EVM networks
    switch (networkId) {
      case '1': return 'Ethereum Mainnet'
      case '11155111': return 'Ethereum Sepolia'
      case '137': return 'Polygon Mainnet'
      case '80001': return 'Mumbai Testnet'
      case '42161': return 'Arbitrum One'
      case '421614': return 'Arbitrum Sepolia'
      case '10': return 'Optimism'
      case '420': return 'Optimism Goerli'
      default: return `EVM ${networkId}`
    }
  }

  // Helper function to get block explorer URL
  const getBlockExplorerUrl = (protocol: number, networkId: string, txHash: string): string => {
    if (protocol === 0) { // Bitcoin
      switch (networkId) {
        case 'mainnet':
        case '0':
          return `https://blockstream.info/tx/${txHash}`
        case 'testnet':
        case '1':
          return `https://blockstream.info/testnet/tx/${txHash}`
        default:
          return `https://blockstream.info/tx/${txHash}`
      }
    }

    // EVM networks
    switch (networkId) {
      case '1': return `https://etherscan.io/tx/${txHash}`
      case '11155111': return `https://sepolia.etherscan.io/tx/${txHash}`
      case '137': return `https://polygonscan.com/tx/${txHash}`
      case '80001': return `https://mumbai.polygonscan.com/tx/${txHash}`
      case '42161': return `https://arbiscan.io/tx/${txHash}`
      case '421614': return `https://sepolia.arbiscan.io/tx/${txHash}`
      case '10': return `https://optimistic.etherscan.io/tx/${txHash}`
      case '420': return `https://goerli-optimism.etherscan.io/tx/${txHash}`
      default: return '' // Unknown network
    }
  }

  // Helper function to get network information from a transaction
  const getTransactionNetwork = (transaction: any): { networkName: string, protocol: string } => {
    // Check if transaction has direct network field
    if (transaction.network) {
      const protocol = transaction.network.protocol === 0 ? 'Bitcoin' : 'EVM'
      const networkName = getNetworkName(transaction.network.protocol, transaction.network.id)
      return { networkName, protocol }
    }

    // Try to determine network from spent/received assets (correct proto field names)
    const allAssetIds = [
      ...Object.keys(transaction.spent || {}),
      ...Object.keys(transaction.received || {})
    ]

    if (allAssetIds.length > 0 && assetRegistry) {
      const firstAssetId = allAssetIds[0]
      const assetInfo = assetRegistry[firstAssetId]

      if (assetInfo?.network) {
        const protocol = assetInfo.network.protocol === 0 ? 'Bitcoin' : 'EVM'
        const networkName = getNetworkName(assetInfo.network.protocol, assetInfo.network.id)
        return { networkName, protocol }
      }
    }

    return { networkName: 'Unknown', protocol: 'Unknown' }
  }

  // Extract transactions - the gRPC client returns the array directly, not wrapped in {transactions: [...]}
  const transactions = Array.isArray(transactionsResponse) ? transactionsResponse : (transactionsResponse?.transactions || [])

  // Show empty state if no real transactions found
  const hasTransactions = transactions.length > 0

  // Calculate summary stats using proper protobuf enums
  const confirmedTxs = transactions.filter((tx: any) => tx.status === 3).length // COMPLETED = 3
  const pendingTxs = transactions.filter((tx: any) => tx.status === 2 || tx.status === 1).length // PENDING_CONFIRMATIONS = 2, IN_MEMPOOL = 1
  const failedTxs = transactions.filter((tx: any) => tx.status === 4).length // FAILED = 4

  // Calculate total value from received amounts
  const totalValue = transactions.reduce((sum: number, tx: any) => {
    const receivedAmounts = Object.values(tx.received || {})
    return sum + receivedAmounts.reduce((txSum: number, amount: any) =>
      txSum + parseFloat(amount.value || '0'), 0)
  }, 0)

  const getStatusIcon = (status: number) => {
    switch (status) {
      case 3: // COMPLETED
        return <CheckCircle color="success" fontSize="small" />
      case 2: // PENDING_CONFIRMATIONS
      case 1: // IN_MEMPOOL
        return <Schedule color="warning" fontSize="small" />
      case 4: // FAILED
        return <Error color="error" fontSize="small" />
      default: // UNKNOWN or other
        return <Schedule color="disabled" fontSize="small" />
    }
  }

  const getStatusText = (status: number) => {
    switch (status) {
      case 3: return 'Completed'
      case 2: return 'Pending'
      case 1: return 'In Mempool'
      case 4: return 'Failed'
      default: return 'Unknown'
    }
  }

  const getTypeIcon = (type: string) => {
    return type === 'send' ? (
      <TrendingUp color="error" fontSize="small" />
    ) : (
      <TrendingDown color="success" fontSize="small" />
    )
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
          Transactions
        </Typography>
        <Alert severity="error">
          Failed to load transactions: {error.message}
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Transactions
        </Typography>

        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => refetch()}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Receipt sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Total Transactions</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>
                {transactions.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <CheckCircle sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Confirmed</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'success.main' }}>
                {confirmedTxs}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Schedule sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">Pending</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'warning.main' }}>
                {pendingTxs}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total Value</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {formatUsdAmount(totalValue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Confirmed only
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Transactions Table */}
      <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Recent Transactions
          </Typography>

          {!hasTransactions ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No transactions found. This could mean:
              <ul>
                <li>No wallets are configured for any networks</li>
                <li>No transactions have been made yet</li>
                <li>The wallet service is not responding</li>
              </ul>
            </Alert>
          ) : isLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Status</TableCell>
                      <TableCell>Transaction ID</TableCell>
                      <TableCell>Network</TableCell>
                      <TableCell>Confirmations</TableCell>
                      <TableCell>Block Height</TableCell>
                      <TableCell>Fee</TableCell>
                      <TableCell>Time</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.map((tx: any, index: number) => (
                      <TableRow key={tx.id || index} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            {getStatusIcon(tx.status)}
                            <Chip
                              label={getStatusText(tx.status)}
                              size="small"
                              color={tx.status === 3 ? 'success' : tx.status === 4 ? 'error' : 'warning'}
                            />
                          </Box>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {formatHash(tx.id || 'unknown', 8, 6)}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Chip
                            label={getTransactionNetwork(tx).networkName}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor: getTransactionNetwork(tx).protocol === 'Bitcoin' ? '#f7931a20' : '#627eea20',
                              color: getTransactionNetwork(tx).protocol === 'Bitcoin' ? '#f7931a' : '#627eea',
                              fontWeight: 600
                            }}
                          />
                        </TableCell>

                        <TableCell>
                          <Typography
                            variant="body2"
                            color={tx.confirmations >= 6 ? 'success.main' : 'warning.main'}
                            sx={{ fontWeight: 500 }}
                          >
                            {tx.confirmations || 0}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2">
                            {tx.block_height || 'N/A'}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {tx.fee?.value || '0'}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatTransactionTimestamp(tx.timestamp)}
                          </Typography>
                        </TableCell>

                        <TableCell align="center">
                          <Box display="flex" gap={1} justifyContent="center">
                            <Tooltip title="View Details">
                              <IconButton size="small" onClick={() => handleViewDetails(tx)}>
                                <Receipt fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="View on Block Explorer">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  // Try to get network info from transaction or asset registry
                                  let protocol = 1 // Default to EVM
                                  let networkId = '11155111' // Default to Sepolia

                                  if (tx.network) {
                                    protocol = tx.network.protocol
                                    networkId = tx.network.id
                                  } else {
                                    // Fallback: try to determine from asset registry
                                    const txNetwork = getTransactionNetwork(tx)
                                    if (txNetwork.protocol === 'Bitcoin') {
                                      protocol = 0
                                      networkId = 'mainnet'
                                    } else {
                                      // Extract actual network ID from the network name if possible
                                      if (txNetwork.networkName.includes('421614')) networkId = '421614'
                                      else if (txNetwork.networkName.includes('11155111')) networkId = '11155111'
                                      else if (txNetwork.networkName.includes('42161')) networkId = '42161'
                                      else if (txNetwork.networkName.includes('137')) networkId = '137'
                                      else if (txNetwork.networkName.includes('1')) networkId = '1'
                                    }
                                  }

                                  const url = getBlockExplorerUrl(protocol, networkId, tx.id || '')
                                  if (url) window.open(url, '_blank')
                                }}
                                disabled={!tx.id}
                              >
                                <OpenInNew fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  Showing {transactions.length} transactions from Hydra backend. Auto-refreshes every 30 seconds.
                </Typography>
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      {/* Transaction Details Dialog */}
      <Dialog open={detailsDialogOpen} onClose={handleCloseDetails} maxWidth="md" fullWidth>
        <DialogTitle>
          Transaction Details
        </DialogTitle>
        <DialogContent>
          {selectedTransaction && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Transaction ID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {selectedTransaction.id || 'N/A'}
                  </Typography>
                  {selectedTransaction.id && selectedTransaction.network && (
                    <Button
                      size="small"
                      startIcon={<OpenInNew />}
                      onClick={() => {
                        const url = getBlockExplorerUrl(
                          selectedTransaction.network.protocol,
                          selectedTransaction.network.id,
                          selectedTransaction.id
                        )
                        if (url) window.open(url, '_blank')
                      }}
                      sx={{ mt: 1 }}
                    >
                      View on Explorer
                    </Button>
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getStatusIcon(selectedTransaction.status)}
                    <Typography variant="body2">
                      {getStatusText(selectedTransaction.status)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Network</Typography>
                  <Chip
                    label={getTransactionNetwork(selectedTransaction).networkName}
                    size="small"
                    sx={{
                      backgroundColor: getTransactionNetwork(selectedTransaction).protocol === 'Bitcoin' ? '#f7931a20' : '#627eea20',
                      color: getTransactionNetwork(selectedTransaction).protocol === 'Bitcoin' ? '#f7931a' : '#627eea',
                      fontWeight: 600
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Timestamp</Typography>
                  <Typography variant="body2">
                    {formatTransactionTimestamp(selectedTransaction.timestamp)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Fee</Typography>
                  <Typography variant="body2">
                    {selectedTransaction.fee?.value || '0'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Spent Amounts</Typography>
                  {selectedTransaction.spent && Object.keys(selectedTransaction.spent).length > 0 ? (
                    Object.entries(selectedTransaction.spent).map(([assetId, amount]: [string, any]) => (
                      <Typography key={assetId} variant="body2">
                        {amount.value} (Asset: {assetId.slice(0, 8)}...)
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">None</Typography>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Received Amounts</Typography>
                  {selectedTransaction.received && Object.keys(selectedTransaction.received).length > 0 ? (
                    Object.entries(selectedTransaction.received).map(([assetId, amount]: [string, any]) => (
                      <Typography key={assetId} variant="body2">
                        {amount.value} (Asset: {assetId.slice(0, 8)}...)
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">None</Typography>
                  )}
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}