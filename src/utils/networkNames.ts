/**
 * Centralized utility for network name mappings
 */

export const getNetworkName = (networkId: string, protocol?: number): string => {
  if (protocol === 0) return 'Bitcoin'

  if (protocol === 1) {
    // Map EVM network IDs to names
    switch (networkId) {
      // Mainnets
      case '1': return 'Ethereum'
      case '137': return 'Polygon'
      case '42161': return 'Arbitrum'
      case '10': return 'Optimism'
      case '8453': return 'Base'
      case '43114': return 'Avalanche'
      case '56': return 'BNB Chain'

      // Testnets
      case '5': return 'Goerli'
      case '11155111': return 'Ethereum Sepolia'
      case '80001': return 'Mumbai'
      case '80002': return 'Amoy'
      case '421614': return 'Arbitrum Sepolia'
      case '420': return 'Optimism Goerli'
      case '11155420': return 'Optimism Sepolia'
      case '84532': return 'Base Sepolia'
      case '43113': return 'Fuji'
      case '97': return 'BNB Testnet'

      default: return `EVM ${networkId}`
    }
  }

  return networkId
}

export const getNetworkDisplayName = (network: any): string => {
  if (!network) return 'Unknown'
  return getNetworkName(network.id || network.networkId, network.protocol)
}

// Helper to format network for display with protocol info
export const getNetworkWithProtocol = (network: any): string => {
  const name = getNetworkDisplayName(network)
  const protocolName = network.protocol === 0 ? 'Bitcoin' : 'EVM'
  return name === 'Unknown' ? protocolName : name
}