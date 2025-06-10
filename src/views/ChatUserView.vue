<template>
  <div class="chat-container">
    <!-- Debug component - remove in production -->
    <SubscriptionTest v-if="showDebug" :chat-id="chatId" />
    <div class="chat-header">
      <div class="header-content">
        <div class="header-left">
          <div class="role-badge user-badge">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
            </svg>
            <span>User View</span>
          </div>
          <h2>YTLLMND</h2>
        </div>
        <div class="header-actions">
          <button @click="copyLink" class="icon-button" title="Copy assistant link">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
            </svg>
          </button>
          <router-link to="/" class="icon-button" title="New chat">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
            </svg>
          </router-link>
        </div>
      </div>
    </div>
    
    <div class="chat-body">
      <div class="messages-wrapper">
        <div class="messages-container" ref="messagesContainer">
          <pre class="chat-stream"><template v-if="systemPrompt"><span class="role-header">[SYSTEM]</span>
{{ systemPrompt }}
</template><template v-if="messages.length === 0 && !systemPrompt">Waiting for messages...

Send a message below to begin chatting with the AI assistant.</template><template v-for="message in messages" :key="message.id">
<span class="role-header">[{{ message.role.toUpperCase() }}]</span>
{{ processMessageContent(message) }}
</template></pre>
        </div>
      </div>
    </div>
    
    <div class="chat-input">
      <form @submit.prevent="sendMessage" class="message-form">
        <div class="input-wrapper">
          <input
            v-model="newMessage"
            type="text"
            placeholder="Type your message..."
            :disabled="isSending"
            required
            @keydown.enter.prevent="sendMessage"
          />
          <button type="submit" class="send-button" :disabled="isSending || !newMessage.trim()">
            <svg v-if="!isSending" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
            </svg>
            <svg v-else class="spinner" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="50.265" stroke-dashoffset="25.133"/>
            </svg>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import SubscriptionTest from '../components/SubscriptionTest.vue'
import { useRoute } from 'vue-router'
import { generateClient } from 'aws-amplify/data'
import { Hub } from 'aws-amplify/utils'
import { CONNECTION_STATE_CHANGE, ConnectionState } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'

const route = useRoute()
const client = generateClient<Schema>()

const messages = ref<any[]>([])
const newMessage = ref('')
const isSending = ref(false)
const systemPrompt = ref('')
const messagesContainer = ref<HTMLElement>()
let subscription: any = null
let createSubscription: any = null
let updateSubscription: any = null

const chatId = route.params.chatId as string
const showDebug = computed(() => import.meta.env.DEV && import.meta.env.VITE_SHOW_DEBUG !== 'false')

const loadChat = async () => {
  try {
    const { data: chat } = await client.models.Chat.get({ id: chatId })
    if (chat) {
      systemPrompt.value = chat.systemPrompt
    }
  } catch (error) {
    console.error('Error loading chat:', error)
  }
}

const loadMessages = async () => {
  try {
    const { data } = await client.models.Message.list({
      filter: { chatId: { eq: chatId } }
    })
    messages.value = data.sort((a, b) => 
      new Date(a.timestamp || '').getTime() - new Date(b.timestamp || '').getTime()
    )
    scrollToBottom()
  } catch (error) {
    console.error('Error loading messages:', error)
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || isSending.value) return
  
  isSending.value = true
  const messageContent = newMessage.value
  newMessage.value = ''
  
  try {
    console.log('[User View] Sending message:', { chatId, content: messageContent })
    const { data, errors } = await client.models.Message.create({
      chatId,
      content: messageContent,
      role: 'user',
      timestamp: new Date().toISOString()
    })
    
    if (errors) {
      console.error('[User View] GraphQL errors:', errors)
      throw new Error('Failed to create message: ' + errors.map(e => e.message).join(', '))
    }
    
    if (!data) {
      console.error('[User View] No data returned from create')
      throw new Error('No data returned from message creation')
    }
    
    console.log('[User View] Message created successfully:', data)
    
    // Manually add to local messages if subscription hasn't picked it up
    setTimeout(() => {
      const exists = messages.value.some(m => m.id === data.id)
      if (!exists) {
        console.log('[User View] Adding message manually to local state')
        messages.value.push(data)
        messages.value.sort((a, b) => 
          new Date(a.timestamp || '').getTime() - new Date(b.timestamp || '').getTime()
        )
        scrollToBottom()
      }
    }, 500)
  } catch (error) {
    console.error('[User View] Error sending message:', error)
    newMessage.value = messageContent
    alert(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    isSending.value = false
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const formatTime = (timestamp: string | null) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  })
}

const copyLink = () => {
  const assistantUrl = `${window.location.origin}/chats/${chatId}/assistant`
  navigator.clipboard.writeText(assistantUrl)
  alert('Assistant link copied to clipboard!')
}

