<template>
  <div class="home-page">
    <div class="hero-section">
      <div class="hero-content">
        <div class="logo-container">
          <div class="logo">
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="60" height="60" rx="16" fill="url(#gradient)"/>
              <path d="M20 40V20L30 30L40 20V40" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="60" y2="60">
                  <stop stop-color="#6366f1"/>
                  <stop offset="1" stop-color="#4f46e5"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
        <h1 class="hero-title">YTLLMND</h1>
        <p class="hero-subtitle">You The LLM Now Dog</p>
        <p class="hero-description">
          Experience what it's like to be an AI assistant. Create a chat session and play either role in real-time.
        </p>
      </div>
    </div>
    
    <div class="main-content">
      <div class="create-section">
        <div class="section-header">
          <h2>Start a New Experience</h2>
          <p>Set up your AI assistant's personality with a system prompt</p>
        </div>
        
        <form @submit.prevent="createChat" class="create-form">
          <div class="form-group">
            <label for="system-prompt">System Prompt</label>
            <p class="form-description">Define how the AI assistant should behave and respond</p>
            <textarea
              id="system-prompt"
              v-model="systemPrompt"
              placeholder="You are a helpful assistant that..."
              rows="6"
              required
            ></textarea>
            <div class="char-count">{{ systemPrompt.length }} characters</div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="primary-button" :disabled="isCreating">
              <svg v-if="!isCreating" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
              </svg>
              <span>{{ isCreating ? 'Creating Experience...' : 'Create Experience' }}</span>
            </button>
          </div>
        </form>
        
        <div class="examples">
          <h3>Example Prompts</h3>
          <div class="example-grid">
            <button @click="useExample('helpful')" class="example-card">
              <div class="example-icon">💡</div>
              <div class="example-title">Helpful Assistant</div>
              <div class="example-desc">General purpose helpful AI</div>
            </button>
            <button @click="useExample('creative')" class="example-card">
              <div class="example-icon">🎨</div>
              <div class="example-title">Creative Writer</div>
              <div class="example-desc">Imaginative storytelling AI</div>
            </button>
            <button @click="useExample('technical')" class="example-card">
              <div class="example-icon">💻</div>
              <div class="example-title">Code Expert</div>
              <div class="example-desc">Technical programming assistant</div>
            </button>
          </div>
        </div>
      </div>
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

const defaultSystemPrompt = `You are a helpful AI assistant with access to tools. You can use these tools by including them in your responses with the following syntax:

[calculator: expression] - Perform calculations. Example: [calculator: 2+2*3]
[search: query] - Search for information. Example: [search: weather today]
[fetch: url] - Fetch and read a webpage. Example: [fetch: https://example.com]

When you use a tool, both you and the user will see the result displayed inline. The tool will show like this:
[calculator: 2+2] → 4

You can use multiple tools in a single response. Always explain what you're doing when using tools.

Example response:
"Let me calculate that for you: [calculator: 15*20+10]. I'll also fetch that webpage: [fetch: https://example.com] to see what it contains."

Note: The fetch tool will show "Fetching webpage..." while loading, then display the title and content preview.

Remember: You're being played by a human who will see the tool results in their interface too!`

const systemPrompt = ref(defaultSystemPrompt)
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

const useExample = (type: string) => {
  const examples = {
    helpful: "You are a helpful, friendly assistant. You aim to provide clear, accurate, and useful responses while being respectful and professional. You're happy to help with a wide variety of tasks.",
    creative: "You are a creative writing assistant with a vivid imagination. You excel at storytelling, creating characters, and crafting engaging narratives. You use descriptive language and help bring ideas to life.",
    technical: "You are a technical programming expert. You provide clear code examples, explain complex concepts simply, and follow best practices. You're knowledgeable about various programming languages and frameworks."
  }
  systemPrompt.value = examples[type as keyof typeof examples] || ''
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  background: linear-gradient(180deg, var(--surface) 0%, var(--background) 100%);
}

.hero-section {
  padding: 4rem 0;
  text-align: center;
  border-bottom: 1px solid var(--border);
  background: var(--background);
}

.hero-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1.5rem;
  animation: fadeIn 0.6s ease-out;
}

.logo-container {
  display: inline-block;
  margin-bottom: 1.5rem;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 4px 6px rgb(0 0 0 / 0.1));
  animation: slideUp 0.8s ease-out;
}

.hero-title {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
  animation: slideUp 0.8s ease-out 0.1s both;
}

.hero-subtitle {
  font-size: 1.5rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
  font-weight: 500;
  animation: slideUp 0.8s ease-out 0.2s both;
}

.hero-description {
  font-size: 1.125rem;
  color: var(--text-secondary);
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.8;
  animation: slideUp 0.8s ease-out 0.3s both;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 4rem 1.5rem;
}

.create-section {
  max-width: 800px;
  margin: 0 auto;
}

.section-header {
  text-align: center;
  margin-bottom: 3rem;
  animation: fadeIn 0.6s ease-out 0.4s both;
}

.section-header h2 {
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.section-header p {
  color: var(--text-secondary);
  font-size: 1.125rem;
}

.create-form {
  background: var(--background);
  padding: 2.5rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  margin-bottom: 3rem;
  animation: fadeIn 0.6s ease-out 0.5s both;
}

.form-group {
  margin-bottom: 2rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.form-description {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.form-group textarea {
  width: 100%;
  min-height: 150px;
  padding: 1rem;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  font-size: 1rem;
  transition: all 0.2s;
  background: var(--surface);
}

.form-group textarea:focus {
  border-color: var(--primary-color);
  background: var(--background);
}

.char-count {
  text-align: right;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.5rem;
}

.form-actions {
  display: flex;
  justify-content: center;
}

.primary-button {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%);
  color: white;
  padding: 0.875rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--radius);
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  transition: all 0.2s;
  box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.3);
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px 0 rgba(99, 102, 241, 0.4);
}

.primary-button:active {
  transform: translateY(0);
}

.primary-button:disabled {
  background: linear-gradient(135deg, var(--text-muted) 0%, var(--text-secondary) 100%);
  box-shadow: none;
}

.examples {
  animation: fadeIn 0.6s ease-out 0.6s both;
}

.examples h3 {
  text-align: center;
  color: var(--text-primary);
  margin-bottom: 2rem;
}

.example-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.example-card {
  background: var(--background);
  padding: 2rem;
  border-radius: var(--radius);
  border: 2px solid var(--border);
  text-align: center;
  transition: all 0.2s;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.example-card:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.example-icon {
  font-size: 2.5rem;
  line-height: 1;
}

.example-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1.125rem;
}

.example-desc {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .hero-section {
    padding: 3rem 0;
  }
  
  .create-form {
    padding: 1.5rem;
  }
  
  .example-grid {
    grid-template-columns: 1fr;
  }
}
</style>