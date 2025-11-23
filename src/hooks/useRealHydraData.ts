/**
 * React hooks for real Hydra gRPC data
 */

import React from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { hydraGrpcClient } from '../services/grpcWebClient'
import { Network, FiatCurrency, Protocol, Asset, NodeEvent, ClientEvent } from '../proto/models'

/**
 * Hook to get real networks from Hydra backend
 */
export function useRealNetworks() {
  return useQuery({
    queryKey: ['hydra', 'networks'],
    queryFn: () => hydraGrpcClient.getNetworks(),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    retry: 3,
  })
}

/**
 * Hook to get real wallet balances from Hydra backend
 */
export function useRealBalances() {
  return useQuery({
    queryKey: ['hydra', 'balances'],
    queryFn: () => hydraGrpcClient.getBalances(),
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

/**
 * Hook to get real channel data from Hydra backend
 */
export function useRealChannels() {
  return useQuery({
    queryKey: ['hydra', 'channels'],
    queryFn: () => hydraGrpcClient.getChannels(),
    refetchInterval: 15000, // Refresh every 15 seconds
    retry: 3,
  })
}

/**
 * Hook to get real peer data from Hydra backend
 */
export function useRealPeers() {
  return useQuery({
    queryKey: ['hydra', 'peers'],
    queryFn: () => hydraGrpcClient.getPeers(),
    refetchInterval: 20000, // Refresh every 20 seconds
    retry: 3,
    staleTime: 5000, // Data is fresh for 5 seconds
  })
}

/**
 * Hook to get real transaction data from Hydra backend
 */
export function useRealTransactions() {
  return useQuery({
    queryKey: ['hydra', 'transactions'],
    queryFn: () => hydraGrpcClient.getTransactions(),
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 3,
  })
}

/**
 * Hook to get real orderbook markets from Hydra backend
 */
export function useRealMarkets() {
  return useQuery({
    queryKey: ['hydra', 'markets'],
    queryFn: () => hydraGrpcClient.getMarkets(),
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: 3,
  })
}

/**
 * Hook to test gRPC connection status
 */
export function useGrpcStatus() {
  return useQuery({
    queryKey: ['hydra', 'grpc-status'],
    queryFn: async () => {
      try {
        await hydraGrpcClient.getBalances()
        return { connected: true, error: null }
      } catch (error) {
        return {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    },
    refetchInterval: 5000, // Check every 5 seconds
    retry: false, // Don't retry for status checks
  })
}

/**
 * Hook to build an asset registry from all networks
 */
export function useAssetRegistry(networks: Network[]) {
  // Helper function to get native symbol based on network
  const getNativeSymbolForNetwork = (network: Network): string => {
    switch (network.id) {
      case '1':
      case '11155111': // Sepolia
        return 'ETH'
      case '137':
      case '80001': // Mumbai
        return 'MATIC'
      case '42161':
      case '421614': // Arbitrum Sepolia
        return 'ETH'
      case '10':
      case '420': // Optimism Goerli
        return 'ETH'
      default:
        return 'ETH' // Default for unknown EVM networks
    }
  }

  return useQuery({
    queryKey: ['hydra', 'asset-registry'],
    queryFn: async () => {
      const assetRegistry: Record<string, { asset: Asset, network: Network }> = {}

      // Get assets from all networks
      for (const network of networks) {
        try {
          const assets = await hydraGrpcClient.getAssets(network)
          console.log(`🏦 Assets returned for ${network.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} network ${network.id}:`, assets)

          // Add each asset to the registry with its network
          for (const asset of assets) {
            // Use network-specific key for zero address to avoid overwrites across networks
            const zeroAddress = '0x0000000000000000000000000000000000000000'
            const assetKey = asset.id === zeroAddress
              ? `${asset.id}-${network.id}`
              : asset.id
            assetRegistry[assetKey] = { asset, network }

            // For zero address, also add a plain entry for easy symbol lookup (first network wins)
            if (asset.id === zeroAddress && !assetRegistry[zeroAddress]) {
              assetRegistry[zeroAddress] = { asset, network }
            }
          }

          // Add native assets if they're missing for EVM networks
          if (network.protocol === Protocol.EVM) {
            const hasNativeAsset = assets.some(asset =>
              asset.symbol === 'ETH' ||
              asset.name?.toLowerCase().includes('ethereum') ||
              asset.id === '0x0000000000000000000000000000000000000000' ||
              asset.id === 'eth'
            )

            if (!hasNativeAsset) {
              const nativeSymbol = getNativeSymbolForNetwork(network)
              // Use zero address with network suffix to avoid overwrites across networks
              const zeroAddress = '0x0000000000000000000000000000000000000000'
              const nativeAssetId = `${zeroAddress}-${network.id}`
              console.log(`🌟 Adding missing native asset ${nativeSymbol} for EVM network ${network.id}`)

              // Store with network-specific key but also add the plain zero address entry
              assetRegistry[nativeAssetId] = {
                asset: {
                  id: zeroAddress, // Use standard zero address as asset ID
                  symbol: nativeSymbol,
                  name: `Native ${nativeSymbol}`,
                  decimals: 18
                },
                network
              }

              // Also add an entry with the zero address as key (will be overwritten by other networks, but that's okay for symbol lookup)
              if (!assetRegistry[zeroAddress]) {
                assetRegistry[zeroAddress] = assetRegistry[nativeAssetId]
              }
            }
          }

          // Add native Bitcoin asset if missing for Bitcoin networks
          if (network.protocol === Protocol.BITCOIN) {
            const hasNativeBitcoin = assets.some(asset =>
              asset.symbol === 'BTC' ||
              asset.name?.toLowerCase().includes('bitcoin') ||
              asset.id === 'btc'
            )

            if (!hasNativeBitcoin) {
              console.log(`🌟 Adding missing native Bitcoin asset for network ${network.id}`)
              const nativeAssetId = `native-btc-${network.id}`

              assetRegistry[nativeAssetId] = {
                asset: {
                  id: nativeAssetId,
                  symbol: 'BTC',
                  name: 'Bitcoin',
                  decimals: 8
                },
                network
              }
            }
          }
        } catch (error) {
          console.log(`❌ AssetService failed for network ${network.id}:`, error)
        }
      }
      console.log(`🏦 Final asset registry:`, assetRegistry)
      return assetRegistry
    },
    enabled: networks.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  })
}

/**
 * Hook to get asset price from Hydra pricing service
 */
export function useAssetPrice(network: Network | undefined, assetId: string, fiatCurrency: FiatCurrency = FiatCurrency.USD) {
  return useQuery({
    queryKey: ['hydra', 'asset-price', network?.id, assetId, fiatCurrency],
    queryFn: () => {
      if (!network) {
        throw new Error('Network is required for price fetching')
      }
      return hydraGrpcClient.getAssetFiatPrice(network, assetId, fiatCurrency)
    },
    enabled: !!network && !!assetId, // Only run if we have network and asset ID
    staleTime: 30000, // Prices are stale after 30 seconds
    retry: 1, // Only retry once for price failures
  })
}

/**
 * Hook to get all asset prices for balance calculation
 */
// Helper function to determine which network an asset belongs to
function getNetworkForAsset(assetId: string, networks: Network[]): Network | undefined {
  // Bitcoin native asset (all zeros) belongs to Bitcoin network
  if (assetId === '0x0000000000000000000000000000000000000000000000000000000000000000' || assetId === '0000000000000000000000000000000000000000000000000000000000000000') {
    return networks.find(n => n.protocol === Protocol.BITCOIN)
  }

  // For other assets (tokens), try EVM networks first
  // In the future, this logic should be improved with proper asset registry
  return networks.find(n => n.protocol === Protocol.EVM) || networks[0]
}

export function useBalanceAssetPrices(balanceData: any, networks: Network[]) {
  // Get the asset registry first
  const { data: assetRegistry, isLoading: registryLoading } = useAssetRegistry(networks)

  // Extract asset information with their potential networks
  const assetEntries = balanceData?.balances ? Object.entries(balanceData.balances) : []


  // Create price queries for each asset using the asset registry
  const priceQueries = useQueries({
    queries: assetEntries.map(([assetId, balance]) => {
      const assetInfo = assetRegistry?.[assetId]
      const network = assetInfo?.network || getNetworkForAsset(assetId, networks) // Fallback to old method

      return {
        queryKey: ['hydra', 'asset-price', network?.id, assetId, FiatCurrency.USD],
        queryFn: async () => {
          if (!network) {
            throw new Error('No network found for asset')
          }

          return await hydraGrpcClient.getAssetFiatPrice(network, assetId, FiatCurrency.USD)
        },
        enabled: !!network && !!assetId && !registryLoading,
        staleTime: 30000,
        retry: 1,
      }
    })
  })

  // Create a map of assetId -> price
  const priceMap = React.useMemo(() => {
    const map: Record<string, number> = {}
    assetEntries.forEach(([assetId], index) => {
      const query = priceQueries[index]
      map[assetId] = query?.data || 0
    })
    return map
  }, [priceQueries, assetEntries])

  const isLoading = registryLoading || priceQueries.some(query => query.isLoading)
  const hasErrors = priceQueries.some(query => query.error)

  return { priceMap, isLoading: isLoading, hasErrors }
}

/**
 * Hook to connect to a peer on a specific network
 */
export function useConnectToPeer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ network, peerUrl }: { network: Network; peerUrl: string }) => {
      return await hydraGrpcClient.connectToPeer(network, peerUrl)
    },
    onSuccess: () => {
      // Invalidate and refetch peers data after successful connection
      queryClient.invalidateQueries({ queryKey: ['hydra', 'peers'] })
      console.log('✅ Peer connected successfully! Refreshing peer list...')

      // Also refresh multiple times to ensure the connection is registered
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['hydra', 'peers'] })
        console.log('🔄 Secondary peer list refresh after connection (2s)')
      }, 2000)

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['hydra', 'peers'] })
        console.log('🔄 Tertiary peer list refresh after connection (5s)')
      }, 5000)
    },
    onError: (error: any) => {
      console.error('❌ Failed to connect to peer:', error)

      // Provide more specific error messages
      if (error.message?.includes('internal server error')) {
        console.error('💡 Peer connection failed: The backend had an internal error. This could mean:')
        console.error('   - The peer is unreachable or offline')
        console.error('   - The peer URL format is incorrect')
        console.error('   - Network connectivity issues')
        console.error('   - The peer is refusing connections')
      }
    },
  })
}

