import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Card, CardContent, Grid, List, ListItem, ListItemIcon, ListItemText, Button, Alert, CircularProgress } from '@mui/material'
import { CheckCircle, RadioButtonUnchecked, AccountBalance, Public, Cable, Refresh } from '@mui/icons-material'
import { useRealNetworks, useRealPeers, useRealChannels, useInitializedMarkets, useConnectToPeer, useMarketsInfo, useInitMarket, useAssetRegistry } from '@/hooks/useRealHydraData'
import { Protocol } from '@/proto/models'

// Official recommended peers
const RECOMMENDED_PEERS = [
  {
    nodeId: '03726edb9778282abf3b08cbac5114fe45e8b0d302ad278bd1dc7af5d3bb134083',
    address: '37.27.36.2:30843',
    networkProtocol: Protocol.BITCOIN,
    networkId: '0a03cf40',
    name: 'Bitcoin Signet'
  },
  {
    nodeId: '0xd78f26fdc770e4041960d3e06a58fb9b91fa5ff6',
    address: '37.27.36.2:30402',
    networkProtocol: Protocol.EVM,
    networkId: '11155111',
    name: 'Ethereum Sepolia'
  },
  {
    nodeId: '0xd78f26fdc770e4041960d3e06a58fb9b91fa5ff6',
    address: '37.27.36.2:31967',
    networkProtocol: Protocol.EVM,
    networkId: '421614',
    name: 'Arbitrum Sepolia'
  }
]

