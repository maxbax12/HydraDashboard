import React, { useState } from 'react'
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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Tooltip,
  Alert
} from '@mui/material'
import {
  Add,
  Devices,
  CheckCircle,
  Error,
  Delete,
  Refresh,
  Link,
  LinkOff
} from '@mui/icons-material'
import OpenChannelDialog from '../components/OpenChannelDialog'
import { useRealPeers, useConnectToPeer, useRealNetworks, useAssetRegistry, useRealChannels } from '@/hooks/useRealHydraData'
import { formatRelativeTime, getStatusColor } from '@/utils/formatting'
import { Network, Protocol } from '@/proto/models'

// Mock peer data for development
const mockPeers = [
  {
    id: '03abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234567890',
    address: '123.45.67.89:9735',
    isConnected: true,
    network: 'bitcoin',
    lastSeen: Date.now() - 300000, // 5 minutes ago
    channels: 2,
    alias: 'Lightning Node 1'
  },
  {
    id: '02efgh5678901234efgh5678901234efgh5678901234efgh5678901234efgh5678901234',
    address: '198.51.100.123:9735',
    isConnected: true,
    network: 'ethereum',
    lastSeen: Date.now() - 120000, // 2 minutes ago
    channels: 1,
    alias: 'ETH Node'
  },
  {
    id: '01ijkl9012345678ijkl9012345678ijkl9012345678ijkl9012345678ijkl9012345678',
    address: '203.0.113.45:8080',
    isConnected: false,
    network: 'arbitrum',
    lastSeen: Date.now() - 3600000, // 1 hour ago
    channels: 0,
    alias: 'ARB Peer'
  },
  {
    id: '04mnop3456789012mnop3456789012mnop3456789012mnop3456789012mnop3456789012',
    address: '192.0.2.78:9735',
    isConnected: true,
    network: 'bitcoin',
    lastSeen: Date.now() - 60000, // 1 minute ago
    channels: 3,
    alias: null
  }
]

// Standard peer recommendations (from backend)
const recommendedPeers = [
  {
    nodeId: '034795b99732e3c63d23a5cd8f1895681c925a28ee143278d5fbd137a3ffb1f791',
    alias: 'Bitcoin Signet Peer',
    network: 'bitcoin',
    address: '37.27.36.2:31379',
    description: 'Standard Bitcoin Signet test network peer'
  },
  {
    nodeId: '0x114b636eb40b3a8637d6273c67da40ab95b2714c',
    alias: 'Ethereum Sepolia Peer',
    network: 'ethereum',
    address: '37.27.36.2:32247',
    description: 'Standard Ethereum Sepolia test network peer'
  },
  {
    nodeId: '0x114b636eb40b3a8637d6273c67da40ab95b2714c',
    alias: 'Arbitrum Sepolia Peer',
    network: 'arbitrum',
    address: '37.27.36.2:30597',
    description: 'Standard Arbitrum Sepolia test network peer'
  }
]