/**
 * Channel Management Hooks
 */

// Hook to open a channel
export function useEstimateOpenChannelFee() {
  return useMutation({
    mutationFn: async ({ network, nodeId, assetAmounts, feeRate }: {
      network: Network;
      nodeId: string;
      assetAmounts: Record<string, any>;
      feeRate: any
    }) => {
      return await hydraGrpcClient.estimateOpenChannelFee(network, nodeId, assetAmounts, feeRate)
    },
    onError: (error: any) => {
      console.error('❌ Failed to estimate open channel fee:', error)
    },
  })
}

export function useOpenChannel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ network, nodeId, assetAmounts, feeRate }: {
      network: Network;
      nodeId: string;
      assetAmounts: Record<string, any>;
      feeRate: any
    }) => {
      return await hydraGrpcClient.openChannel(network, nodeId, assetAmounts, feeRate)
    },
    onSuccess: () => {
      // Invalidate and refetch channels data after successful open
      queryClient.invalidateQueries({ queryKey: ['hydra', 'channels'] })
      console.log('✅ Channel opened successfully! Refreshing channels list...')
    },
    onError: (error: any) => {
      console.error('❌ Failed to open channel:', error)
    },
  })
}

// Hook to deposit to a channel
export function useDepositChannel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ network, channelId, assetAmounts, feeRate }: {
      network: Network;
      channelId: string;
      assetAmounts: Record<string, any>;
      feeRate: any
    }) => {
      return await hydraGrpcClient.depositChannel(network, channelId, assetAmounts, feeRate)
    },
    onSuccess: () => {
      // Invalidate channels and balances data
      queryClient.invalidateQueries({ queryKey: ['hydra', 'channels'] })
      queryClient.invalidateQueries({ queryKey: ['hydra', 'balances'] })
      console.log('✅ Channel deposit successful! Refreshing data...')
    },
    onError: (error: any) => {
      console.error('❌ Failed to deposit to channel:', error)
    },
  })
}

