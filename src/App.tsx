import { Routes, Route, Navigate } from 'react-router-dom'
import { Box } from '@mui/material'
import Layout from './components/Layout'
import WelcomeTab from './pages/WelcomeTab'
import NetworksTab from './pages/NetworksTab'
import BalancesTab from './pages/BalancesTab'
import TransactionsTab from './pages/TransactionsTab'
import ChannelsTab from './pages/ChannelsTab'
import PeersTab from './pages/PeersTab'
import MarketsTab from './pages/MarketsTab'

function App() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/welcome" replace />} />
          <Route path="/welcome" element={<WelcomeTab />} />
          <Route path="/networks" element={<NetworksTab />} />
          <Route path="/balances" element={<BalancesTab />} />
          <Route path="/transactions" element={<TransactionsTab />} />
          <Route path="/channels" element={<ChannelsTab />} />
          <Route path="/peers" element={<PeersTab />} />
          <Route path="/markets" element={<MarketsTab />} />
        </Routes>
      </Layout>
    </Box>
  )
}

export default App