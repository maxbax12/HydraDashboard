import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Grid,
  Alert,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup
} from '@mui/material'
import { HomeWork, Schedule, Payment } from '@mui/icons-material'
import {
  useRentalNodeInfo,
  useRentableAssetInfo,
  useRentChannelFeeEstimate,
  useRentChannel,
  useRealNetworks,
  useAssetRegistry,
  useRealBalances,
  useFeeEstimates
} from '../hooks/useRealHydraData'
import { PaymentMethod } from '../proto/rental'
import { formatCryptoAmount } from '@/utils/formatting'
import { getNetworkDisplayName } from '@/utils/networkNames'

interface RentChannelDialogProps {
  open: boolean
  onClose: () => void
  initialAssetId?: string
  initialNetwork?: any
}

export default function RentChannelDialog({ open, onClose, initialAssetId = '', initialNetwork = null }: RentChannelDialogProps) {
  const [formData, setFormData] = useState({
    network: initialNetwork,
    assetId: initialAssetId,
    amount: '',
    duration: '86400', // 1 day in seconds
    paymentMethod: 'OFFCHAIN' as 'ONCHAIN' | 'OFFCHAIN', // Only offchain available now
    paymentAssetId: '',
    paymentNetwork: null as any
  })

  const [rentalOption, setRentalOption] = useState<any>(null)

  // Hooks
  const { data: networksResponse } = useRealNetworks()
  const networks = networksResponse || []
  const { data: assetRegistry } = useAssetRegistry(networks)
  const { data: rentalNodeInfo } = useRentalNodeInfo()
  const { data: balances } = useRealBalances()
  const { data: rentableAssetInfo, isLoading: loadingAssetInfo } = useRentableAssetInfo(
    formData.network,
    formData.assetId,
    !!formData.network && !!formData.assetId
  )

  // Get fee estimates for the rental network (where the channel will be opened)
  const { data: rentalNetworkFeeEstimates } = useFeeEstimates(formData.network)

  // Fee estimation now requires payment details (backend requires rental option)
  const feeEstimationEnabled = !!formData.network && !!formData.assetId && !!formData.amount && parseFloat(formData.amount) > 0 && !!rentalOption
  console.log('🏠 [DEBUG] Fee estimation enabled:', feeEstimationEnabled, {
    network: !!formData.network,
    assetId: !!formData.assetId,
    amount: !!formData.amount,
    amountValid: parseFloat(formData.amount) > 0,
    rentalOption: !!rentalOption,
    actualAssetId: formData.assetId,
    isZeroAddress: formData.assetId === '0x0000000000000000000000000000000000000000'
  })

  const { data: feeEstimate, isLoading: loadingFee } = useRentChannelFeeEstimate(
    formData.network,
    formData.assetId,
    formData.duration,
    formData.amount,
    rentalOption, // Backend requires rental option
    feeEstimationEnabled
  )

  console.log('🏠 [DEBUG] Fee estimation result:', { feeEstimate, loadingFee })

  // Create rental option only when user selects payment method (for final rental)
  useEffect(() => {
    if (formData.paymentMethod && formData.paymentAssetId && formData.paymentNetwork && rentalNetworkFeeEstimates) {
      // Use medium fee rate from rental network fee estimates
      const mediumFeeRate = rentalNetworkFeeEstimates.medium || {
        maxTipFeePerUnit: { value: '1000000000' }, // Fallback: 1 Gwei tip
        maxFeePerUnit: { value: '2000000000' }      // Fallback: 2 Gwei max fee
      }

      const option = {
        payment: {
          rentalTxFeeRate: {
            maxTipFeePerUnit: mediumFeeRate.maxTipFeePerUnit,
            maxFeePerUnit: mediumFeeRate.maxFeePerUnit || mediumFeeRate.maxPricePerUnit // Handle both field names
          },
          paymentNetwork: formData.paymentNetwork,
          paymentAssetId: formData.paymentAssetId,
          paymentMethod: formData.paymentMethod === 'ONCHAIN' ? PaymentMethod.ONCHAIN : PaymentMethod.OFFCHAIN
        }
      }
      console.log('🏠 [DEBUG] Creating rental option with fee estimates:')
      console.log('   Rental network fee estimates:', rentalNetworkFeeEstimates)
      console.log('   Using medium fee rate:', mediumFeeRate)
      console.log('   Payment network:', formData.paymentNetwork)
      console.log('   Payment asset ID:', formData.paymentAssetId)
      console.log('   Payment method:', formData.paymentMethod)
      console.log('   Final rental option:', option)
      setRentalOption(option)
    }
  }, [formData.paymentMethod, formData.paymentAssetId, formData.paymentNetwork, rentalNetworkFeeEstimates])

  const rentChannelMutation = useRentChannel()

  // Get available assets for the selected network from rental node info
  const availableAssets = useMemo(() => {
    if (!rentalNodeInfo?.rentalAssets) return []

    // If no network selected, show all assets for debugging
    if (!formData.network) {
      return rentalNodeInfo.rentalAssets.map((rentalAsset: any) => {
        const assetInfo = assetRegistry?.[rentalAsset.assetId]
        return {
          id: rentalAsset.assetId,
          symbol: assetInfo?.asset?.symbol || assetInfo?.symbol || rentalAsset.assetId.slice(0, 8),
          rentalFeeRatio: rentalAsset.rentalFeeRatio,
          network: rentalAsset.network
        }
      })
    }

    // Filter rental assets for selected network (check both protocol and id)
    // Normalize network IDs by removing '0x' prefix if present for comparison
    const normalizeNetworkId = (id: string) => id?.toLowerCase().replace(/^0x/, '')

    const networkRentalAssets = rentalNodeInfo.rentalAssets.filter(
      (rentalAsset: any) => {
        const rentalNetworkId = normalizeNetworkId(rentalAsset.network?.id)
        const selectedNetworkId = normalizeNetworkId(formData.network?.id)
        return rentalNetworkId === selectedNetworkId &&
               rentalAsset.network?.protocol === formData.network?.protocol
      }
    )

    // If no matches, try different comparison methods (for debugging)
    if (networkRentalAssets.length === 0) {
      console.log('🏠 No matches with network.id + protocol, trying alternative comparisons...')
      console.log('🏠 Selected network:', formData.network)
      console.log('🏠 Selected network protocol:', formData.network?.protocol, 'id:', formData.network?.id)
      console.log('🏠 Rental assets:', rentalNodeInfo.rentalAssets)

      // Log each rental asset's network details
      rentalNodeInfo.rentalAssets.forEach((rentalAsset: any, idx: number) => {
        console.log(`🏠 Rental asset ${idx}:`)
        console.log(`   AssetId: ${rentalAsset.assetId}`)
        console.log(`   Network protocol: ${rentalAsset.network?.protocol} (type: ${typeof rentalAsset.network?.protocol})`)
        console.log(`   Network id: ${rentalAsset.network?.id} (type: ${typeof rentalAsset.network?.id})`)
        console.log(`   Protocol match: ${rentalAsset.network?.protocol === formData.network?.protocol}`)
        console.log(`   ID match: ${rentalAsset.network?.id === formData.network?.id}`)
      })

      // Try string comparison with protocol and normalized IDs
      const stringMatches = rentalNodeInfo.rentalAssets.filter(
        (rentalAsset: any) => {
          const rentalNetworkId = normalizeNetworkId(String(rentalAsset.network?.id))
          const selectedNetworkId = normalizeNetworkId(String(formData.network?.id))
          return rentalNetworkId === selectedNetworkId &&
                 rentalAsset.network?.protocol === formData.network?.protocol
        }
      )
      console.log('🏠 String comparison matches:', stringMatches.length)

      if (stringMatches.length > 0) {
        return stringMatches.map((rentalAsset: any) => {
          const assetInfo = assetRegistry?.[rentalAsset.assetId]
          return {
            id: rentalAsset.assetId,
            symbol: assetInfo?.asset?.symbol || assetInfo?.symbol || rentalAsset.assetId.slice(0, 8),
            rentalFeeRatio: rentalAsset.rentalFeeRatio,
            network: rentalAsset.network
          }
        })
      }
    }

    // Map to asset info with symbols from registry
    return networkRentalAssets.map((rentalAsset: any) => {
      const assetInfo = assetRegistry?.[rentalAsset.assetId]
      return {
        id: rentalAsset.assetId,
        symbol: assetInfo?.asset?.symbol || assetInfo?.symbol || rentalAsset.assetId.slice(0, 8),
        rentalFeeRatio: rentalAsset.rentalFeeRatio,
        network: rentalAsset.network
      }
    })
  }, [rentalNodeInfo, formData.network, assetRegistry])

  // Debug logging for rental assets
  useEffect(() => {
    if (rentalNodeInfo?.rentalAssets) {
      console.log('🏠 Rental Node Info:', rentalNodeInfo)
      console.log('🏠 Available Rental Assets:', rentalNodeInfo.rentalAssets)
      console.log('🏠 Available Assets for current network:', availableAssets)
      console.log('🏠 Selected network:', formData.network)
      console.log('🏠 Network comparison debug:')
      rentalNodeInfo.rentalAssets.forEach((rentalAsset: any, idx: number) => {
        console.log(`  Asset ${idx}: network=${JSON.stringify(rentalAsset.network)}, assetId=${rentalAsset.assetId}`)
        console.log(`  AssetId type: ${typeof rentalAsset.assetId}, length: ${rentalAsset.assetId?.length}`)
        console.log(`  Is zero address: ${rentalAsset.assetId === '0x0000000000000000000000000000000000000000'}`)
        console.log(`  Matches selected network: ${rentalAsset.network?.id === formData.network?.id}`)
      })
    }
  }, [rentalNodeInfo, availableAssets, formData.network])

  // Debug logging for rentable asset info
  useEffect(() => {
    console.log('🏠 [DEBUG] rentableAssetInfo state:', rentableAssetInfo)
    console.log('🏠 [DEBUG] formData.network:', formData.network)
    console.log('🏠 [DEBUG] formData.assetId:', formData.assetId)
    console.log('🏠 [DEBUG] formData.paymentAssetId:', formData.paymentAssetId)
    console.log('🏠 [DEBUG] formData.paymentNetwork:', formData.paymentNetwork)
    console.log('🏠 [DEBUG] useRentableAssetInfo enabled:', !!formData.network && !!formData.assetId)
    console.log('🏠 [DEBUG] Full formData:', formData)
    console.log('🏠 [DEBUG] rentalOption:', rentalOption)
    console.log('🏠 [DEBUG] availableAssets:', availableAssets)
    console.log('🏠 [DEBUG] availableAssets.length:', availableAssets.length)
  }, [rentableAssetInfo, formData.network, formData.assetId, formData, rentalOption, availableAssets])

  // Get asset symbol
  const getAssetSymbol = (assetId: string): string => {
    if (!assetRegistry || !assetId) return 'Unknown'

    // Try to find in available assets first (has better symbol resolution)
    const availableAsset = availableAssets.find(asset => asset.id === assetId)
    if (availableAsset?.symbol) return availableAsset.symbol

    // Fall back to registry lookup
    const asset = assetRegistry[assetId]
    return asset?.asset?.symbol || asset?.symbol || assetId.slice(0, 8)
  }

  // Get asset symbol with network context for native assets
  const getAssetSymbolWithNetwork = (assetId: string, network: any): string => {
    if (!assetId) return 'Unknown'

    // Handle native assets (zero address)
    if (assetId === '0x0000000000000000000000000000000000000000') {
      if (network?.protocol === 0) return 'BTC'  // Bitcoin network
      if (network?.protocol === 1) return 'ETH'  // Ethereum network
      return 'Native'
    }

    // For non-native assets, use the regular symbol lookup
    return getAssetSymbol(assetId)
  }

  // Get available offchain payment assets
  const getAvailablePaymentAssets = () => {
    console.log('🏠 [DEBUG] Raw balances data:', balances)

    if (!balances?.balances) {
      console.log('🏠 [DEBUG] No balances.balances found')
      return []
    }

    console.log('🏠 [DEBUG] Balances structure:', balances.balances)
    console.log('🏠 [DEBUG] All asset IDs in balances:', Object.keys(balances.balances))

    const availableAssets = Object.entries(balances.balances)
      .filter(([assetId, balance]: [string, any]) => {
        const offchainBalance = parseFloat(balance.offchain?.freeLocal?.value || '0')
        console.log(`🏠 [DEBUG] Checking asset ${assetId}:`, balance, 'offchain.freeLocal.value:', offchainBalance)
        console.log(`🏠 [DEBUG] Asset ID length: ${assetId.length}, format: ${assetId}`)
        return offchainBalance > 0
      })
      .map(([assetId, balance]: [string, any]) => {
        // Fix asset ID format - convert long zero address to proper ETH representation
        let formattedAssetId = assetId
        if (assetId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
          formattedAssetId = '0x0000000000000000000000000000000000000000' // Proper ETH address format
        }
        console.log(`🏠 [DEBUG] Original asset ID: ${assetId}, formatted: ${formattedAssetId}`)

        // Get asset network from registry
        const assetInfo = assetRegistry?.[formattedAssetId]
        const assetNetwork = assetInfo?.network

        return {
          id: formattedAssetId,
          symbol: getAssetSymbolWithNetwork(formattedAssetId, assetNetwork),
          balance: parseFloat(balance.offchain?.freeLocal?.value || '0'),
          network: assetNetwork
        }
      })

    console.log('🏠 [DEBUG] Available payment assets:', availableAssets)
    return availableAssets
  }

  // Convert USD fee to payment asset amount
  const getConvertedFeeAmount = (usdAmount: string, paymentAssetId: string): string => {
    const usdValue = parseFloat(usdAmount)
    if (isNaN(usdValue)) return '0'

    // Mock conversion rates (in production, get from pricing service)
    const conversionRates: { [key: string]: number } = {
      'HDN': 0.10, // 1 HDN = $0.10, so $1 = 10 HDN
      'USDC': 1.00, // 1 USDC = $1.00, so $1 = 1 USDC
      'USDT': 1.00, // 1 USDT = $1.00, so $1 = 1 USDT
      'ETH': 2500, // 1 ETH = $2500, so $1 = 0.0004 ETH
      'BTC': 45000, // 1 BTC = $45000, so $1 = 0.000022 BTC
    }

    const rate = conversionRates[paymentAssetId] || 1
    const convertedAmount = usdValue / rate

    return formatCryptoAmount(convertedAmount)
  }

  // Duration options based on asset-specific rental information
  const getDurationOptions = () => {
    // If we have asset-specific rental info, use its limits
    if (rentableAssetInfo?.minDurationSeconds && rentableAssetInfo?.maxDurationSeconds) {
      const minSeconds = parseInt(rentableAssetInfo.minDurationSeconds)
      const maxSeconds = parseInt(rentableAssetInfo.maxDurationSeconds)

      const options = []

      // Add common durations within the asset's allowed range
      const commonDurations = [
        { seconds: 3600, label: '1 Hour' },
        { seconds: 86400, label: '1 Day' },
        { seconds: 604800, label: '1 Week' },
        { seconds: 2592000, label: '30 Days' }
      ]

      for (const duration of commonDurations) {
        if (duration.seconds >= minSeconds && duration.seconds <= maxSeconds) {
          options.push({ value: duration.seconds.toString(), label: duration.label })
        }
      }

      // Add min duration if not already included
      if (!options.find(opt => parseInt(opt.value) === minSeconds)) {
        const minHours = Math.floor(minSeconds / 3600)
        const minDays = Math.floor(minSeconds / 86400)
        const minLabel = minDays > 0 ? `${minDays} Days (Min)` : `${minHours} Hours (Min)`
        options.unshift({ value: minSeconds.toString(), label: minLabel })
      }

      // Add max duration if not already included
      if (!options.find(opt => parseInt(opt.value) === maxSeconds) && maxSeconds !== 2592000) {
        const maxDays = Math.floor(maxSeconds / 86400)
        const maxLabel = `${maxDays} Days (Max)`
        options.push({ value: maxSeconds.toString(), label: maxLabel })
      }

      return options.length > 0 ? options : [{ value: minSeconds.toString(), label: 'Available Duration' }]
    }

    // Default durations when no asset is selected
    return [
      { value: '3600', label: '1 Hour' },
      { value: '86400', label: '1 Day' },
      { value: '604800', label: '1 Week' },
      { value: '2592000', label: '30 Days' }
    ]
  }

  const durationOptions = getDurationOptions()

  const handleSubmit = async () => {
    if (!formData.network || !formData.assetId || !formData.amount || !rentalOption) {
      return
    }

    try {
      await rentChannelMutation.mutateAsync({
        network: formData.network,
        assetId: formData.assetId,
        lifetimeSeconds: formData.duration, // API expects string
        amount: formData.amount,
        rentalOption
      })
      onClose()
    } catch (error) {
      console.error('Failed to rent channel:', error)
    }
  }

  const handleClose = () => {
    setFormData({
      network: null,
      assetId: '',
      amount: '',
      duration: '86400',
      paymentMethod: 'OFFCHAIN',
      paymentAssetId: '',
      paymentNetwork: null
    })
    setRentalOption(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <HomeWork />
          <Typography variant="h6">Rent Channel</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box mt={1}>
          <Grid container spacing={3}>
            {/* Network Selection */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Network</InputLabel>
                <Select
                  value={formData.network?.id || ''}
                  label="Network"
                  onChange={(e) => {
                    const selectedNetwork = networks.find(n => n.id === e.target.value)
                    setFormData(prev => ({
                      ...prev,
                      network: selectedNetwork,
                      assetId: '',
                      paymentAssetId: '', // Clear payment asset when rental network changes
                      paymentNetwork: null // Will be set when payment asset is selected
                    }))
                  }}
                >
                  {networks.map((network) => (
                    <MenuItem key={network.id} value={network.id}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          label={network.protocol === 0 ? 'Bitcoin' : 'EVM'}
                          size="small"
                          sx={{
                            backgroundColor: network.protocol === 0 ? '#f7931a20' : '#627eea20',
                            color: network.protocol === 0 ? '#f7931a' : '#627eea'
                          }}
                        />
                        <Typography>
                          {getNetworkDisplayName(network)}
                          {network.id && ` (${network.id})`}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Asset Selection */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={!formData.network}>
                <InputLabel>Asset</InputLabel>
                <Select
                  value={formData.assetId}
                  label="Asset"
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    assetId: e.target.value,
                    paymentAssetId: '', // Clear payment asset when rental asset changes
                    paymentNetwork: null // Clear payment network when rental asset changes
                  }))}
                >
                  {availableAssets.length === 0 ? (
                    <MenuItem disabled>
                      {formData.network ? 'No assets available for this network' : 'Select a network first'}
                    </MenuItem>
                  ) : (
                    availableAssets.map((asset) => (
                      <MenuItem key={asset.id} value={asset.id}>
                        {asset.symbol || asset.id.slice(0, 8)}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>

            {/* Amount */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Rental Amount"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                type="number"
                inputProps={{
                  step: "0.000001",
                  min: rentableAssetInfo?.minCapacity?.value || "0",
                  max: rentableAssetInfo?.maxCapacity?.value || undefined
                }}
                helperText={
                  formData.assetId
                    ? `Amount of ${getAssetSymbol(formData.assetId)} to rent${
                        rentableAssetInfo
                          ? ` (Min: ${formatCryptoAmount(parseFloat(rentableAssetInfo.minCapacity?.value || '0'))}, Max: ${formatCryptoAmount(parseFloat(rentableAssetInfo.maxCapacity?.value || '0'))})`
                          : ''
                      }`
                    : 'Select an asset first'
                }
                placeholder="Enter amount to rent"
                disabled={!formData.assetId}
                error={Boolean(
                  formData.amount && rentableAssetInfo && (
                    parseFloat(formData.amount) < parseFloat(rentableAssetInfo.minCapacity?.value || '0') ||
                    parseFloat(formData.amount) > parseFloat(rentableAssetInfo.maxCapacity?.value || '0')
                  )
                )}
              />
            </Grid>

            {/* Duration Selection */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={!formData.assetId}>
                <InputLabel>Rental Duration</InputLabel>
                <Select
                  value={formData.duration}
                  label="Rental Duration"
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                >
                  {getDurationOptions().map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Rental Asset Info */}
            {rentableAssetInfo && (
              <Grid item xs={12}>
                <Box p={2} bgcolor="background.paper" borderRadius={1} border={1} borderColor="divider">
                  <Typography variant="subtitle2" gutterBottom>Asset Rental Information</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="text.secondary">Available Liquidity</Typography>
                      <Typography variant="body1" fontWeight={600}>
                        {formatCryptoAmount(parseFloat(rentableAssetInfo.availableLiquidity?.value || '0'))} {getAssetSymbol(formData.assetId)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="text.secondary">Min Amount</Typography>
                      <Typography variant="body1">
                        {formatCryptoAmount(parseFloat(rentableAssetInfo.minCapacity?.value || '0'))} {getAssetSymbol(formData.assetId)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="text.secondary">Max Amount</Typography>
                      <Typography variant="body1">
                        {formatCryptoAmount(parseFloat(rentableAssetInfo.maxCapacity?.value || '0'))} {getAssetSymbol(formData.assetId)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="text.secondary">Fee Ratio</Typography>
                      <Typography variant="body1">
                        {(parseFloat(rentableAssetInfo.rentalFeeRatio?.value || '0') * 100).toFixed(2)}%
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
            )}

            <Grid item xs={12}>
              <Divider />
            </Grid>

            {/* Payment Method */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Payment Method</Typography>
              <RadioGroup
                value={formData.paymentMethod}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value as 'ONCHAIN' | 'OFFCHAIN' }))}
                row
              >
                <FormControlLabel
                  value="ONCHAIN"
                  control={<Radio />}
                  disabled
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Payment fontSize="small" />
                      On-chain Payment (Coming Soon)
                    </Box>
                  }
                />
                <FormControlLabel
                  value="OFFCHAIN"
                  control={<Radio />}
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Payment fontSize="small" />
                      Off-chain Payment (Available)
                    </Box>
                  }
                />
              </RadioGroup>
            </Grid>

            {/* Payment Asset Selection */}
            {formData.paymentMethod === 'OFFCHAIN' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Payment Asset</InputLabel>
                  <Select
                    value={formData.paymentAssetId || ''}
                    label="Payment Asset"
                    onChange={(e) => {
                      const selectedAssetId = e.target.value
                      // Look up the payment asset's network from the asset registry
                      const paymentAssetInfo = assetRegistry?.[selectedAssetId]
                      const paymentAssetNetwork = paymentAssetInfo?.network

                      console.log('🏠 [DEBUG] Selected payment asset:', selectedAssetId)
                      console.log('🏠 [DEBUG] Payment asset network:', paymentAssetNetwork)

                      setFormData(prev => ({
                        ...prev,
                        paymentAssetId: selectedAssetId,
                        paymentNetwork: paymentAssetNetwork || prev.network // Use payment asset's network
                      }))
                    }}
                  >
                    <MenuItem disabled value="">
                      <em>Select asset to pay rental fee with</em>
                    </MenuItem>
                    {getAvailablePaymentAssets().map((paymentAsset: any) => (
                      <MenuItem key={paymentAsset.id} value={paymentAsset.id}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                          <Box display="flex" alignItems="center" gap={1}>
                            <span>{paymentAsset.symbol}</span>
                            {paymentAsset.network && (
                              <Chip
                                label={getNetworkDisplayName(paymentAsset.network)}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  fontWeight: 600
                                }}
                              />
                            )}
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {formatCryptoAmount(paymentAsset.balance)} available
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Fee Estimate */}
            {feeEstimate && (
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="subtitle2" gutterBottom>Estimated Rental Fee</Typography>
                  <Typography variant="h6" color="primary">
                    ${formatCryptoAmount(parseFloat(feeEstimate.fee?.value || '0'))} USD
                  </Typography>
                  {formData.paymentAssetId && formData.paymentAssetId !== '' && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      ≈ {getConvertedFeeAmount(feeEstimate.fee?.value || '0', getAssetSymbol(formData.paymentAssetId))} {getAssetSymbol(formData.paymentAssetId)}
                    </Typography>
                  )}
                </Alert>
              </Grid>
            )}

            {loadingFee && (
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={2}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Calculating rental fee...
                  </Typography>
                </Box>
              </Grid>
            )}

            {/* Fee estimation guide */}
            {!feeEstimate && !loadingFee && formData.network && formData.assetId && formData.amount && formData.paymentMethod === 'OFFCHAIN' && !formData.paymentAssetId && (
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    Select a payment asset below to see the estimated rental fee
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={
            !formData.network ||
            !formData.assetId ||
            !formData.amount ||
            !rentalOption ||
            rentChannelMutation.isPending ||
            loadingFee
          }
          startIcon={rentChannelMutation.isPending ? <CircularProgress size={16} /> : <HomeWork />}
        >
          {rentChannelMutation.isPending ? 'Renting...' : 'Rent Channel'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}