// Hook to withdraw from a channel
export function useWithdrawChannel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ network, channelId, assetAmounts, feeRate }: {
      network: Network;
      channelId: string;
      assetAmounts: Record<string, any>;
      feeRate: any
    }) => {
      return await hydraGrpcClient.withdrawChannel(network, channelId, assetAmounts, feeRate)
    },
    onSuccess: () => {
      // Invalidate channels and balances data
      queryClient.invalidateQueries({ queryKey: ['hydra', 'channels'] })
      queryClient.invalidateQueries({ queryKey: ['hydra', 'balances'] })
      console.log('✅ Channel withdrawal successful! Refreshing data...')
    },
    onError: (error: any) => {
      console.error('❌ Failed to withdraw from channel:', error)
    },
  })
}

// Hook to close a channel
export function useCloseChannel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ network, channelId, assetIds, feeRate }: {
      network: Network;
      channelId: string;
      assetIds: string[];
      feeRate: any
    }) => {
      return await hydraGrpcClient.closeChannel(network, channelId, assetIds, feeRate)
    },
    onSuccess: () => {
      // Invalidate channels and balances data
      queryClient.invalidateQueries({ queryKey: ['hydra', 'channels'] })
      queryClient.invalidateQueries({ queryKey: ['hydra', 'balances'] })
      console.log('✅ Channel closed successfully! Refreshing data...')
    },
    onError: (error: any) => {
      console.error('❌ Failed to close channel:', error)
    },
  })
}

