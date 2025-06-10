<template>
  <div class="chat-container">
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
          <div v-if="messages.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 14h32a2 2 0 012 2v20a2 2 0 01-2 2H8a2 2 0 01-2-2V16a2 2 0 012-2z"/>
                <path d="M24 22v8m-4-4h8"/>
              </svg>
            </div>
            <h3>Start a conversation</h3>
            <p>Send a message below to begin chatting with the AI assistant</p>
          </div>
          
          <div
            v-for="message in messages"
            :key="message.id"
            :class="['message', message.role]"
          >
            <div class="message-avatar">
              <div v-if="message.role === 'user'" class="avatar user-avatar">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                </svg>
              </div>
              <div v-else class="avatar assistant-avatar">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z"/>
                  <path d="M12 2.252A8 8 0 0117.748 8H12V2.252z"/>
                </svg>
              </div>
            </div>
            <div class="message-body">
              <div class="message-role">{{ message.role === 'user' ? 'You' : 'Assistant' }}</div>
              <div class="message-content">
                <MessageContent :content="message.content" :role="message.role" />
              </div>
              <div class="message-time">{{ formatTime(message.timestamp) }}</div>
            </div>
          </div>
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
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'
import MessageContent from '../components/MessageContent.vue'

const route = useRoute()
const client = generateClient<Schema>()

const messages = ref<any[]>([])
const newMessage = ref('')
const isSending = ref(false)
const messagesContainer = ref<HTMLElement>()
let subscription: any = null

const chatId = route.params.chatId as string

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
    await client.models.Message.create({
      chatId,
      content: messageContent,
      role: 'user',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error sending message:', error)
    newMessage.value = messageContent
    alert('Failed to send message. Please try again.')
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

onMounted(() => {
  loadMessages()
  
  subscription = client.models.Message.observeQuery({
    filter: { chatId: { eq: chatId } }
  }).subscribe({
    next: ({ items }) => {
      messages.value = items.sort((a, b) => 
        new Date(a.timestamp || '').getTime() - new Date(b.timestamp || '').getTime()
      )
      scrollToBottom()
    }
  })
})

onUnmounted(() => {
  if (subscription) {
    subscription.unsubscribe()
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
  padding: 2rem;
  scroll-behavior: smooth;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  color: var(--text-secondary);
}

.empty-icon {
  margin-bottom: 1.5rem;
  color: var(--text-muted);
}

.empty-state h3 {
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.empty-state p {
  max-width: 400px;
}

.message {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  animation: fadeIn 0.3s ease-out;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}

.user-avatar {
  background: var(--primary-light);
  color: var(--primary-hover);
}

.assistant-avatar {
  background: var(--secondary-light);
  color: var(--secondary-hover);
}

.message-body {
  flex: 1;
  max-width: 70%;
}

.message.user .message-body {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-role {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.message-content {
  padding: 1rem 1.25rem;
  border-radius: var(--radius);
  font-size: 0.9375rem;
  line-height: 1.6;
  word-wrap: break-word;
}

.message.user .message-content {
  background: var(--primary-color);
  color: white;
  border-bottom-right-radius: var(--radius-sm);
}

.message.assistant .message-content {
  background: var(--background);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-bottom-left-radius: var(--radius-sm);
}

.message-time {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
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