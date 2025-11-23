import React, { useState, useEffect } from 'react'
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
import { useDepositChannel, useWithdrawChannel, useCloseChannel, useForceCloseChannel, useFeeEstimates, useRealBalances } from '../hooks/useRealHydraData'

interface ChannelManagementDialogProps {
  open: boolean
  onClose: () => void
  operation: 'deposit' | 'withdraw' | 'close' | 'force-close'
  channel: any
  network: Network
  availableAssets: Array<{ asset: any, network: Network }>
}

const steps = ['Configure', 'Review & Estimate', 'Confirm']

export default function ChannelManagementDialog({
  open,
  onClose,
  operation,
  channel,
  network,
  availableAssets
}: ChannelManagementDialogProps) {
  const [activeStep, setActiveStep] = useState(0)
  const [selectedAsset, setSelectedAsset] = useState('')
  const [amount, setAmount] = useState('')
  const [feeRate, setFeeRate] = useState<'low' | 'medium' | 'high'>('medium')
  const [error, setError] = useState('')
  const [feeEstimate, setFeeEstimate] = useState<string | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)

  // Hooks for operations
  const depositMutation = useDepositChannel()
  const withdrawMutation = useWithdrawChannel()
  const closeMutation = useCloseChannel()
  const forceCloseMutation = useForceCloseChannel()
  const { data: feeEstimates } = useFeeEstimates(network)
  const { data: balancesData } = useRealBalances()

  const operationTitle = {
    deposit: 'Deposit to Channel',
    withdraw: 'Withdraw from Channel',
    close: 'Close Channel',
    'force-close': 'Force Close Channel'
  }[operation]

  // Get available assets for this channel's network
  const networkAssets = network ? availableAssets.filter(
    asset => asset.network.id === network.id && asset.network.protocol === network.protocol
  ) : []

  // Get channel assets for withdraw/close operations
  const channelAssets = channel?.assetChannels ? Object.keys(channel.assetChannels) : []

  // For deposit: show all network assets (can deposit any asset)
  // For withdraw/close: show only assets that are already in the channel
  const availableAssetsForOperation = operation === 'deposit'
    ? networkAssets
    : networkAssets.filter(asset => channelAssets.includes(asset.asset.id))

  const resetDialog = () => {
    setActiveStep(0)
    setSelectedAsset('')
    setAmount('')
    setFeeRate('medium')
    setError('')
    setFeeEstimate(null)
    setIsEstimating(false)
  }

  const handleClose = () => {
    resetDialog()
    onClose()
  }

  const handleNext = async () => {
    setError('')

    if (activeStep === 0) {
      // Step 1: Validate inputs
      // For close/force-close operations, skip asset selection validation
      if (operation !== 'close' && operation !== 'force-close' && !selectedAsset) {
        setError('Please select an asset')
        return
      }
      // Amount is only required for deposit and withdraw operations
      if (operation !== 'close' && operation !== 'force-close' && (!amount || parseFloat(amount) <= 0)) {
        setError('Please enter a valid amount')
        return
      }

      // For withdraw operations, check if amount doesn't exceed available balance
      if (operation === 'withdraw') {
        const balance = getSelectedAssetBalance()
        if (balance && parseFloat(amount) > balance.availableToWithdraw) {
          setError(`Cannot withdraw ${amount}. Available: ${balance.availableToWithdraw}`)
          return
        }
      }

      // For deposit operations, check if amount doesn't exceed available onchain balance
      if (operation === 'deposit') {
        const onchainBalance = balancesData?.balances?.[selectedAsset]?.onchain?.usable?.value
        if (onchainBalance && parseFloat(amount) > parseFloat(onchainBalance)) {
          setError(`Cannot deposit ${amount}. Available onchain: ${onchainBalance}`)
          return
        }
      }
      setActiveStep(1)
    } else if (activeStep === 1) {
      // Step 2: Estimate fee (skip for close/force-close as they don't have estimation endpoints)
      if (operation !== 'close' && operation !== 'force-close') {
        await estimateFee()
      } else {
        // For close/force-close, just skip to confirmation step
        setFeeEstimate('Will be calculated on execution')
      }
      setActiveStep(2)
    } else if (activeStep === 2) {
      // Step 3: Execute operation
      await executeOperation()
    }
  }

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1)
    setError('')
  }

  const estimateFee = async () => {
    setIsEstimating(true)
    try {
      // Fee estimation endpoints for deposit/withdraw/close/force-close have encoding issues
      // Skip estimation and just show that fee will be calculated on execution
      if (operation === 'deposit' || operation === 'withdraw' || operation === 'close' || operation === 'force-close') {
        setFeeEstimate('Will be calculated on execution')
      }

      // Note: The backend has EstimateDepositChannelFee and EstimateWithdrawChannelFee endpoints,
      // but they have encoding TODOs and aren't properly implemented yet.
      // Once they're fixed, we can add proper fee estimation here.

    } catch (error: any) {
      setError(`Fee estimation failed: ${error.message}`)
    } finally {
      setIsEstimating(false)
    }
  }

  const executeOperation = async () => {
    try {
      const selectedFeeRate = feeEstimates?.[feeRate] || {
        baseFeePerUnit: '1000000000',
        maxTipFeePerUnit: '1000000000',
        maxPricePerUnit: '2000000000'
      }

      if (operation === 'deposit') {
        const assetAmounts = {
          [selectedAsset]: {
            exact: {
              amount: { value: amount }
            }
          }
        }
        await depositMutation.mutateAsync({
          network,
          channelId: channel.id,
          assetAmounts,
          feeRate // Pass 'low', 'medium', or 'high'
        })
      } else if (operation === 'withdraw') {
        const withdrawAmounts = {
          [selectedAsset]: {
            selfWithdrawal: {
              exact: {
                amount: { value: amount }
              }
            },
            counterpartyWithdrawal: {
              exact: {
                amount: { value: '0' }
              }
            }
          }
        }
        await withdrawMutation.mutateAsync({
          network,
          channelId: channel.id,
          assetAmounts: withdrawAmounts,
          feeRate // Pass 'low', 'medium', or 'high'
        })
      } else if (operation === 'close') {
        // For close, close all assets in the channel - just asset IDs and fee rate level
        await closeMutation.mutateAsync({
          network,
          channelId: channel.id,
          assetIds: channelAssets, // Close all assets
          feeRate // Pass 'low', 'medium', or 'high'
        })
      } else if (operation === 'force-close') {
        // For force close, close all assets in the channel - just asset IDs and fee rate level
        await forceCloseMutation.mutateAsync({
          network,
          channelId: channel.id,
          assetIds: channelAssets, // Force close all assets
          feeRate // Pass 'low', 'medium', or 'high'
        })
      }

      handleClose()
    } catch (error: any) {
      let errorMessage = `Operation failed: ${error.message}`

      // Special handling for Bitcoin channel close internal server errors
      if (error.message?.includes('internal server error') &&
          operation === 'close' &&
          network.protocol === Protocol.BITCOIN) {
        errorMessage = 'Bitcoin channel close failed with backend error. This appears to be a backend issue - please check the Hydra backend logs for details. The channel may need to be force-closed instead.'
      }

      setError(errorMessage)
    }
  }

  const getSelectedAssetInfo = () => {
    return availableAssetsForOperation.find(asset => asset.asset.id === selectedAsset)
  }

  const getSelectedAssetDecimals = () => {
    const assetInfo = getSelectedAssetInfo()
    return assetInfo?.asset?.decimals || 18
  }

  const getSelectedAssetBalance = () => {
    if (!selectedAsset || !channel?.assetChannels) return null

    const assetChannel = channel.assetChannels[selectedAsset]
    if (!assetChannel?.balance) return null

    const balance = assetChannel.balance
    const freeLocal = parseFloat(balance.freeLocal?.value || '0')

    return {
      freeLocal,
      // For withdraw operations, show what's available to withdraw
      availableToWithdraw: freeLocal
    }
  }

  const getAmountHelperText = () => {
    if (!selectedAsset) return ''

    const decimals = getSelectedAssetDecimals()

    if (operation === 'withdraw') {
      const balance = getSelectedAssetBalance()
      if (balance) {
        return `Available to withdraw: ${balance.availableToWithdraw.toFixed(Math.min(decimals, 8))} | Decimals: ${decimals}`
      }
      return `Decimals: ${decimals}`
    } else if (operation === 'deposit') {
      // For deposit, show onchain usable balance
      const onchainBalance = balancesData?.balances?.[selectedAsset]?.onchain?.usable?.value
      if (onchainBalance) {
        const balance = parseFloat(onchainBalance)
        return `Available onchain: ${balance.toFixed(Math.min(decimals, 8))} | Decimals: ${decimals}`
      }
      return `Depositing to channel | Decimals: ${decimals}`
    } else {
      return `Decimals: ${decimals}`
    }
  }

  const formatAmount = (amount: string, decimals: number) => {
    const num = parseFloat(amount)
    return isNaN(num) ? '0' : num.toFixed(Math.min(decimals, 8))
  }

  const isLoading = depositMutation.isPending || withdrawMutation.isPending || closeMutation.isPending || forceCloseMutation.isPending

  // Don't render if network is not provided
  if (!network) {
    return null
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{operationTitle}</Typography>
          <Chip
            label={`Channel ${channel?.id?.substring(0, 8)}...`}
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
              Configure {operation.replace('-', ' ')}
            </Typography>

            {operation === 'force-close' && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                ⚡ <strong>Force Close</strong> is a unilateral channel closure that doesn't require cooperation from your counterparty.
                Use this when the counterparty is unresponsive or in emergency situations.
              </Alert>
            )}

            {operation === 'close' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                This will close the channel and settle all assets ({channelAssets.length} asset{channelAssets.length !== 1 ? 's' : ''}) back to your on-chain wallet.
              </Alert>
            )}

            {/* Only show asset selection for deposit/withdraw operations */}
            {operation !== 'close' && operation !== 'force-close' && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Select Asset</InputLabel>
                <Select
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  label="Select Asset"
                >
                  {availableAssetsForOperation.map((assetInfo) => (
                    <MenuItem key={assetInfo.asset.id} value={assetInfo.asset.id}>
                      <Box>
                        <Typography variant="body1">
                          {assetInfo.asset.symbol || assetInfo.asset.name || 'Unknown Asset'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {network.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} {network.id}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {operation !== 'close' && operation !== 'force-close' && (
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputProps={{
                    step: Math.pow(10, -(getSelectedAssetDecimals() || 18)),
                    min: 0,
                    max: operation === 'withdraw' && getSelectedAssetBalance()
                      ? getSelectedAssetBalance()?.availableToWithdraw
                      : undefined
                  }}
                  helperText={getAmountHelperText()}
                  InputProps={{
                    endAdornment: operation === 'withdraw' && getSelectedAssetBalance() && (
                      <Button
                        size="small"
                        onClick={() => {
                          const balance = getSelectedAssetBalance()
                          if (balance) {
                            setAmount(balance.availableToWithdraw.toString())
                          }
                        }}
                        sx={{ minWidth: 'auto', px: 1 }}
                      >
                        Max
                      </Button>
                    )
                  }}
                />
              </Box>
            )}

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Fee Rate</InputLabel>
              <Select
                value={feeRate}
                onChange={(e) => setFeeRate(e.target.value as 'low' | 'medium' | 'high')}
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
                  Operation Summary
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography color="text.secondary">Operation:</Typography>
                  <Typography>{operation.charAt(0).toUpperCase() + operation.slice(1)}</Typography>
                </Box>

                {operation === 'close' || operation === 'force-close' ? (
                  <>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography color="text.secondary">Assets to close:</Typography>
                      <Typography>
                        {channelAssets.length} asset{channelAssets.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ ml: 2, mb: 1 }}>
                      {channelAssets.map(assetId => {
                        const assetInfo = availableAssetsForOperation.find(a => a.asset.id === assetId)
                        return (
                          <Chip
                            key={assetId}
                            label={assetInfo?.asset?.symbol || assetId.slice(0, 8)}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        )
                      })}
                    </Box>
                  </>
                ) : (
                  <>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography color="text.secondary">Asset:</Typography>
                      <Typography>
                        {getSelectedAssetInfo()?.asset?.symbol || 'Unknown'}
                      </Typography>
                    </Box>

                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography color="text.secondary">Amount:</Typography>
                      <Typography>
                        {formatAmount(amount, getSelectedAssetDecimals())}
                      </Typography>
                    </Box>
                  </>
                )}

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
                      {feeEstimate} ETH
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
              Confirm Operation
            </Typography>

            <Alert severity={operation === 'force-close' ? 'error' : 'warning'} sx={{ mb: 2 }}>
              {operation === 'force-close'
                ? '⚡ FORCE CLOSE WARNING: This will unilaterally close the channel without counterparty cooperation. This action cannot be undone and may take longer to settle.'
                : 'Please review all details carefully. This operation cannot be undone.'
              }
            </Alert>

            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Final Summary
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {operation === 'close' || operation === 'force-close' ? (
                  <>
                    <Typography variant="body2" paragraph>
                      You are about to {operation.replace('-', ' ')} channel {channel?.id?.substring(0, 16)}...
                      and settle all {channelAssets.length} asset{channelAssets.length !== 1 ? 's' : ''} back to your on-chain wallet:
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      {channelAssets.map(assetId => {
                        const assetInfo = availableAssetsForOperation.find(a => a.asset.id === assetId)
                        return (
                          <Chip
                            key={assetId}
                            label={assetInfo?.asset?.symbol || assetId.slice(0, 8)}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        )
                      })}
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2" paragraph>
                    You are about to {operation} {formatAmount(amount, getSelectedAssetDecimals())} {getSelectedAssetInfo()?.asset?.symbol || 'Unknown Asset'}
                    {operation === 'deposit' ? ' into' : ' from'} channel {channel?.id?.substring(0, 16)}...
                  </Typography>
                )}

                <Typography variant="body2" color="text.secondary">
                  Estimated network fee: {feeEstimate || 'Unknown'} ETH
                </Typography>
              </CardContent>
            </Card>

            {isLoading && (
              <Box display="flex" alignItems="center" mt={2}>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                <Typography color="text.secondary">
                  Processing {operation}...
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
          {activeStep === steps.length - 1 ? 'Confirm' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}