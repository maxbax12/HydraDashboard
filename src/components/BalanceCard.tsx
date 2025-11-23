import React from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material'
import { Refresh, TrendingUp, TrendingDown } from '@mui/icons-material'
import { formatCryptoAmount, formatUsdAmount, formatPercentage } from '@/utils/formatting'

interface BalanceCardProps {
  asset: string
  onChain: number
  offChain: number
  total: number
  usdValue: number
  change24h?: number
  isLoading?: boolean
  onRefresh?: () => void
}

export default function BalanceCard({
  asset,
  onChain,
  offChain,
  total,
  usdValue,
  change24h,
  isLoading = false,
  onRefresh
}: BalanceCardProps) {
  const onChainPercentage = total > 0 ? (onChain / total) * 100 : 0
  const offChainPercentage = total > 0 ? (offChain / total) * 100 : 0

  const getTrendIcon = () => {
    if (!change24h) return null
    return change24h >= 0 ?
      <TrendingUp color="success" sx={{ fontSize: 16 }} /> :
      <TrendingDown color="error" sx={{ fontSize: 16 }} />
  }

  const getTrendColor = () => {
    if (!change24h) return 'text.secondary'
    return change24h >= 0 ? 'success.main' : 'error.main'
  }

  return (
    <Card
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        height: '100%',
        position: 'relative'
      }}
    >
      {isLoading && (
        <LinearProgress
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2
          }}
        />
      )}

      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {asset.toUpperCase()}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
              {formatCryptoAmount(total)}
            </Typography>
          </Box>

          {onRefresh && (
            <Tooltip title="Refresh Balance">
              <IconButton
                size="small"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box mb={2}>
          <Typography variant="h6" color="primary">
            {formatUsdAmount(usdValue)}
          </Typography>

          {change24h !== undefined && (
            <Box display="flex" alignItems="center" mt={0.5}>
              {getTrendIcon()}
              <Typography
                variant="body2"
                color={getTrendColor()}
                sx={{ ml: 0.5, fontWeight: 500 }}
              >
                {formatPercentage(change24h)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                24h
              </Typography>
            </Box>
          )}
        </Box>

        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" color="text.secondary">
              On-chain
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {formatCryptoAmount(onChain)} ({onChainPercentage.toFixed(1)}%)
            </Typography>
          </Box>

          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" color="text.secondary">
              Off-chain
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {formatCryptoAmount(offChain)} ({offChainPercentage.toFixed(1)}%)
            </Typography>
          </Box>
        </Box>

        <Box>
          <LinearProgress
            variant="determinate"
            value={onChainPercentage}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
              }
            }}
          />
          <Box display="flex" justifyContent="space-between" mt={1}>
            <Chip
              label="On-chain"
              size="small"
              variant="outlined"
              color="primary"
            />
            <Chip
              label="Off-chain"
              size="small"
              variant="outlined"
              sx={{
                borderColor: 'rgba(0, 0, 0, 0.12)',
                color: 'text.secondary'
              }}
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}