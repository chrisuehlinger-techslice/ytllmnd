import { test, expect, Page } from '@playwright/test';

test.describe('AppSync Browser-Based Integration Tests', () => {
  let page: Page;
  let chatId: string;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    
    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'log' && msg.text().includes('AppSync')) {
        console.log('Browser log:', msg.text());
      }
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should verify message is stored in AppSync via browser API calls', async () => {
    // Navigate to home page
    await page.goto('/');
    await page.waitForSelector('h1:has-text("YTLLMND")');
    
    // Create a chat
    const uniquePrompt = `Browser AppSync Test ${Date.now()}`;
    await page.fill('textarea#system-prompt', uniquePrompt);
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    // Extract chat ID
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Send a test message
    const testMessage = `Test message for AppSync verification ${Date.now()}`;
    await page.fill('input[type="text"]', testMessage);
    await page.click('button.send-button');
    
    // Wait for message to appear in UI
    await expect(page.locator('.chat-stream').getByText(testMessage)).toBeVisible({ timeout: 10000 });
    
    // Wait a moment for the message to be saved
    await page.waitForTimeout(1000);
    
    // Use browser context to query AppSync directly
    const messages = await page.evaluate(async ({ chatId }) => {
      // This code runs in the browser context where Amplify is available
      // @ts-ignore
      if (!window.client) {
        console.error('Amplify client not available in window');
        return [];
      }
      
      try {
        // @ts-ignore
        const { data } = await window.client.models.Message.list({
          filter: { chatId: { eq: chatId } }
        });
        return data.map(msg => ({
          id: msg.id,
          chatId: msg.chatId,
          content: msg.content,
          role: msg.role,
          timestamp: msg.timestamp
        }));
      } catch (error) {
        console.error('Error querying AppSync:', error);
        return [];
      }
    }, { chatId });
    
    // Verify the message exists in AppSync
    expect(messages.length).toBeGreaterThan(0);
    const savedMessage = messages.find(m => m.content === testMessage);
    expect(savedMessage).toBeTruthy();
    expect(savedMessage?.role).toBe('user');
    expect(savedMessage?.chatId).toBe(chatId);
  });

  test('should verify chat creation in AppSync', async () => {
    await page.goto('/');
    
    const testPrompt = `Chat creation test ${Date.now()}`;
    await page.fill('textarea#system-prompt', testPrompt);
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Query the chat from AppSync using browser context
    const chat = await page.evaluate(async ({ chatId }) => {
      // @ts-ignore
      if (!window.client) {
        console.error('Amplify client not available in window');
        return null;
      }
      
      try {
        // @ts-ignore
        const { data } = await window.client.models.Chat.get({ id: chatId });
        return data ? {
          id: data.id,
          systemPrompt: data.systemPrompt,
          createdAt: data.createdAt
        } : null;
      } catch (error) {
        console.error('Error getting chat:', error);
        return null;
      }
    }, { chatId });
    
    expect(chat).toBeTruthy();
    expect(chat?.id).toBe(chatId);
    expect(chat?.systemPrompt).toBe(testPrompt);
  });

  test('should verify real-time sync saves to AppSync', async () => {
    // Create chat
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Open assistant view
    const assistantPage = await page.context().newPage();
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    await assistantPage.waitForSelector('.chat-stream');
    
    // Send user message
    const userMsg = `User sync test ${Date.now()}`;
    await page.fill('input[type="text"]', userMsg);
    await page.click('button.send-button');
    
    // Wait for it to appear on assistant side
    await expect(assistantPage.locator('.chat-stream').getByText(userMsg)).toBeVisible({ timeout: 10000 });
    
    // Send assistant message
    const assistantMsg = `Assistant sync test ${Date.now()}`;
    await assistantPage.fill('textarea', assistantMsg);
    await assistantPage.click('button.send-button');
    
    // Wait for it to appear on user side
    await expect(page.locator('.chat-stream').getByText(assistantMsg)).toBeVisible({ timeout: 10000 });
    
    // Wait a bit for AppSync to save
    await page.waitForTimeout(2000);
    
    // Query AppSync to verify both messages are saved
    const messages = await page.evaluate(async ({ chatId }) => {
      // @ts-ignore
      if (!window.client) {
        console.error('Amplify client not available in window');
        return [];
      }
      
      try {
        // @ts-ignore
        const { data } = await window.client.models.Message.list({
          filter: { chatId: { eq: chatId } }
        });
        return data.map(msg => ({
          content: msg.content,
          role: msg.role
        }));
      } catch (error) {
        console.error('Error querying messages:', error);
        return [];
      }
    }, { chatId });
    
    // Verify both messages are in AppSync
    const userMessage = messages.find(m => m.content === userMsg);
    const assistantMessage = messages.find(m => m.content === assistantMsg);
    
    expect(userMessage).toBeTruthy();
    expect(userMessage?.role).toBe('user');
    
    expect(assistantMessage).toBeTruthy();
    expect(assistantMessage?.role).toBe('assistant');
    
    await assistantPage.close();
  });

  test('should count messages correctly in AppSync', async () => {
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Send multiple messages
    const messageCount = 5;
    const messagePrefix = `Count test ${Date.now()}`;
    
    for (let i = 0; i < messageCount; i++) {
      await page.fill('input[type="text"]', `${messagePrefix} - Message ${i + 1}`);
      await page.click('button.send-button');
      await page.waitForTimeout(300); // Small delay between messages
    }
    
    // Wait for all messages to appear
    for (let i = 0; i < messageCount; i++) {
      await expect(page.locator('.chat-stream').getByText(`Message ${i + 1}`)).toBeVisible({ timeout: 10000 });
    }
    
    // Wait a bit more for all saves to complete
    await page.waitForTimeout(2000);
    
    // Count messages in AppSync
    const dbMessageCount = await page.evaluate(async ({ chatId, prefix }) => {
      // @ts-ignore
      if (!window.client) {
        console.error('Amplify client not available in window');
        return -1;
      }
      
      try {
        // @ts-ignore
        const { data } = await window.client.models.Message.list({
          filter: { chatId: { eq: chatId } }
        });
        // Count only our test messages
        return data.filter(msg => msg.content.includes(prefix)).length;
      } catch (error) {
        console.error('Error counting messages:', error);
        return -1;
      }
    }, { chatId, prefix: messagePrefix });
    
    expect(dbMessageCount).toBe(messageCount);
  });

  test('should verify tool results are stored in AppSync', async () => {
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Open assistant view
    const assistantPage = await page.context().newPage();
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    
    // Send message with calculator tool
    const toolMsg = 'Testing calculator: [calculator: 99*99]';
    await assistantPage.fill('textarea', toolMsg);
    await assistantPage.click('button.send-button');
    
    // Wait for processed message
    await expect(assistantPage.locator('.chat-stream').getByText('[calculator: 99*99] → 9801')).toBeVisible({ timeout: 10000 });
    
    // Wait for save
    await page.waitForTimeout(1000);
    
    // Verify in AppSync
    const processedMessage = await page.evaluate(async ({ chatId }) => {
      // @ts-ignore
      if (!window.client) {
        console.error('Amplify client not available in window');
        return null;
      }
      
      try {
        // @ts-ignore
        const { data } = await window.client.models.Message.list({
          filter: { chatId: { eq: chatId } }
        });
        return data.find(msg => msg.content.includes('[calculator: 99*99]'))?.content || null;
      } catch (error) {
        console.error('Error finding tool message:', error);
        return null;
      }
    }, { chatId });
    
    expect(processedMessage).toBeTruthy();
    // The tool processing happens client-side for display, AppSync stores the raw message
    expect(processedMessage).toBe('Testing calculator: [calculator: 99*99]');
    
    await assistantPage.close();
  });

  test('should handle special characters in AppSync', async () => {
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Test various special content
    const specialMessages = [
      'Emoji test: 🚀 💻 🎉',
      'Unicode: café résumé naïve',
      'Symbols: <>&"\'@#$%',
      'Special chars: • © ® ™ °'
    ];
    
    for (const msg of specialMessages) {
      await page.fill('input[type="text"]', msg);
      await page.click('button.send-button');
      await expect(page.locator('.chat-stream').getByText(msg)).toBeVisible({ timeout: 10000 });
    }
    
    // Wait for saves
    await page.waitForTimeout(1000);
    
    // Verify all special characters are preserved in AppSync
    const savedMessages = await page.evaluate(async ({ chatId, expectedMessages }) => {
      // @ts-ignore
      if (!window.client) {
        console.error('Amplify client not available in window');
        return [];
      }
      
      try {
        // @ts-ignore
        const { data } = await window.client.models.Message.list({
          filter: { chatId: { eq: chatId } }
        });
        
        return expectedMessages.map(expected => {
          const found = data.find(msg => msg.content === expected);
          return {
            expected,
            found: found?.content || null,
            matches: found?.content === expected
          };
        });
      } catch (error) {
        console.error('Error checking special characters:', error);
        return [];
      }
    }, { chatId, expectedMessages: specialMessages });
    
    // All messages should match exactly
    for (const result of savedMessages) {
      expect(result.matches).toBe(true);
      expect(result.found).toBe(result.expected);
    }
  });
});