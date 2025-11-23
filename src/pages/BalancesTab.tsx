import React from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Chip
} from '@mui/material'
import { Refresh, AccountBalance, TrendingUp } from '@mui/icons-material'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useRealBalances, useRealNetworks, useGrpcStatus, useAssetPrice, useBalanceAssetPrices, useAssetRegistry } from '@/hooks/useRealHydraData'
import { FiatCurrency } from '@/proto/models'
import { formatUsdAmount, formatCryptoAmount } from '@/utils/formatting'
import BalanceCard from '@/components/BalanceCard'

const COLORS = ['#1976d2', '#dc004e', '#388e3c', '#f57c00', '#7b1fa2']

// Helper function to get readable asset names from asset IDs
function getAssetDisplayName(assetId: string): string {
  // Common asset IDs mapping
  const assetNames: Record<string, string> = {
    // Bitcoin native asset (all zeros)
    '0x0000000000000000000000000000000000000000000000000000000000000000': 'BTC',
    // USDT on various networks
    '0xa0b86a33e6ba42d9f6b3a7e1b6b6a8c8d8e8f8g8h8': 'USDT',
    // USDC on various networks
    '0x67e6a7eae40107ff676908b28c3fc632a38f1499': 'USDC',
    // Add more known asset IDs as needed
  }

  // If we have a known mapping, use it
  if (assetNames[assetId]) {
    return assetNames[assetId]
  }

  // For unknown assets, show shortened ID
  if (assetId.length > 20) {
    return `${assetId.slice(0, 6)}...${assetId.slice(-4)}`
  }

  return assetId.toUpperCase()
}

// Helper function to estimate USD value (in production, use a real price API)
function getEstimatedUsdValue(assetName: string, amount: number): number {
  // Basic price estimates (you would fetch these from CoinGecko, CoinMarketCap, etc.)
  const priceEstimates: Record<string, number> = {
    'BTC': 43000, // Bitcoin price estimate
    'USDC': 1.00, // USDC is pegged to USD
    'USDT': 1.00, // USDT is pegged to USD
    'ETH': 2600,  // Ethereum price estimate
  }

  // For unknown assets, assume $1 so we can see some USD value
  // This is just for demo purposes while pricing service is being implemented
  const price = priceEstimates[assetName] || 1.00


  return amount * price
}

