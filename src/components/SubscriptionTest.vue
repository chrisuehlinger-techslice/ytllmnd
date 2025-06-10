<template>
  <div class="subscription-test">
    <h3>Real-time Subscription Test</h3>
    <div class="status">
      <p>Connection Status: <span :class="connectionClass">{{ connectionStatus }}</span></p>
      <p>Messages received: {{ messagesReceived }}</p>
      <p>Last message: {{ lastMessage }}</p>
    </div>
    <button @click="createTestMessage">Send Test Message</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { generateClient } from 'aws-amplify/data'
import { Hub } from 'aws-amplify/utils'
import { CONNECTION_STATE_CHANGE, ConnectionState } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'

const props = defineProps<{
  chatId: string
}>()

const client = generateClient<Schema>()
const connectionStatus = ref('Unknown')
const connectionClass = ref('')
const messagesReceived = ref(0)
const lastMessage = ref('')
let createSub: any = null
let hubListener: any = null

const createTestMessage = async () => {
  try {
    const message = await client.models.Message.create({
      chatId: props.chatId,
      content: `Test message from subscription test at ${new Date().toLocaleTimeString()}`,
      role: 'user',
      timestamp: new Date().toISOString()
    })
    console.log('Test message created:', message)
  } catch (error) {
    console.error('Error creating test message:', error)
  }
}

onMounted(() => {
  // Monitor connection state
  hubListener = Hub.listen('api', (data) => {
    const { payload } = data
    if (payload.event === CONNECTION_STATE_CHANGE) {
      const state = payload.data.connectionState as ConnectionState
      switch (state) {
        case ConnectionState.Connected:
          connectionStatus.value = 'Connected'
          connectionClass.value = 'connected'
          break
        case ConnectionState.Connecting:
          connectionStatus.value = 'Connecting...'
          connectionClass.value = 'connecting'
          break
        case ConnectionState.Disconnected:
          connectionStatus.value = 'Disconnected'
          connectionClass.value = 'disconnected'
          break
        case ConnectionState.ConnectionDisrupted:
          connectionStatus.value = 'Disrupted'
          connectionClass.value = 'disrupted'
          break
        default:
          connectionStatus.value = state
          connectionClass.value = ''
      }
    }
  })

  // Subscribe to message creation
  createSub = client.models.Message.onCreate().subscribe({
    next: (data) => {
      console.log('[Subscription Test] Message received:', data)
      if (data.chatId === props.chatId) {
        messagesReceived.value++
        lastMessage.value = data.content
      }
    },
    error: (error) => {
      console.error('[Subscription Test] Error:', error)
      connectionStatus.value = 'Error'
      connectionClass.value = 'error'
    }
  })
})

onUnmounted(() => {
  if (hubListener) {
    Hub.remove('api', hubListener)
  }
  if (createSub) {
    createSub.unsubscribe()
  }
})
</script>

<style scoped>
.subscription-test {
  padding: 1rem;
  border: 2px dashed #666;
  border-radius: 8px;
  margin: 1rem 0;
  background: rgba(0, 0, 0, 0.05);
}

.subscription-test h3 {
  margin: 0 0 1rem 0;
  color: #666;
}

.status p {
  margin: 0.5rem 0;
  font-family: monospace;
}

.connected {
  color: #4caf50;
  font-weight: bold;
}

.connecting {
  color: #ff9800;
}

.disconnected, .error {
  color: #f44336;
  font-weight: bold;
}

.disrupted {
  color: #ff5722;
}

button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #1976d2;
}
</style>