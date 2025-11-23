import React, { useState } from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tabs,
  Tab,
  Chip
} from '@mui/material'
import {
  Add,
  Cable,
  TrendingUp,
  AccountBalance,
  AccountBalanceWallet,
  CallMade,
  Close,
  HomeWork,
  Refresh,
  ContentCopy,
  CheckCircle
} from '@mui/icons-material'
import ChannelManagementDialog from '../components/ChannelManagementDialog'
import RentChannelDialog from '../components/RentChannelDialog'
import OpenChannelDialog from '../components/OpenChannelDialog'
import { useRealChannels, useRealNetworks, useAssetRegistry, useRealPeers } from '../hooks/useRealHydraData'
import { formatCryptoAmount } from '@/utils/formatting'
import { Network } from '@/proto/models'

// Channel Status enum mapping (from models.proto)
const ChannelStatus = {
  INACTIVE: 0,
  ACTIVE: 1,
  UPDATING: 2,
  CLOSED: 3,
  CLOSED_REDEEMABLE: 4
} as const

const getChannelStatusText = (status: number | undefined): string => {
  if (status === undefined || status === null) {
    return 'unknown'
  }
  switch (status) {
    case ChannelStatus.INACTIVE:
      return 'inactive'
    case ChannelStatus.ACTIVE:
      return 'active'
    case ChannelStatus.UPDATING:
      return 'updating'
    case ChannelStatus.CLOSED:
      return 'closed'
    case ChannelStatus.CLOSED_REDEEMABLE:
      return 'closed redeemable'
    default:
      return 'unknown'
  }
}

const getChannelStatusColor = (status: number | undefined): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
  if (status === undefined || status === null) {
    return 'default'
  }
  switch (status) {
    case ChannelStatus.ACTIVE:
      return 'success'
    case ChannelStatus.UPDATING:
      return 'warning'
    case ChannelStatus.CLOSED:
    case ChannelStatus.CLOSED_REDEEMABLE:
      return 'error'
    case ChannelStatus.INACTIVE:
    default:
      return 'default'
  }
}

// Helper function to format network display name
const getNetworkDisplayName = (network: any): string => {
  if (!network) return 'Unknown Network'

  // If network is a string, use it directly
  if (typeof network === 'string') {
    const lowerNetwork = network.toLowerCase()
    if (lowerNetwork.includes('bitcoin')) {
      return 'Bitcoin Signet'
    } else if (lowerNetwork.includes('evm')) {
      if (lowerNetwork.includes('11155111')) {
        return 'Ethereum Sepolia'
      } else if (lowerNetwork.includes('421614')) {
        return 'Arbitrum Sepolia'
      } else {
        return 'EVM Network'
      }
    }
    return network
  }

  // If network is an object with protocol and id
  if (typeof network === 'object' && network.id) {
    const protocol = network.protocol === 0 ? 'Bitcoin' : 'EVM'
    if (protocol === 'Bitcoin') {
      return 'Bitcoin Signet'
    } else {
      if (network.id === '11155111') {
        return 'Ethereum Sepolia'
      } else if (network.id === '421614') {
        return 'Arbitrum Sepolia'
      } else {
        return 'EVM Network'
      }
    }
  }

  return 'Unknown Network'
}

// Helper function to get network color
const getNetworkColor = (network: any): string => {
  if (!network) return '#999999'

  // If network is a string, use it directly
  if (typeof network === 'string') {
    const lowerNetwork = network.toLowerCase()
    if (lowerNetwork.includes('bitcoin')) {
      return '#f7931a'
    } else if (lowerNetwork.includes('evm')) {
      if (lowerNetwork.includes('11155111')) {
        return '#627eea' // Ethereum Sepolia
      } else if (lowerNetwork.includes('421614')) {
        return '#28a0f0' // Arbitrum Sepolia
      } else {
        return '#627eea' // Default EVM color
      }
    }
    return '#999999'
  }

  // If network is an object with protocol and id
  if (typeof network === 'object' && network.protocol !== undefined) {
    const protocol = network.protocol === 0 ? 'Bitcoin' : 'EVM'
    if (protocol === 'Bitcoin') {
      return '#f7931a'
    } else {
      if (network.id === '11155111') {
        return '#627eea' // Ethereum Sepolia
      } else if (network.id === '421614') {
        return '#28a0f0' // Arbitrum Sepolia
      } else {
        return '#627eea' // Default EVM color
      }
    }
  }

  return '#999999' // Default color for unknown networks
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index} style={{ paddingTop: 16 }}>
      {value === index && children}
    </div>
  )
}

