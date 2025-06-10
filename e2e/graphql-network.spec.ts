import { test, expect, Page, Request, Response } from '@playwright/test';

test.describe('GraphQL Network Request Verification', () => {
  let page: Page;
  let graphqlRequests: { request: Request; response: Response | null; body: any }[] = [];

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    graphqlRequests = [];

    // Intercept all GraphQL requests
    page.on('request', request => {
      if (request.url().includes('/graphql') && request.method() === 'POST') {
        const body = request.postDataJSON();
        graphqlRequests.push({ request, response: null, body });
      }
    });

    page.on('response', response => {
      if (response.url().includes('/graphql')) {
        const req = graphqlRequests.find(r => r.request === response.request());
        if (req) {
          req.response = response;
        }
      }
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should verify GraphQL mutations are sent when creating a chat', async () => {
    await page.goto('/');
    
    const testPrompt = `GraphQL Test ${Date.now()}`;
    await page.fill('textarea#system-prompt', testPrompt);
    
    // Clear previous requests
    graphqlRequests = [];
    
    // Create chat
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    // Wait a moment for all requests to complete
    await page.waitForTimeout(1000);
    
    // Find the createChat mutation
    const createChatRequest = graphqlRequests.find(req => 
      req.body?.query?.includes('createChat') || 
      req.body?.operationName === 'createChat'
    );
    
    expect(createChatRequest).toBeTruthy();
    expect(createChatRequest?.body.variables?.input?.systemPrompt).toBe(testPrompt);
    
    // Verify the response was successful
    if (createChatRequest?.response) {
      const responseData = await createChatRequest.response.json();
      expect(responseData.data?.createChat).toBeTruthy();
      expect(responseData.data?.createChat?.id).toBeTruthy();
      expect(responseData.data?.createChat?.systemPrompt).toBe(testPrompt);
    }
  });

  test('should verify GraphQL mutations for message creation', async () => {
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    const chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Clear previous requests
    graphqlRequests = [];
    
    // Send a message
    const testMessage = `Network test message ${Date.now()}`;
    await page.fill('input[type="text"]', testMessage);
    await page.click('button.send-button');
    
    // Wait for the message to appear
    await expect(page.locator('.chat-stream').getByText(testMessage)).toBeVisible({ timeout: 10000 });
    
    // Find the createMessage mutation
    const createMessageRequest = graphqlRequests.find(req => 
      req.body?.query?.includes('createMessage') || 
      req.body?.operationName === 'createMessage'
    );
    
    expect(createMessageRequest).toBeTruthy();
    expect(createMessageRequest?.body.variables?.input?.content).toBe(testMessage);
    expect(createMessageRequest?.body.variables?.input?.chatId).toBe(chatId);
    expect(createMessageRequest?.body.variables?.input?.role).toBe('user');
    
    // Verify the response
    if (createMessageRequest?.response) {
      const responseData = await createMessageRequest.response.json();
      expect(responseData.data?.createMessage).toBeTruthy();
      expect(responseData.data?.createMessage?.content).toBe(testMessage);
      expect(responseData.data?.createMessage?.chatId).toBe(chatId);
      expect(responseData.data?.createMessage?.role).toBe('user');
    }
  });

  test('should verify GraphQL subscriptions are established', async () => {
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    // Look for WebSocket connections (subscriptions use WebSocket)
    const webSocketPromise = new Promise<string>(resolve => {
      page.on('websocket', ws => {
        if (ws.url().includes('realtime') || ws.url().includes('appsync')) {
          resolve(ws.url());
        }
      });
    });
    
    // Wait a bit for subscriptions to be established
    const timeout = new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error('WebSocket timeout')), 5000)
    );
    
    try {
      const wsUrl = await Promise.race([webSocketPromise, timeout]);
      expect(wsUrl).toBeTruthy();
    } catch (e) {
      // WebSocket monitoring might not work in all environments
      // Check for subscription-related GraphQL requests instead
      const subscriptionRequests = graphqlRequests.filter(req => 
        req.body?.query?.includes('subscription') || 
        req.body?.operationName?.includes('on')
      );
      
      // Should have subscription requests for onCreate/onUpdate
      expect(subscriptionRequests.length).toBeGreaterThan(0);
    }
  });

  test('should verify all required fields are sent in mutations', async () => {
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    const chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Open assistant view
    const assistantPage = await page.context().newPage();
    await assistantPage.goto(`/chats/${chatId}/assistant`);
    
    // Monitor assistant page requests too
    const assistantRequests: any[] = [];
    assistantPage.on('request', request => {
      if (request.url().includes('/graphql') && request.method() === 'POST') {
        assistantRequests.push({
          body: request.postDataJSON(),
          url: request.url(),
          method: request.method()
        });
      }
    });
    
    // Send an assistant message
    const assistantMessage = 'Assistant GraphQL test';
    await assistantPage.fill('textarea', assistantMessage);
    await assistantPage.click('button.send-button');
    
    // Wait for message to appear
    await expect(assistantPage.locator('.chat-stream').getByText(assistantMessage)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    
    // Find the assistant's createMessage mutation
    const assistantCreateMessage = assistantRequests.find(req => 
      req.body?.query?.includes('createMessage') || 
      req.body?.operationName === 'createMessage'
    );
    
    expect(assistantCreateMessage).toBeTruthy();
    
    // Verify all required fields are present
    const input = assistantCreateMessage?.body.variables?.input;
    expect(input).toBeTruthy();
    expect(input.chatId).toBe(chatId);
    expect(input.content).toBe(assistantMessage);
    expect(input.role).toBe('assistant');
    expect(input.timestamp).toBeTruthy();
    expect(new Date(input.timestamp).getTime()).toBeGreaterThan(0);
    
    await assistantPage.close();
  });

  test('should verify list queries when loading chat history', async () => {
    // Create a chat and send some messages
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    const url = page.url();
    const chatId = url.match(/\/chats\/([\w-]+)\/user/)![1];
    
    // Send a few messages
    for (let i = 1; i <= 3; i++) {
      await page.fill('input[type="text"]', `History message ${i}`);
      await page.click('button.send-button');
      await page.waitForTimeout(500);
    }
    
    // Navigate away and back to trigger a fresh load
    await page.goto('/');
    
    // Clear requests
    graphqlRequests = [];
    
    // Navigate back to the chat
    await page.goto(`/chats/${chatId}/user`);
    await page.waitForSelector('.chat-stream');
    
    // Wait for queries to complete
    await page.waitForTimeout(1000);
    
    // Find list/get queries
    const getChatQuery = graphqlRequests.find(req => 
      req.body?.query?.includes('getChat') || 
      (req.body?.query?.includes('Chat') && req.body?.query?.includes('id'))
    );
    
    const listMessagesQuery = graphqlRequests.find(req => 
      req.body?.query?.includes('listMessages') || 
      (req.body?.query?.includes('Message') && req.body?.query?.includes('filter'))
    );
    
    expect(getChatQuery).toBeTruthy();
    expect(listMessagesQuery).toBeTruthy();
    
    // Verify the chat query includes the correct ID
    if (getChatQuery?.body.variables) {
      expect(getChatQuery.body.variables.id).toBe(chatId);
    }
    
    // Verify the messages query filters by chatId
    if (listMessagesQuery?.body.variables) {
      expect(listMessagesQuery.body.variables.filter?.chatId?.eq).toBe(chatId);
    }
  });

  test('should batch GraphQL operations efficiently', async () => {
    await page.goto('/');
    await page.click('button:has-text("Create Experience")');
    await page.waitForURL(/\/chats\/[\w-]+\/user/);
    
    // Clear requests
    graphqlRequests = [];
    
    // Send multiple messages quickly
    const messages = ['Batch 1', 'Batch 2', 'Batch 3'];
    for (const msg of messages) {
      await page.fill('input[type="text"]', msg);
      await page.click('button.send-button');
      // Don't wait between messages
    }
    
    // Wait for all to complete
    await page.waitForTimeout(2000);
    
    // Count createMessage mutations
    const createMessageMutations = graphqlRequests.filter(req => 
      req.body?.query?.includes('createMessage') || 
      req.body?.operationName === 'createMessage'
    );
    
    // Should have one mutation per message (no batching in this case)
    expect(createMessageMutations.length).toBe(messages.length);
    
    // Verify each mutation has the correct content
    for (let i = 0; i < messages.length; i++) {
      const mutation = createMessageMutations.find(m => 
        m.body.variables?.input?.content === messages[i]
      );
      expect(mutation).toBeTruthy();
    }
  });

  test('should handle GraphQL errors gracefully', async () => {
    await page.goto('/');
    
    // Intercept and modify a request to cause an error
    await page.route('**/graphql', async (route, request) => {
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        if (body?.operationName === 'createChat') {
          // Send an error response
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              errors: [{
                message: 'Test error: Invalid input',
                extensions: {
                  code: 'BAD_USER_INPUT'
                }
              }]
            })
          });
          return;
        }
      }
      await route.continue();
    });
    
    // Try to create a chat (should fail)
    await page.fill('textarea#system-prompt', 'Error test prompt');
    await page.click('button:has-text("Create Experience")');
    
    // Should not navigate (due to error)
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('localhost:5173/');
    
    // Check for error handling (alert or console error)
    // The app shows an alert on error
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Failed to create chat');
      dialog.accept();
    });
  });
});