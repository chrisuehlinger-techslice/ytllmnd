export interface ToolInvocation {
  tool: string
  args: string[]
  result?: string
}

export interface ParsedMessage {
  content: string
  tools: ToolInvocation[]
}

// Parse tool invocations from assistant messages
export function parseToolInvocations(message: string): ParsedMessage {
  const tools: ToolInvocation[] = []
  let processedContent = message
  
  // Match tool invocations like [calculator: 2+2] or [search: weather today]
  const toolRegex = /\[(\w+):\s*([^\]]+)\]/g
  let match
  
  while ((match = toolRegex.exec(message)) !== null) {
    const [fullMatch, toolName, argsString] = match
    const args = argsString.split(',').map(arg => arg.trim())
    
    tools.push({
      tool: toolName.toLowerCase(),
      args
    })
  }
  
  return {
    content: processedContent,
    tools
  }
}

// Calculator tool
export function calculateExpression(expression: string): string {
  try {
    // Remove any non-numeric/operator characters for safety
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '')
    
    // Simple eval alternative using Function constructor
    // This is safer than eval but still be careful with user input
    const result = Function('"use strict"; return (' + sanitized + ')')()
    
    if (isNaN(result) || !isFinite(result)) {
      return 'Error: Invalid calculation'
    }
    
    return result.toString()
  } catch (error) {
    return 'Error: Invalid expression'
  }
}

// Mock web search tool
export function webSearch(query: string): string {
  // This is a mock implementation
  // In a real app, this would call an actual search API
  
  const mockResults = {
    'weather today': 'Today\'s weather: Partly cloudy, 72°F (22°C), with a gentle breeze.',
    'latest news': 'Top headlines: Tech stocks rise, New climate accord signed, Sports team wins championship.',
    'time in tokyo': 'Current time in Tokyo: 2:30 PM JST (UTC+9)',
    'python tutorial': 'Python basics: Variables, loops, functions. Visit python.org for comprehensive guides.',
    'recipe chocolate cake': 'Simple chocolate cake: Mix flour, cocoa, sugar, eggs, butter. Bake at 350°F for 30 mins.'
  }
  
  // Check for exact matches first
  const lowerQuery = query.toLowerCase()
  if (mockResults[lowerQuery as keyof typeof mockResults]) {
    return mockResults[lowerQuery as keyof typeof mockResults]
  }
  
  // Check for partial matches
  for (const [key, value] of Object.entries(mockResults)) {
    if (lowerQuery.includes(key) || key.includes(lowerQuery)) {
      return value
    }
  }
  
  // Default response
  return `Search results for "${query}": Multiple relevant results found. Visit your favorite search engine for detailed information.`
}

// Fetch webpage tool
export async function fetchWebpage(url: string): Promise<string> {
  try {
    // Validate URL
    const urlObj = new URL(url)
    
    // Only allow HTTP and HTTPS protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return 'Error: Only HTTP and HTTPS URLs are supported'
    }
    
    // Use a CORS proxy for client-side fetching
    // In production, this should be done server-side
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
    
    // Extract text content from HTML (basic extraction)
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    
    // Remove script and style elements
    const scripts = tempDiv.querySelectorAll('script, style')
    scripts.forEach(el => el.remove())
    
    // Get text content and clean it up
    let text = tempDiv.textContent || tempDiv.innerText || ''
    text = text.replace(/\s+/g, ' ').trim()
    
    // Limit response length
    const maxLength = 500
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...'
    }
    
    // Get title if available
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

// Process all tools in a message
export async function processTools(parsedMessage: ParsedMessage): Promise<ParsedMessage> {
  const processedTools = [...parsedMessage.tools]
  
  for (const tool of processedTools) {
    switch (tool.tool) {
      case 'calculator':
      case 'calc':
        tool.result = calculateExpression(tool.args.join(''))
        break
        
      case 'search':
      case 'web':
        tool.result = webSearch(tool.args.join(' '))
        break
        
      case 'fetch':
      case 'fetchwebpage':
      case 'webpage':
        tool.result = await fetchWebpage(tool.args.join(' '))
        break
        
      default:
        tool.result = `Unknown tool: ${tool.tool}`
    }
  }
  
  return {
    ...parsedMessage,
    tools: processedTools
  }
}

// Format message with tool results
export function formatMessageWithTools(parsedMessage: ParsedMessage): string {
  let formattedContent = parsedMessage.content
  
  // Replace tool invocations with their results
  parsedMessage.tools.forEach(tool => {
    const toolPattern = new RegExp(`\\[${tool.tool}:\\s*${tool.args.join(',').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'gi')
    const replacement = `[${tool.tool}: ${tool.args.join(', ')}] → ${tool.result || 'Processing...'}`
    formattedContent = formattedContent.replace(toolPattern, replacement)
  })
  
  return formattedContent
}