// Hook to force close a channel (unilateral close)
export function useForceCloseChannel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ network, channelId, assetIds, feeRate }: {
      network: Network;
      channelId: string;
      assetIds: string[];
      feeRate: any
    }) => {
      return await hydraGrpcClient.forceCloseChannel(network, channelId, assetIds, feeRate)
    },
    onSuccess: () => {
      // Invalidate channels and balances data
      queryClient.invalidateQueries({ queryKey: ['hydra', 'channels'] })
      queryClient.invalidateQueries({ queryKey: ['hydra', 'balances'] })
      console.log('⚡ Channel force closed successfully! Refreshing data...')
    },
    onError: (error: any) => {
      console.error('❌ Failed to force close channel:', error)
    },
  })
}

// Hook to estimate force close channel fee
export function useEstimateForceCloseChannelFee() {
  return useMutation({
    mutationFn: async ({ network, channelId, assetIds, feeRate }: {
      network: Network;
      channelId: string;
      assetIds: string[];
      feeRate: any
    }) => {
      return await hydraGrpcClient.estimateForceCloseChannelFee(network, channelId, assetIds, feeRate)
    },
    onError: (error: any) => {
      console.error('❌ Failed to estimate force close channel fee:', error)
    },
  })
}

// Hook to get fee estimates for a network
export function useFeeEstimates(network: Network | undefined) {
  return useQuery({
    queryKey: ['hydra', 'fee-estimates', network?.id],
    queryFn: async () => {
      if (!network) {
        throw new Error('Network is required for fee estimates')
      }

      console.log(`⛽ Getting real fee estimates from backend for network ${network.id}`)
      return await hydraGrpcClient.getFeeEstimates(network)
    },
    enabled: !!network,
    staleTime: 30000, // Cache for 30 seconds since fees change frequently
    retry: 2,
  })
}

/**
 * Event Streaming Hooks
 */

