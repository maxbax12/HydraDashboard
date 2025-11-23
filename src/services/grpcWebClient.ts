/**
 * Real gRPC-Web Client for Hydra Backend
 *
 * This client makes actual gRPC calls to your Rust backend directly
 */

import { GetBalancesRequest, GetBalancesResponse, GetTransactionsRequest, GetTransactionsResponse } from '@/proto/wallet'
import { GetNetworksRequest, GetNetworksResponse } from '@/proto/app'
import { GetRentalNodeInfoRequest, GetRentalNodeInfoResponse, GetRentableAssetInfoRequest, GetRentableAssetInfoResponse, RentChannelRequest, RentChannelResponse, EstimateRentChannelFeeRequest, EstimateRentChannelFeeResponse } from '@/proto/rental'
import { GetChannelsRequest, GetChannelsResponse } from '@/proto/watch_only_node'
import { GetConnectedPeersRequest, GetConnectedPeersResponse, ConnectToPeerRequest, ConnectToPeerResponse, OpenChannelRequest, OpenChannelResponse, EstimateOpenChannelFeeRequest, EstimateOpenChannelFeeResponse, DepositChannelRequest, DepositChannelResponse, EstimateDepositChannelFeeRequest, EstimateDepositChannelFeeResponse, WithdrawChannelRequest, WithdrawChannelResponse, EstimateWithdrawChannelFeeRequest, EstimateWithdrawChannelFeeResponse, CloseChannelRequest, CloseChannelResponse, EstimateCloseChannelFeeRequest, EstimateCloseChannelFeeResponse, ForceCloseChannelRequest, ForceCloseChannelResponse, EstimateForceCloseChannelFeeRequest, EstimateForceCloseChannelFeeResponse } from '@/proto/node'
import { GetAssetFiatPriceRequest, GetAssetFiatPriceResponse } from '@/proto/pricing'
import { GetAssetsRequest, GetAssetsResponse, GetAssetRequest, GetAssetResponse } from '@/proto/asset'
import { GetFeeEstimatesRequest, GetFeeEstimatesResponse } from '@/proto/blockchain'
import { GetInitializedMarketsRequest, GetInitializedMarketsResponse, GetMarketsInfoRequest, GetMarketsInfoResponse, GetMarketInfoRequest, GetMarketInfoResponse, InitMarketRequest, InitMarketResponse } from '@/proto/orderbook'
import { SubscribeNodeEventsRequest, SubscribeClientEventsRequest } from '@/proto/event'
import { GetDepositAddressRequest, GetDepositAddressResponse } from '@/proto/client'
import { Network, Protocol, FiatCurrency, Asset, SendAmount, DecimalString, NodeEvent, ClientEvent } from '@/proto/models'
import { BinaryWriter, BinaryReader } from "@bufbuild/protobuf/wire"

class HydraGrpcWebClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = import.meta.env.VITE_GRPC_URL || 'http://localhost:5001'
  }


  /**
   * Make a gRPC-Web call with proper protobuf encoding
   */
  private async grpcCall<TRequest, TResponse>(
    servicePath: string,
    method: string,
    request: TRequest,
    requestEncoder: (message: TRequest, writer?: BinaryWriter) => BinaryWriter
  ): Promise<TResponse> {
    const url = `${this.baseUrl}/${servicePath}/${method}`

    console.log(`🔗 gRPC call: ${servicePath}/${method}`, request)

    try {
      // Encode the request using proper protobuf encoding
      const messageBytes = requestEncoder(request).finish()

      // Add gRPC-Web framing: compression flag (1 byte) + length (4 bytes) + message
      const frame = new Uint8Array(5 + messageBytes.length)
      const view = new DataView(frame.buffer)

      // Compression flag: 0 = no compression
      view.setUint8(0, 0)
      // Message length (big-endian)
      view.setUint32(1, messageBytes.length, false)
      // Message data
      frame.set(messageBytes, 5)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web+proto',
          'Accept': 'application/grpc-web+proto',
          'X-Grpc-Web': '1',
        },
        body: frame, // Properly framed gRPC-Web message
      })

      const grpcStatus = response.headers.get('grpc-status')
      const grpcMessage = response.headers.get('grpc-message')
      const contentType = response.headers.get('content-type')


      // Check if we got a proper gRPC response
      if (grpcStatus === null) {
        // No gRPC status header - but if content-type is gRPC, try protobuf decoding first

        // Clone the response early so we can read it again if protobuf decoding fails
        const responseClone = response.clone()

        if (response.status === 200) {

          // Special handling for market methods FIRST (before consuming response body)
          if (servicePath === 'hydra_app.OrderbookService' &&
              ['GetMarketsInfo', 'GetInitializedMarkets'].includes(method)) {

            if (method === 'GetInitializedMarkets') {
              try {
                const responseData = await response.arrayBuffer()
                const responseBytes = new Uint8Array(responseData, 5)
                const reader = new BinaryReader(responseBytes)
                const decoded = GetInitializedMarketsResponse.decode(reader)
                return decoded as TResponse
              } catch (decodeError) {
                console.log('❌ Protobuf decoding failed for GetInitializedMarkets:', decodeError)
                return { markets: [] } as TResponse
              }
            }

            if (method === 'GetMarketsInfo') {
              try {
                const responseData = await response.arrayBuffer()
                const responseBytes = new Uint8Array(responseData, 5)
                const reader = new BinaryReader(responseBytes)
                const decoded = GetMarketsInfoResponse.decode(reader)
                return decoded as TResponse
              } catch (decodeError) {
                console.log('❌ Protobuf decoding failed for GetMarketsInfo:', decodeError)
                return { markets: [] } as TResponse
              }
            }
          }

          // Special handling for rental service methods
          if (servicePath === 'hydra_app.RentalService') {
            try {
              const responseData = await response.arrayBuffer()
              const responseBytes = new Uint8Array(responseData, 5)
              const reader = new BinaryReader(responseBytes)

              if (method === 'GetRentalNodeInfo') {
                console.log('🏠 GetRentalNodeInfo: Attempting proper protobuf decoding')
                const decoded = GetRentalNodeInfoResponse.decode(reader)
                console.log('✅ Properly decoded GetRentalNodeInfo response:', decoded)
                return decoded as TResponse
              }

              if (method === 'GetRentableAssetInfo') {
                console.log('🏠 GetRentableAssetInfo: Attempting proper protobuf decoding')
                const decoded = GetRentableAssetInfoResponse.decode(reader)
                console.log('✅ Properly decoded GetRentableAssetInfo response:', decoded)
                return decoded as TResponse
              }

              if (method === 'EstimateRentChannelFee') {
                console.log('🏠 EstimateRentChannelFee: Attempting proper protobuf decoding')
                const decoded = EstimateRentChannelFeeResponse.decode(reader)
                console.log('✅ Properly decoded EstimateRentChannelFee response:', decoded)
                return decoded as TResponse
              }

              if (method === 'RentChannel') {
                console.log('🏠 RentChannel: Attempting proper protobuf decoding')
                const decoded = RentChannelResponse.decode(reader)
                console.log('✅ Properly decoded RentChannel response:', decoded)
                return decoded as TResponse
              }

            } catch (decodeError) {
              console.log('❌ Protobuf decoding failed for rental service:', decodeError)
              throw new Error(`Failed to decode ${method} response`)
            }
          }

          // Try protobuf decoding first for other methods
          const responseData = await response.arrayBuffer()

          if (servicePath === 'hydra_app.AppService' && method === 'GetNetworks') {

            try {
              // Skip the gRPC-Web framing (5 bytes: compression + length)
              const responseBytes = new Uint8Array(responseData, 5)

              // Decode using protobuf
              const reader = new BinaryReader(responseBytes)
              const decoded = GetNetworksResponse.decode(reader)

              return decoded as TResponse
            } catch (decodeError) {
              console.log('❌ Protobuf decoding failed:', decodeError)
              console.log('📦 Falling back to text parsing...')
              // Fall back to text parsing below
            }
          }

          if (servicePath === 'hydra_app.BlockchainService' && method === 'GetFeeEstimates') {
            console.log('🔍 GetFeeEstimates: Attempting proper protobuf decoding')

            try {
              // Skip the gRPC-Web framing (5 bytes: compression + length)
              const responseBytes = new Uint8Array(responseData, 5)

              // Decode using protobuf
              const reader = new BinaryReader(responseBytes)
              const decoded = GetFeeEstimatesResponse.decode(reader)

              return decoded as TResponse
            } catch (decodeError) {
              console.log('❌ Protobuf decoding failed for GetFeeEstimates:', decodeError)
              console.log('📦 Falling back to text parsing...')
              // Fall back to text parsing below
            }
          }

          // Special handling for ClientService methods
          if (servicePath === 'hydra_app.ClientService' && method === 'GetDepositAddress') {
            console.log('🔍 GetDepositAddress: Attempting proper protobuf decoding')

            try {
              // Skip the gRPC-Web framing (5 bytes: compression + length)
              const responseBytes = new Uint8Array(responseData, 5)

              // Decode using protobuf
              const reader = new BinaryReader(responseBytes)
              const decoded = GetDepositAddressResponse.decode(reader)

              console.log('✅ Decoded GetDepositAddress response:', decoded)
              return decoded as TResponse
            } catch (decodeError) {
              console.log('❌ Protobuf decoding failed for GetDepositAddress:', decodeError)
              throw new Error(`Failed to decode ${method} response`)
            }
          }

          if (servicePath === 'hydra_app.WalletService' && method === 'GetBalances') {
            console.log('🔍 GetBalances: Attempting proper protobuf decoding')

            try {
              // Skip the gRPC-Web framing (5 bytes: compression + length)
              const responseBytes = new Uint8Array(responseData, 5)

              // Decode using protobuf
              const reader = new BinaryReader(responseBytes)
              const decoded = GetBalancesResponse.decode(reader)

              return decoded as TResponse
            } catch (decodeError) {
              console.log('❌ Protobuf decoding failed for GetBalances:', decodeError)
              console.log('📦 Falling back to text parsing...')
              // Fall back to text parsing below
            }
          }

          if (servicePath === 'hydra_app.PricingService' && method === 'GetAssetFiatPrice') {

            try {
              // Skip the gRPC-Web framing (5 bytes: compression + length)
              const responseBytes = new Uint8Array(responseData, 5)
              console.log('📦 Message bytes (after frame):', responseBytes)

              // Decode using protobuf
              const reader = new BinaryReader(responseBytes)
              const decoded = GetAssetFiatPriceResponse.decode(reader)
              console.log('✅ Properly decoded GetAssetFiatPrice response:', decoded)

              return decoded as TResponse
            } catch (decodeError) {
              console.log('❌ Protobuf decoding failed for GetAssetFiatPrice:', decodeError)
              console.log('📦 Falling back to text parsing...')
              // Fall back to text parsing below
            }
          }

          if (servicePath === 'hydra_app.AssetService' && method === 'GetAssets') {

            try {
              // Skip the gRPC-Web framing (5 bytes: compression + length)
              const responseBytes = new Uint8Array(responseData, 5)

              // Decode using protobuf
              const reader = new BinaryReader(responseBytes)
              const decoded = GetAssetsResponse.decode(reader)

              return decoded as TResponse
            } catch (decodeError) {
              console.log('❌ Protobuf decoding failed for GetAssets:', decodeError)
              console.log('📦 Falling back to text parsing...')
              // Fall back to text parsing below
            }
          }

          if (servicePath === 'hydra_app.WalletService' && method === 'GetTransactions') {

            try {
              // Skip the gRPC-Web framing (5 bytes: compression + length)
              const responseBytes = new Uint8Array(responseData, 5)

              // Decode using protobuf
              const reader = new BinaryReader(responseBytes)
              const decoded = GetTransactionsResponse.decode(reader)

              return decoded as TResponse
            } catch (decodeError) {
              console.log('❌ Protobuf decoding failed for GetTransactions:', decodeError)
              console.log('📦 Falling back to text parsing...')
              // Fall back to text parsing below
            }
          }

          if (servicePath === 'hydra_app.WatchOnlyNodeService' && method === 'GetChannels') {

            try {
              // Skip the gRPC-Web framing (5 bytes: compression + length)
              const responseBytes = new Uint8Array(responseData, 5)

              // Decode using protobuf
              const reader = new BinaryReader(responseBytes)
              const decoded = GetChannelsResponse.decode(reader)

              return decoded as TResponse
            } catch (decodeError) {
              console.log('❌ Protobuf decoding failed for GetChannels:', decodeError)
              console.log('📦 Falling back to text parsing...')
              // Fall back to text parsing below
            }
          }

          if (servicePath === 'hydra_app.NodeService' && method === 'GetConnectedPeers') {

            try {
              // Skip the gRPC-Web framing (5 bytes: compression + length)
              const responseBytes = new Uint8Array(responseData, 5)

              // Decode using protobuf
              const reader = new BinaryReader(responseBytes)
              const decoded = GetConnectedPeersResponse.decode(reader)

              return decoded as TResponse
            } catch (decodeError) {
              console.log('❌ Protobuf decoding failed for GetConnectedPeers:', decodeError)
              console.log('📦 Falling back to text parsing...')
              // Fall back to text parsing below
            }
          }

          if (servicePath === 'hydra_app.NodeService' && method === 'EstimateOpenChannelFee') {
            console.log('🔍 EstimateOpenChannelFee: Attempting proper protobuf decoding')

            try {
              // Skip the gRPC-Web framing (5 bytes: compression + length)
              const responseBytes = new Uint8Array(responseData, 5)
              console.log('📦 Message bytes (after frame):', responseBytes)

              // Decode using protobuf
              const reader = new BinaryReader(responseBytes)
              const decoded = EstimateOpenChannelFeeResponse.decode(reader)
              console.log('✅ Properly decoded EstimateOpenChannelFee response:', decoded)

              return decoded as TResponse
            } catch (decodeError) {
              console.log('❌ Protobuf decoding failed for EstimateOpenChannelFee:', decodeError)
              console.log('📦 Falling back to text parsing...')
              // Fall back to text parsing below
            }
          }

          if (servicePath === 'hydra_app.NodeService' && method === 'OpenChannel') {
            console.log('🔍 OpenChannel: Attempting proper protobuf decoding')

            try {
              // Skip the gRPC-Web framing (5 bytes: compression + length)
              const responseBytes = new Uint8Array(responseData, 5)
              console.log('📦 Message bytes (after frame):', responseBytes)

              // Decode using protobuf
              const reader = new BinaryReader(responseBytes)
              const decoded = OpenChannelResponse.decode(reader)
              console.log('✅ Properly decoded OpenChannel response:', decoded)

              return decoded as TResponse
            } catch (decodeError) {
              console.log('❌ Protobuf decoding failed for OpenChannel:', decodeError)
              console.log('📦 Falling back to text parsing...')
              // Fall back to text parsing below
            }
          }
        }


        // If protobuf decoding failed or wasn't applicable, fall back to text parsing
        const responseText = await responseClone.text()
        console.log('🔍 No gRPC headers found. Response body:', responseText)
        const allHeaders = [...response.headers.entries()]
        console.log('📋 All response headers:', allHeaders)
        allHeaders.forEach(([key, value]) => console.log(`  ${key}: ${value}`))

        if (response.status === 200) {
          console.log('⚠️ Got HTTP 200 but no gRPC headers - this suggests a protocol mismatch')

          // TEMPORARY: Parse the text response since your backend isn't returning proper gRPC-Web format
          if ((servicePath === 'hydra_app.WalletService' && method === 'GetBalances') ||
              (servicePath === 'hydra_app.OrderbookService' && method === 'InitMarket')) {
            if (responseText.includes('grpc-status:0')) {
              if (servicePath === 'hydra_app.OrderbookService' && method === 'InitMarket') {
                console.log('🎯 WORKAROUND: InitMarket succeeded (grpc-status:0 found)')
                // Return a basic success response for InitMarket
                return { success: true, message: 'Market initialized successfully' } as TResponse
              }


              console.log('🔧 WORKAROUND: Parsing GetBalances text response')
              console.log('💰 Raw balance data:', JSON.stringify(responseText))

              // Extract balance data - look for the Bitcoin asset ID pattern and amounts
              const assetIdPattern = /0x[0-9a-f]{64}/i
              const assetMatch = responseText.match(assetIdPattern)

              if (assetMatch) {
                const assetId = assetMatch[0]
                console.log(`🪙 Found asset: ${assetId}`)

                // Extract numeric values (amounts) from the response
                const amounts = responseText.match(/\d+\.\d+/g) || []
                console.log('💎 Found amounts:', amounts)

                if (amounts.length >= 2) {
                  // Assume first few amounts are onchain/offchain balances
                  const balances = {
                    [assetId]: {
                      onChain: parseFloat(amounts[0]) || 0,
                      offChain: parseFloat(amounts[1]) || 0
                    }
                  }

                  console.log('✅ Parsed balance data:', balances)
                  return { balances } as TResponse
                }
              }

              return { balances: {} } as TResponse
            }
          } else {
            // No grpc-status:0 found, but still might be valid data
            if (servicePath === 'hydra_app.OrderbookService' && (method === 'GetMarketsInfo' || method === 'GetInitializedMarkets')) {
              console.log('📊 WORKAROUND: Market method without grpc-status:0')
              console.log('📄 Raw response:', responseText)
              return { markets: [] } as TResponse
            }
          }

          if (servicePath === 'hydra_app.NodeService' && method === 'ConnectToPeer' && responseText.includes('grpc-status:0')) {
            console.log('🔧 WORKAROUND: ConnectToPeer succeeded - grpc-status:0 found in response body')
            // ConnectToPeer returns an empty response on success
            // Since grpc-status:0 means success, return empty response
            return {} as TResponse
          }


          if (servicePath === 'hydra_app.AppService' && method === 'GetNetworks' && responseText.includes('grpc-status:0')) {
            console.log('🔧 WORKAROUND: Parsing text-format response for GetNetworks')
            console.log('📝 Raw response text for debugging:', JSON.stringify(responseText))

            // More specific parsing to find all three networks from the raw response
            // Based on the raw response pattern we can see: "0a03cf40", "11155111", "421614"
            const networkIds = []

            // Extract Bitcoin network ID (8 hex chars)
            const bitcoinMatch = responseText.match(/[a-f0-9]{8}/i)
            if (bitcoinMatch) {
              networkIds.push(bitcoinMatch[0])
            }

            // Extract EVM network IDs (numeric, various lengths)
            // Look for sequences of digits that are likely network IDs
            const evmMatches = [...responseText.matchAll(/(\d{6,8})/g)]
            for (const match of evmMatches) {
              const id = match[1]
              // Filter out obviously non-network values (like timestamps, etc.)
              if (parseInt(id) > 0 && parseInt(id) < 100000000) {
                networkIds.push(id)
              }
            }

            console.log('📋 Extracted network IDs:', networkIds)
            const networkIdMatches = [...new Set(networkIds)] // Remove duplicates

            const networks = networkIdMatches.map(networkId => {
              // Clean up the network ID
              const cleanId = networkId.trim()

              // Determine protocol based on network ID format and known values
              const isBitcoin = cleanId.length === 8 && /^[a-f0-9]{8}$/i.test(cleanId)
              const isKnownEvm = ['1', '11155111', '421614', '42161', '137', '56', '10', '43114'].includes(cleanId)

              const protocol = isKnownEvm ? Protocol.EVM : (isBitcoin ? Protocol.BITCOIN : Protocol.EVM)

              console.log(`🔍 Processing network ID: "${cleanId}" (length: ${cleanId.length}, isBitcoin: ${isBitcoin}, isKnownEvm: ${isKnownEvm})`)

              return {
                protocol: protocol,
                id: cleanId
              }
            }).filter(network => network.id.length > 0) // Filter out empty IDs

            console.log('🌐 Parsed networks from text response:', networks)
            return { networks } as TResponse
          }
        }

        throw new Error(`No gRPC headers in response. HTTP status: ${response.status}. This suggests the server isn't handling gRPC-Web properly.`)
      }

      if (grpcStatus === '0') {
        // Success - parse the response
        const responseData = await response.arrayBuffer()
        console.log('✅ gRPC success, response size:', responseData.byteLength, 'bytes')
        console.log('📦 Raw response data:', new Uint8Array(responseData))

        if (servicePath === 'hydra_app.AppService' && method === 'GetNetworks') {

          try {
            // Skip the gRPC-Web framing (5 bytes: compression + length)
            const responseBytes = new Uint8Array(responseData, 5)

            // Decode using protobuf
            const reader = new BinaryReader(responseBytes)
            const decoded = GetNetworksResponse.decode(reader)

            return decoded as TResponse
          } catch (decodeError) {
            console.log('❌ Protobuf decoding failed:', decodeError)
            console.log('📦 Falling back to text parsing...')
            // Fall back to text parsing if protobuf decoding fails
          }
        }

        if (servicePath === 'hydra_app.WalletService' && method === 'GetBalances') {
          console.log('🔍 GetBalances: Attempting proper protobuf decoding')

          try {
            // Skip the gRPC-Web framing (5 bytes: compression + length)
            const responseBytes = new Uint8Array(responseData, 5)

            // Decode using protobuf
            const reader = new BinaryReader(responseBytes)
            const decoded = GetBalancesResponse.decode(reader)

            return decoded as TResponse
          } catch (decodeError) {
            console.log('❌ Protobuf decoding failed for GetBalances:', decodeError)
            console.log('📦 Falling back to text parsing...')
            // Fall back to text parsing if protobuf decoding fails
          }
        }

        if (servicePath === 'hydra_app.BlockchainService' && method === 'GetFeeEstimates') {

          try {
            // Skip the gRPC-Web framing (5 bytes: compression + length)
            const responseBytes = new Uint8Array(responseData, 5)

            // Decode using protobuf
            const reader = new BinaryReader(responseBytes)
            const decoded = GetFeeEstimatesResponse.decode(reader)

            return decoded as TResponse
          } catch (decodeError) {
            console.log('❌ Protobuf decoding failed for GetFeeEstimates:', decodeError)
            console.log('📦 Falling back to text parsing...')
            // Fall back to text parsing if protobuf decoding fails
          }
        }

        if (servicePath === 'hydra_app.WalletService' && method === 'GetTransactions') {

          try {
            // Skip the gRPC-Web framing (5 bytes: compression + length)
            const responseBytes = new Uint8Array(responseData, 5)

            // Decode using protobuf
            const reader = new BinaryReader(responseBytes)
            const decoded = GetTransactionsResponse.decode(reader)

            return decoded as TResponse
          } catch (decodeError) {
            console.log('❌ Protobuf decoding failed for GetTransactions:', decodeError)
            console.log('📦 Falling back to empty array...')
            return { transactions: [] } as TResponse
          }
        }

        if (servicePath === 'hydra_app.WatchOnlyNodeService' && method === 'GetChannels') {

          try {
            // Skip the gRPC-Web framing (5 bytes: compression + length)
            const responseBytes = new Uint8Array(responseData, 5)

            // Decode using protobuf
            const reader = new BinaryReader(responseBytes)
            const decoded = GetChannelsResponse.decode(reader)

            return decoded as TResponse
          } catch (decodeError) {
            console.log('❌ Protobuf decoding failed for GetChannels:', decodeError)
            console.log('📦 Falling back to empty array...')
            return { channels: [] } as TResponse
          }
        }

        if (servicePath === 'hydra_app.NodeService' && method === 'GetConnectedPeers') {

          try {
            // Skip the gRPC-Web framing (5 bytes: compression + length)
            const responseBytes = new Uint8Array(responseData, 5)

            // Decode using protobuf
            const reader = new BinaryReader(responseBytes)
            const decoded = GetConnectedPeersResponse.decode(reader)

            return decoded as TResponse
          } catch (decodeError) {
            console.log('❌ Protobuf decoding failed for GetConnectedPeers:', decodeError)
            console.log('📦 Falling back to empty array...')
            return { nodeIds: [] } as TResponse
          }
        }

        if (servicePath === 'hydra_app.PricingService' && method === 'GetAssetFiatPrice') {

          try {
            // Skip the gRPC-Web framing (5 bytes: compression + length)
            const responseBytes = new Uint8Array(responseData, 5)

            // Decode using protobuf
            const reader = new BinaryReader(responseBytes)
            const decoded = GetAssetFiatPriceResponse.decode(reader)

            return decoded as TResponse
          } catch (decodeError) {
            console.log('❌ Protobuf decoding failed for GetAssetFiatPrice:', decodeError)
            console.log('📦 Falling back to zero price...')
            return { price: { value: '0' } } as TResponse
          }
        }

        if (servicePath === 'hydra_app.AssetService' && method === 'GetAssets') {

          try {
            // Skip the gRPC-Web framing (5 bytes: compression + length)
            const responseBytes = new Uint8Array(responseData, 5)

            // Decode using protobuf
            const reader = new BinaryReader(responseBytes)
            const decoded = GetAssetsResponse.decode(reader)

            return decoded as TResponse
          } catch (decodeError) {
            console.log('❌ Protobuf decoding failed for GetAssets:', decodeError)
            return { assets: [] } as TResponse
          }
        }

        if (servicePath === 'hydra_app.AssetService' && method === 'GetAsset') {

          try {
            // Skip the gRPC-Web framing (5 bytes: compression + length)
            const responseBytes = new Uint8Array(responseData, 5)

            // Decode using protobuf
            const reader = new BinaryReader(responseBytes)
            const decoded = GetAssetResponse.decode(reader)

            return decoded as TResponse
          } catch (decodeError) {
            console.log('❌ Protobuf decoding failed for GetAsset:', decodeError)
            return { asset: null } as TResponse
          }
        }

        return {} as TResponse
      } else {
        console.log(`❌ gRPC error: status=${grpcStatus}, message=${grpcMessage}`)
        throw new Error(`gRPC error: status=${grpcStatus}, message=${grpcMessage}`)
      }
    } catch (error: any) {
      // Enhanced error handling with detailed diagnostics
      const errorDetails = {
        url,
        method: `${servicePath}/${method}`,
        originalError: error.message,
        errorType: error.constructor.name,
        timestamp: new Date().toISOString()
      }

      // Network-specific error analysis
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        errorDetails.diagnosis = [
          `🔌 Network connection failed to ${this.baseUrl}`,
          `• Check if Hydra backend is running on port 5001`,
          `• Verify CORS is enabled for gRPC-Web requests`,
          `• Test basic connectivity: curl ${this.baseUrl}`,
          `• Check browser dev tools Network tab for details`
        ].join('\n')
      } else if (error.message.includes('CORS')) {
        errorDetails.diagnosis = [
          `🌐 CORS (Cross-Origin Resource Sharing) error`,
          `• Hydra backend needs to allow origin: http://localhost:3000`,
          `• Required CORS headers: Access-Control-Allow-Origin, Access-Control-Allow-Headers`,
          `• Required methods: POST, OPTIONS`,
          `• Required headers: content-type, x-grpc-web, x-user-agent`
        ].join('\n')
      } else if (error.message.includes('timeout')) {
        errorDetails.diagnosis = [
          `⏱️ Request timeout`,
          `• Hydra backend may be overloaded or unresponsive`,
          `• Check backend logs for processing delays`,
          `• Consider increasing timeout values`
        ].join('\n')
      } else if (error.message.includes('refused')) {
        errorDetails.diagnosis = [
          `🚫 Connection refused`,
          `• Port 5001 is not accepting connections`,
          `• Hydra backend may not be running`,
          `• Check if another service is using port 5001`,
          `• Verify backend configuration`
        ].join('\n')
      } else {
        errorDetails.diagnosis = [
          `❓ Unexpected error during gRPC call`,
          `• Check browser console for additional details`,
          `• Verify request format and encoding`,
          `• Check Hydra backend logs for server-side errors`
        ].join('\n')
      }

      console.error(`❌ gRPC call failed with detailed diagnostics:`, errorDetails)

      // Create a more informative error message
      const enhancedError = new Error(
        `gRPC call to ${servicePath}/${method} failed:\n${errorDetails.diagnosis}`
      )
      enhancedError.name = 'GrpcCallError'
      enhancedError.cause = error

      throw enhancedError
    }
  }

  /**
   * Get available networks from Hydra backend
   */
  async getNetworks(): Promise<Network[]> {
    try {

      const request: GetNetworksRequest = {}

      const result = await this.grpcCall<GetNetworksRequest, GetNetworksResponse>(
        'hydra_app.AppService',
        'GetNetworks',
        request,
        GetNetworksRequest.encode
      )

      return result.networks || []

    } catch (error) {
      console.log(`❌ Failed to get networks: ${error.message}`)
      return []
    }
  }

  /**
   * Get wallet balances from all configured networks
   */
  async getBalances(): Promise<{ balances: Record<string, any> }> {
    // First, get the actual networks configured in Hydra
    const configuredNetworks = await this.getNetworks()

    if (configuredNetworks.length === 0) {
      console.log('⚠️ No networks configured in Hydra backend')
      return { balances: {} }
    }

    const allBalances: Record<string, any> = {}
    let successCount = 0

    // Query balances for each configured network
    for (const network of configuredNetworks) {
      try {
        const networkName = network.protocol === Protocol.BITCOIN
          ? `Bitcoin ${network.id}`
          : `EVM ${network.id}`

        console.log(`💰 Fetching balances for ${networkName}`)

        const request: GetBalancesRequest = { network }

        const result = await this.grpcCall<GetBalancesRequest, GetBalancesResponse>(
          'hydra_app.WalletService',
          'GetBalances',
          request,
          GetBalancesRequest.encode
        )

        // Merge balances from this network
        if (result.balances) {
          Object.assign(allBalances, result.balances)
          console.log(`✅ Got balances for ${networkName}:`, Object.keys(result.balances))
          successCount++
        } else {
          console.log(`✅ Connected to ${networkName} but no balances found`)
          successCount++
        }

      } catch (error) {
        const networkName = network.protocol === Protocol.BITCOIN
          ? `Bitcoin ${network.id}`
          : `EVM ${network.id}`

        if (error.message.includes('internal server error') || error.message.includes('grpc-status: 3')) {
          console.log(`⚠️ ${networkName}: No wallet configured (this is normal if you haven't set up this network)`)
        } else {
          console.log(`❌ ${networkName}: ${error.message}`)
        }
      }
    }

    console.log(`📊 Successfully fetched balances from ${successCount}/${configuredNetworks.length} networks`)
    return { balances: allBalances }
  }

  /**
   * Get deposit address for a specific network
   */
  async getDepositAddress(network: any): Promise<string> {
    try {
      const networkName = network.protocol === Protocol.BITCOIN
        ? `Bitcoin ${network.id}`
        : `EVM ${network.id}`

      console.log(`🔍 GetDepositAddress request:`, {
        service: 'hydra_app.ClientService',
        method: 'GetDepositAddress',
        network: {
          protocol: network.protocol,
          id: network.id
        }
      })

      const request: GetDepositAddressRequest = { network }

      const result = await this.grpcCall<GetDepositAddressRequest, GetDepositAddressResponse>(
        'hydra_app.ClientService',
        'GetDepositAddress',
        request,
        GetDepositAddressRequest.encode
      )

      console.log(`✅ Got deposit address for ${networkName}:`, result.address)
      return result.address || 'N/A'

    } catch (error) {
      const networkName = network.protocol === Protocol.BITCOIN
        ? `Bitcoin ${network.id}`
        : `EVM ${network.id}`

      console.error(`❌ Failed to get deposit address for ${networkName}:`, error)
      throw error
    }
  }

  /**
   * Get channels from WatchOnlyNode service
   */
  async getChannels(): Promise<any> {
    try {
      console.log('📡 Fetching channels from Hydra backend...')

      // Get configured networks first
      const networks = await this.getNetworks()
      if (networks.length === 0) {
        console.log('⚠️ No networks configured for channels')
        return []
      }

      const allChannels: any[] = []

      // Query channels for each network
      for (const network of networks) {
        try {
          const request: GetChannelsRequest = { network }

          const result = await this.grpcCall(
            'hydra_app.WatchOnlyNodeService',
            'GetChannels',
            request,
            GetChannelsRequest.encode
          )

          console.log(`✅ Channels response for ${network.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} ${network.id}:`, result)
          if (result.channels) {
            allChannels.push(...result.channels)
          }
        } catch (error) {
          const networkName = network.protocol === Protocol.BITCOIN ? `Bitcoin ${network.id}` : `EVM ${network.id}`
          console.log(`❌ Failed to get channels for ${networkName}: ${error.message}`)
        }
      }

      return allChannels
    } catch (error) {
      console.log(`❌ Failed to get channels: ${error.message}`)
      return []
    }
  }

  /**
   * Get connected peers from Node service
   */
  async getPeers(): Promise<any> {
    try {
      console.log('🤝 Fetching connected peers from Hydra backend...', new Date().toISOString())

      // Get configured networks first
      const networks = await this.getNetworks()
      if (networks.length === 0) {
        console.log('⚠️ No networks configured for peers')
        return []
      }

      const allPeers: Array<{id: string, network: Network, networkName: string}> = []

      // Query peers for each network
      for (const network of networks) {
        try {
          const request: GetConnectedPeersRequest = { network }

          const result = await this.grpcCall(
            'hydra_app.NodeService',
            'GetConnectedPeers',
            request,
            GetConnectedPeersRequest.encode
          )

          const networkName = network.protocol === Protocol.BITCOIN ? `Bitcoin ${network.id}` : `EVM ${network.id}`
          console.log(`✅ Connected peers response for ${networkName}:`, result)
          console.log(`🔍 Network details for ${networkName}:`, { id: network.id, protocol: network.protocol })

          if (result.nodeIds) {
            console.log(`📝 Adding ${result.nodeIds.length} peers for ${networkName}:`, result.nodeIds)
            // Add each peer with its network information
            result.nodeIds.forEach((nodeId: string) => {
              console.log(`   ➕ Adding peer ${nodeId} for ${networkName}`)
              allPeers.push({
                id: nodeId,
                network,
                networkName
              })
            })
          } else {
            console.log(`🚫 No nodeIds found for ${networkName}`)
          }
        } catch (error) {
          const networkName = network.protocol === Protocol.BITCOIN ? `Bitcoin ${network.id}` : `EVM ${network.id}`
          console.log(`❌ Failed to get peers for ${networkName}: ${error.message}`)
        }
      }

      // Keep all peers (same nodeId can be connected to multiple networks)
      // This allows showing the same peer connected to different networks as separate entries
      const uniquePeers = allPeers

      console.log(`🎯 Final peer list summary (${uniquePeers.length} total):`)
      uniquePeers.forEach((peer, index) => {
        console.log(`   ${index + 1}. ${peer.id} on ${peer.networkName}`)
      })

      return uniquePeers
    } catch (error) {
      console.log(`❌ Failed to get connected peers: ${error.message}`)
      return []
    }
  }

  /**
   * Connect to a peer on a specific network
   */
  async connectToPeer(network: Network, peerUrl: string): Promise<void> {
    try {
      console.log(`🤝 Connecting to peer ${peerUrl} on ${network.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} ${network.id}...`)

      const request: ConnectToPeerRequest = {
        network,
        peerUrl
      }

      await this.grpcCall<ConnectToPeerRequest, ConnectToPeerResponse>(
        'hydra_app.NodeService',
        'ConnectToPeer',
        request,
        ConnectToPeerRequest.encode
      )

      console.log(`✅ Successfully connected to peer ${peerUrl}`)
    } catch (error) {
      console.error(`❌ Failed to connect to peer ${peerUrl}:`, error.message)
      throw error
    }
  }

  /**
   * Get transactions from Wallet service
   */
  async getTransactions(network?: Network): Promise<any> {
    try {
      console.log('📄 Fetching transactions from Hydra backend...')

      if (network) {
        // Query specific network
        const request: GetTransactionsRequest = { network }

        const result = await this.grpcCall(
          'hydra_app.WalletService',
          'GetTransactions',
          request,
          GetTransactionsRequest.encode
        )

        console.log('✅ Transactions response:', result)
        return result.transactions || []
      }

      // Query all networks
      const networks = await this.getNetworks()
      if (networks.length === 0) {
        console.log('⚠️ No networks configured for transactions')
        return []
      }

      const allTransactions: any[] = []

      // Query transactions for each network
      for (const net of networks) {
        try {
          const request: GetTransactionsRequest = { network: net }

          const result = await this.grpcCall(
            'hydra_app.WalletService',
            'GetTransactions',
            request,
            GetTransactionsRequest.encode
          )

          console.log(`✅ Transactions response for ${net.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} ${net.id}:`, result)
          if (result.transactions) {
            allTransactions.push(...result.transactions)
          }
        } catch (error) {
          const networkName = net.protocol === Protocol.BITCOIN ? `Bitcoin ${net.id}` : `EVM ${net.id}`
          console.log(`❌ Failed to get transactions for ${networkName}: ${error.message}`)
        }
      }

      return allTransactions
    } catch (error) {
      console.log(`❌ Failed to get transactions: ${error.message}`)
      return []
    }
  }

  /**
   * Get orderbook markets
   */
  async getMarkets(): Promise<any> {
    try {
      console.log('📈 Fetching markets from Hydra backend...')

      const result = await this.grpcCall(
        'hydra_app.OrderbookService',
        'GetMarkets',
        {},
        (request) => new BinaryWriter() // Empty request
      )

      console.log('✅ Markets response:', result)
      return result.markets || []
    } catch (error) {
      console.log(`❌ Failed to get markets: ${error.message}`)
      return []
    }
  }

  /**
   * Get asset price in fiat currency from Pricing service
   */
  async getAssetFiatPrice(network: Network, assetId: string, fiatCurrency: FiatCurrency = FiatCurrency.USD): Promise<number> {
    try {
      const request: GetAssetFiatPriceRequest = {
        network,
        assetId,
        fiatCurrency
      }

      const result = await this.grpcCall(
        'hydra_app.PricingService',
        'GetAssetFiatPrice',
        request,
        GetAssetFiatPriceRequest.encode
      )

      // Debug only the response structure to fix parsing
      console.log(`📥 Pricing response for ${assetId}:`, result)

      const price = parseFloat(result.price?.value || '0')
      return price
    } catch (error) {
      console.log(`❌ Price fetch failed for ${assetId}: ${error.message}`)
      return 0
    }
  }

  /**
   * Get all assets for a specific network
   */
  async getAssets(network: Network): Promise<Asset[]> {
    try {
      const request: GetAssetsRequest = { network }

      const result = await this.grpcCall(
        'hydra_app.AssetService',
        'GetAssets',
        request,
        GetAssetsRequest.encode
      )

      return result.assets || []
    } catch (error) {
      console.log(`❌ AssetService failed for network ${network.id}: ${error.message}`)
      return []
    }
  }

  /**
   * Get specific asset details
   */
  async getAsset(network: Network, assetId: string): Promise<Asset | null> {
    try {
      const request: GetAssetRequest = { network, assetId }

      const result = await this.grpcCall(
        'hydra_app.AssetService',
        'GetAsset',
        request,
        GetAssetRequest.encode
      )

      return result.asset || null
    } catch (error) {
      console.log(`❌ GetAsset failed for ${assetId}: ${error.message}`)
      return null
    }
  }

  /**
   * Channel Management Methods
   */

  // Open a new channel with a peer
  async openChannel(network: Network, nodeId: string, assetAmounts: Record<string, any>, feeRate: any): Promise<OpenChannelResponse> {
    try {
      console.log(`🔓 Opening channel with peer ${nodeId} on ${network.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} ${network.id}...`)

      // Transform assetAmounts to proper SendAmount format
      const transformedAssetAmounts: Record<string, SendAmount> = {}
      for (const [assetId, amount] of Object.entries(assetAmounts)) {
        if (amount && typeof amount === 'object' && 'exact' in amount && amount.exact) {
          // The amount.exact.amount is a string, but we need DecimalString { value: string }
          const decimalAmount: DecimalString = { value: amount.exact.amount }
          transformedAssetAmounts[assetId] = {
            exact: { amount: decimalAmount }
          }
          console.log(`✅ Transformed ${assetId}: ${amount.exact.amount} -> DecimalString`)
        } else {
          console.warn(`❌ Invalid asset amount format for ${assetId}:`, amount)
          console.warn(`   Expected: { exact: { amount: string } }, got:`, typeof amount, amount)
        }
      }

      const request: OpenChannelRequest = {
        network,
        nodeId,
        assetAmounts: transformedAssetAmounts,
        feeOption: this.convertFeeRateToFeeOption(feeRate)
      }

      const result = await this.grpcCall<OpenChannelRequest, OpenChannelResponse>(
        'hydra_app.NodeService',
        'OpenChannel',
        request,
        OpenChannelRequest.encode
      )

      console.log(`✅ Channel opened successfully:`, result)
      return result
    } catch (error: any) {
      console.error(`❌ Failed to open channel:`, error.message)
      throw error
    }
  }

  // Estimate fee for opening a channel
  async estimateOpenChannelFee(network: Network, nodeId: string, assetAmounts: Record<string, any>, feeRate: any): Promise<EstimateOpenChannelFeeResponse> {
    try {
      console.log(`💰 Estimating fee for opening channel with ${nodeId}...`)

      // Transform assetAmounts to proper SendAmount format
      const transformedAssetAmounts: Record<string, SendAmount> = {}
      for (const [assetId, amount] of Object.entries(assetAmounts)) {
        if (amount && typeof amount === 'object' && 'exact' in amount && amount.exact) {
          // The amount.exact.amount is a string, but we need DecimalString { value: string }
          const decimalAmount: DecimalString = { value: amount.exact.amount }
          transformedAssetAmounts[assetId] = {
            exact: { amount: decimalAmount }
          }
          console.log(`✅ Transformed ${assetId}: ${amount.exact.amount} -> DecimalString`)
        } else {
          console.warn(`❌ Invalid asset amount format for ${assetId}:`, amount)
          console.warn(`   Expected: { exact: { amount: string } }, got:`, typeof amount, amount)
        }
      }

      // Convert fee rate string to FeeOption
      const feeOption = this.convertFeeRateToFeeOption(feeRate)

      const request: EstimateOpenChannelFeeRequest = {
        network,
        nodeId,
        assetAmounts: transformedAssetAmounts,
        feeOption
      }

      console.log(`📤 EstimateOpenChannelFee request - Fee option being sent: ${feeRate}`, feeOption)

      const result = await this.grpcCall<EstimateOpenChannelFeeRequest, EstimateOpenChannelFeeResponse>(
        'hydra_app.NodeService',
        'EstimateOpenChannelFee',
        request,
        EstimateOpenChannelFeeRequest.encode
      )

      console.log(`💰 Estimated fee:`, result.fee)
      return result
    } catch (error: any) {
      console.error(`❌ Failed to estimate open channel fee:`, error.message)
      throw error
    }
  }

  // Convert fee rate string ('low', 'medium', 'high') to FeeOption object
  private convertFeeRateToFeeOption(feeRate: string): any {
    switch (feeRate) {
      case 'low':
        return { low: {} }
      case 'medium':
        return { medium: {} }
      case 'high':
        return { high: {} }
      default:
        return { medium: {} } // default to medium
    }
  }

  // Deposit assets into an existing channel
  async depositChannel(network: Network, channelId: string, assetAmounts: Record<string, any>, feeRate: any): Promise<any> {
    try {
      console.log(`💰 Depositing into channel ${channelId} on ${network.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} ${network.id}...`)
      console.log(`📝 assetAmounts:`, assetAmounts)
      console.log(`📝 feeRate:`, feeRate)

      // Transform assetAmounts to proper SendAmount format
      const transformedAssetAmounts: Record<string, SendAmount> = {}
      for (const [assetId, amount] of Object.entries(assetAmounts)) {
        if (amount && typeof amount === 'object' && 'exact' in amount && amount.exact) {
          // Check if amount.exact.amount is already a DecimalString or just a string
          const amountValue = amount.exact.amount
          const decimalAmount: DecimalString = typeof amountValue === 'string'
            ? { value: amountValue }
            : amountValue  // Already a DecimalString
          transformedAssetAmounts[assetId] = {
            exact: { amount: decimalAmount }
          }
          console.log(`✅ Transformed ${assetId}:`, amount, '-> DecimalString')
        } else {
          console.warn(`❌ Invalid asset amount format for ${assetId}:`, amount)
          console.warn(`   Expected: { exact: { amount: string | DecimalString } }, got:`, typeof amount, amount)
        }
      }

      const feeOption = this.convertFeeRateToFeeOption(feeRate)
      console.log(`📝 feeOption:`, feeOption)

      const request: DepositChannelRequest = {
        network,
        channelId,
        assetAmounts: transformedAssetAmounts,
        feeOption
      }

      console.log(`📝 Full request:`, JSON.stringify(request, null, 2))

      const result = await this.grpcCall<DepositChannelRequest, DepositChannelResponse>(
        'hydra_app.NodeService',
        'DepositChannel',
        request,
        DepositChannelRequest.encode
      )

      console.log(`✅ Channel deposit successful:`, result)
      return result
    } catch (error: any) {
      console.error(`❌ Failed to deposit to channel:`, error?.message)
      throw error
    }
  }

  // Estimate fee for depositing to a channel
  async estimateDepositChannelFee(network: Network, channelId: string, assetAmounts: Record<string, any>, feeRate: any): Promise<any> {
    try {
      const request: EstimateDepositChannelFeeRequest = {
        network,
        channelId,
        assetAmounts,
        feeOption: this.convertFeeRateToFeeOption(feeRate)
      }

      const result = await this.grpcCall<EstimateDepositChannelFeeRequest, EstimateDepositChannelFeeResponse>(
        'hydra_app.NodeService',
        'EstimateDepositChannelFee',
        request,
        EstimateDepositChannelFeeRequest.encode
      )

      return result
    } catch (error: any) {
      console.error(`❌ Failed to estimate deposit channel fee:`, error?.message)
      throw error
    }
  }

  // Withdraw assets from an existing channel
  async withdrawChannel(network: Network, channelId: string, assetAmounts: Record<string, any>, feeRate: any): Promise<any> {
    try {
      console.log(`💸 Withdrawing from channel ${channelId} on ${network.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} ${network.id}...`)

      const request: WithdrawChannelRequest = {
        network,
        channelId,
        assetAmounts,
        feeOption: this.convertFeeRateToFeeOption(feeRate)
      }

      const result = await this.grpcCall<WithdrawChannelRequest, WithdrawChannelResponse>(
        'hydra_app.NodeService',
        'WithdrawChannel',
        request,
        WithdrawChannelRequest.encode
      )

      console.log(`✅ Channel withdrawal successful:`, result)
      return result
    } catch (error: any) {
      console.error(`❌ Failed to withdraw from channel:`, error?.message)
      throw error
    }
  }

  // Estimate fee for withdrawing from a channel
  async estimateWithdrawChannelFee(network: Network, channelId: string, assetAmounts: Record<string, any>, feeRate: any): Promise<any> {
    try {
      const request: EstimateWithdrawChannelFeeRequest = {
        network,
        channelId,
        assetAmounts,
        feeOption: this.convertFeeRateToFeeOption(feeRate)
      }

      const result = await this.grpcCall<EstimateWithdrawChannelFeeRequest, EstimateWithdrawChannelFeeResponse>(
        'hydra_app.NodeService',
        'EstimateWithdrawChannelFee',
        request,
        EstimateWithdrawChannelFeeRequest.encode
      )

      return result
    } catch (error: any) {
      console.error(`❌ Failed to estimate withdraw channel fee:`, error?.message)
      throw error
    }
  }

  // Close a channel
  async closeChannel(network: Network, channelId: string, assetIds: string[], feeRate: any): Promise<any> {
    try {
      console.log(`🔒 Closing channel ${channelId} on ${network.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} ${network.id}...`)

      const request: CloseChannelRequest = {
        network,
        channelId,
        assetIds,
        feeOption: this.convertFeeRateToFeeOption(feeRate)
      }

      const result = await this.grpcCall<CloseChannelRequest, CloseChannelResponse>(
        'hydra_app.NodeService',
        'CloseChannel',
        request,
        CloseChannelRequest.encode
      )

      console.log(`✅ Channel closed successfully:`, result)
      return result
    } catch (error: any) {
      console.error(`❌ Failed to close channel:`, error?.message)
      throw error
    }
  }

  // Estimate fee for closing a channel
  async estimateCloseChannelFee(network: Network, channelId: string, assetIds: string[], feeRate: any): Promise<any> {
    try {
      const request: EstimateCloseChannelFeeRequest = {
        network,
        channelId,
        assetIds,
        feeOption: this.convertFeeRateToFeeOption(feeRate)
      }

      const result = await this.grpcCall<EstimateCloseChannelFeeRequest, EstimateCloseChannelFeeResponse>(
        'hydra_app.NodeService',
        'EstimateCloseChannelFee',
        request,
        EstimateCloseChannelFeeRequest.encode
      )

      return result
    } catch (error: any) {
      console.error(`❌ Failed to estimate close channel fee:`, error?.message)
      throw error
    }
  }

  // Force close a channel (unilateral close)
  async forceCloseChannel(network: Network, channelId: string, assetIds: string[], feeRate: any): Promise<any> {
    try {
      console.log(`⚡ Force closing channel ${channelId} on ${network.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} ${network.id}...`)

      const request: ForceCloseChannelRequest = {
        network,
        channelId,
        assetIds,
        feeOption: this.convertFeeRateToFeeOption(feeRate)
      }

      const result = await this.grpcCall<ForceCloseChannelRequest, ForceCloseChannelResponse>(
        'hydra_app.NodeService',
        'ForceCloseChannel',
        request,
        ForceCloseChannelRequest.encode
      )

      console.log(`✅ Channel force closed successfully:`, result)
      return result
    } catch (error: any) {
      console.error(`❌ Failed to force close channel:`, error?.message)
      throw error
    }
  }

  // Estimate fee for force closing a channel
  async estimateForceCloseChannelFee(network: Network, channelId: string, assetIds: string[], feeRate: any): Promise<any> {
    try {
      const request: EstimateForceCloseChannelFeeRequest = {
        network,
        channelId,
        assetIds,
        feeOption: this.convertFeeRateToFeeOption(feeRate)
      }

      const result = await this.grpcCall<EstimateForceCloseChannelFeeRequest, EstimateForceCloseChannelFeeResponse>(
        'hydra_app.NodeService',
        'EstimateForceCloseChannelFee',
        request,
        EstimateForceCloseChannelFeeRequest.encode
      )

      return result
    } catch (error: any) {
      console.error(`❌ Failed to estimate force close channel fee:`, error?.message)
      throw error
    }
  }


  /**
   * Event Streaming Methods
   */

  // Subscribe to node events for a specific network
  async subscribeToNodeEvents(network: Network, onEvent: (event: NodeEvent) => void, onError?: (error: Error) => void): Promise<() => void> {
    console.log(`🎧 Subscribing to node events for ${network.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} ${network.id}...`)

    const request: SubscribeNodeEventsRequest = { network }

    try {
      // Create a streaming connection
      const response = await fetch(`${this.baseUrl}/hydra_app.EventService/SubscribeNodeEvents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web+proto',
          'Accept': 'application/grpc-web+proto',
        },
        body: SubscribeNodeEventsRequest.encode(request).finish(),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body reader available')
      }

      let isActive = true
      const unsubscribe = () => {
        isActive = false
        reader.cancel()
      }

      // Process the stream
      const processStream = async () => {
        try {
          while (isActive) {
            const { done, value } = await reader.read()
            if (done) break

            // Parse the gRPC-Web frame and decode the NodeEvent
            try {
              // Skip gRPC-Web frame header (5 bytes)
              const eventData = new Uint8Array(value, 5)
              const nodeEvent = NodeEvent.decode(new BinaryReader(eventData))

              console.log('📡 Received node event:', nodeEvent)
              onEvent(nodeEvent)
            } catch (decodeError) {
              console.warn('⚠️ Failed to decode node event:', decodeError)
            }
          }
        } catch (streamError) {
          if (isActive && onError) {
            onError(streamError as Error)
          }
        }
      }

      // Start processing the stream
      processStream()

      return unsubscribe
    } catch (error) {
      console.error(`❌ Failed to subscribe to node events:`, error)
      if (onError) {
        onError(error as Error)
      }
      throw error
    }
  }

  // Subscribe to client events for a specific network
  async subscribeToClientEvents(network: Network, onEvent: (event: ClientEvent) => void, onError?: (error: Error) => void): Promise<() => void> {
    console.log(`🎧 Subscribing to client events for ${network.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} ${network.id}...`)

    const request: SubscribeClientEventsRequest = { network }

    try {
      // Create a streaming connection
      const response = await fetch(`${this.baseUrl}/hydra_app.EventService/SubscribeClientEvents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web+proto',
          'Accept': 'application/grpc-web+proto',
        },
        body: SubscribeClientEventsRequest.encode(request).finish(),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body reader available')
      }

      let isActive = true
      const unsubscribe = () => {
        isActive = false
        reader.cancel()
      }

      // Process the stream
      const processStream = async () => {
        try {
          while (isActive) {
            const { done, value } = await reader.read()
            if (done) break

            // Parse the gRPC-Web frame and decode the ClientEvent
            try {
              // Skip gRPC-Web frame header (5 bytes)
              const eventData = new Uint8Array(value, 5)
              const clientEvent = ClientEvent.decode(new BinaryReader(eventData))

              console.log('📡 Received client event:', clientEvent)
              onEvent(clientEvent)
            } catch (decodeError) {
              console.warn('⚠️ Failed to decode client event:', decodeError)
            }
          }
        } catch (streamError) {
          if (isActive && onError) {
            onError(streamError as Error)
          }
        }
      }

      // Start processing the stream
      processStream()

      return unsubscribe
    } catch (error) {
      console.error(`❌ Failed to subscribe to client events:`, error)
      if (onError) {
        onError(error as Error)
      }
      throw error
    }
  }

  /**
   * Get fee estimates for a specific network
   */
  async getFeeEstimates(network: Network): Promise<{ low: any, medium: any, high: any }> {
    try {
      const request: GetFeeEstimatesRequest = { network }

      const result = await this.grpcCall(
        'hydra_app.BlockchainService',
        'GetFeeEstimates',
        request,
        GetFeeEstimatesRequest.encode
      )

      const feeEstimate = (result as any).feeEstimate
      if (!feeEstimate) {
        throw new Error('No fee estimate returned from backend')
      }

      console.log(`⛽ FeeEstimate from backend for ${network.protocol === Protocol.BITCOIN ? 'Bitcoin' : 'EVM'} network ${network.id}:`, feeEstimate)
      console.log(`  📊 Low FeeRate:`, feeEstimate.low)
      console.log(`  📊 Medium FeeRate:`, feeEstimate.medium)
      console.log(`  📊 High FeeRate:`, feeEstimate.high)

      return {
        low: feeEstimate.low || { baseFeePerUnit: { value: '5' }, maxTipFeePerUnit: { value: '0' }, maxPricePerUnit: { value: '5' } },
        medium: feeEstimate.medium || { baseFeePerUnit: { value: '15' }, maxTipFeePerUnit: { value: '0' }, maxPricePerUnit: { value: '15' } },
        high: feeEstimate.high || { baseFeePerUnit: { value: '30' }, maxTipFeePerUnit: { value: '0' }, maxPricePerUnit: { value: '30' } }
      }
    } catch (error: any) {
      console.log(`❌ getFeeEstimates failed for network ${network.id}: ${error.message}`)

      // Return reasonable fallbacks based on network protocol
      if (network.protocol === Protocol.BITCOIN) {
        return {
          low: { baseFeePerUnit: { value: '5' }, maxTipFeePerUnit: { value: '0' }, maxPricePerUnit: { value: '5' } },
          medium: { baseFeePerUnit: { value: '15' }, maxTipFeePerUnit: { value: '0' }, maxPricePerUnit: { value: '15' } },
          high: { baseFeePerUnit: { value: '30' }, maxTipFeePerUnit: { value: '0' }, maxPricePerUnit: { value: '30' } }
        }
      } else {
        // EVM networks - use more reasonable gwei values
        return {
          low: { baseFeePerUnit: { value: '8000000000' }, maxTipFeePerUnit: { value: '1000000000' }, maxPricePerUnit: { value: '9000000000' } }, // 9 gwei
          medium: { baseFeePerUnit: { value: '12000000000' }, maxTipFeePerUnit: { value: '2000000000' }, maxPricePerUnit: { value: '14000000000' } }, // 14 gwei
          high: { baseFeePerUnit: { value: '20000000000' }, maxTipFeePerUnit: { value: '3000000000' }, maxPricePerUnit: { value: '23000000000' } } // 23 gwei
        }
      }
    }
  }


  // Rental Service Methods
  async getRentalNodeInfo(): Promise<any> {
    try {
      console.log('🏠 grpcWebClient: Getting rental node info...')

      const request: GetRentalNodeInfoRequest = {}
      const response = await this.grpcCall<GetRentalNodeInfoRequest, GetRentalNodeInfoResponse>(
        'hydra_app.RentalService',
        'GetRentalNodeInfo',
        request,
        GetRentalNodeInfoRequest.encode
      )

      console.log('🏠 grpcWebClient: Raw rental node info response:', response)

      console.log('🏠 grpcWebClient: Rental node info response:', response)
      return response
    } catch (error) {
      console.error('❌ grpcWebClient: Error in getRentalNodeInfo:', error)
      throw error
    }
  }

  async getRentableAssetInfo(network: any, assetId: string): Promise<any> {
    try {
      console.log('🏠 grpcWebClient: Getting rentable asset info for', assetId, 'on network', network)

      const request: GetRentableAssetInfoRequest = { network, assetId }
      const response = await this.grpcCall<GetRentableAssetInfoRequest, GetRentableAssetInfoResponse>(
        'hydra_app.RentalService',
        'GetRentableAssetInfo',
        request,
        GetRentableAssetInfoRequest.encode
      )

      console.log('🏠 grpcWebClient: Raw rentable asset info response:', response)

      console.log('🏠 grpcWebClient: Rentable asset info response:', response)
      return response
    } catch (error) {
      console.error('❌ grpcWebClient: Error in getRentableAssetInfo:', error)
      throw error
    }
  }

  async estimateRentChannelFee(network: any, assetId: string, lifetimeSeconds: string, amount: string, rentalOption: any): Promise<any> {
    try {
      console.log('🏠 grpcWebClient: Estimating rent channel fee for', amount, assetId)
      console.log('🏠 grpcWebClient: Input parameters:', { network, assetId, lifetimeSeconds, amount, rentalOption })

      // Convert lifetimeSeconds to number for protobuf
      const lifetimeSecondsNum = parseInt(lifetimeSeconds)
      if (isNaN(lifetimeSecondsNum)) {
        throw new Error(`Invalid lifetimeSeconds: ${lifetimeSeconds}`)
      }

      const request: EstimateRentChannelFeeRequest = {
        network,
        assetId,
        lifetimeSeconds: lifetimeSecondsNum.toString(),
        amount: { value: amount },
        ...(rentalOption && { rentalOption }) // Only include rentalOption if it exists
      }

      console.log('🏠 grpcWebClient: EstimateRentChannelFee request:', JSON.stringify(request, null, 2))
      const response = await this.grpcCall<EstimateRentChannelFeeRequest, EstimateRentChannelFeeResponse>(
        'hydra_app.RentalService',
        'EstimateRentChannelFee',
        request,
        EstimateRentChannelFeeRequest.encode
      )

      console.log('🏠 grpcWebClient: Raw estimate rent fee response:', response)

      console.log('🏠 grpcWebClient: Fee estimate response:', response)
      return response
    } catch (error) {
      console.error('❌ grpcWebClient: Error in estimateRentChannelFee:', error)
      throw error
    }
  }

  async rentChannel(network: any, assetId: string, lifetimeSeconds: string, amount: string, rentalOption: any): Promise<any> {
    try {
      console.log('🏠 grpcWebClient: Renting channel for', amount, assetId)
      console.log('🏠 grpcWebClient: Input parameters:', { network, assetId, lifetimeSeconds, amount, rentalOption })

      // Convert lifetimeSeconds to number for validation, but keep as string for protobuf
      const lifetimeSecondsNum = parseInt(lifetimeSeconds)
      if (isNaN(lifetimeSecondsNum)) {
        throw new Error(`Invalid lifetimeSeconds: ${lifetimeSeconds}`)
      }

      const request: RentChannelRequest = {
        network,
        assetId,
        lifetimeSeconds,
        amount: { value: amount },
        rentalOption
      }
      const response = await this.grpcCall<RentChannelRequest, RentChannelResponse>(
        'hydra_app.RentalService',
        'RentChannel',
        request,
        RentChannelRequest.encode
      )

      console.log('🏠 grpcWebClient: Rent channel response:', response)
      return response
    } catch (error) {
      console.error('❌ grpcWebClient: Error in rentChannel:', error)
      throw error
    }
  }

  // Market Service Methods
  async getInitializedMarkets(): Promise<any> {
    try {
      console.log('📈 grpcWebClient: Getting initialized markets...')

      const request: GetInitializedMarketsRequest = {}

      const result = await this.grpcCall<GetInitializedMarketsRequest, GetInitializedMarketsResponse>(
        'hydra_app.OrderbookService',
        'GetInitializedMarkets',
        request,
        GetInitializedMarketsRequest.encode
      )

      console.log('✅ grpcWebClient: Successfully got initialized markets:', result)
      return result
    } catch (error) {
      console.error('❌ grpcWebClient: Error in getInitializedMarkets:', error)
      throw error
    }
  }

  async getMarketsInfo(): Promise<any> {
    try {
      console.log('📈 grpcWebClient: Getting markets info...')

      const request: GetMarketsInfoRequest = {}

      const result = await this.grpcCall<GetMarketsInfoRequest, GetMarketsInfoResponse>(
        'hydra_app.OrderbookService',
        'GetMarketsInfo',
        request,
        GetMarketsInfoRequest.encode
      )

      console.log('✅ grpcWebClient: Successfully got markets info:', result)
      return result
    } catch (error) {
      console.error('❌ grpcWebClient: Error in getMarketsInfo:', error)
      throw error
    }
  }

  async getMarketInfo(baseCurrency: any, quoteCurrency: any): Promise<any> {
    try {
      console.log('📈 grpcWebClient: Getting market info for', baseCurrency, '/', quoteCurrency)

      const request: GetMarketInfoRequest = {
        firstCurrency: baseCurrency,
        otherCurrency: quoteCurrency
      }

      const result = await this.grpcCall<GetMarketInfoRequest, GetMarketInfoResponse>(
        'hydra_app.OrderbookService',
        'GetMarketInfo',
        request,
        GetMarketInfoRequest.encode
      )

      console.log('✅ grpcWebClient: Successfully got market info:', result)
      return result
    } catch (error) {
      console.error('❌ grpcWebClient: Error in getMarketInfo:', error)
      throw error
    }
  }

  async initMarket(baseCurrency: any, quoteCurrency: any): Promise<any> {
    try {
      console.log('📈 grpcWebClient: Initializing market for', baseCurrency, '/', quoteCurrency)
      console.log('📈 baseCurrency details:', JSON.stringify(baseCurrency, null, 2))
      console.log('📈 quoteCurrency details:', JSON.stringify(quoteCurrency, null, 2))

      const request: InitMarketRequest = {
        firstCurrency: baseCurrency,
        otherCurrency: quoteCurrency
      }

      const result = await this.grpcCall<InitMarketRequest, InitMarketResponse>(
        'hydra_app.OrderbookService',
        'InitMarket',
        request,
        InitMarketRequest.encode
      )

      console.log('✅ grpcWebClient: Successfully initialized market:', result)
      return result
    } catch (error) {
      console.error('❌ grpcWebClient: Error in initMarket:', error)
      throw error
    }
  }

}

export const hydraGrpcClient = new HydraGrpcWebClient()
export default hydraGrpcClient