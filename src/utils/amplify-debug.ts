import { Hub } from 'aws-amplify/utils'
import { CONNECTION_STATE_CHANGE, ConnectionState } from 'aws-amplify/data'

export function setupAmplifyDebugging() {
  // Monitor all Hub events
  Hub.listen('core', (data) => {
    console.log('[Amplify Core Event]', data)
  })

  Hub.listen('auth', (data) => {
    console.log('[Amplify Auth Event]', data)
  })

  Hub.listen('api', (data) => {
    console.log('[Amplify API Event]', data)
    const { payload } = data
    
    if (payload.event === CONNECTION_STATE_CHANGE) {
      const connectionState = payload.data.connectionState as ConnectionState
      console.log('[Connection State Change]', connectionState)
      
      // Display user-friendly status
      let statusMessage = ''
      switch (connectionState) {
        case ConnectionState.Connected:
          statusMessage = '✅ WebSocket Connected - Real-time sync active'
          break
        case ConnectionState.Connecting:
          statusMessage = '🔄 Connecting to real-time service...'
          break
        case ConnectionState.Disconnected:
          statusMessage = '❌ WebSocket Disconnected - Real-time sync inactive'
          break
        case ConnectionState.ConnectionDisrupted:
          statusMessage = '⚠️ Connection disrupted - Attempting to reconnect...'
          break
        case ConnectionState.ConnectionDisruptedPendingNetwork:
          statusMessage = '⚠️ Network issue detected - Waiting for network...'
          break
        default:
          statusMessage = `🔍 Connection state: ${connectionState}`
      }
      
      console.log(statusMessage)
    }
  })

  Hub.listen('datastore', (data) => {
    console.log('[Amplify DataStore Event]', data)
  })

  console.log('🔍 Amplify debugging enabled - Check console for real-time events')
}

export function logSubscriptionHealth(viewName: string, subscriptions: any[]) {
  console.log(`[${viewName}] Active subscriptions:`, subscriptions.length)
  subscriptions.forEach((sub, index) => {
    if (sub && typeof sub === 'object') {
      console.log(`  Subscription ${index + 1}:`, {
        closed: sub.closed || false,
        _state: sub._state || 'unknown'
      })
    }
  })
}