// Hook to subscribe to node events for a network
export function useNodeEventStream(network: Network | undefined) {
  const queryClient = useQueryClient()
  const [unsubscribe, setUnsubscribe] = React.useState<(() => void) | null>(null)
  const [isConnected, setIsConnected] = React.useState(false)
  const [lastEvent, setLastEvent] = React.useState<NodeEvent | null>(null)

  React.useEffect(() => {
    if (!network) return

    let mounted = true

    const handleNodeEvent = (event: NodeEvent) => {
      if (!mounted) return

      console.log('🎯 Node event received:', event)
      setLastEvent(event)

      // Invalidate relevant queries based on event type
      if (event.channelUpdate) {
        console.log('📢 Channel updated:', event.channelUpdate.channel?.id)
        // Invalidate channels query to refresh the list
        queryClient.invalidateQueries({ queryKey: ['hydra', 'channels'] })
        // Invalidate balances as channel changes affect balances
        queryClient.invalidateQueries({ queryKey: ['hydra', 'balances'] })
      }

      if (event.channelClosed) {
        console.log('📢 Channel closed:', event.channelClosed.channelId)
        queryClient.invalidateQueries({ queryKey: ['hydra', 'channels'] })
        queryClient.invalidateQueries({ queryKey: ['hydra', 'balances'] })
      }

      if (event.assetChannelUpdate) {
        console.log('📢 Asset channel updated:', event.assetChannelUpdate.channelId, event.assetChannelUpdate.assetId)
        queryClient.invalidateQueries({ queryKey: ['hydra', 'channels'] })
        queryClient.invalidateQueries({ queryKey: ['hydra', 'balances'] })
      }

      if (event.paymentUpdate) {
        console.log('📢 Payment updated:', event.paymentUpdate.payment?.id)
        queryClient.invalidateQueries({ queryKey: ['hydra', 'payments'] })
        queryClient.invalidateQueries({ queryKey: ['hydra', 'balances'] })
      }
    }

    const handleError = (error: Error) => {
      if (!mounted) return
      console.error('❌ Node event stream error:', error)
      setIsConnected(false)
      // Try to reconnect after a delay
      setTimeout(() => {
        if (mounted && network) {
          connectToEvents()
        }
      }, 5000)
    }

    const connectToEvents = async () => {
      try {
        setIsConnected(false)
        const unsub = await hydraGrpcClient.subscribeToNodeEvents(network, handleNodeEvent, handleError)
        if (mounted) {
          setUnsubscribe(() => unsub)
          setIsConnected(true)
          console.log('✅ Connected to node event stream')
        }
      } catch (error) {
        console.error('❌ Failed to connect to node events:', error)
        setIsConnected(false)
      }
    }

    connectToEvents()

    return () => {
      mounted = false
      if (unsubscribe) {
        unsubscribe()
      }
      setIsConnected(false)
    }
  }, [network, queryClient])

  return {
    isConnected,
    lastEvent,
    disconnect: unsubscribe
  }
}

// Hook to subscribe to client events for a network
export function useClientEventStream(network: Network | undefined) {
  const queryClient = useQueryClient()
  const [unsubscribe, setUnsubscribe] = React.useState<(() => void) | null>(null)
  const [isConnected, setIsConnected] = React.useState(false)
  const [lastEvent, setLastEvent] = React.useState<ClientEvent | null>(null)

  React.useEffect(() => {
    if (!network) return

    let mounted = true

    const handleClientEvent = (event: ClientEvent) => {
      if (!mounted) return

      console.log('🎯 Client event received:', event)
      setLastEvent(event)

      // Invalidate relevant queries based on event type
      // (Client events might be different from node events)
      queryClient.invalidateQueries({ queryKey: ['hydra', 'balances'] })
    }

    const handleError = (error: Error) => {
      if (!mounted) return
      console.error('❌ Client event stream error:', error)
      setIsConnected(false)
    }

    const connectToEvents = async () => {
      try {
        setIsConnected(false)
        const unsub = await hydraGrpcClient.subscribeToClientEvents(network, handleClientEvent, handleError)
        if (mounted) {
          setUnsubscribe(() => unsub)
          setIsConnected(true)
          console.log('✅ Connected to client event stream')
        }
      } catch (error) {
        console.error('❌ Failed to connect to client events:', error)
        setIsConnected(false)
      }
    }

    connectToEvents()

    return () => {
      mounted = false
      if (unsubscribe) {
        unsubscribe()
      }
      setIsConnected(false)
    }
  }, [network, queryClient])

  return {
    isConnected,
    lastEvent,
    disconnect: unsubscribe
  }
}