export default function ChannelsTab() {
  const [tabValue, setTabValue] = React.useState(0)
  const [openChannelDialog, setOpenChannelDialog] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [selectedPeerForDialog, setSelectedPeerForDialog] = React.useState<{
    id: string
    network: string
    networkObj: Network
    alias?: string
  } | null>(null)

  // Channel management dialog state
  const [managementDialog, setManagementDialog] = useState({
    open: false,
    operation: 'deposit' as 'deposit' | 'withdraw' | 'close' | 'force-close',
    channel: null as any,
    network: null as any
  })

  // Rental dialog state
  const [rentDialog, setRentDialog] = useState({
    open: false,
    assetId: '',
    network: null as any
  })

  const { data: channelsResponse, isLoading, error, refetch } = useRealChannels()
  const { data: networksResponse } = useRealNetworks()
  const networks = networksResponse || []
  const { data: assetRegistry } = useAssetRegistry(networks)
  const { data: peersResponse } = useRealPeers()
  const peers = Array.isArray(peersResponse) ? peersResponse : (peersResponse?.peers || [])
  const availableAssets = assetRegistry ? Object.values(assetRegistry) : []

  // Helper function to format channel ID for display
  const formatChannelId = (id: string): string => {
    if (!id || id.length <= 15) return id
    return `${id.slice(0, 5)}...${id.slice(-5)}`
  }

  // Helper function to copy channel ID to clipboard
  const handleCopyChannelId = (channelId: string) => {
    navigator.clipboard.writeText(channelId)
    setCopiedId(channelId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Helper functions for asset and network information
  const getAssetSymbol = (assetId: string): string => {
    const assetInfo = assetRegistry?.[assetId]
    return assetInfo?.asset?.symbol || assetInfo?.asset?.name || `${assetId.slice(0, 8)}...`
  }

  const getAssetNetwork = (assetId: string): { networkName: string, networkId: string, protocol: string } => {
    const assetInfo = assetRegistry?.[assetId]
    if (assetInfo?.network) {
      const protocol = assetInfo.network.protocol === 0 ? 'Bitcoin' : 'EVM'
      const networkName = protocol === 'Bitcoin' ? `Bitcoin ${assetInfo.network.id}` : `EVM ${assetInfo.network.id}`
      return {
        networkName,
        networkId: assetInfo.network.id,
        protocol
      }
    }
    return { networkName: 'Unknown', networkId: '', protocol: 'Unknown' }
  }

  const getChannelNetwork = (channel: any): { networkName: string, protocol: string } => {
    // Get the first asset channel to determine the network
    const assetChannels = channel.assetChannels ? Object.entries(channel.assetChannels) : []
    if (assetChannels.length > 0) {
      const [firstAssetId] = assetChannels[0]
      const network = getAssetNetwork(firstAssetId)
      return { networkName: network.networkName, protocol: network.protocol }
    }
    return { networkName: 'Unknown', protocol: 'Unknown' }
  }

  const isChannelUpdatable = (channel: any): boolean => {
    // Channel is updatable only if it's not closed AND all asset channels are updatable
    if (channel.status === ChannelStatus.CLOSED) return false

    const assetChannels = channel.assetChannels ? Object.entries(channel.assetChannels) : []
    return assetChannels.every(([_, assetChannel]: [string, any]) => assetChannel.isUpdatable !== false)
  }

  // Extract channels - the gRPC client returns the array directly, not wrapped in {channels: [...]}
  const channels = Array.isArray(channelsResponse) ? channelsResponse : (channelsResponse?.channels || [])

  // Show empty state if no real channels found
  const hasChannels = channels.length > 0

  // Process real Hydra channel structure
  // Channel has: id, counterparty, status (enum), asset_channels (map<asset_id, AssetChannel>)
  const activeChannels = channels.filter((ch: any) => ch.status === ChannelStatus.ACTIVE)

  // Calculate totals from asset_channels using proper OffchainBalance structure
  let totalLocalBalance = 0
  let totalRemoteBalance = 0
  let totalPendingLocal = 0
  let totalPendingRemote = 0

  channels.forEach((ch: any) => {
    // Use camelCase field names (JavaScript converted from protobuf)
    const assetChannels = Object.values(ch.assetChannels || {})
    assetChannels.forEach((assetCh: any) => {
      const balance = assetCh.balance || {}
      // Use camelCase for balance fields too
      totalLocalBalance += parseFloat(balance.freeLocal?.value || '0')
      totalRemoteBalance += parseFloat(balance.freeRemote?.value || '0')
      totalPendingLocal += parseFloat(balance.pendingLocal?.value || '0')
      totalPendingRemote += parseFloat(balance.pendingRemote?.value || '0')
    })
  })

  const totalCapacity = totalLocalBalance + totalRemoteBalance + totalPendingLocal + totalPendingRemote


  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  // Helper to convert peer network object to string format for OpenChannelDialog
  const formatNetworkString = (network: any): string => {
    if (!network) return ''
    if (typeof network === 'string') return network
    // Convert network object to string format like "EVM 11155111" or "Bitcoin 0a03cf40"
    const protocol = network.protocol === 0 ? 'Bitcoin' : 'EVM'
    return `${protocol} ${network.id}`
  }

  const handlePeerSelected = (peer: any) => {
    if (!peer) {
      setSelectedPeerForDialog(null)
      return
    }

    // Transform peer to format expected by OpenChannelDialog
    const formattedPeer = {
      id: peer.id,
      network: formatNetworkString(peer.network),
      networkObj: peer.network,
      alias: peer.alias
    }
    setSelectedPeerForDialog(formattedPeer)
  }

  const handleCloseOpenChannelDialog = () => {
    setOpenChannelDialog(false)
    setSelectedPeerForDialog(null)
    refetch()
  }

  // Channel management dialog functions
  const openManagementDialog = (operation: 'deposit' | 'withdraw' | 'close' | 'force-close', channel: any) => {
    // Try to determine network from channel's asset channels using asset registry
    let channelNetwork = null

    if (channel.assetChannels && availableAssets.length > 0) {
      const firstAssetId = Object.keys(channel.assetChannels)[0]
      if (firstAssetId) {
        const assetInfo = availableAssets.find(asset => asset.asset.id === firstAssetId)
        if (assetInfo) {
          channelNetwork = assetInfo.network
        }
      }
    }

    // Fallback to first network if we can't determine from assets
    if (!channelNetwork && networks.length > 0) {
      channelNetwork = networks[0]
    }

    setManagementDialog({
      open: true,
      operation,
      channel,
      network: channelNetwork
    })
  }

  const openRentDialog = (assetId: string, network: any) => {
    setRentDialog({
      open: true,
      assetId,
      network
    })
  }

  const closeRentDialog = () => {
    setRentDialog({
      open: false,
      assetId: '',
      network: null
    })
  }

  const closeManagementDialog = () => {
    setManagementDialog({
      open: false,
      operation: 'deposit',
      channel: null,
      network: null
    })
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
          Channels
        </Typography>
        <Alert severity="error">
          Failed to load channels: {error.message}
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Channels
          </Typography>
          {isLoading && (
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
              <Refresh sx={{ mr: 0.5, fontSize: 16, animation: 'spin 1s linear infinite' }} />
              Loading...
            </Typography>
          )}
        </Box>

        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setOpenChannelDialog(true)}
          >
            Open Channel
          </Button>
          <Button
            variant="outlined"
            startIcon={<HomeWork />}
            onClick={() => openRentDialog('', null)}
          >
            Rent Channel
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Cable sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Total Channels</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>
                {channels.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {activeChannels.length} active
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TrendingUp sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Local Balance</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'success.main' }}>
                {formatCryptoAmount(totalLocalBalance)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Available to send
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <AccountBalance sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="h6">Remote Balance</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'info.main' }}>
                {formatCryptoAmount(totalRemoteBalance)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Available to receive
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total Capacity</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {formatCryptoAmount(totalCapacity)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Combined capacity
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for different channel views */}
      <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="All Channels" />
            <Tab label="Active Only" />
            <Tab label="Pending" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          {!hasChannels ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No channels found. This could mean:
              <ul>
                <li>No channels have been opened yet</li>
                <li>The node service is not responding</li>
                <li>No peers are connected</li>
              </ul>
              You can try opening a channel with a peer using the "Open Channel" button above.
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {channels.map((channel: any, index: number) => {
                const assetChannels = Object.entries(channel.assetChannels || {})

                return (
                  <Grid item xs={12} lg={6} xl={4} key={channel.id || index}>
                    <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                      <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                          <Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="h6">
                                Channel
                              </Typography>
                              {channel.id && (
                                <Chip
                                  label={formatChannelId(channel.id)}
                                  size="small"
                                  icon={copiedId === channel.id ? <CheckCircle /> : <ContentCopy />}
                                  onClick={() => handleCopyChannelId(channel.id)}
                                  sx={{
                                    cursor: 'pointer',
                                    fontFamily: 'monospace',
                                    fontSize: '0.8rem',
                                    bgcolor: copiedId === channel.id ? 'success.light' : 'action.hover',
                                    color: copiedId === channel.id ? 'success.dark' : 'text.primary',
                                    '& .MuiChip-icon': {
                                      fontSize: '0.9rem',
                                      color: copiedId === channel.id ? 'success.dark' : 'text.secondary'
                                    },
                                    '&:hover': {
                                      bgcolor: copiedId === channel.id ? 'success.light' : 'action.selected'
                                    }
                                  }}
                                />
                              )}
                            </Box>
                            <Box display="flex" gap={1} alignItems="center" mt={0.5}>
                              <Chip
                                label={getChannelNetwork(channel).networkName}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.7rem',
                                  backgroundColor: getChannelNetwork(channel).protocol === 'Bitcoin' ? '#f7931a20' : '#627eea20',
                                  color: getChannelNetwork(channel).protocol === 'Bitcoin' ? '#f7931a' : '#627eea',
                                  fontWeight: 600
                                }}
                              />
                              <Chip
                                label={getChannelStatusText(channel.status || 0).toUpperCase()}
                                size="small"
                                color={getChannelStatusColor(channel.status || 0)}
                                sx={{
                                  height: 20,
                                  fontSize: '0.75rem',
                                  fontWeight: 700
                                }}
                              />
                            </Box>
                          </Box>
                        </Box>

                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          <strong>Counterparty:</strong> {channel.counterparty?.slice(0, 16)}...{channel.counterparty?.slice(-8)}
                        </Typography>

                        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                          Asset Channels ({assetChannels.length})
                        </Typography>

                        {assetChannels.map(([assetId, assetChannel]: [string, any], assetIndex: number) => {
                          const balance = assetChannel.balance || {}
                          // Use camelCase field names from JavaScript protobuf conversion
                          const freeLocal = parseFloat(balance.freeLocal?.value || '0')
                          const freeRemote = parseFloat(balance.freeRemote?.value || '0')
                          const pendingLocal = parseFloat(balance.pendingLocal?.value || '0')
                          const pendingRemote = parseFloat(balance.pendingRemote?.value || '0')
                          const totalBalance = freeLocal + freeRemote + pendingLocal + pendingRemote

                          return (
                            <Box key={assetId} sx={{
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                              p: 1.5,
                              mb: assetIndex < assetChannels.length - 1 ? 1 : 0,
                              bgcolor: 'background.paper',
                              '& .MuiTypography-root': {
                                color: 'text.primary'
                              }
                            }}>
                              <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                                  {getAssetSymbol(assetId)}
                                </Typography>
                                <Chip
                                  label={getAssetNetwork(assetId).networkName}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.7rem',
                                    backgroundColor: getAssetNetwork(assetId).protocol === 'Bitcoin' ? '#f7931a20' : '#627eea20',
                                    color: getAssetNetwork(assetId).protocol === 'Bitcoin' ? '#f7931a' : '#627eea',
                                    fontWeight: 600
                                  }}
                                />
                              </Box>

                              <Box display="flex" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Local (Free):</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                                  {freeLocal.toFixed(8)}
                                </Typography>
                              </Box>

                              <Box display="flex" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Remote (Free):</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                                  {freeRemote.toFixed(8)}
                                </Typography>
                              </Box>

                              {(pendingLocal > 0 || pendingRemote > 0) && (
                                <>
                                  <Box display="flex" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                    <Typography variant="body2" color="warning.main">Pending Local:</Typography>
                                    <Typography variant="body2" color="warning.main" sx={{ fontWeight: 500 }}>
                                      {pendingLocal.toFixed(8)}
                                    </Typography>
                                  </Box>
                                  <Box display="flex" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                    <Typography variant="body2" color="warning.main">Pending Remote:</Typography>
                                    <Typography variant="body2" color="warning.main" sx={{ fontWeight: 500 }}>
                                      {pendingRemote.toFixed(8)}
                                    </Typography>
                                  </Box>
                                </>
                              )}

                              <Box display="flex" justifyContent="space-between" sx={{
                                mt: 1,
                                pt: 1,
                                borderTop: 1,
                                borderColor: 'divider'
                              }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>Total:</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                  {totalBalance.toFixed(8)}
                                </Typography>
                              </Box>
                              <Chip
                                label={assetChannel.isUpdatable ? "Operations Enabled" : "Operations Disabled"}
                                size="small"
                                color={assetChannel.isUpdatable ? "success" : "warning"}
                                variant="outlined"
                                sx={{ mt: 1 }}
                              />
                            </Box>
                          )
                        })}

                        {/* Channel Action Buttons */}
                        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Actions
                          </Typography>
                          <Box display="flex" gap={1}>
                            {getChannelNetwork(channel).protocol !== 'Bitcoin' && (
                              <>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<AccountBalanceWallet />}
                                  onClick={() => openManagementDialog('deposit', channel)}
                                  disabled={!isChannelUpdatable(channel)}
                                >
                                  Deposit
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<CallMade />}
                                  onClick={() => openManagementDialog('withdraw', channel)}
                                  disabled={!isChannelUpdatable(channel)}
                                >
                                  Withdraw
                                </Button>
                              </>
                            )}
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<Close />}
                              onClick={() => openManagementDialog('close', channel)}
                              disabled={!isChannelUpdatable(channel)}
                            >
                              Close
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              startIcon={<Close />}
                              onClick={() => openManagementDialog('force-close', channel)}
                              disabled={isChannelUpdatable(channel)}
                              sx={{ ml: 1 }}
                            >
                              Force Close
                            </Button>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            {activeChannels.map((channel: any, index: number) => (
              <Grid item xs={12} lg={6} xl={4} key={channel.id || index}>
                <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Active Channel {channel.id || `#${index + 1}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Status: {getChannelStatusText(channel.status)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Counterparty: {channel.counterparty || 'Unknown'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          {activeChannels.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No active channels found.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Alert severity="info" sx={{ mt: 2 }}>
            No pending channels found. Check the "All Channels" tab to see channels in various states.
          </Alert>
        </TabPanel>
      </Card>

      {/* Peer Selection Dialog - Simple dialog to select a peer */}
      <Dialog open={openChannelDialog && !selectedPeerForDialog} onClose={handleCloseOpenChannelDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Select Peer to Open Channel</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 1 }}>
            Choose a peer from your connected peers to open a channel with them.
          </Typography>

          {peers.length === 0 ? (
            <Alert severity="info">
              No connected peers found. Please connect to a peer first from the Peers tab.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {peers.map((peer: any, index: number) => {
                const uniqueKey = `${peer.id}-${index}`

                return (
                  <Card
                    key={uniqueKey}
                    elevation={0}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover'
                      }
                    }}
                    onClick={() => handlePeerSelected(peer)}
                  >
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                            {peer.id?.slice(0, 16)}...{peer.id?.slice(-8)}
                          </Typography>
                          {peer.alias && (
                            <Typography variant="caption" color="text.secondary">
                              {peer.alias}
                            </Typography>
                          )}
                        </Box>
                        {peer.network && (
                          <Chip
                            label={getNetworkDisplayName(peer.network)}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor: getNetworkColor(peer.network) + '20',
                              color: getNetworkColor(peer.network),
                              fontWeight: 600
                            }}
                          />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                )
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseOpenChannelDialog}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Open Channel Dialog - Full multi-step dialog for channel opening */}
      <OpenChannelDialog
        open={!!selectedPeerForDialog}
        onClose={handleCloseOpenChannelDialog}
        peer={selectedPeerForDialog}
        availableAssets={availableAssets}
      />

      {/* Channel Management Dialog */}
      <ChannelManagementDialog
        open={managementDialog.open}
        onClose={closeManagementDialog}
        operation={managementDialog.operation}
        channel={managementDialog.channel}
        network={managementDialog.network}
        availableAssets={availableAssets}
      />

      <RentChannelDialog
        open={rentDialog.open}
        onClose={closeRentDialog}
        initialAssetId={rentDialog.assetId}
        initialNetwork={rentDialog.network}
      />
    </Box>
  )
}