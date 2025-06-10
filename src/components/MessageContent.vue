<template>
  <div class="message-content-wrapper">
    <div v-if="processedContent" class="message-text">
      <template v-for="(part, index) in contentParts" :key="index">
        <span v-if="part.type === 'text'">{{ part.content }}</span>
        <div v-else-if="part.type === 'tool'" class="tool-invocation">
          <div class="tool-header">
            <svg class="tool-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path v-if="part.tool === 'calculator' || part.tool === 'calc'" d="M2 2a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V2zm3 1a1 1 0 000 2h6a1 1 0 100-2H5zm0 4a1 1 0 000 2h2a1 1 0 100-2H5zm0 4a1 1 0 000 2h6a1 1 0 100-2H5zm6-4a1 1 0 100 2h2a1 1 0 100-2h-2z"/>
              <path v-else-if="part.tool === 'fetch' || part.tool === 'fetchwebpage' || part.tool === 'webpage'" d="M0 8a8 8 0 1116 0A8 8 0 010 8zm5.496-6.033l.66 2.088H4.04L6.435 8.56l-.66 2.088L8 7.401l2.224 3.247-.66-2.088 2.396-4.505h-2.116l.66-2.088L8 5.214 5.496 1.967z"/>
              <path v-else d="M8 16a2 2 0 002-2h-2V2a2 2 0 00-2 2v1H4a2 2 0 00-2 2v1a2 2 0 002 2h2v1H4a2 2 0 00-2 2v1a2 2 0 002 2h2v1a2 2 0 002 2zm6-11a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2z"/>
            </svg>
            <span class="tool-name">{{ part.tool }}</span>
            <span class="tool-args">{{ part.args.join(', ') }}</span>
          </div>
          <div v-if="part.result" class="tool-result">
            <svg class="result-arrow" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 8a.5.5 0 01.5-.5h11.793l-3.147-3.146a.5.5 0 01.708-.708l4 4a.5.5 0 010 .708l-4 4a.5.5 0 01-.708-.708L13.293 8.5H1.5A.5.5 0 011 8z"/>
            </svg>
            <span class="result-text">{{ part.result }}</span>
          </div>
        </div>
      </template>
    </div>
    <div v-else class="message-text">{{ content }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { parseToolInvocations, processTools } from '../utils/tools'

const props = defineProps<{
  content: string
  role: 'user' | 'assistant'
}>()

interface ContentPart {
  type: 'text' | 'tool'
  content?: string
  tool?: string
  args?: string[]
  result?: string
}

const processedContent = computed(() => {
  if (props.role !== 'assistant') return null
  return parseToolInvocations(props.content)
})

// Store processed tools with results
const toolResults = ref<Map<string, string>>(new Map())

// Process tools asynchronously
const processToolsAsync = async () => {
  if (!processedContent.value) return
  
  for (let i = 0; i < processedContent.value.tools.length; i++) {
    const tool = processedContent.value.tools[i]
    const toolKey = `${tool.tool}-${i}`
    
    if (tool.tool === 'calculator' || tool.tool === 'calc') {
      toolResults.value.set(toolKey, calculateExpression(tool.args.join('')))
    } else if (tool.tool === 'search' || tool.tool === 'web') {
      toolResults.value.set(toolKey, webSearch(tool.args.join(' ')))
    } else if (tool.tool === 'fetch' || tool.tool === 'fetchwebpage' || tool.tool === 'webpage') {
      toolResults.value.set(toolKey, 'Fetching webpage...')
      try {
        const result = await fetchWebpage(tool.args.join(' '))
        toolResults.value.set(toolKey, result)
      } catch (error) {
        toolResults.value.set(toolKey, 'Error: Failed to fetch webpage')
      }
    } else {
      toolResults.value.set(toolKey, `Unknown tool: ${tool.tool}`)
    }
  }
}

// Watch for content changes and process tools
import { watch, onMounted } from 'vue'
watch(() => props.content, () => {
  processToolsAsync()
}, { immediate: true })

onMounted(() => {
  processToolsAsync()
})

const contentParts = computed((): ContentPart[] => {
  if (!processedContent.value) return []
  
  const parts: ContentPart[] = []
  let lastIndex = 0
  const content = props.content
  
  // Find tool invocations and split content
  const toolRegex = /\[(\w+):\s*([^\]]+)\]/g
  let match
  let toolIndex = 0
  
  while ((match = toolRegex.exec(content)) !== null) {
    // Add text before the tool
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex, match.index)
      })
    }
    
    // Get result from toolResults map
    const toolKey = `${match[1].toLowerCase()}-${toolIndex}`
    const result = toolResults.value.get(toolKey) || 'Processing...'
    
    // Add the tool
    parts.push({
      type: 'tool',
      tool: match[1].toLowerCase(),
      args: match[2].split(',').map(arg => arg.trim()),
      result: result
    })
    
    lastIndex = match.index + match[0].length
    toolIndex++
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.substring(lastIndex)
    })
  }
  
  return parts
})