const processMessageContent = (message: any) => {
  if (message.role !== 'assistant') {
    return message.content
  }
  
  // Process tool invocations for assistant messages
  let content = message.content
  const toolRegex = /\[(\w+):\s*([^\]]+)\]/g
  
  content = content.replace(toolRegex, (match: string, tool: string, args: string) => {
    const toolLower = tool.toLowerCase()
    let result = 'Processing...'
    
    // Simple inline tool processing for display
    if (toolLower === 'calculator' || toolLower === 'calc') {
      try {
        const sanitized = args.replace(/[^0-9+\-*/().\s]/g, '')
        const calcResult = Function('"use strict"; return (' + sanitized + ')')()
        result = isNaN(calcResult) || !isFinite(calcResult) ? 'Error' : calcResult.toString()
      } catch {
        result = 'Error'
      }
    } else if (toolLower === 'search' || toolLower === 'web') {
      // Mock search results
      const mockResults: Record<string, string> = {
        'weather today': 'Partly cloudy, 72°F',
        'latest news': 'Tech stocks rise',
        'python tutorial': 'Visit python.org'
      }
      const query = args.toLowerCase().trim()
      result = mockResults[query] || 'No results found'
    } else if (toolLower === 'fetch' || toolLower === 'fetchwebpage' || toolLower === 'webpage') {
      result = '[Content would be fetched]'
    }
    
    return `${match} → ${result}`
  })
  
  return content
}

onMounted(async () => {
  await loadChat()
  await loadMessages()
  
  // Monitor connection state
  const hubListener = Hub.listen('api', (data) => {
    const { payload } = data
    if (payload.event === CONNECTION_STATE_CHANGE) {
      const connectionState = payload.data.connectionState as ConnectionState
      console.log('[User View] Connection state:', connectionState)
    }
  })
  
  // Use direct subscriptions instead of observeQuery for better cross-client sync
  createSubscription = client.models.Message.onCreate().subscribe({
    next: (data) => {
      console.log('[User View] New message received via subscription:', {
        id: data.id,
        chatId: data.chatId,
        role: data.role,
        content: data.content?.substring(0, 50) + '...'
      })
      if (data.chatId === chatId) {
        // Check if message already exists to avoid duplicates
        const exists = messages.value.some(m => m.id === data.id)
        if (!exists) {
          console.log('[User View] Adding message to local state')
          messages.value.push(data)
          messages.value.sort((a, b) => 
            new Date(a.timestamp || '').getTime() - new Date(b.timestamp || '').getTime()
          )
          scrollToBottom()
        } else {
          console.log('[User View] Message already exists, skipping')
        }
      } else {
        console.log('[User View] Message is for different chat:', data.chatId, 'vs', chatId)
      }
    },
    error: (error) => {
      console.error('[User View] Create subscription error:', error)
    }
  })
  
  updateSubscription = client.models.Message.onUpdate().subscribe({
    next: (data) => {
      console.log('[User View] Message updated:', data)
      if (data.chatId === chatId) {
        const index = messages.value.findIndex(m => m.id === data.id)
        if (index !== -1) {
          messages.value[index] = data
        }
      }
    },
    error: (error) => {
      console.error('[User View] Update subscription error:', error)
    }
  })
  
  // Store hub listener for cleanup
  subscription = hubListener
})

onUnmounted(() => {
  if (subscription) {
    Hub.remove('api', subscription)
  }
  if (createSubscription) {
    createSubscription.unsubscribe()
  }
  if (updateSubscription) {
    updateSubscription.unsubscribe()
  }
})
</script>

<style scoped>
.chat-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--background);
}

.chat-header {
  background: var(--background);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.header-left h2 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--text-primary);
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
}

.user-badge {
  background: var(--primary-light);
  color: var(--primary-hover);
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-secondary);
  transition: all 0.2s;
  border: 1px solid var(--border);
}

.icon-button:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.chat-body {
  flex: 1;
  overflow: hidden;
  background: var(--surface);
}

.messages-wrapper {
  height: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.messages-container {
  height: 100%;
  overflow-y: auto;
  background: #1e1e1e;
}

.chat-stream {
  margin: 0;
  padding: 1rem;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #d4d4d4;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.role-header {
  color: #569cd6;
  font-weight: bold;
  display: inline-block;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.chat-input {
  background: var(--background);
  border-top: 1px solid var(--border);
  padding: 1.5rem;
}

.message-form {
  max-width: 900px;
  margin: 0 auto;
}

.input-wrapper {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.input-wrapper input {
  flex: 1;
  padding: 0.875rem 1.25rem;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.9375rem;
  transition: all 0.2s;
  background: var(--surface);
}

.input-wrapper input:focus {
  border-color: var(--primary-color);
  background: var(--background);
}

.send-button {
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: var(--radius);
  background: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.send-button:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: scale(1.05);
}

.send-button:disabled {
  background: var(--text-secondary);
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .header-content {
    padding: 1rem;
  }
  
  .messages-container {
    padding: 1rem;
  }
  
  .message-body {
    max-width: 85%;
  }
  
  .chat-input {
    padding: 1rem;
  }
}
</style>