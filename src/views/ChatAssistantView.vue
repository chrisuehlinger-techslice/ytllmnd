<template>
  <div class="chat-container">
    <div class="chat-header">
      <h2>YTLLMND - Assistant View</h2>
      <router-link to="/" class="home-link">New Chat</router-link>
    </div>
    
    <div v-if="systemPrompt" class="system-prompt">
      <h3>System Prompt:</h3>
      <p>{{ systemPrompt }}</p>
    </div>
    
    <div class="messages-container" ref="messagesContainer">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="['message', message.role]"
      >
        <div class="message-role">{{ message.role === 'user' ? 'User' : 'You' }}</div>
        <div class="message-content">{{ message.content }}</div>
      </div>
      
      <div v-if="messages.length === 0 && systemPrompt" class="empty-state">
        Waiting for the user to send a message...
      </div>
    </div>
    
    <form @submit.prevent="sendMessage" class="message-form">
      <textarea
        v-model="newMessage"
        placeholder="Type your response..."
        :disabled="isSending"
        rows="3"
        required
      ></textarea>
      <button type="submit" :disabled="isSending || !newMessage.trim()">
        Send
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'

const route = useRoute()
const client = generateClient<Schema>()

const messages = ref<any[]>([])
const newMessage = ref('')
const isSending = ref(false)
const systemPrompt = ref('')
const messagesContainer = ref<HTMLElement>()
let subscription: any = null

const chatId = route.params.chatId as string

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
    await client.models.Message.create({
      chatId,
      content: messageContent,
      role: 'assistant',
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

onMounted(() => {
  loadChat()
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
  max-width: 800px;
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: white;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: #28a745;
  color: white;
}

.chat-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.home-link {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  transition: background 0.2s;
}

.home-link:hover {
  background: rgba(255, 255, 255, 0.3);
}

.system-prompt {
  padding: 1rem 2rem;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.system-prompt h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: #666;
}

.system-prompt p {
  margin: 0;
  color: #333;
  font-style: italic;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background: #f5f5f5;
}

.message {
  margin-bottom: 1.5rem;
}

.message.user .message-content {
  background: white;
  color: #333;
}

.message.assistant .message-content {
  background: #28a745;
  color: white;
  margin-left: auto;
}

.message-role {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.message.assistant .message-role {
  text-align: right;
}

.message-content {
  max-width: 70%;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  white-space: pre-wrap;
}

.empty-state {
  text-align: center;
  color: #666;
  font-style: italic;
  margin-top: 2rem;
}

.message-form {
  display: flex;
  padding: 1rem 2rem;
  gap: 1rem;
  background: white;
  border-top: 1px solid #eee;
}

.message-form textarea {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  resize: none;
  font-family: inherit;
}

.message-form textarea:focus {
  outline: none;
  border-color: #28a745;
}

.message-form button {
  padding: 0.75rem 2rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
  align-self: flex-end;
}

.message-form button:hover:not(:disabled) {
  background: #218838;
}

.message-form button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>