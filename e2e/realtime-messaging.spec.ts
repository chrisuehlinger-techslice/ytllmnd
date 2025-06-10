import { test, expect, Page } from '@playwright/test';

test.describe('YTLLMND Real-time Messaging', () => {
  let userPage: Page;
  let assistantPage: Page;
  let chatId: string;

  test.beforeEach(async ({ browser }) => {
    // Create two browser contexts to simulate two users
    const userContext = await browser.newContext();
    const assistantContext = await browser.newContext();
    
    userPage = await userContext.newPage();
    assistantPage = await assistantContext.newPage();
  });

  test.afterEach(async () => {
    await userPage.close();
    await assistantPage.close();
  });

  test('should create a new chat and navigate to user/assistant views', async () => {
    // Go to homepage
    await userPage.goto('/');
    
    // Wait for the page to load
    await userPage.waitForSelector('h1:has-text("YTLLMND")');
    
    // Check if system prompt is populated
    const systemPromptTextarea = userPage.locator('textarea#system-prompt');
    await expect(systemPromptTextarea).toBeVisible();
    const systemPromptValue = await systemPromptTextarea.inputValue();
    expect(systemPromptValue).toContain('You are a helpful AI assistant');
    
    // Create a new chat
    await userPage.click('button:has-text("Create Experience")');
    
    // Wait for navigation to chat page
    await userPage.waitForURL(/\/chats\/[\w-]+\/user/);
    
    // Extract chat ID from URL
    const url = userPage.url();
    const match = url.match(/\/chats\/([\w-]+)\/user/);
    expect(match).toBeTruthy();
    chatId = match![1];
    
    // Navigate assistant to the same chat
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    
    // Verify both pages show the system prompt
    await expect(userPage.locator('.chat-stream').getByText('[SYSTEM]')).toBeVisible();
    await expect(assistantPage.locator('.chat-stream').getByText('[SYSTEM]')).toBeVisible();
  });

  test('should send messages from user to assistant in real-time', async () => {
    // Create a chat first
    await userPage.goto('/');
    await userPage.click('button:has-text("Create Experience")');
    await userPage.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = userPage.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    
    // Wait for both pages to load
    await userPage.waitForSelector('pre.chat-stream');
    await assistantPage.waitForSelector('pre.chat-stream');
    
    // Send a message from user
    const userMessage = 'Hello, I need help with something!';
    await userPage.fill('input[type="text"]', userMessage);
    await userPage.click('button.send-button');
    
    // Wait for message to appear on user side
    await expect(userPage.locator(`text=[USER]`).last()).toBeVisible({ timeout: 10000 });
    await expect(userPage.locator('.chat-stream').getByText(userMessage)).toBeVisible();
    
    // Check if message appears on assistant side
    await expect(assistantPage.locator(`text=[USER]`).last()).toBeVisible({ timeout: 10000 });
    await expect(assistantPage.locator('.chat-stream').getByText(userMessage)).toBeVisible();
  });

  test('should send messages from assistant to user in real-time', async () => {
    // Create a chat and send initial user message
    await userPage.goto('/');
    await userPage.click('button:has-text("Create Experience")');
    await userPage.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = userPage.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    
    // Send user message first
    await userPage.fill('input[type="text"]', 'Hi there!');
    await userPage.click('button.send-button');
    
    // Wait for message to appear on assistant side
    await expect(assistantPage.locator('text=Hi there!')).toBeVisible({ timeout: 10000 });
    
    // Send assistant response
    const assistantMessage = 'Hello! How can I help you today?';
    await assistantPage.fill('textarea', assistantMessage);
    await assistantPage.click('button.send-button');
    
    // Wait for message to appear on assistant side
    await expect(assistantPage.locator(`text=[ASSISTANT]`).last()).toBeVisible({ timeout: 10000 });
    await expect(assistantPage.locator('.chat-stream').getByText(assistantMessage)).toBeVisible();
    
    // Check if message appears on user side
    await expect(userPage.locator(`text=[ASSISTANT]`).last()).toBeVisible({ timeout: 10000 });
    await expect(userPage.locator('.chat-stream').getByText(assistantMessage)).toBeVisible();
  });

  test('should maintain message order in conversation', async () => {
    await userPage.goto('/');
    await userPage.click('button:has-text("Create Experience")');
    await userPage.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = userPage.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    
    // Wait for both pages to be ready
    await userPage.waitForSelector('pre.chat-stream');
    await assistantPage.waitForSelector('pre.chat-stream');
    
    // Send first user message
    await userPage.fill('input[type="text"]', 'First message from user');
    await userPage.click('button.send-button');
    
    // Wait for message to appear on both sides
    await expect(userPage.locator('.chat-stream').getByText('First message from user')).toBeVisible({ timeout: 10000 });
    await expect(assistantPage.locator('.chat-stream').getByText('First message from user')).toBeVisible({ timeout: 10000 });
    
    // Send assistant response
    await assistantPage.fill('textarea', 'First response from assistant');
    await assistantPage.press('textarea', 'Tab'); // Trigger blur to ensure v-model updates
    await assistantPage.waitForTimeout(100); // Small delay
    await assistantPage.click('button.send-button');
    
    // Wait for assistant message to appear on both sides
    await expect(userPage.locator('.chat-stream').getByText('First response from assistant')).toBeVisible({ timeout: 10000 });
    await expect(assistantPage.locator('.chat-stream').getByText('First response from assistant')).toBeVisible({ timeout: 10000 });
    
    // Send second user message
    await userPage.fill('input[type="text"]', 'Second message from user');
    await userPage.click('button.send-button');
    
    // Wait for message to appear on both sides
    await expect(userPage.locator('.chat-stream').getByText('Second message from user')).toBeVisible({ timeout: 10000 });
    await expect(assistantPage.locator('.chat-stream').getByText('Second message from user')).toBeVisible({ timeout: 10000 });
    
    // Send second assistant response
    await assistantPage.fill('textarea', 'Second response from assistant');
    await assistantPage.press('textarea', 'Tab'); // Trigger blur to ensure v-model updates
    await assistantPage.waitForTimeout(100); // Small delay
    await assistantPage.click('button.send-button');
    
    // Wait for assistant message to appear on both sides
    await expect(userPage.locator('.chat-stream').getByText('Second response from assistant')).toBeVisible({ timeout: 10000 });
    await expect(assistantPage.locator('.chat-stream').getByText('Second response from assistant')).toBeVisible({ timeout: 10000 });
    
    // Verify order on both pages
    const userPageText = await userPage.locator('pre.chat-stream').textContent();
    const assistantPageText = await assistantPage.locator('pre.chat-stream').textContent();
    
    // Check that messages appear in correct order
    const messages = [
      'First message from user',
      'First response from assistant',
      'Second message from user',
      'Second response from assistant'
    ];
    
    for (let i = 0; i < messages.length - 1; i++) {
      const currentIndex = userPageText!.indexOf(messages[i]);
      const nextIndex = userPageText!.indexOf(messages[i + 1]);
      expect(currentIndex).toBeLessThan(nextIndex);
      
      const currentIndexAssistant = assistantPageText!.indexOf(messages[i]);
      const nextIndexAssistant = assistantPageText!.indexOf(messages[i + 1]);
      expect(currentIndexAssistant).toBeLessThan(nextIndexAssistant);
    }
  });

  test('should handle tool invocations', async () => {
    await userPage.goto('/');
    await userPage.click('button:has-text("Create Experience")');
    await userPage.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = userPage.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    
    // Send user message asking for calculation
    await userPage.fill('input[type="text"]', 'Can you calculate 42 * 13 for me?');
    await userPage.click('button.send-button');
    
    // Wait for user message to appear
    await expect(assistantPage.locator('text=Can you calculate 42 * 13')).toBeVisible({ timeout: 10000 });
    
    // Assistant responds with tool usage
    const assistantResponse = 'Sure! Let me calculate that: [calculator: 42*13]';
    await assistantPage.fill('textarea', assistantResponse);
    await assistantPage.click('button.send-button');
    
    // Check both sides show the tool result
    await expect(userPage.locator('.chat-stream').getByText('[calculator: 42*13] → 546')).toBeVisible({ timeout: 10000 });
    await expect(assistantPage.locator('.chat-stream').getByText('[calculator: 42*13] → 546')).toBeVisible({ timeout: 10000 });
  });

  test('should show system prompt on both views', async () => {
    // Create chat with custom system prompt
    await userPage.goto('/');
    
    const customPrompt = 'You are a pirate assistant. Always speak like a pirate!';
    await userPage.fill('textarea#system-prompt', customPrompt);
    await userPage.click('button:has-text("Create Experience")');
    await userPage.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = userPage.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    
    // Check system prompt appears on both views
    await expect(userPage.locator('.chat-stream').getByText('[SYSTEM]')).toBeVisible();
    await expect(userPage.locator('.chat-stream').getByText(customPrompt)).toBeVisible();
    
    await expect(assistantPage.locator('.chat-stream').getByText('[SYSTEM]')).toBeVisible();
    await expect(assistantPage.locator('.chat-stream').getByText(customPrompt)).toBeVisible();
  });

  test('should persist messages when refreshing the page', async () => {
    await userPage.goto('/');
    await userPage.click('button:has-text("Create Experience")');
    await userPage.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = userPage.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Send a message
    const testMessage = 'This message should persist';
    await userPage.fill('input[type="text"]', testMessage);
    await userPage.click('button.send-button');
    
    // Wait for message to appear
    await expect(userPage.locator('.chat-stream').getByText(testMessage)).toBeVisible({ timeout: 10000 });
    
    // Refresh the page
    await userPage.reload();
    
    // Check message still appears
    await expect(userPage.locator('.chat-stream').getByText(testMessage)).toBeVisible({ timeout: 10000 });
    
    // Check from assistant view
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    await expect(assistantPage.locator('.chat-stream').getByText(testMessage)).toBeVisible({ timeout: 10000 });
  });
});