/**
 * Hook to get rental node information
 */
export function useRentalNodeInfo() {
  return useQuery({
    queryKey: ["rentalNodeInfo"],
    queryFn: async () => {
      return await hydraGrpcClient.getRentalNodeInfo()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to get rentable asset information for a specific asset
 */
export function useRentableAssetInfo(network: any, assetId: string, enabled = true) {
  return useQuery({
    queryKey: ["rentableAssetInfo", network?.id, assetId],
    queryFn: async () => {
      if (!network || !assetId) return null
      return await hydraGrpcClient.getRentableAssetInfo(network, assetId)
    },
    enabled: enabled && !!network && !!assetId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to estimate rental channel fee
 */
export function useRentChannelFeeEstimate(
  network: any,
  assetId: string,
  lifetimeSeconds: string,
  amount: string,
  rentalOption: any,
  enabled = true
) {
  return useQuery({
    queryKey: ["rentChannelFeeEstimate", network?.id, assetId, lifetimeSeconds, amount, rentalOption],
    queryFn: async () => {
      if (!network || !assetId || !amount || !rentalOption) return null
      return await hydraGrpcClient.estimateRentChannelFee(network, assetId, lifetimeSeconds, amount, rentalOption)
    },
    enabled: enabled && !!network && !!assetId && !!amount && !!rentalOption,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to rent a channel
 */
export function useRentChannel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ network, assetId, lifetimeSeconds, amount, rentalOption }: {
      network: any
      assetId: string
      lifetimeSeconds: string
      amount: string
      rentalOption: any
    }) => {
      return await hydraGrpcClient.rentChannel(network, assetId, lifetimeSeconds, amount, rentalOption)
    },
    onSuccess: () => {
      // Invalidate channels data to refresh the list
      queryClient.invalidateQueries({ queryKey: ["channels"] })
      queryClient.invalidateQueries({ queryKey: ["balances"] })
    },
  })
}

/**
 * Hook to get initialized markets
 */
export function useInitializedMarkets() {
  return useQuery({
    queryKey: ["initializedMarkets"],
    queryFn: async () => {
      return await hydraGrpcClient.getInitializedMarkets()
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to get all markets info
 */
export function useMarketsInfo() {
  return useQuery({
    queryKey: ["marketsInfo"],
    queryFn: async () => {
      return await hydraGrpcClient.getMarketsInfo()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to get specific market info
 */
export function useMarketInfo(baseCurrency: any, quoteCurrency: any, enabled = true) {
  return useQuery({
    queryKey: ["marketInfo", baseCurrency?.asset_id, quoteCurrency?.asset_id],
    queryFn: async () => {
      if (!baseCurrency || !quoteCurrency) return null
      return await hydraGrpcClient.getMarketInfo(baseCurrency, quoteCurrency)
    },
    enabled: enabled && !!baseCurrency && !!quoteCurrency,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to initialize a market
 */
export function useInitMarket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ baseCurrency, quoteCurrency }: {
      baseCurrency: any
      quoteCurrency: any
    }) => {
      return await hydraGrpcClient.initMarket(baseCurrency, quoteCurrency)
    },
    onSuccess: () => {
      // Invalidate markets data to refresh the lists
      queryClient.invalidateQueries({ queryKey: ["initializedMarkets"] })
      queryClient.invalidateQueries({ queryKey: ["marketsInfo"] })
    },
  })
}