export default function PeersTab() {
  const [connectDialogOpen, setConnectDialogOpen] = React.useState(false)
  const [connectionError, setConnectionError] = React.useState<string | null>(null)
  const [connectionSuccess, setConnectionSuccess] = React.useState<string | null>(null)
  const [newPeerData, setNewPeerData] = React.useState({
    address: '',
    network: 'bitcoin'
  })

  // Open Channel dialog state
  const [openChannelDialog, setOpenChannelDialog] = useState({
    open: false,
    peer: null as any
  })

  const { data: peersResponse, isLoading, error, refetch } = useRealPeers()
  const { data: networksResponse } = useRealNetworks()
  const networks = networksResponse || []
  const { data: assetRegistry } = useAssetRegistry(networks)
  const availableAssets = assetRegistry ? Object.values(assetRegistry) : []
  const connectPeerMutation = useConnectToPeer()
  const { refetch: refetchChannels } = useRealChannels()
  console.log('🌐 Available networks for peer connection:', networks)
  console.log('🏦 Asset registry data:', assetRegistry)
  console.log('📦 Available assets for channel opening:', availableAssets)

  // Helper function to map network string to Network object
  const getNetworkFromString = (networkStr: string, availableNetworks: Network[]): Network | undefined => {
    console.log(`🔍 Mapping network string "${networkStr}" to available networks:`, availableNetworks)

    // First, try exact matching based on known network IDs or names
    const lowerStr = networkStr.toLowerCase()

    // Try to find by protocol first, then by specific network characteristics
    let targetNetwork: Network | undefined

    if (lowerStr === 'bitcoin') {
      // Find Bitcoin network (protocol BITCOIN)
      targetNetwork = availableNetworks.find(n => n.protocol === Protocol.BITCOIN)
    } else if (lowerStr === 'ethereum') {
      // Find Ethereum network (protocol EVM with known Ethereum network IDs)
      targetNetwork = availableNetworks.find(n =>
        n.protocol === Protocol.EVM &&
        (n.id === '1' || n.id === '11155111') // Mainnet or Sepolia
      )
    } else if (lowerStr === 'arbitrum') {
      // Find Arbitrum network (protocol EVM with known Arbitrum network IDs)
      targetNetwork = availableNetworks.find(n =>
        n.protocol === Protocol.EVM &&
        (n.id === '42161' || n.id === '421614') // Mainnet or Sepolia
      )
    }

    // Fallback: if no specific match, use first network of the right protocol
    if (!targetNetwork) {
      const protocolMap: Record<string, Protocol> = {
        'bitcoin': Protocol.BITCOIN,
        'ethereum': Protocol.EVM,
        'arbitrum': Protocol.EVM
      }

      const protocol = protocolMap[lowerStr]
      if (protocol !== undefined) {
        targetNetwork = availableNetworks.find(n => n.protocol === protocol)
      }
    }

    console.log(`🎯 Mapped "${networkStr}" to network:`, targetNetwork)
    return targetNetwork
  }

  // Extract peers - the gRPC client now returns peers with network information
  const peersData = Array.isArray(peersResponse) ? peersResponse : []
  const peers = peersData.map((peerInfo: any) => {
    // Try to find matching recommended peer for address info
    const recommendedPeer = recommendedPeers.find(rec => rec.nodeId === peerInfo.id)

    return {
      id: peerInfo.id,
      isConnected: true, // If in the list, they're connected
      address: recommendedPeer ? recommendedPeer.address : 'Unknown',
      network: peerInfo.networkName || 'Unknown',
      networkObj: peerInfo.network,
      lastSeen: Date.now(),
      channels: 0, // Would need channel correlation
      alias: recommendedPeer ? recommendedPeer.alias : null
    }
  })
  const connectedPeers = peers.filter((peer: any) => peer.isConnected)
  const totalChannels = peers.reduce((sum: number, peer: any) => sum + (peer.channels || 0), 0)

  // Helper function to check if a recommended peer is already connected on the specific network
  const isPeerConnected = (nodeId: string, networkName: string): boolean => {
    // Check if this specific nodeId is connected on this specific network
    return peers.some((peer: any) => {
      if (peer.id !== nodeId) return false

      // Map the recommended peer network name to the actual network name format
      const targetNetworkName = getTargetNetworkName(networkName)
      return peer.network === targetNetworkName
    })
  }

  // Helper to map recommended peer network names to actual network names
  const getTargetNetworkName = (recommendedNetwork: string): string => {
    switch (recommendedNetwork.toLowerCase()) {
      case 'bitcoin':
        return networks.find(n => n.protocol === Protocol.BITCOIN)
          ? `Bitcoin ${networks.find(n => n.protocol === Protocol.BITCOIN)?.id}`
          : 'Bitcoin'
      case 'ethereum':
        return networks.find(n => n.protocol === Protocol.EVM && n.id === '11155111')
          ? 'EVM 11155111'
          : 'Ethereum'
      case 'arbitrum':
        return networks.find(n => n.protocol === Protocol.EVM && n.id === '421614')
          ? 'EVM 421614'
          : 'Arbitrum'
      default:
        return recommendedNetwork
    }
  }

  const handleConnectPeer = async () => {
    try {
      setConnectionError(null)
      setConnectionSuccess(null)

      // Map the network string to Network object
      const networkObj = getNetworkFromString(newPeerData.network, networks)
      if (!networkObj) {
        setConnectionError('Invalid network selected')
        return
      }

      await connectPeerMutation.mutateAsync({
        network: networkObj,
        peerUrl: newPeerData.address
      })
      setConnectDialogOpen(false)
      setNewPeerData({ address: '', network: 'bitcoin' })
      setConnectionSuccess(`Successfully connected to peer: ${newPeerData.address}`)
      refetch()
      // Also refresh channels after connecting to a peer
      refetchChannels()
    } catch (error: any) {
      console.error('Failed to connect peer:', error)
      if (error.message?.includes('internal server error')) {
        setConnectionError('Connection failed: The peer may be unreachable, offline, or the address format is incorrect.')
      } else {
        setConnectionError(`Connection failed: ${error.message || 'Unknown error'}`)
      }
    }
  }

  const handleConnectRecommended = async (nodeId: string, address: string, network: string) => {
    try {
      setConnectionError(null)
      setConnectionSuccess(null)

      // Map the network string to Network object
      const networkObj = getNetworkFromString(network, networks)
      if (!networkObj) {
        setConnectionError(`Invalid network for recommended peer: ${network}`)
        return
      }

      await connectPeerMutation.mutateAsync({
        network: networkObj,
        peerUrl: `${nodeId}@${address}`
      })
      setConnectionSuccess(`Successfully connected to ${network} peer at ${address}`)
      refetch()
      // Also refresh channels after connecting to a peer
      refetchChannels()
    } catch (error: any) {
      console.error('Failed to connect to recommended peer:', error)
      if (error.message?.includes('internal server error')) {
        setConnectionError('Connection to recommended peer failed: The peer may be unreachable or offline.')
      } else {
        setConnectionError(`Failed to connect: ${error.message || 'Unknown error'}`)
      }
    }
  }

  const handleDisconnectPeer = (peerId: string) => {
    // Implementation would call disconnect mutation
    console.log('Disconnect peer:', peerId)
    refetch()
  }

  // Open Channel dialog functions
  const handleOpenChannel = (peer: any) => {
    setOpenChannelDialog({
      open: true,
      peer
    })
  }

  const closeOpenChannelDialog = () => {
    setOpenChannelDialog({
      open: false,
      peer: null
    })
  }

  const getNetworkColor = (network: string) => {
    const lowerNetwork = network.toLowerCase()
    if (lowerNetwork.includes('bitcoin')) {
      return '#f7931a'
    } else if (lowerNetwork.includes('evm')) {
      // Try to determine specific EVM network by network ID
      if (lowerNetwork.includes('11155111')) {
        return '#627eea' // Ethereum Sepolia
      } else if (lowerNetwork.includes('421614')) {
        return '#28a0f0' // Arbitrum Sepolia
      } else {
        return '#627eea' // Default EVM color
      }
    }
    return '#666'
  }

  const getNetworkDisplayName = (network: string) => {
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

  const getStatusIcon = (isConnected: boolean) => {
    return isConnected ? (
      <CheckCircle color="success" fontSize="small" />
    ) : (
      <Error color="error" fontSize="small" />
    )
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
          Peers
        </Typography>
        <Alert severity="error">
          Failed to load peers: {error.message}
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Network Peers
        </Typography>

        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => refetch()}
            disabled={isLoading || connectPeerMutation.isPending}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setConnectDialogOpen(true)}
          >
            Connect Peer
          </Button>
        </Box>
      </Box>

      {/* Connection Status Alerts */}
      {connectionError && (
        <Alert severity="error" onClose={() => setConnectionError(null)} sx={{ mb: 3 }}>
          {connectionError}
        </Alert>
      )}
      {connectionSuccess && (
        <Alert severity="success" onClose={() => setConnectionSuccess(null)} sx={{ mb: 3 }}>
          {connectionSuccess}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Devices sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Total Peers</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>
                {peers.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <CheckCircle sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Connected</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'success.main' }}>
                {connectedPeers.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Networks</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>
                {new Set(peers.map((p: any) => p.network)).size}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Active Channels</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {totalChannels}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Current Peers */}
        <Grid item xs={12} lg={8}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                Connected Peers
              </Typography>

              <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Status</TableCell>
                      <TableCell>Alias / Node ID</TableCell>
                      <TableCell>Network</TableCell>
                      <TableCell>Address</TableCell>
                      <TableCell>Channels</TableCell>
                      <TableCell>Last Seen</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {peers.map((peer: any) => (
                      <TableRow key={`${peer.id}-${peer.network}`} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            {getStatusIcon(peer.isConnected)}
                            <Chip
                              label={peer.isConnected ? 'CONNECTED' : 'OFFLINE'}
                              size="small"
                              color={peer.isConnected ? 'success' : 'error'}
                            />
                          </Box>
                        </TableCell>

                        <TableCell>
                          <Box>
                            {peer.alias && (
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {peer.alias}
                              </Typography>
                            )}
                            <Typography
                              variant="caption"
                              sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                            >
                              {peer.id.slice(0, 16)}...
                            </Typography>
                          </Box>
                        </TableCell>

                        <TableCell>
                          <Chip
                            label={getNetworkDisplayName(peer.network)}
                            size="small"
                            sx={{
                              backgroundColor: getNetworkColor(peer.network) + '20',
                              color: getNetworkColor(peer.network),
                              fontWeight: 600
                            }}
                          />
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {peer.address}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {peer.channels || 0}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatRelativeTime(peer.lastSeen)}
                          </Typography>
                        </TableCell>

                        <TableCell align="center">
                          <Box display="flex" gap={1}>
                            {peer.isConnected ? (
                              <Tooltip title="Disconnect">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDisconnectPeer(peer.id)}
                                >
                                  <LinkOff fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Reconnect">
                                <IconButton
                                  size="small"
                                  onClick={() => handleConnectRecommended(peer.id, peer.address, peer.network)}
                                >
                                  <Link fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            {peer.isConnected && (
                              <Tooltip title="Open Channel">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleOpenChannel(peer)}
                                >
                                  <Add fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            <Tooltip title="Remove">
                              <IconButton size="small" color="error">
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Recommended Peers */}
        <Grid item xs={12} lg={4}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                Recommended Peers
              </Typography>

              {recommendedPeers.map((rec, index) => (
                <Card
                  key={index}
                  elevation={0}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    mb: 2,
                    '&:hover': { borderColor: 'primary.main' }
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {rec.alias}
                      </Typography>
                      <Chip
                        label={rec.network.toUpperCase()}
                        size="small"
                        sx={{
                          backgroundColor: getNetworkColor(rec.network) + '20',
                          color: getNetworkColor(rec.network),
                          fontSize: '0.7rem'
                        }}
                      />
                    </Box>

                    <Typography variant="caption" color="text.secondary" paragraph>
                      {rec.description}
                    </Typography>

                    {isPeerConnected(rec.nodeId, rec.network) ? (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        fullWidth
                        disabled
                      >
                        Already Connected
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        fullWidth
                        onClick={() => handleConnectRecommended(rec.nodeId, rec.address, rec.network)}
                        disabled={connectPeerMutation.isPending}
                      >
                        {connectPeerMutation.isPending ? 'Connecting...' : 'Connect'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Connect Peer Dialog */}
      <Dialog open={connectDialogOpen} onClose={() => setConnectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Connect New Peer</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Peer Address"
            fullWidth
            variant="outlined"
            value={newPeerData.address}
            onChange={(e) => setNewPeerData({ ...newPeerData, address: e.target.value })}
            placeholder="nodeId@host:port or host:port"
            sx={{ mt: 2, mb: 2 }}
            helperText="Format: 03abcd...@123.45.67.89:9735 or just 123.45.67.89:9735"
          />

          <FormControl fullWidth variant="outlined">
            <InputLabel>Network</InputLabel>
            <Select
              value={newPeerData.network}
              onChange={(e) => setNewPeerData({ ...newPeerData, network: e.target.value })}
              label="Network"
            >
              <MenuItem value="bitcoin">Bitcoin</MenuItem>
              <MenuItem value="ethereum">Ethereum</MenuItem>
              <MenuItem value="arbitrum">Arbitrum</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConnectDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConnectPeer}
            variant="contained"
            disabled={!newPeerData.address || connectPeerMutation.isPending}
          >
            {connectPeerMutation.isPending ? 'Connecting...' : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Open Channel Dialog */}
      <OpenChannelDialog
        open={openChannelDialog.open}
        onClose={closeOpenChannelDialog}
        peer={openChannelDialog.peer}
        availableAssets={availableAssets}
      />
    </Box>
  )
}