export default function WelcomeTab() {
  const navigate = useNavigate()
  const [quickConnecting, setQuickConnecting] = useState(false)
  const [quickConnectStatus, setQuickConnectStatus] = useState<string | null>(null)

  // Fetch data for setup status
  const { data: networksResponse } = useRealNetworks()
  const { data: peersResponse, refetch: refetchPeers } = useRealPeers()
  const { data: channelsResponse } = useRealChannels()
  const { data: marketsResponse, refetch: refetchMarkets } = useInitializedMarkets()
  const { data: marketsInfoResponse } = useMarketsInfo()
  const { data: assetRegistry } = useAssetRegistry(networksResponse || [])
  const connectPeerMutation = useConnectToPeer()
  const initMarketMutation = useInitMarket()

  const networks = networksResponse || []
  const peers = Array.isArray(peersResponse) ? peersResponse : []
  const channels = Array.isArray(channelsResponse) ? channelsResponse : (channelsResponse?.channels || [])
  const markets = Array.isArray(marketsResponse?.markets) ? marketsResponse.markets : []
  const marketsInfoList = Array.isArray(marketsInfoResponse?.markets) ? marketsInfoResponse.markets : []

  // Calculate setup status
  const hasNetworks = networks.length > 0
  const hasPeers = peers.length > 0
  const hasChannels = channels.length > 0
  const hasMarkets = markets.length > 0

  // Calculate uninitialized market pairs (same logic as MarketsTab)
  const uninitializedPairs = React.useMemo(() => {
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

    // Generate all possible pairs from asset registry
    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const baseAssetEntry = assets[i]
        const quoteAssetEntry = assets[j]

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
          baseCurrency,
          quoteCurrency,
          symbol: `${baseAsset.symbol || baseAsset.id.slice(0, 8)}/${quoteAsset.symbol || quoteAsset.id.slice(0, 8)}`
        })
      }
    }

    // Filter out already initialized pairs
    if (markets.length > 0) {
      const initializedPairIds = new Set()
      markets.forEach((market: any) => {
        if (market.base?.assetId && market.quote?.assetId) {
          initializedPairIds.add(`${market.base.assetId}_${market.quote.assetId}`)
          initializedPairIds.add(`${market.quote.assetId}_${market.base.assetId}`)
        }
      })
      return pairs.filter(pair => !initializedPairIds.has(pair.id))
    }

    return pairs
  }, [assetRegistry, markets])

  // Initialize all markets function
  const handleInitializeAllMarkets = async () => {
    setQuickConnecting(true)
    setQuickConnectStatus(null)
    let successCount = 0
    let failCount = 0

    for (const pair of uninitializedPairs) {
      try {
        await initMarketMutation.mutateAsync({
          baseCurrency: pair.baseCurrency,
          quoteCurrency: pair.quoteCurrency
        })
        successCount++
      } catch (error) {
        console.error('Failed to initialize market:', pair.id, error)
        failCount++
      }
    }

    setQuickConnecting(false)
    if (successCount > 0) {
      setQuickConnectStatus(`Successfully initialized ${successCount} market${successCount !== 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`)
      refetchMarkets()
    } else {
      setQuickConnectStatus('Failed to initialize markets. Please check the Markets tab for details.')
    }
    setTimeout(() => setQuickConnectStatus(null), 5000)
  }

  // Quick connect to all recommended peers
  const handleQuickConnect = async () => {
    setQuickConnecting(true)
    setQuickConnectStatus(null)
    let successCount = 0
    let failCount = 0

    for (const peer of RECOMMENDED_PEERS) {
      try {
        const network = networks.find(n => n.protocol === peer.networkProtocol && n.id === peer.networkId)
        if (!network) {
          console.warn(`Network not found for ${peer.name}`)
          failCount++
          continue
        }

        await connectPeerMutation.mutateAsync({
          network,
          peerUrl: `${peer.nodeId}@${peer.address}`
        })
        successCount++
      } catch (error: any) {
        console.error(`Failed to connect to ${peer.name}:`, error)
        failCount++
      }
    }

    setQuickConnecting(false)
    if (successCount > 0) {
      setQuickConnectStatus(`Successfully connected to ${successCount} peer${successCount !== 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`)
      refetchPeers()
    } else {
      setQuickConnectStatus('Failed to connect to peers. They may already be connected or unreachable.')
    }
    setTimeout(() => setQuickConnectStatus(null), 5000)
  }

  const setupSteps = [
    {
      completed: hasNetworks,
      title: 'Connect to Networks',
      description: 'Connected to Bitcoin, Ethereum, and Arbitrum networks',
      action: hasNetworks ? null : { label: 'View Networks', onClick: () => navigate('/networks') }
    },
    {
      completed: hasPeers,
      title: 'Connect Peers',
      description: `${peers.length} peer${peers.length !== 1 ? 's' : ''} connected`,
      action: {
        label: hasPeers ? 'Manage Peers' : 'Quick Connect All',
        onClick: hasPeers ? () => navigate('/peers') : handleQuickConnect,
        loading: quickConnecting
      }
    },
    {
      completed: hasChannels,
      title: 'Open Channels',
      description: `${channels.length} channel${channels.length !== 1 ? 's' : ''} opened`,
      action: { label: 'Manage Channels', onClick: () => navigate('/channels') }
    },
    {
      completed: hasMarkets,
      title: 'Initialize Markets',
      description: `${markets.length} market${markets.length !== 1 ? 's' : ''} initialized`,
      action: {
        label: hasMarkets ? 'Manage Markets' : 'Initialize All',
        onClick: hasMarkets ? () => navigate('/markets') : handleInitializeAllMarkets,
        loading: initMarketMutation.isPending
      }
    },
  ]

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Welcome to Hydra Dashboard
      </Typography>

      <Typography variant="h6" color="text.secondary" paragraph>
        Your comprehensive multi-network cryptocurrency management center
      </Typography>

      {quickConnectStatus && (
        <Alert severity={quickConnectStatus.includes('Failed') ? 'error' : 'success'} sx={{ mb: 2 }}>
          {quickConnectStatus}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🚀 Quick Setup Guide
              </Typography>
              <List>
                {setupSteps.map((step, index) => (
                  <ListItem
                    key={index}
                    sx={{ pl: 0, flexDirection: 'column', alignItems: 'flex-start' }}
                  >
                    <Box display="flex" alignItems="center" width="100%">
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {step.completed ? (
                          <CheckCircle color="success" />
                        ) : (
                          <RadioButtonUnchecked color="disabled" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={step.title}
                        secondary={step.description}
                        sx={{
                          '& .MuiListItemText-primary': {
                            fontWeight: step.completed ? 600 : 400,
                          }
                        }}
                      />
                    </Box>
                    {step.action && (
                      <Button
                        size="small"
                        variant={step.completed ? 'outlined' : 'contained'}
                        onClick={step.action.onClick}
                        disabled={step.action.loading}
                        sx={{ ml: 5, mt: 1 }}
                        startIcon={step.action.loading ? <CircularProgress size={16} /> : null}
                      >
                        {step.action.label}
                      </Button>
                    )}
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <AccountBalance sx={{ mr: 1 }} />
                    <Typography variant="h6">Multi-Asset Support</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Manage Bitcoin, Ethereum, and various tokens from a single interface
                  </Typography>
                  <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/wallet')}>View Balances</Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Public sx={{ mr: 1 }} />
                    <Typography variant="h6">Cross-Network Trading</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Trade between Bitcoin and Ethereum networks with atomic swaps
                  </Typography>
                  <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/markets')}>View Markets</Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Cable sx={{ mr: 1 }} />
                    <Typography variant="h6">Channel Management</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Open Lightning and state channels for instant, low-cost transactions
                  </Typography>
                  <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/channels')}>Manage Channels</Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  )
}