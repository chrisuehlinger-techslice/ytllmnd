import { test, expect, Page } from '@playwright/test';
import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import * as fs from 'fs';
import * as path from 'path';
import type { Schema } from '../amplify/data/resource';

// Load config from file system
const configPath = path.join(process.cwd(), 'amplify_outputs.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Configure Amplify for direct API access
Amplify.configure(config);
const client = generateClient<Schema>();

test.describe('Direct AppSync API Verification', () => {
  let page: Page;
  let chatId: string;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should verify message creation via direct AppSync query', async () => {
    // Create a chat through UI
    await page.goto('/');
    const uniquePrompt = `Direct API Test ${Date.now()}`;
    await page.fill('textarea#system-prompt', uniquePrompt);
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Query AppSync directly to verify chat exists
    const { data: chat } = await client.models.Chat.get({ id: chatId });
    expect(chat).toBeTruthy();
    expect(chat?.systemPrompt).toBe(uniquePrompt);
    expect(chat?.id).toBe(chatId);
    
    // Send a message through UI
    const testMessage = `API verification message ${Date.now()}`;
    await page.fill('input[type="text"]', testMessage);
    await page.click('button.send-button');
    await expect(page.locator('.chat-stream').getByText(testMessage)).toBeVisible({ timeout: 10000 });
    
    // Wait a moment for the message to be saved
    await page.waitForTimeout(1000);
    
    // Query AppSync directly for messages
    const { data: messages } = await client.models.Message.list({
      filter: { chatId: { eq: chatId } }
    });
    
    expect(messages).toBeTruthy();
    expect(messages.length).toBeGreaterThan(0);
    
    // Find our specific message
    const ourMessage = messages.find(m => m.content === testMessage);
    expect(ourMessage).toBeTruthy();
    expect(ourMessage?.role).toBe('user');
    expect(ourMessage?.chatId).toBe(chatId);
  });

  test('should verify all message fields are stored correctly', async () => {
    // Create a chat
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Send messages from both user and assistant
    const userMsg = `User message for field verification ${Date.now()}`;
    await page.fill('input[type="text"]', userMsg);
    await page.click('button.send-button');
    await expect(page.locator('.chat-stream').getByText(userMsg)).toBeVisible({ timeout: 10000 });
    
    // Open assistant view
    const assistantPage = await page.context().newPage();
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    await assistantPage.waitForSelector('.chat-stream');
    
    const assistantMsg = `Assistant message for field verification ${Date.now()}`;
    await assistantPage.fill('textarea', assistantMsg);
    await assistantPage.click('button.send-button');
    await expect(assistantPage.locator('.chat-stream').getByText(assistantMsg)).toBeVisible({ timeout: 10000 });
    
    // Wait for messages to be saved
    await page.waitForTimeout(1000);
    
    // Query AppSync for all messages
    const { data: messages } = await client.models.Message.list({
      filter: { chatId: { eq: chatId } }
    });
    
    // Verify user message fields
    const userMessage = messages.find(m => m.content === userMsg);
    expect(userMessage).toBeTruthy();
    expect(userMessage?.id).toBeTruthy();
    expect(userMessage?.chatId).toBe(chatId);
    expect(userMessage?.role).toBe('user');
    expect(userMessage?.content).toBe(userMsg);
    expect(userMessage?.timestamp).toBeTruthy();
    expect(new Date(userMessage?.timestamp!).getTime()).toBeGreaterThan(0);
    
    // Verify assistant message fields
    const assistantMessage = messages.find(m => m.content === assistantMsg);
    expect(assistantMessage).toBeTruthy();
    expect(assistantMessage?.id).toBeTruthy();
    expect(assistantMessage?.chatId).toBe(chatId);
    expect(assistantMessage?.role).toBe('assistant');
    expect(assistantMessage?.content).toBe(assistantMsg);
    expect(assistantMessage?.timestamp).toBeTruthy();
    expect(new Date(assistantMessage?.timestamp!).getTime()).toBeGreaterThan(0);
    
    await assistantPage.close();
  });

  test('should verify tool-processed messages are stored correctly', async () => {
    // Create a chat
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Open assistant view
    const assistantPage = await page.context().newPage();
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    
    // Send message with tool
    const toolMessage = 'Calculate this: [calculator: 42*10+58]';
    await assistantPage.fill('textarea', toolMessage);
    await assistantPage.click('button.send-button');
    await expect(assistantPage.locator('.chat-stream').getByText('[calculator: 42*10+58] → 478')).toBeVisible({ timeout: 10000 });
    
    // Wait for save
    await page.waitForTimeout(1000);
    
    // Query AppSync
    const { data: messages } = await client.models.Message.list({
      filter: { chatId: { eq: chatId } }
    });
    
    // Find the tool message
    const storedMessage = messages.find(m => m.content.includes('[calculator: 42*10+58]'));
    expect(storedMessage).toBeTruthy();
    expect(storedMessage?.content).toContain('[calculator: 42*10+58] → 478');
    expect(storedMessage?.role).toBe('assistant');
    
    await assistantPage.close();
  });

  test('should verify message count matches between UI and AppSync', async () => {
    // Create a chat
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Send multiple messages
    const messageCount = 5;
    for (let i = 0; i < messageCount; i++) {
      await page.fill('input[type="text"]', `Test message ${i + 1}`);
      await page.click('button.send-button');
      await page.waitForTimeout(500); // Small delay between messages
    }
    
    // Wait for all messages to appear
    for (let i = 0; i < messageCount; i++) {
      await expect(page.locator('.chat-stream').getByText(`Test message ${i + 1}`)).toBeVisible({ timeout: 10000 });
    }
    
    // Wait for messages to be saved
    await page.waitForTimeout(1000);
    
    // Query AppSync for total count
    const { data: messages } = await client.models.Message.list({
      filter: { chatId: { eq: chatId } }
    });
    
    // Should have exactly the messages we sent
    expect(messages.length).toBe(messageCount);
    
    // Verify each message exists
    for (let i = 0; i < messageCount; i++) {
      const msg = messages.find(m => m.content === `Test message ${i + 1}`);
      expect(msg).toBeTruthy();
    }
  });

  test('should verify messages persist across browser sessions', async () => {
    // Create a chat and send messages
    await page.goto('/');
    const sessionTest = `Session test ${Date.now()}`;
    await page.fill('textarea#system-prompt', sessionTest);
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Send test messages
    const messages = [
      'First session message',
      'Second session message',
      'Third session message'
    ];
    
    for (const msg of messages) {
      await page.fill('input[type="text"]', msg);
      await page.click('button.send-button');
      await expect(page.locator('.chat-stream').getByText(msg)).toBeVisible({ timeout: 10000 });
    }
    
    // Close the page completely
    await page.close();
    
    // Create a new browser context (simulating new session)
    const newContext = await page.context().browser()!.newContext();
    const newPage = await newContext.newPage();
    
    // Navigate directly to the chat
    await newPage.goto(`/chats/${chatId}/user`);
    await newPage.waitForSelector('.chat-stream');
    
    // Verify all messages are loaded from AppSync
    for (const msg of messages) {
      await expect(newPage.locator('.chat-stream').getByText(msg)).toBeVisible({ timeout: 10000 });
    }
    
    // Also verify via direct API
    const { data: apiMessages } = await client.models.Message.list({
      filter: { chatId: { eq: chatId } }
    });
    
    expect(apiMessages.length).toBe(messages.length);
    for (const msg of messages) {
      expect(apiMessages.some(m => m.content === msg)).toBe(true);
    }
    
    await newPage.close();
    await newContext.close();
  });

  test('should handle special characters and emoji in AppSync', async () => {
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Test various special content
    const specialMessages = [
      'Message with "quotes" and \'apostrophes\'',
      'Unicode: ñ é ü ∞ ∑ π',
      'Emoji party: 🎉 🚀 💻 🔥 🌟',
      'Code snippet: const x = () => { return "test"; }',
      'HTML-like: <div>Not HTML</div> & entities',
      'Newlines:\nLine 2\nLine 3\n\nLine 5',
      'Tabs:\tColumn1\tColumn2',
      'Mixed: 你好 мир العالم 🌍'
    ];
    
    // Send all special messages
    for (const msg of specialMessages) {
      await page.fill('input[type="text"]', msg);
      await page.click('button.send-button');
      await expect(page.locator('.chat-stream').getByText(msg)).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(300);
    }
    
    // Wait for saves
    await page.waitForTimeout(1000);
    
    // Query AppSync and verify all special characters are preserved
    const { data: messages } = await client.models.Message.list({
      filter: { chatId: { eq: chatId } }
    });
    
    expect(messages.length).toBe(specialMessages.length);
    
    for (const specialMsg of specialMessages) {
      const found = messages.find(m => m.content === specialMsg);
      expect(found).toBeTruthy();
      expect(found?.content).toBe(specialMsg); // Exact match including special chars
    }
    
    // Reload page to verify display
    await page.reload();
    await page.waitForSelector('.chat-stream');
    
    for (const msg of specialMessages) {
      await expect(page.locator('.chat-stream').getByText(msg)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should verify subscription updates match AppSync data', async () => {
    // Create two browser pages
    const userPage = page;
    const assistantContext = await page.context().browser()!.newContext();
    const assistantPage = await assistantContext.newPage();
    
    // Create chat
    await userPage.goto('/');
    await userPage.click('button:has-text("Create Experience")');
    await userPage.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = userPage.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Open assistant view
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    await assistantPage.waitForSelector('.chat-stream');
    
    // Send a message from user
    const subTestMsg = `Subscription test ${Date.now()}`;
    await userPage.fill('input[type="text"]', subTestMsg);
    await userPage.click('button.send-button');
    
    // Wait for it to appear on both sides
    await expect(userPage.locator('.chat-stream').getByText(subTestMsg)).toBeVisible({ timeout: 10000 });
    await expect(assistantPage.locator('.chat-stream').getByText(subTestMsg)).toBeVisible({ timeout: 10000 });
    
    // Query AppSync to verify it's there
    await page.waitForTimeout(1000);
    const { data: messages } = await client.models.Message.list({
      filter: { chatId: { eq: chatId } }
    });
    
    const foundMessage = messages.find(m => m.content === subTestMsg);
    expect(foundMessage).toBeTruthy();
    expect(foundMessage?.chatId).toBe(chatId);
    expect(foundMessage?.role).toBe('user');
    
    await assistantPage.close();
    await assistantContext.close();
  });
});