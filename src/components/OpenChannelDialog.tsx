import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Divider,
  Chip
} from '@mui/material'
import { Network, Protocol } from '../proto/models'
import { useOpenChannel, useEstimateOpenChannelFee, useFeeEstimates, useRealBalances } from '../hooks/useRealHydraData'

interface OpenChannelDialogProps {
  open: boolean
  onClose: () => void
  peer: {
    id: string
    network: string
    networkObj: Network
    alias?: string
  } | null
  availableAssets: Array<{ asset: any, network: Network }>
}

const steps = ['Configure', 'Review & Estimate', 'Confirm']

export default function OpenChannelDialog({
  open,
  onClose,
  peer,
  availableAssets
}: OpenChannelDialogProps) {
  const [activeStep, setActiveStep] = useState(0)
  const [selectedAsset, setSelectedAsset] = useState('')
  const [amount, setAmount] = useState('')
  const [feeRate, setFeeRate] = useState('medium')
  const [error, setError] = useState('')
  const [feeEstimate, setFeeEstimate] = useState<string | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)

  // Hooks
  const openChannelMutation = useOpenChannel()
  const estimateFeeMutation = useEstimateOpenChannelFee()
  const { data: feeEstimates } = useFeeEstimates(peer?.networkObj)
  const { data: balanceData } = useRealBalances()


  // Get available assets for this peer's network
  const networkAssets = availableAssets.filter(
    asset => peer && asset.network.id === peer.networkObj.id && asset.network.protocol === peer.networkObj.protocol
  )

  const resetDialog = () => {
    setActiveStep(0)
    setSelectedAsset('')
    setAmount('')
    setFeeRate('medium')
    setError('')
    setFeeEstimate(null)
    setIsEstimating(false)
  }

  const handleClose = React.useCallback(() => {
    resetDialog()
    onClose()
  }, [onClose])

  const handleNext = async () => {
    setError('')

    if (activeStep === 0) {
      // Step 1: Validate inputs
      if (!selectedAsset) {
        setError('Please select an asset')
        return
      }
      if (!amount || parseFloat(amount) <= 0) {
        setError('Please enter a valid amount')
        return
      }
      setActiveStep(1)
    } else if (activeStep === 1) {
      // Step 2: Estimate fee
      await estimateFee()
      setActiveStep(2)
    } else if (activeStep === 2) {
      // Step 3: Execute operation
      await executeOpenChannel()
    }
  }

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1)
    setError('')
  }

  const estimateFee = async () => {
    if (!peer) return

    setIsEstimating(true)
    try {
      // Prepare fee rate object with more reasonable fallbacks
      const selectedFeeRate = feeEstimates?.[feeRate] || {
        baseFeePerUnit: { value: '12000000000' }, // 12 gwei fallback (more realistic)
        maxTipFeePerUnit: { value: '2000000000' }, // 2 gwei tip fallback
        maxPricePerUnit: { value: '14000000000' } // 14 gwei total fallback (12+2)
      }

      console.log(`⛽ Fee rate (${feeRate}) for ${peer.networkObj.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} ${peer.networkObj.id}:`)
      console.log(`   Base fee: ${selectedFeeRate.baseFeePerUnit?.value || 'undefined'} ${peer.networkObj.protocol === Protocol.BITCOIN ? 'sat/vB' : 'wei/gas'}`)
      console.log(`   Max tip: ${selectedFeeRate.maxTipFeePerUnit?.value || 'undefined'} ${peer.networkObj.protocol === Protocol.BITCOIN ? 'sat/vB' : 'wei/gas'}`)
      console.log(`   Max price: ${selectedFeeRate.maxPricePerUnit?.value || 'undefined'} ${peer.networkObj.protocol === Protocol.BITCOIN ? 'sat/vB' : 'wei/gas'}`)

      if (peer.networkObj.protocol === Protocol.BITCOIN) {
        console.log(`   📏 Bitcoin transaction size: ~250-400 vBytes (typical channel opening)`)
        console.log(`   💰 Estimated total fee: ~${(parseInt(selectedFeeRate.maxPricePerUnit?.value || '0') * 300 / 100000000).toFixed(8)} BTC`)
      } else {
        const gasLimit = 80000 // More realistic gas limit for channel operations
        const maxPriceWei = selectedFeeRate.maxPricePerUnit?.value || '0'
        const maxPriceGwei = (parseInt(maxPriceWei) / 1000000000).toFixed(1)
        const totalFeeWei = parseInt(maxPriceWei) * gasLimit
        const totalFeeEth = (totalFeeWei / 1000000000000000000).toFixed(6)
        console.log(`   ⛽ Estimated gas limit: ~${gasLimit} gas units`)
        console.log(`   💰 Max price: ${maxPriceGwei} gwei/gas`)
        console.log(`   💰 Estimated total fee: ~${totalFeeEth} ETH`)
      }

      // Prepare asset amounts
      const assetAmounts = {
        [selectedAsset]: {
          exact: { amount }
        }
      }

      console.log(`⛽ Using fee rate: ${feeRate} (backend will use its own ${feeRate} fee estimates)`)

      // Pass the fee rate string - grpcWebClient will convert it to FeeOption
      const feeResult = await estimateFeeMutation.mutateAsync({
        network: peer.networkObj,
        nodeId: peer.id,
        assetAmounts,
        feeRate  // Pass string 'low', 'medium', or 'high'
      })

      // Use the backend fee estimate result
      if (feeResult?.fee?.value) {
        const backendFeeEstimate = parseFloat(feeResult.fee.value).toFixed(8)
        console.log(`💰 Backend fee estimate: ${backendFeeEstimate} ${peer.networkObj.protocol === Protocol.BITCOIN ? 'BTC' : 'ETH'}`)
        setFeeEstimate(backendFeeEstimate)
      } else {
        // Fallback to frontend calculation only if backend doesn't provide estimate
        console.log(`⚠️ No backend fee estimate, falling back to frontend calculation`)
        let frontendFeeEstimate: string
        if (peer.networkObj.protocol === Protocol.BITCOIN) {
          // Bitcoin: fee rate (sat/vB) × transaction size (vB)
          const feeRatePerVB = parseInt(selectedFeeRate.maxPricePerUnit?.value || '15')
          const estimatedVBytes = 300
          const totalSats = feeRatePerVB * estimatedVBytes
          const totalBTC = (totalSats / 100000000).toFixed(8)
          frontendFeeEstimate = totalBTC
          console.log(`💰 Frontend fee calculation: ${feeRatePerVB} sat/vB × ${estimatedVBytes} vB = ${totalSats} sats = ${totalBTC} BTC`)
        } else {
          // EVM: gas price (wei) × gas limit
          const gasPriceWei = parseInt(selectedFeeRate.maxPricePerUnit?.value || '14000000000')
          const gasLimit = 80000
          const totalWei = gasPriceWei * gasLimit
          const totalEth = (totalWei / 1000000000000000000).toFixed(6)
          frontendFeeEstimate = totalEth
          const gasPriceGwei = (gasPriceWei / 1000000000).toFixed(1)
          console.log(`💰 Frontend fee calculation: ${gasPriceGwei} gwei × ${gasLimit} gas = ${totalEth} ETH`)
        }
        setFeeEstimate(frontendFeeEstimate)
      }
    } catch (error: any) {
      setError(`Fee estimation failed: ${error.message}`)
    } finally {
      setIsEstimating(false)
    }
  }

  const executeOpenChannel = async () => {
    if (!peer) return

    try {
      const selectedFeeRate = feeEstimates?.[feeRate] || {
        baseFeePerUnit: { value: '12000000000' }, // 12 gwei fallback (more realistic)
        maxTipFeePerUnit: { value: '2000000000' }, // 2 gwei tip fallback
        maxPricePerUnit: { value: '14000000000' } // 14 gwei total fallback (12+2)
      }

      console.log(`⛽ Channel opening fee rate (${feeRate}) for ${peer.networkObj.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} ${peer.networkObj.id}:`)
      console.log(`   Base fee: ${selectedFeeRate.baseFeePerUnit?.value || 'undefined'} ${peer.networkObj.protocol === Protocol.BITCOIN ? 'sat/vB' : 'wei/gas'}`)
      console.log(`   Max tip: ${selectedFeeRate.maxTipFeePerUnit?.value || 'undefined'} ${peer.networkObj.protocol === Protocol.BITCOIN ? 'sat/vB' : 'wei/gas'}`)
      console.log(`   Max price: ${selectedFeeRate.maxPricePerUnit?.value || 'undefined'} ${peer.networkObj.protocol === Protocol.BITCOIN ? 'sat/vB' : 'wei/gas'}`)

      if (peer.networkObj.protocol === Protocol.BITCOIN) {
        console.log(`   📏 Bitcoin transaction size: ~250-400 vBytes (typical channel opening)`)
        console.log(`   💰 Estimated total fee: ~${(parseInt(selectedFeeRate.maxPricePerUnit?.value || '0') * 300 / 100000000).toFixed(8)} BTC`)
      } else {
        const gasLimit = 80000 // More realistic gas limit for channel operations
        const maxPriceWei = selectedFeeRate.maxPricePerUnit?.value || '0'
        const maxPriceGwei = (parseInt(maxPriceWei) / 1000000000).toFixed(1)
        const totalFeeWei = parseInt(maxPriceWei) * gasLimit
        const totalFeeEth = (totalFeeWei / 1000000000000000000).toFixed(6)
        console.log(`   ⛽ Estimated gas limit: ~${gasLimit} gas units`)
        console.log(`   💰 Max price: ${maxPriceGwei} gwei/gas`)
        console.log(`   💰 Estimated total fee: ~${totalFeeEth} ETH`)
      }

      const assetAmounts = {
        [selectedAsset]: {
          exact: { amount }
        }
      }

      console.log(`📡 Opening channel with fee rate: ${feeRate} (backend will use its own ${feeRate} fee estimates)`)

      // Pass the fee rate string - grpcWebClient will convert it to FeeOption
      const result = await openChannelMutation.mutateAsync({
        network: peer.networkObj,
        nodeId: peer.id,
        assetAmounts,
        feeRate  // Pass string 'low', 'medium', or 'high'
      })

      console.log('📡 Channel opened successfully:', result)

      // Close the dialog immediately
      handleClose()
    } catch (error: any) {
      setError(`Failed to open channel: ${error.message}`)
    }
  }

  const getSelectedAssetInfo = () => {
    return networkAssets.find(asset => asset.asset.id === selectedAsset)
  }

  const getSelectedAssetDecimals = () => {
    const assetInfo = getSelectedAssetInfo()
    return assetInfo?.asset?.decimals || 18
  }

  const formatAmount = (amount: string, decimals: number) => {
    const num = parseFloat(amount)
    return isNaN(num) ? '0' : num.toFixed(Math.min(decimals, 8))
  }

  const getAvailableBalance = (assetId: string) => {
    if (!balanceData?.balances || !assetId) return '0'

    const balance = balanceData.balances[assetId]
    if (!balance) return '0'

    // For channel opening, we use onchain usable balance
    const onchainUsable = parseFloat(balance.onchain?.usable?.value || '0')
    return onchainUsable.toString()
  }

  const getFeeDenomination = () => {
    if (!peer?.networkObj) return ''

    // For Bitcoin networks, fees are paid in BTC/sats
    if (peer.networkObj.protocol === Protocol.BITCOIN) {
      return 'BTC'
    }

    // For EVM networks, fees are paid in the native token (ETH, MATIC, etc.)
    // We can derive this from the network ID
    switch (peer.networkObj.id.toLowerCase()) {
      case 'ethereum':
      case 'goerli':
      case 'sepolia':
        return 'ETH'
      case 'polygon':
      case 'mumbai':
        return 'MATIC'
      case 'arbitrum':
        return 'ETH'
      case 'optimism':
        return 'ETH'
      default:
        return 'ETH' // Default for unknown EVM networks
    }
  }

  const isLoading = openChannelMutation.isPending

  if (!peer) return null

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Open Channel</Typography>
          <Chip
            label={`with ${peer.alias || peer.id.substring(0, 8)}...`}
            size="small"
            variant="outlined"
          />
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ width: '100%', mb: 3 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Step 1: Configure */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Configure Channel
            </Typography>

            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 2, p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Peer Information</Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Node ID:</strong> {peer.id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Network:</strong> {peer.network}
              </Typography>
              {peer.alias && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Alias:</strong> {peer.alias}
                </Typography>
              )}
            </Card>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Select Asset to Fund Channel</InputLabel>
              <Select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                label="Select Asset to Fund Channel"
              >
                {networkAssets.map((assetInfo) => (
                  <MenuItem key={assetInfo.asset.id} value={assetInfo.asset.id}>
                    <Box>
                      <Typography variant="body1">
                        {assetInfo.asset.symbol || assetInfo.asset.name || 'Unknown Asset'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {peer.networkObj.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} {peer.networkObj.id}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ position: 'relative', mb: 2 }}>
              <TextField
                fullWidth
                label="Amount to Fund Channel"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputProps={{
                  step: Math.pow(10, -(getSelectedAssetDecimals() || 18)),
                  min: 0
                }}
                helperText={selectedAsset ?
                  `Available: ${formatAmount(getAvailableBalance(selectedAsset), getSelectedAssetDecimals())} ${getSelectedAssetInfo()?.asset?.symbol || ''} • Decimals: ${getSelectedAssetDecimals()}`
                  : ''
                }
                InputProps={{
                  endAdornment: selectedAsset ? (
                    <Button
                      size="small"
                      onClick={() => setAmount(getAvailableBalance(selectedAsset))}
                      sx={{ minWidth: 'auto', px: 1 }}
                    >
                      Max
                    </Button>
                  ) : null
                }}
              />
            </Box>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Fee Rate</InputLabel>
              <Select
                value={feeRate}
                onChange={(e) => setFeeRate(e.target.value)}
                label="Fee Rate"
              >
                <MenuItem value="low">Low (slower)</MenuItem>
                <MenuItem value="medium">Medium (recommended)</MenuItem>
                <MenuItem value="high">High (faster)</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Step 2: Review & Estimate */}
        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review & Fee Estimation
            </Typography>

            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Channel Summary
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography color="text.secondary">Peer:</Typography>
                  <Typography>{peer.alias || peer.id.substring(0, 16)}...</Typography>
                </Box>

                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography color="text.secondary">Asset:</Typography>
                  <Typography>
                    {getSelectedAssetInfo()?.asset?.symbol || 'Unknown'}
                  </Typography>
                </Box>

                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography color="text.secondary">Initial Funding:</Typography>
                  <Typography>
                    {formatAmount(amount, getSelectedAssetDecimals())}
                  </Typography>
                </Box>

                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography color="text.secondary">Fee Rate:</Typography>
                  <Typography>{feeRate.charAt(0).toUpperCase() + feeRate.slice(1)}</Typography>
                </Box>

                {isEstimating ? (
                  <Box display="flex" alignItems="center" mt={2}>
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                    <Typography color="text.secondary">Estimating fee...</Typography>
                  </Box>
                ) : feeEstimate && (
                  <Box display="flex" justifyContent="space-between" mt={2} pt={2}
                       sx={{ borderTop: 1, borderColor: 'divider' }}>
                    <Typography color="text.secondary" fontWeight="medium">
                      Estimated Fee:
                    </Typography>
                    <Typography fontWeight="medium">
                      {feeEstimate} {getFeeDenomination()}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Step 3: Confirm */}
        {activeStep === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Confirm Channel Opening
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              You are about to open a payment channel with peer {peer.alias || peer.id.substring(0, 16)}...
            </Alert>

            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Final Summary
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Typography variant="body2" paragraph>
                  Opening channel with initial funding of {formatAmount(amount, getSelectedAssetDecimals())} {getSelectedAssetInfo()?.asset?.symbol || 'Unknown Asset'}
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Estimated network fee: {feeEstimate || 'Unknown'} {getFeeDenomination()}
                </Typography>
              </CardContent>
            </Card>

            {isLoading && (
              <Box display="flex" alignItems="center" mt={2}>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                <Typography color="text.secondary">
                  Opening channel...
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={isLoading}>
            Back
          </Button>
        )}
        <Button
          onClick={handleNext}
          variant="contained"
          disabled={isLoading || isEstimating}
        >
          {activeStep === steps.length - 1 ? 'Open Channel' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}