// Import tool functions directly for synchronous use
function calculateExpression(expression: string): string {
  try {
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '')
    const result = Function('"use strict"; return (' + sanitized + ')')()
    
    if (isNaN(result) || !isFinite(result)) {
      return 'Error: Invalid calculation'
    }
    
    return result.toString()
  } catch (error) {
    return 'Error: Invalid expression'
  }
}

function webSearch(query: string): string {
  const mockResults = {
    'weather today': 'Today\'s weather: Partly cloudy, 72°F (22°C), with a gentle breeze.',
    'latest news': 'Top headlines: Tech stocks rise, New climate accord signed, Sports team wins championship.',
    'time in tokyo': 'Current time in Tokyo: 2:30 PM JST (UTC+9)',
    'python tutorial': 'Python basics: Variables, loops, functions. Visit python.org for comprehensive guides.',
    'recipe chocolate cake': 'Simple chocolate cake: Mix flour, cocoa, sugar, eggs, butter. Bake at 350°F for 30 mins.'
  }
  
  const lowerQuery = query.toLowerCase()
  if (mockResults[lowerQuery as keyof typeof mockResults]) {
    return mockResults[lowerQuery as keyof typeof mockResults]
  }
  
  for (const [key, value] of Object.entries(mockResults)) {
    if (lowerQuery.includes(key) || key.includes(lowerQuery)) {
      return value
    }
  }
  
  return `Search results for "${query}": Multiple relevant results found. Visit your favorite search engine for detailed information.`
}

async function fetchWebpage(url: string): Promise<string> {
  try {
    const urlObj = new URL(url)
    
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return 'Error: Only HTTP and HTTPS URLs are supported'
    }
    
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })
    
    if (!response.ok) {
      return `Error: Failed to fetch webpage (Status: ${response.status})`
    }
    
    const data = await response.json()
    const html = data.contents
    
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    
    const scripts = tempDiv.querySelectorAll('script, style')
    scripts.forEach(el => el.remove())
    
    let text = tempDiv.textContent || tempDiv.innerText || ''
    text = text.replace(/\s+/g, ' ').trim()
    
    const maxLength = 500
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...'
    }
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : 'No title'
    
    return `Title: ${title}\n\nContent preview: ${text}`
    
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Invalid URL')) {
      return 'Error: Invalid URL format'
    }
    return `Error: Unable to fetch webpage - ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}
</script>

<style scoped>
.message-content-wrapper {
  width: 100%;
}

.message-text {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.tool-invocation {
  display: inline-block;
  margin: 0.25rem 0;
  padding: 0.5rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: var(--radius-sm);
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 0.875em;
  width: 100%;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary-color);
  font-weight: 500;
}

.tool-icon {
  flex-shrink: 0;
}

.tool-name {
  font-weight: 600;
}

.tool-args {
  color: var(--text-secondary);
}

.tool-result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(99, 102, 241, 0.1);
  color: var(--text-primary);
}

.result-arrow {
  flex-shrink: 0;
  color: var(--primary-color);
}

.result-text {
  font-weight: 500;
}

/* Dark theme for tool invocations in assistant messages */
.message.assistant .tool-invocation {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.message.assistant .tool-header {
  color: rgba(255, 255, 255, 0.9);
}

.message.assistant .tool-args {
  color: rgba(255, 255, 255, 0.7);
}

.message.assistant .tool-result {
  border-top-color: rgba(255, 255, 255, 0.1);
  color: white;
}

.message.assistant .result-arrow {
  color: rgba(255, 255, 255, 0.9);
}
</style>