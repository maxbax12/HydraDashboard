/**
 * Utility functions for formatting data in the Hydra Dashboard
 */

import { format, formatDistanceToNow } from 'date-fns'

/**
 * Format cryptocurrency amounts
 */
export const formatCryptoAmount = (
  amount: number | string,
  decimals: number = 8
): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(num)) return '0'

  if (num === 0) return '0'

  // For very small amounts, show more decimals
  if (Math.abs(num) < 0.00001) {
    return num.toFixed(decimals)
  }

  // For normal amounts, show reasonable decimals
  if (Math.abs(num) < 1) {
    return num.toFixed(6)
  }

  // For larger amounts, show fewer decimals
  return num.toFixed(4)
}

/**
 * Format USD amounts
 */
export const formatUsdAmount = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(num)) return '$0.00'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Format percentage values
 */
export const formatPercentage = (
  value: number,
  showSign: boolean = true
): string => {
  if (isNaN(value)) return '0%'

  const formatted = Math.abs(value).toFixed(2) + '%'

  if (!showSign) return formatted

  if (value > 0) return `+${formatted}`
  if (value < 0) return `-${formatted}`
  return formatted
}

/**
 * Format timestamps
 */
export const formatTimestamp = (
  timestamp: number | string | Date,
  formatStr: string = 'MMM dd, yyyy HH:mm:ss'
): string => {
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return 'Invalid date'
    return format(date, formatStr)
  } catch {
    return 'Invalid date'
  }
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export const formatRelativeTime = (timestamp: number | string | Date): string => {
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return 'Unknown'
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return 'Unknown'
  }
}

/**
 * Format transaction hashes with ellipsis
 */
export const formatHash = (
  hash: string,
  startChars: number = 6,
  endChars: number = 6
): string => {
  if (!hash || hash.length <= startChars + endChars) {
    return hash || ''
  }

  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`
}

/**
 * Format addresses with ellipsis
 */
export const formatAddress = formatHash

/**
 * Format node IDs with ellipsis
 */
export const formatNodeId = (nodeId: string): string => {
  return formatHash(nodeId, 8, 8)
}

/**
 * Format network names
 */
export const formatNetworkName = (network: string): string => {
  const networkNames: Record<string, string> = {
    bitcoin: 'Bitcoin',
    ethereum: 'Ethereum',
    arbitrum: 'Arbitrum',
    btc: 'Bitcoin',
    eth: 'Ethereum',
    arb: 'Arbitrum',
  }

  return networkNames[network.toLowerCase()] || network
}

/**
 * Format asset symbols
 */
export const formatAssetSymbol = (asset: string): string => {
  return asset.toUpperCase()
}

/**
 * Format channel capacity
 */
export const formatChannelCapacity = (capacity: number | string): string => {
  const num = typeof capacity === 'string' ? parseFloat(capacity) : capacity

  if (isNaN(num)) return '0'

  // Format as BTC for Bitcoin channels, ETH for Ethereum channels
  return formatCryptoAmount(num)
}

/**
 * Format file sizes
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Format numbers with thousand separators
 */
export const formatNumber = (num: number | string): string => {
  const value = typeof num === 'string' ? parseFloat(num) : num

  if (isNaN(value)) return '0'

  return new Intl.NumberFormat('en-US').format(value)
}

/**
 * Format trading pair
 */
export const formatTradingPair = (baseAsset: string, quoteAsset: string): string => {
  return `${formatAssetSymbol(baseAsset)}/${formatAssetSymbol(quoteAsset)}`
}

/**
 * Get status color based on status string
 */
export const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'info' => {
  const statusLower = status.toLowerCase()

  if (['active', 'connected', 'confirmed', 'success', 'completed'].includes(statusLower)) {
    return 'success'
  }

  if (['pending', 'syncing', 'opening', 'closing'].includes(statusLower)) {
    return 'warning'
  }

  if (['failed', 'error', 'disconnected', 'closed'].includes(statusLower)) {
    return 'error'
  }

  return 'info'
}

/**
 * Format log levels for display
 */
export const formatLogLevel = (level: string): string => {
  const levels: Record<string, string> = {
    ERROR: '🔴 ERROR',
    WARNING: '🟡 WARN',
    INFO: '🔵 INFO',
    DEBUG: '🟢 DEBUG',
  }

  return levels[level.toUpperCase()] || level
}