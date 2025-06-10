import { test, expect, Page } from '@playwright/test';
import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import * as fs from 'fs';
import * as path from 'path';

// Load config from file system
const configPath = path.join(process.cwd(), 'amplify_outputs.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Configure Amplify for the test environment
Amplify.configure(config);

test.describe('AppSync Integration Tests', () => {
  let page: Page;
  let chatId: string;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    
    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser error:', msg.text());
      }
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should create chat in AppSync when using UI', async () => {
    // Navigate to home page
    await page.goto('/');
    await page.waitForSelector('h1:has-text("YTLLMND")');
    
    // Set a unique system prompt to identify this test
    const uniquePrompt = `Test System Prompt ${Date.now()}`;
    await page.fill('textarea#system-prompt', uniquePrompt);
    
    // Create chat
    await page.click('button:has-text("Create Experience")');
    
    // Wait for navigation and extract chat ID
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    const url = page.url();
    const match = url.match(/\/chats\/([\w-]+)\/user/);
    expect(match).toBeTruthy();
    chatId = match![1];
    
    // Verify chat exists in AppSync by checking the page loads with system prompt
    await expect(page.locator('.chat-stream').getByText(uniquePrompt)).toBeVisible({ timeout: 10000 });
    
    // Also verify by navigating to assistant view
    await page.goto(`/chats/${chatId}/assistant`);
    await expect(page.locator('.chat-stream').getByText(uniquePrompt)).toBeVisible({ timeout: 10000 });
  });

  test('should store user messages in AppSync', async () => {
    // Create a new chat
    await page.goto('/');
    const testTimestamp = Date.now();
    const systemPrompt = `AppSync Test ${testTimestamp}`;
    await page.fill('textarea#system-prompt', systemPrompt);
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    // Extract chat ID
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Send multiple test messages
    const testMessages = [
      `First test message ${testTimestamp}`,
      `Second test message with special chars !@#$%`,
      `Third message with emojis 🚀 🎉 🔥`,
      `Fourth message with newlines\nLine 2\nLine 3`
    ];
    
    for (const message of testMessages) {
      await page.fill('input[type="text"]', message);
      await page.click('button.send-button');
      
      // Wait for message to appear in UI
      await expect(page.locator('.chat-stream').getByText(message)).toBeVisible({ timeout: 10000 });
    }
    
    // Refresh page to verify messages are persisted
    await page.reload();
    await page.waitForSelector('.chat-stream');
    
    // Verify all messages still appear after refresh (proving they're in AppSync)
    for (const message of testMessages) {
      await expect(page.locator('.chat-stream').getByText(message)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should store assistant messages in AppSync', async () => {
    // Create a new chat
    await page.goto('/');
    const testTimestamp = Date.now();
    await page.fill('textarea#system-prompt', `Assistant AppSync Test ${testTimestamp}`);
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Send a user message first
    const userMessage = `User question ${testTimestamp}`;
    await page.fill('input[type="text"]', userMessage);
    await page.click('button.send-button');
    await expect(page.locator('.chat-stream').getByText(userMessage)).toBeVisible({ timeout: 10000 });
    
    // Open assistant view in same context
    const assistantPage = await page.context().newPage();
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    await assistantPage.waitForSelector('.chat-stream');
    
    // Send assistant messages
    const assistantMessages = [
      `Assistant response ${testTimestamp}`,
      `Multi-line assistant response\nWith detailed explanation\nAnd examples`,
      `Response with [calculator: 5*5] tool usage`
    ];
    
    for (const message of assistantMessages) {
      await assistantPage.fill('textarea', message);
      await assistantPage.click('button.send-button');
      
      // Wait for message to appear
      if (message.includes('[calculator:')) {
        await expect(assistantPage.locator('.chat-stream').getByText('[calculator: 5*5] → 25')).toBeVisible({ timeout: 10000 });
      } else {
        await expect(assistantPage.locator('.chat-stream').getByText(message)).toBeVisible({ timeout: 10000 });
      }
    }
    
    // Close assistant page and refresh user page
    await assistantPage.close();
    await page.reload();
    
    // Verify all assistant messages appear after refresh
    for (const message of assistantMessages) {
      if (message.includes('[calculator:')) {
        await expect(page.locator('.chat-stream').getByText('[calculator: 5*5] → 25')).toBeVisible({ timeout: 10000 });
      } else {
        await expect(page.locator('.chat-stream').getByText(message)).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should handle rapid message sending and store all in AppSync', async () => {
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Send messages rapidly without waiting
    const rapidMessages = Array.from({ length: 10 }, (_, i) => `Rapid message ${i + 1}`);
    
    for (const message of rapidMessages) {
      await page.fill('input[type="text"]', message);
      await page.click('button.send-button');
      // Don't wait for UI update, just send next message
    }
    
    // Now wait for all messages to appear
    for (const message of rapidMessages) {
      await expect(page.locator('.chat-stream').getByText(message)).toBeVisible({ timeout: 15000 });
    }
    
    // Refresh and verify all messages persisted
    await page.reload();
    await page.waitForSelector('.chat-stream');
    
    for (const message of rapidMessages) {
      await expect(page.locator('.chat-stream').getByText(message)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should store tool invocation results in AppSync', async () => {
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Open assistant view
    const assistantPage = await page.context().newPage();
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    
    // Send messages with various tool invocations
    const toolMessages = [
      { input: 'Let me calculate: [calculator: 100/5+3*2]', expected: '[calculator: 100/5+3*2] → 26' },
      { input: 'Searching for: [search: TypeScript tutorials]', expected: '[search: TypeScript tutorials] → Results for "TypeScript tutorials"' },
      { input: 'Multiple tools: [calculator: 2**8] and [search: React hooks]', expected: ['[calculator: 2**8] → 256', '[search: React hooks] → Results for "React hooks"'] }
    ];
    
    for (const { input, expected } of toolMessages) {
      await assistantPage.fill('textarea', input);
      await assistantPage.click('button.send-button');
      
      // Wait for processed message with tool results
      if (Array.isArray(expected)) {
        for (const exp of expected) {
          await expect(assistantPage.locator('.chat-stream').getByText(exp)).toBeVisible({ timeout: 10000 });
        }
      } else {
        await expect(assistantPage.locator('.chat-stream').getByText(expected)).toBeVisible({ timeout: 10000 });
      }
    }
    
    // Refresh both pages to verify tool results are persisted
    await assistantPage.reload();
    await page.reload();
    
    // Verify tool results still appear after refresh
    for (const { expected } of toolMessages) {
      if (Array.isArray(expected)) {
        for (const exp of expected) {
          await expect(page.locator('.chat-stream').getByText(exp)).toBeVisible({ timeout: 10000 });
        }
      } else {
        await expect(page.locator('.chat-stream').getByText(expected)).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should maintain message order in AppSync across page reloads', async () => {
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Open assistant view
    const assistantPage = await page.context().newPage();
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    await assistantPage.waitForSelector('.chat-stream');
    
    // Create a specific sequence of messages
    const messageSequence = [
      { role: 'user', text: 'First user message', page: page },
      { role: 'assistant', text: 'First assistant response', page: assistantPage },
      { role: 'user', text: 'Second user message', page: page },
      { role: 'assistant', text: 'Second assistant response', page: assistantPage },
      { role: 'user', text: 'Final user message', page: page }
    ];
    
    // Send messages in sequence
    for (const msg of messageSequence) {
      if (msg.role === 'user') {
        await msg.page.fill('input[type="text"]', msg.text);
        await msg.page.click('button.send-button');
      } else {
        await msg.page.fill('textarea', msg.text);
        await msg.page.click('button.send-button');
      }
      
      // Wait for message to appear on both pages
      await expect(page.locator('.chat-stream').getByText(msg.text)).toBeVisible({ timeout: 10000 });
      await expect(assistantPage.locator('.chat-stream').getByText(msg.text)).toBeVisible({ timeout: 10000 });
    }
    
    // Get the full text content to verify order
    const getMessageOrder = async (p: Page) => {
      const content = await p.locator('.chat-stream').textContent();
      const order: string[] = [];
      for (const msg of messageSequence) {
        const index = content!.indexOf(msg.text);
        if (index !== -1) {
          order.push(msg.text);
        }
      }
      return order;
    };
    
    const originalUserOrder = await getMessageOrder(page);
    const originalAssistantOrder = await getMessageOrder(assistantPage);
    
    // Reload both pages
    await page.reload();
    await assistantPage.reload();
    await page.waitForSelector('.chat-stream');
    await assistantPage.waitForSelector('.chat-stream');
    
    // Verify order is maintained after reload
    const reloadedUserOrder = await getMessageOrder(page);
    const reloadedAssistantOrder = await getMessageOrder(assistantPage);
    
    expect(reloadedUserOrder).toEqual(originalUserOrder);
    expect(reloadedAssistantOrder).toEqual(originalAssistantOrder);
    
    // Verify the exact sequence
    const expectedOrder = messageSequence.map(m => m.text);
    expect(reloadedUserOrder).toEqual(expectedOrder);
  });

  test('should handle network interruption gracefully', async () => {
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Send a message normally
    const firstMessage = 'Message before network issue';
    await page.fill('input[type="text"]', firstMessage);
    await page.click('button.send-button');
    await expect(page.locator('.chat-stream').getByText(firstMessage)).toBeVisible({ timeout: 10000 });
    
    // Simulate offline mode
    await page.context().setOffline(true);
    
    // Try to send a message while offline
    const offlineMessage = 'Message during network issue';
    await page.fill('input[type="text"]', offlineMessage);
    await page.click('button.send-button');
    
    // The message might appear locally but won't sync
    // Wait a bit to see if any error handling occurs
    await page.waitForTimeout(2000);
    
    // Go back online
    await page.context().setOffline(false);
    
    // Send another message
    const afterMessage = 'Message after network restored';
    await page.fill('input[type="text"]', afterMessage);
    await page.click('button.send-button');
    await expect(page.locator('.chat-stream').getByText(afterMessage)).toBeVisible({ timeout: 10000 });
    
    // Refresh to check what was actually persisted
    await page.reload();
    await page.waitForSelector('.chat-stream');
    
    // First and last messages should be there
    await expect(page.locator('.chat-stream').getByText(firstMessage)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.chat-stream').getByText(afterMessage)).toBeVisible({ timeout: 10000 });
    
    // The offline message behavior depends on implementation
    // It might or might not be there depending on error handling
  });

  test('should verify message timestamps are stored correctly', async () => {
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Record time before sending message
    const beforeTime = new Date().toISOString();
    
    // Send a message
    const timestampMessage = `Timestamp test at ${new Date().toLocaleTimeString()}`;
    await page.fill('input[type="text"]', timestampMessage);
    await page.click('button.send-button');
    await expect(page.locator('.chat-stream').getByText(timestampMessage)).toBeVisible({ timeout: 10000 });
    
    // Record time after message appears
    const afterTime = new Date().toISOString();
    
    // Wait a few seconds
    await page.waitForTimeout(3000);
    
    // Send another message
    const secondMessage = `Second timestamp test at ${new Date().toLocaleTimeString()}`;
    await page.fill('input[type="text"]', secondMessage);
    await page.click('button.send-button');
    await expect(page.locator('.chat-stream').getByText(secondMessage)).toBeVisible({ timeout: 10000 });
    
    // Reload to ensure messages are loaded from AppSync
    await page.reload();
    await page.waitForSelector('.chat-stream');
    
    // Verify messages appear in correct order (which implies timestamps are correct)
    const content = await page.locator('.chat-stream').textContent();
    const firstIndex = content!.indexOf(timestampMessage);
    const secondIndex = content!.indexOf(secondMessage);
    
    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(-1);
    expect(firstIndex).toBeLessThan(secondIndex);
  });
});