import React from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  IconButton,
  Button,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Menu,
  MenuItem,
} from '@mui/material'
import {
  MoreVert,
  Cable,
  TrendingUp,
  TrendingDown,
  Close,
  Add,
  Remove
} from '@mui/icons-material'
import { formatCryptoAmount, formatNodeId, getStatusColor } from '@/utils/formatting'

interface ChannelCardProps {
  id: string
  peerNodeId: string
  capacity: number
  localBalance: number
  remoteBalance: number
  status: 'opening' | 'active' | 'closing' | 'closed'
  asset: string
  onDeposit?: (channelId: string, amount: number) => void
  onWithdraw?: (channelId: string, amount: number) => void
  onClose?: (channelId: string) => void
}

export default function ChannelCard({
  id,
  peerNodeId,
  capacity,
  localBalance,
  remoteBalance,
  status,
  asset,
  onDeposit,
  onWithdraw,
  onClose
}: ChannelCardProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const [depositDialogOpen, setDepositDialogOpen] = React.useState(false)
  const [withdrawDialogOpen, setWithdrawDialogOpen] = React.useState(false)
  const [depositAmount, setDepositAmount] = React.useState('')
  const [withdrawAmount, setWithdrawAmount] = React.useState('')

  const localPercentage = capacity > 0 ? (localBalance / capacity) * 100 : 0
  const remotePercentage = capacity > 0 ? (remoteBalance / capacity) * 100 : 0

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount)
    if (amount > 0 && onDeposit) {
      onDeposit(id, amount)
      setDepositAmount('')
      setDepositDialogOpen(false)
    }
    handleMenuClose()
  }

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount)
    if (amount > 0 && onWithdraw) {
      onWithdraw(id, amount)
      setWithdrawAmount('')
      setWithdrawDialogOpen(false)
    }
    handleMenuClose()
  }

  const handleCloseChannel = () => {
    if (onClose) {
      onClose(id)
    }
    handleMenuClose()
  }

  return (
    <>
      <Card
        elevation={0}
        sx={{
          border: 1,
          borderColor: status === 'active' ? 'success.main' : 'divider',
          height: '100%',
          '&:hover': {
            borderColor: status === 'active' ? 'success.main' : 'primary.main'
          }
        }}
      >
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Cable color={status === 'active' ? 'success' : 'disabled'} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Channel
              </Typography>
            </Box>

            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                label={status.toUpperCase()}
                size="small"
                color={getStatusColor(status)}
              />
              <IconButton size="small" onClick={handleMenuOpen}>
                <MoreVert fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Box mb={2}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Peer Node ID
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
            >
              {formatNodeId(peerNodeId)}
            </Typography>
          </Box>

          <Box mb={3}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Channel Capacity
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {formatCryptoAmount(capacity)} {asset.toUpperCase()}
            </Typography>
          </Box>

          <Box mb={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <TrendingUp fontSize="small" color="success" />
                <Typography variant="body2" color="text.secondary">
                  Local Balance
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {formatCryptoAmount(localBalance)} ({localPercentage.toFixed(1)}%)
              </Typography>
            </Box>

            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <TrendingDown fontSize="small" color="info" />
                <Typography variant="body2" color="text.secondary">
                  Remote Balance
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {formatCryptoAmount(remoteBalance)} ({remotePercentage.toFixed(1)}%)
              </Typography>
            </Box>
          </Box>

          <Box>
            <LinearProgress
              variant="determinate"
              value={localPercentage}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  backgroundColor: 'success.main'
                }
              }}
            />
            <Box display="flex" justifyContent="space-between" mt={1}>
              <Typography variant="caption" color="success.main">
                Outbound
              </Typography>
              <Typography variant="caption" color="info.main">
                Inbound
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            setDepositDialogOpen(true)
            handleMenuClose()
          }}
          disabled={status !== 'active'}
        >
          <Add sx={{ mr: 1 }} />
          Deposit Funds
        </MenuItem>
        <MenuItem
          onClick={() => {
            setWithdrawDialogOpen(true)
            handleMenuClose()
          }}
          disabled={status !== 'active' || localBalance <= 0}
        >
          <Remove sx={{ mr: 1 }} />
          Withdraw Funds
        </MenuItem>
        <MenuItem onClick={handleCloseChannel} sx={{ color: 'error.main' }}>
          <Close sx={{ mr: 1 }} />
          Close Channel
        </MenuItem>
      </Menu>

      {/* Deposit Dialog */}
      <Dialog open={depositDialogOpen} onClose={() => setDepositDialogOpen(false)}>
        <DialogTitle>Deposit to Channel</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Add funds to your local balance in this channel.
          </Typography>
          <TextField
            autoFocus
            label={`Amount (${asset.toUpperCase()})`}
            type="number"
            fullWidth
            variant="outlined"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepositDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeposit}
            variant="contained"
            disabled={!depositAmount || parseFloat(depositAmount) <= 0}
          >
            Deposit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawDialogOpen} onClose={() => setWithdrawDialogOpen(false)}>
        <DialogTitle>Withdraw from Channel</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Withdraw funds from your local balance. Available: {formatCryptoAmount(localBalance)} {asset.toUpperCase()}
          </Typography>
          <TextField
            autoFocus
            label={`Amount (${asset.toUpperCase()})`}
            type="number"
            fullWidth
            variant="outlined"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            inputProps={{ max: localBalance }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleWithdraw}
            variant="contained"
            disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > localBalance}
          >
            Withdraw
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}