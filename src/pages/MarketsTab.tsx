import { useState, useMemo } from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material'
import {
  Add,
  TrendingUp,
  Refresh,
  SwapHoriz,
  ShowChart
} from '@mui/icons-material'
import {
  useInitializedMarkets,
  useMarketsInfo,
  useInitMarket,
  useRealNetworks,
  useAssetRegistry
} from '../hooks/useRealHydraData'
import { getNetworkName } from '@/utils/networkNames'

export default function MarketsTab() {
  const [initDialog, setInitDialog] = useState({
    open: false,
    baseCurrency: null as any,
    quoteCurrency: null as any
  })

  // Hooks
  const { data: networksResponse } = useRealNetworks()
  const networks = networksResponse || []
  const { data: assetRegistry } = useAssetRegistry(networks)
  const { data: initializedMarkets, isLoading: loadingInitialized, refetch: refetchInitialized } = useInitializedMarkets()
  const { data: marketsInfo, isLoading: loadingMarketsInfo, refetch: refetchMarketsInfo } = useMarketsInfo()
  const initMarketMutation = useInitMarket()

  // Extract markets data and merge fee information
  const initializedMarketsList = Array.isArray(initializedMarkets?.markets) ? initializedMarkets.markets : []
  const marketsInfoList = Array.isArray(marketsInfo?.markets) ? marketsInfo.markets : []

  // Merge initialized markets with their fee info from marketsInfo
  const markets = initializedMarketsList.map((market: any) => {
    // Find matching market info by comparing base and quote asset IDs
    const matchingInfo = marketsInfoList.find((info: any) => {
      const baseMatch = (market.base?.assetId || market.firstCurrency?.assetId) === (info.base?.assetId || info.firstCurrency?.assetId)
      const quoteMatch = (market.quote?.assetId || market.otherCurrency?.assetId) === (info.quote?.assetId || info.otherCurrency?.assetId)
      return baseMatch && quoteMatch
    })

    // Merge the market data with fee info
    return {
      ...market,
      ...(matchingInfo || {}),
      // Ensure we preserve both base/quote structures
      base: market.base || market.firstCurrency || matchingInfo?.base,
      quote: market.quote || market.otherCurrency || matchingInfo?.quote,
    }
  })

  // Generate all possible market pairs from available assets
  const availableMarketPairs = useMemo(() => {
    if (!assetRegistry) return []

    // Deduplicate assets by asset.id + network.id combination
    // This prevents duplicate entries for ETH (which exists as both '0x0000...-networkId' and '0x0000...')
    const assetMap = new Map<string, typeof assetRegistry[string]>()
    Object.values(assetRegistry).forEach(assetEntry => {
      const key = `${assetEntry.asset.id}-${assetEntry.network.id}`
      // Skip if we already have this asset on this network
      if (!assetMap.has(key)) {
        assetMap.set(key, assetEntry)
      }
    })

    const assets = Array.from(assetMap.values())
    const pairs = []

    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const baseAssetEntry = assets[i]  // {asset: Asset, network: Network}
        const quoteAssetEntry = assets[j] // {asset: Asset, network: Network}

        // Extract asset and network info from registry structure
        const baseAsset = baseAssetEntry?.asset
        const quoteAsset = quoteAssetEntry?.asset
        const baseNetwork = baseAssetEntry?.network
        const quoteNetwork = quoteAssetEntry?.network

        if (!baseAsset?.id || !quoteAsset?.id || !baseNetwork || !quoteNetwork) {
          continue
        }

        // Skip pairs where both assets are the same (e.g., ETH/ETH on different networks)
        if (baseAsset.id === quoteAsset.id) {
          continue
        }

        // Create OrderbookCurrency objects for the orderbook service
        const baseCurrency = {
          protocol: baseNetwork.protocol,
          networkId: baseNetwork.id,
          assetId: baseAsset.id
        }
        const quoteCurrency = {
          protocol: quoteNetwork.protocol,
          networkId: quoteNetwork.id,
          assetId: quoteAsset.id
        }

        pairs.push({
          id: `${baseAsset.id}_${quoteAsset.id}`,
          baseAsset: baseAssetEntry,   // Keep full registry entry for consistency
          quoteAsset: quoteAssetEntry, // Keep full registry entry for consistency
          baseCurrency,
          quoteCurrency,
          symbol: `${baseAsset.symbol || baseAsset.id.slice(0, 8)}/${quoteAsset.symbol || quoteAsset.id.slice(0, 8)}`
        })
      }
    }

    return pairs
  }, [assetRegistry])

  // Filter out already initialized pairs
  const uninitializedPairs = useMemo(() => {
    if (!availableMarketPairs.length || !markets.length) return availableMarketPairs

    const initializedPairIds = new Set()
    markets.forEach((market: any) => {
      if (market.base?.assetId && market.quote?.assetId) {
        // Add both directions since markets are bidirectional
        initializedPairIds.add(`${market.base.assetId}_${market.quote.assetId}`)
        initializedPairIds.add(`${market.quote.assetId}_${market.base.assetId}`)
      }
    })

    return availableMarketPairs.filter(pair => !initializedPairIds.has(pair.id))
  }, [availableMarketPairs, markets])

  const handleInitMarket = async () => {
    if (!initDialog.baseCurrency || !initDialog.quoteCurrency) return

    try {
      await initMarketMutation.mutateAsync({
        baseCurrency: initDialog.baseCurrency,
        quoteCurrency: initDialog.quoteCurrency
      })
      setInitDialog({ open: false, baseCurrency: null, quoteCurrency: null })
    } catch (error) {
      console.error('Failed to initialize market:', error)
    }
  }

  const handleRefresh = () => {
    refetchInitialized()
    refetchMarketsInfo()
  }

  const getAssetSymbol = (assetId: string): string => {
    if (!assetRegistry || !assetId) return 'Unknown'

    // First try direct lookup
    let asset: any = assetRegistry[assetId]

    // If not found, try to find by nested asset.id
    if (!asset) {
      asset = Object.values(assetRegistry).find((a: any) =>
        a?.asset?.id === assetId || a?.id === assetId
      )
    }

    return asset?.asset?.symbol || (asset as any)?.symbol || assetId.slice(0, 8)
  }

  const getNetworkChip = (network: any) => {
    if (!network) return null

    return (
      <Chip
        label={network.protocol === 0 ? 'Bitcoin' : 'EVM'}
        size="small"
        sx={{
          height: 18,
          fontSize: '0.7rem',
          backgroundColor: network.protocol === 0 ? '#f7931a20' : '#627eea20',
          color: network.protocol === 0 ? '#f7931a' : '#627eea',
          fontWeight: 600
        }}
      />
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Markets
        </Typography>

        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={loadingInitialized || loadingMarketsInfo}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setInitDialog({ open: true, baseCurrency: null, quoteCurrency: null })}
            disabled={uninitializedPairs.length === 0}
          >
            Initialize Market
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <ShowChart sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Initialized Markets</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>
                {markets.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TrendingUp sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Available Pairs</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'success.main' }}>
                {availableMarketPairs.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <SwapHoriz sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">Uninitiated</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'warning.main' }}>
                {uninitializedPairs.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Initialized Markets Table */}
      <Card elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Initialized Markets
          </Typography>

          {loadingInitialized ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : markets.length === 0 ? (
            <Alert severity="info">
              No markets have been initialized yet. Click "Initialize Market" to create your first trading pair.
            </Alert>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Market Pair</TableCell>
                    <TableCell>Base Asset</TableCell>
                    <TableCell>Quote Asset</TableCell>
                    <TableCell>Network</TableCell>
                    <TableCell>Taker Fee</TableCell>
                    <TableCell>Maker Fee</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {markets.map((market: any, index: number) => {
                    // Handle different possible field names from the backend
                    const baseAssetId = market.firstCurrency?.assetId || market.base?.assetId || market.baseCurrency?.assetId
                    const quoteAssetId = market.otherCurrency?.assetId || market.quote?.assetId || market.quoteCurrency?.assetId
                    const baseNetworkId = market.firstCurrency?.networkId || market.base?.networkId || 'Unknown'
                    const quoteNetworkId = market.otherCurrency?.networkId || market.quote?.networkId || 'Unknown'
                    const baseProtocol = market.firstCurrency?.protocol || market.base?.protocol
                    const quoteProtocol = market.otherCurrency?.protocol || market.quote?.protocol

                    // Get network names using centralized utility

                    const baseNetworkName = getNetworkName(baseNetworkId, baseProtocol)
                    const quoteNetworkName = getNetworkName(quoteNetworkId, quoteProtocol)

                    // Show both networks or just one if they're the same
                    const networkDisplay = baseNetworkName === quoteNetworkName
                      ? baseNetworkName
                      : `${baseNetworkName} / ${quoteNetworkName}`

                    // Extract fee information - fees are objects with .value property
                    const takerFee = market.takerBaseFee?.value || market.taker_base_fee?.value || market.takerFee || '0'
                    const makerFee = market.makerBaseFee?.value || market.maker_base_fee?.value || market.makerFee || '0'

                    return (
                      <TableRow key={`${baseAssetId}_${quoteAssetId}` || index} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              {getAssetSymbol(baseAssetId)}/{getAssetSymbol(quoteAssetId)}
                            </Typography>
                            <SwapHoriz fontSize="small" color="action" />
                          </Box>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {getAssetSymbol(baseAssetId)}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {getAssetSymbol(quoteAssetId)}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {networkDisplay}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2">
                            {(parseFloat(takerFee) * 100).toFixed(3)}%
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2">
                            {(parseFloat(makerFee) * 100).toFixed(3)}%
                          </Typography>
                        </TableCell>

                        <TableCell align="center">
                          <Chip
                            label="Initialized"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Available Market Pairs */}
      {uninitializedPairs.length > 0 && (
        <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">
                Available Market Pairs ({uninitializedPairs.length})
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Add />}
                onClick={async () => {
                  for (const pair of uninitializedPairs) {
                    try {
                      await initMarketMutation.mutateAsync({
                        baseCurrency: pair.baseCurrency,
                        quoteCurrency: pair.quoteCurrency
                      })
                    } catch (error) {
                      console.error('Failed to initialize market:', pair.id, error)
                    }
                  }
                }}
                disabled={initMarketMutation.isPending}
              >
                {initMarketMutation.isPending ? 'Initializing...' : 'Initialize All'}
              </Button>
            </Box>

            <Grid container spacing={2}>
              {uninitializedPairs.slice(0, 12).map((pair) => (
                <Grid item xs={12} sm={6} md={4} key={pair.id}>
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {pair.symbol}
                        </Typography>
                        <Box display="flex" gap={0.5} mt={0.5}>
                          {getNetworkChip(pair.baseAsset.network)}
                          {getNetworkChip(pair.quoteAsset.network)}
                        </Box>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={async () => {
                          try {
                            await initMarketMutation.mutateAsync({
                              baseCurrency: pair.baseCurrency,
                              quoteCurrency: pair.quoteCurrency
                            })
                          } catch (error) {
                            console.error('Failed to initialize market:', error)
                          }
                        }}
                        disabled={initMarketMutation.isPending}
                      >
                        {initMarketMutation.isPending ? 'Init...' : 'Init'}
                      </Button>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {uninitializedPairs.length > 12 && (
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  Showing 12 of {uninitializedPairs.length} available pairs.
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Initialize Market Dialog */}
      <Dialog open={initDialog.open} onClose={() => setInitDialog({ open: false, baseCurrency: null, quoteCurrency: null })} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Add />
            <Typography variant="h6">Initialize Market</Typography>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Box mt={1}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Alert severity="info">
                  Markets are bidirectional. Initializing ETH/USDC allows trading in both directions (ETH→USDC and USDC→ETH).
                </Alert>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Base Currency</InputLabel>
                  <Select
                    value={initDialog.baseCurrency?.assetId || ''}
                    label="Base Currency"
                    onChange={(e) => {
                      const selectedPair = availableMarketPairs.find(p =>
                        p.baseCurrency.assetId === e.target.value
                      )
                      if (selectedPair) {
                        setInitDialog(prev => ({
                          ...prev,
                          baseCurrency: selectedPair.baseCurrency
                        }))
                      }
                    }}
                  >
                    {availableMarketPairs.map((pair) => (
                      <MenuItem key={pair.baseCurrency.assetId} value={pair.baseCurrency.assetId}>
                        <Box display="flex" alignItems="center" gap={1}>
                          {pair.baseAsset.asset.symbol || pair.baseAsset.asset.id.slice(0, 8)}
                          {getNetworkChip(pair.baseAsset.network)}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Quote Currency</InputLabel>
                  <Select
                    value={initDialog.quoteCurrency?.assetId || ''}
                    label="Quote Currency"
                    onChange={(e) => {
                      const selectedPair = availableMarketPairs.find(p =>
                        p.quoteCurrency.assetId === e.target.value &&
                        p.baseCurrency.assetId === initDialog.baseCurrency?.assetId
                      )
                      if (selectedPair) {
                        setInitDialog(prev => ({
                          ...prev,
                          quoteCurrency: selectedPair.quoteCurrency
                        }))
                      }
                    }}
                    disabled={!initDialog.baseCurrency}
                  >
                    {availableMarketPairs
                      .filter(p => p.baseCurrency.assetId === initDialog.baseCurrency?.assetId)
                      .map((pair) => (
                        <MenuItem key={pair.quoteCurrency.assetId} value={pair.quoteCurrency.assetId}>
                          <Box display="flex" alignItems="center" gap={1}>
                            {pair.quoteAsset.asset.symbol || pair.quoteAsset.asset.id.slice(0, 8)}
                            {getNetworkChip(pair.quoteAsset.network)}
                          </Box>
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>

              {initDialog.baseCurrency && initDialog.quoteCurrency && (
                <Grid item xs={12}>
                  <Box p={2} bgcolor="background.paper" borderRadius={1} border={1} borderColor="divider">
                    <Typography variant="subtitle2" gutterBottom>Market Preview</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {getAssetSymbol(initDialog.baseCurrency.assetId)} / {getAssetSymbol(initDialog.quoteCurrency.assetId)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      This will enable trading between {getAssetSymbol(initDialog.baseCurrency.assetId)} and {getAssetSymbol(initDialog.quoteCurrency.assetId)} in both directions.
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setInitDialog({ open: false, baseCurrency: null, quoteCurrency: null })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleInitMarket}
            disabled={
              !initDialog.baseCurrency ||
              !initDialog.quoteCurrency ||
              initMarketMutation.isPending
            }
            startIcon={initMarketMutation.isPending ? <CircularProgress size={16} /> : <Add />}
          >
            {initMarketMutation.isPending ? 'Initializing...' : 'Initialize Market'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}