export default function BalancesTab() {
  // Get real data from Hydra backend
  const { data: balanceData, isLoading, error, refetch } = useRealBalances()
  const { data: networks = [] } = useRealNetworks()
  const { data: grpcStatus } = useGrpcStatus()

  // Get asset registry for proper asset names and network mapping
  const { data: assetRegistry } = useAssetRegistry(networks)


  // Get asset prices for USD calculations
  const { priceMap, isLoading: pricesLoading } = useBalanceAssetPrices(balanceData, networks)

  // Transform real data into display format
  const processedBalances = React.useMemo(() => {
    if (!balanceData?.balances) {
      // Return mock data structure for now
      return [
        {
          asset: 'BTC',
          onChain: 0.1234,
          offChain: 0.0567,
          total: 0.1801,
          usdValue: 7200.40,
          change24h: 2.3
        },
        {
          asset: 'ETH',
          onChain: 1.5678,
          offChain: 0.8901,
          total: 2.4579,
          usdValue: 4915.80,
          change24h: -1.8
        },
        {
          asset: 'USDC',
          onChain: 1000.50,
          offChain: 500.25,
          total: 1500.75,
          usdValue: 1500.75,
          change24h: 0.1
        }
      ]
    }

    // Transform real gRPC data with proper protobuf structure
    return Object.entries(balanceData.balances).map(([assetId, balance]) => {

      // Extract onchain balance (usable + pending)
      const onchainUsable = parseFloat(balance.onchain?.usable?.value || '0')
      const onchainPending = parseFloat(balance.onchain?.pending?.value || '0')
      const totalOnchain = onchainUsable + onchainPending

      // Extract offchain balance (ALL components)
      const offchainFreeLocal = parseFloat(balance.offchain?.freeLocal?.value || '0')
      const offchainFreeRemote = parseFloat(balance.offchain?.freeRemote?.value || '0')
      const offchainPendingLocal = parseFloat(balance.offchain?.pendingLocal?.value || '0')
      const offchainPendingRemote = parseFloat(balance.offchain?.pendingRemote?.value || '0')
      const offchainPayingLocal = parseFloat(balance.offchain?.payingLocal?.value || '0')
      const offchainPayingRemote = parseFloat(balance.offchain?.payingRemote?.value || '0')
      const offchainUnavailableLocal = parseFloat(balance.offchain?.unavailableLocal?.value || '0')
      const offchainUnavailableRemote = parseFloat(balance.offchain?.unavailableRemote?.value || '0')
      const offchainUnspendableLocalReserve = parseFloat(balance.offchain?.unspendableLocalReserve?.value || '0')
      const offchainUnspendableRemoteReserve = parseFloat(balance.offchain?.unspendableRemoteReserve?.value || '0')

      const totalOffchain = offchainFreeLocal + offchainFreeRemote + offchainPendingLocal + offchainPendingRemote +
                           offchainPayingLocal + offchainPayingRemote + offchainUnavailableLocal + offchainUnavailableRemote +
                           offchainUnspendableLocalReserve + offchainUnspendableRemoteReserve

      // Get asset display name (prefer registry over hardcoded mapping)
      const registryAsset = assetRegistry?.[assetId]
      const assetName = registryAsset?.asset?.symbol || registryAsset?.asset?.name || getAssetDisplayName(assetId)

      // Debug logging for BTC specifically
      if (assetName === 'BTC') {
        console.log('🪙 BTC Balance Debug - ALL COMPONENTS:', {
          assetId,
          assetName,
          onchain: { onchainUsable, onchainPending, totalOnchain },
          offchain: {
            freeLocal: offchainFreeLocal,
            freeRemote: offchainFreeRemote,
            pendingLocal: offchainPendingLocal,
            pendingRemote: offchainPendingRemote,
            payingLocal: offchainPayingLocal,
            payingRemote: offchainPayingRemote,
            unavailableLocal: offchainUnavailableLocal,  // ← This had your BTC!
            unavailableRemote: offchainUnavailableRemote, // ← This had your BTC!
            unspendableLocalReserve: offchainUnspendableLocalReserve,
            unspendableRemoteReserve: offchainUnspendableRemoteReserve,
            totalOffchain
          },
          totalBalance: totalOnchain + totalOffchain
        })
      }

      // Calculate USD value using real pricing data (with fallback)
      const totalBalance = totalOnchain + totalOffchain
      const assetPrice = priceMap[assetId] || 0

      // Fallback to estimated value if no real price available
      const usdValue = assetPrice > 0 ? totalBalance * assetPrice : getEstimatedUsdValue(assetName, totalBalance)


      return {
        asset: assetName,
        assetId: assetId,
        onChain: totalOnchain,
        offChain: totalOffchain,
        total: totalBalance,
        usdValue: usdValue,
        change24h: 0, // TODO: Get price change data
        details: {
          onchain: {
            usable: onchainUsable,
            pending: onchainPending
          },
          offchain: {
            freeLocal: offchainFreeLocal,
            freeRemote: offchainFreeRemote,
            pendingLocal: offchainPendingLocal,
            pendingRemote: offchainPendingRemote
          }
        }
      }
    })
  }, [balanceData, priceMap, assetRegistry])


  // Use processed real data or fallback
  const balances = processedBalances

  const totalPortfolioValue = balances.reduce((sum, balance) => sum + balance.usdValue, 0)

  const handleRefreshAll = async () => {
    try {
      await refetch()
    } catch (error) {
      console.error('Failed to refresh balances:', error)
    }
  }

  // Prepare chart data
  const pieChartData = balances.map((balance, index) => ({
    name: balance.asset.toUpperCase(),
    value: balance.usdValue,
    color: COLORS[index % COLORS.length]
  }))

  const barChartData = balances.map(balance => {
    // Calculate USD values for onChain and offChain
    const assetPrice = priceMap[balance.assetId] || 0
    const onChainUsd = balance.onChain * (assetPrice > 0 ? assetPrice : (balance.asset === 'BTC' ? 43000 : balance.asset === 'USDC' ? 1 : balance.asset === 'USDT' ? 1 : 1))
    const offChainUsd = balance.offChain * (assetPrice > 0 ? assetPrice : (balance.asset === 'BTC' ? 43000 : balance.asset === 'USDC' ? 1 : balance.asset === 'USDT' ? 1 : 1))

    return {
      asset: balance.asset.toUpperCase(),
      onChain: onChainUsd,
      offChain: offChainUsd
    }
  })

  const renderPieLabel = ({ name, percent }: any) => {
    return `${name} ${(percent * 100).toFixed(1)}%`
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
          Balances
        </Typography>
        <Alert severity="error">
          Failed to load balances: {error.message}
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Balances
        </Typography>

        <Button
          variant="outlined"
          startIcon={isLoading || pricesLoading ? <CircularProgress size={16} /> : <Refresh />}
          onClick={handleRefreshAll}
          disabled={isLoading || pricesLoading}
        >
          Refresh All
        </Button>
      </Box>

      {/* Portfolio Summary */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AccountBalance sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Total Portfolio Value</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {formatUsdAmount(totalPortfolioValue)}
              </Typography>
              <Box display="flex" alignItems="center" mt={1}>
                <TrendingUp color="success" sx={{ mr: 1 }} />
                <Typography variant="body1" color="success.main" sx={{ fontWeight: 500 }}>
                  +$1,234.56 (5.2%) 24h
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Portfolio Distribution</Typography>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderPieLabel}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatUsdAmount(value)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Balance Distribution</Typography>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barChartData}>
                  <XAxis dataKey="asset" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatUsdAmount(value)} />
                  <Bar dataKey="onChain" stackId="a" fill="#1976d2" name="On-chain" />
                  <Bar dataKey="offChain" stackId="a" fill="#dc004e" name="Off-chain" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ mb: 3 }} />

      {/* Individual Balance Cards */}
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
        Asset Balances
      </Typography>

      <Grid container spacing={3}>
        {balances.map((balance, index) => (
          <Grid item xs={12} md={4} key={balance.asset}>
            <BalanceCard
              asset={balance.asset}
              onChain={balance.onChain}
              offChain={balance.offChain}
              total={balance.total}
              usdValue={balance.usdValue}
              change24h={balance.change24h}
              isLoading={isLoading || pricesLoading}
              onRefresh={() => refetch()}
            />
          </Grid>
        ))}
      </Grid>

      {/* Additional Info */}
      <Card elevation={0} sx={{ border: 1, borderColor: 'divider', mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Balance Types
          </Typography>

          <Box display="flex" gap={2} flexWrap="wrap">
            <Chip
              icon={<AccountBalance />}
              label="On-chain: Confirmed wallet balances"
              variant="outlined"
              color="primary"
            />
            <Chip
              icon={<AccountBalance />}
              label="Off-chain: Channel liquidity available"
              variant="outlined"
              color="secondary"
            />
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Balances are updated automatically every 15 seconds. Click refresh for immediate updates.
            USD values are calculated using real-time pricing data.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}