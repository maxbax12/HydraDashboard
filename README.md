# Hydra Dashboard

A modern React TypeScript dashboard for managing multi-network cryptocurrency operations with Lightning Network and EVM support.

## ⚡ Features

- **Multi-Network Support**: Bitcoin, Ethereum, and Arbitrum integration
- **Real-time Data**: Live balance updates and transaction monitoring
- **Professional UI**: Material-UI dark theme with responsive design
- **Trading Interface**: Orderbook visualization and trading tools
- **Channel Management**: Lightning and state channel operations
- **TypeScript**: Full type safety with generated proto definitions

## 🚀 Quick Start

1. **Install Dependencies**:
```bash
npm install
```

2. **Start Development Server**:
```bash
npm run dev
```

3. **Open Browser**: Navigate to `http://localhost:3000`

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Material-UI (MUI)** for components and theming
- **Redux Toolkit** for state management
- **React Query** for data fetching and caching
- **Recharts** for data visualization

### Backend Integration
- **gRPC-Web** client for Rust backend communication
- **Generated TypeScript types** from proto files
- **Real-time WebSocket** subscriptions for live updates

### Project Structure
```
src/
├── components/          # Reusable UI components
├── hooks/              # Custom React hooks for data fetching
├── pages/              # Main dashboard tabs
├── proto/              # Generated TypeScript proto definitions
├── services/           # gRPC client and API layer
├── store/              # Redux store and slices
├── types/              # TypeScript type definitions
└── utils/              # Utility functions and formatters
```

## 🎯 Dashboard Tabs

### 🏠 Welcome
- Guided setup and onboarding
- Quick action cards for common tasks
- System status overview

### 🌍 Networks
- Network connectivity monitoring
- Block height and sync status
- Peer connection management

### 📊 Overview
- Portfolio summary and metrics
- Key performance indicators
- System health monitoring

### 💰 Balances
- **Portfolio visualization** with pie and bar charts
- **Multi-asset support** (BTC, ETH, USDC, etc.)
- **On-chain vs Off-chain** balance breakdown
- **Real-time USD values** and 24h change tracking
- **Interactive balance cards** with refresh functionality

### 📜 Transactions
- Complete transaction history
- Status tracking and confirmations
- Fee analysis

### ⚡ Channels
- Lightning and state channel management
- Channel opening, closing, and deposits
- Liquidity monitoring

### 🌐 Peers
- Network peer management
- Connection status monitoring
- Multi-network peer support



## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript checks

### Backend Connection

The dashboard connects to the Hydra gRPC backend. Configure the backend URL in your `.env` file:

```bash
VITE_GRPC_URL=http://localhost:8080
```

See `.env.example` for all available configuration options.

## 🎨 Theming

The dashboard uses a custom dark theme optimized for financial data visualization:

- **Primary Color**: Blue (#1976d2)
- **Secondary Color**: Pink (#dc004e)
- **Background**: Dark mode with subtle gradients
- **Typography**: Inter font family for readability

## 📱 Responsive Design

The dashboard is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile devices

## 🔒 Type Safety

- **100% TypeScript** implementation
- **Generated types** from proto files ensure backend compatibility
- **Strict typing** for all API calls and data structures

## 🔗 Prerequisites

- Node.js 18+ and npm
- Running Hydra gRPC backend server
- Envoy proxy configured for gRPC-Web (see backend documentation)

## 📄 License

This project is part of the Hydra multi-network cryptocurrency system.