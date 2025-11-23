import React, { useState, useEffect } from 'react'
import { Box, Typography, Grid, Card, CardContent, Chip, LinearProgress, CircularProgress, Alert } from '@mui/material'
import { CheckCircle, Error, Pending } from '@mui/icons-material'
import { useRealNetworks } from '../hooks/useRealHydraData'
import { hydraGrpcClient } from '../services/grpcWebClient'

// Helper to get network display name
function getNetworkDisplayName(protocol: number, id: string): string {
  const knownNetworks: Record<string, string> = {
    // Bitcoin networks
    'f9beb4d9': 'Bitcoin Mainnet',
    '0b110907': 'Bitcoin Testnet3',
    '1c163f28': 'Bitcoin Testnet4',
    '0a03cf40': 'Bitcoin Signet',
    'fabfb5da': 'Bitcoin Regtest',
    // EVM networks
    '1': 'Ethereum Mainnet',
    '42161': 'Arbitrum One',
    '10': 'Optimism',
    '56': 'Binance Smart Chain',
    '137': 'Polygon',
    '43114': 'Avalanche',
    '11155111': 'Ethereum Sepolia',
    '421614': 'Arbitrum Sepolia'
  }

  return knownNetworks[id] || `${protocol === 0 ? 'Bitcoin' : 'EVM'} ${id}`
}

export default function NetworksTab() {
  const { data: networks = [], isLoading, error } = useRealNetworks()
  const [networkAddresses, setNetworkAddresses] = useState<Record<string, string>>({})
  const [loadingAddresses, setLoadingAddresses] = useState(true)

  // Fetch deposit addresses for all networks
  useEffect(() => {
    const fetchAddresses = async () => {
      if (networks.length === 0) {
        setLoadingAddresses(false)
        return
      }

      console.log('🔍 Fetching deposit addresses for', networks.length, 'networks')
      const addresses: Record<string, string> = {}

      for (const network of networks) {
        try {
          console.log('📡 Fetching address for network:', network.id, 'protocol:', network.protocol)
          const address = await hydraGrpcClient.getDepositAddress(network)
          console.log('✅ Got address for', network.id, ':', address)
          addresses[network.id] = address
        } catch (error: any) {
          console.error(`❌ Failed to fetch address for network ${network.id}:`, error)
          addresses[network.id] = 'Error'
        }
      }

      console.log('📦 All addresses fetched:', addresses)
      setNetworkAddresses(addresses)
      setLoadingAddresses(false)
    }

    fetchAddresses()
  }, [networks])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle color="success" />
      case 'syncing':
        return <Pending color="warning" />
      case 'disconnected':
        return <Error color="error" />
      default:
        return <CheckCircle color="success" /> // Default to connected for real networks
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'success'
      case 'syncing':
        return 'warning'
      case 'disconnected':
        return 'error'
      default:
        return 'success' // Default to success for real networks
    }
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
          Networks
        </Typography>
        <Alert severity="error">
          Failed to load networks: {error.message}
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Networks
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        Monitor and manage connections to supported blockchain networks ({networks.length} configured)
      </Typography>

      {networks.length === 0 ? (
        <Alert severity="info">
          No networks are currently configured in your Hydra backend.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {networks.map((network: any, index: number) => (
            <Grid item xs={12} md={4} key={network.id}>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider', height: '100%' }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {getNetworkDisplayName(network.protocol, network.id)}
                    </Typography>
                    {getStatusIcon('connected')}
                  </Box>

                  <Chip
                    label="ACTIVE"
                    size="small"
                    color="success"
                    sx={{ mb: 2 }}
                  />

                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Protocol
                    </Typography>
                    <Typography variant="body1">
                      {network.protocol === 0 ? 'Bitcoin' : 'EVM'}
                    </Typography>
                  </Box>

                  <Box mb={1}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Network ID
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        wordBreak: 'break-all'
                      }}
                    >
                      {network.id}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Wallet Address
                    </Typography>
                    {loadingAddresses ? (
                      <CircularProgress size={16} />
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          wordBreak: 'break-all',
                          color: networkAddresses[network.id] === 'Error' ? 'error.main' : 'text.primary'
                        }}
                      >
                        {networkAddresses[network.id] || 'Loading...'}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}