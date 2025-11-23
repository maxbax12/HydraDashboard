import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Box,
  Typography,
  Paper,
  Container,
  useTheme,
} from '@mui/material'
import {
  Home,
  Public,
  AccountBalance,
  Receipt,
  Cable,
  Devices,
  ShowChart,
} from '@mui/icons-material'
import { useNodeEventStream, useRealNetworks } from '../hooks/useRealHydraData'

const tabs = [
  { label: 'Welcome', path: '/welcome', icon: <Home /> },
  { label: 'Networks', path: '/networks', icon: <Public /> },
  { label: 'Balances', path: '/balances', icon: <AccountBalance /> },
  { label: 'Transactions', path: '/transactions', icon: <Receipt /> },
  { label: 'Channels', path: '/channels', icon: <Cable /> },
  { label: 'Markets', path: '/markets', icon: <ShowChart /> },
  { label: 'Peers', path: '/peers', icon: <Devices /> },
]

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const theme = useTheme()

  // Set up event streams for the first available network only
  // (We'll implement multi-network streaming later if needed)
  const { data: networksResponse } = useRealNetworks()
  const networks = networksResponse || []
  const primaryNetwork = networks.length > 0 ? networks[0] : undefined

  // Subscribe to node events for the primary network to keep everything in sync
  useNodeEventStream(primaryNetwork)

  const currentTabIndex = tabs.findIndex((tab) => tab.path === location.pathname)

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    navigate(tabs[newValue].path)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static" elevation={0} sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700, mr: 2 }}>
            ⚡ Hydra Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
            Multi-Network Cryptocurrency Management
          </Typography>
        </Toolbar>
        <Tabs
          value={currentTabIndex === -1 ? 0 : currentTabIndex}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: `1px solid ${theme.palette.divider}`,
            '& .MuiTab-root': {
              minHeight: 64,
              textTransform: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
            },
          }}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              icon={tab.icon}
              iconPosition="start"
              label={tab.label}
              sx={{ gap: 1 }}
            />
          ))}
        </Tabs>
      </AppBar>

      <Box sx={{ flexGrow: 1, overflow: 'auto', bgcolor: 'background.default' }}>
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Paper
            elevation={0}
            sx={{
              minHeight: 'calc(100vh - 200px)',
              p: 3,
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: 'background.paper'
            }}
          >
            {children}
          </Paper>
        </Container>
      </Box>
    </Box>
  )
}