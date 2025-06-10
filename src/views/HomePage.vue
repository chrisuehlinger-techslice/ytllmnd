<template>
  <div class="home-page">
    <div class="header">
      <h1>YTLLMND</h1>
      <p class="tagline">You The LLM Now Dog</p>
    </div>
    
    <div class="create-chat-container">
      <h2>Create a New Chat</h2>
      <form @submit.prevent="createChat">
        <div class="form-group">
          <label for="system-prompt">System Prompt:</label>
          <textarea
            id="system-prompt"
            v-model="systemPrompt"
            placeholder="Enter the system prompt for the assistant..."
            rows="6"
            required
          ></textarea>
        </div>
        <button type="submit" :disabled="isCreating">
          {{ isCreating ? 'Creating...' : 'Create Chat' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'

const router = useRouter()
const client = generateClient<Schema>()

const systemPrompt = ref('')
const isCreating = ref(false)

const createChat = async () => {
  if (!systemPrompt.value.trim()) return
  
  isCreating.value = true
  
  try {
    const { data: chat } = await client.models.Chat.create({
      systemPrompt: systemPrompt.value,
      createdAt: new Date().toISOString()
    })
    
    if (chat) {
      router.push(`/chats/${chat.id}/user`)
    }
  } catch (error) {
    console.error('Error creating chat:', error)
    alert('Failed to create chat. Please try again.')
  } finally {
    isCreating.value = false
  }
}
</script>

<style scoped>
.home-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  text-align: center;
  margin-bottom: 3rem;
}

h1 {
  font-size: 3rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.tagline {
  font-size: 1.2rem;
  color: #666;
  font-style: italic;
}

.create-chat-container {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

h2 {
  margin-bottom: 1.5rem;
  color: #333;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
}

textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  resize: vertical;
  font-family: inherit;
}

textarea:focus {
  outline: none;
  border-color: #007bff;
}

button {
  background-color: #007bff;
  color: white;
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>