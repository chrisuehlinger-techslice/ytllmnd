# E2E Test Suites for YTLLMND

This directory contains comprehensive end-to-end tests that verify messages sent through the UI are properly stored in AWS AppSync/DynamoDB.

## Test Files

### 1. `realtime-messaging.spec.ts`
- Tests real-time message synchronization between user and assistant views
- Verifies bidirectional communication works correctly
- Tests tool invocations and message persistence
- Ensures messages appear in correct order

### 2. `appsync-integration.spec.ts`
- Tests that messages sent via UI are stored in AppSync
- Verifies message persistence across page reloads
- Tests rapid message sending and storage
- Validates tool invocation results are persisted
- Tests network interruption handling
- Verifies messages persist across browser sessions

### 3. `appsync-direct.spec.ts`
- Directly queries AppSync API to verify data storage
- Uses Amplify client to fetch and validate stored data
- Verifies all message fields are stored correctly
- Tests special characters, emoji, and unicode handling
- Validates message count matches between UI and database
- Ensures subscription updates match stored data

### 4. `graphql-network.spec.ts`
- Monitors actual GraphQL network requests
- Verifies correct mutations are sent when creating chats/messages
- Validates all required fields are included in requests
- Tests GraphQL subscription establishment
- Monitors query operations when loading chat history
- Tests error handling for failed GraphQL operations

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test suites
npm run test:e2e:appsync    # AppSync integration tests
npm run test:e2e:direct     # Direct API verification tests
npm run test:e2e:network    # GraphQL network monitoring tests

# Run all E2E tests
npm run test:e2e:all

# Run tests with UI
npm run test:e2e:ui

# Debug tests
npm run test:e2e:debug
```

## Test Coverage

These tests verify:

1. **Data Persistence**: Every message sent through the UI is stored in AppSync/DynamoDB
2. **Field Integrity**: All message fields (id, chatId, content, role, timestamp) are correctly stored
3. **Real-time Sync**: Messages appear on both user and assistant views via subscriptions
4. **Special Content**: Unicode, emoji, special characters are properly handled
5. **Tool Processing**: Tool invocations are processed and results are stored
6. **Network Reliability**: Messages persist even with network interruptions
7. **Session Persistence**: Data remains available across browser sessions
8. **API Compliance**: GraphQL mutations include all required fields
9. **Error Handling**: Failed operations are handled gracefully

## Prerequisites

1. The app must be running locally (`npm run dev`)
2. Amplify backend must be deployed (`npx ampx sandbox`)
3. Valid `amplify_outputs.json` must exist

## Debugging Failed Tests

If tests fail:

1. Check the HTML report: `npx playwright show-report`
2. Look for screenshot attachments in test results
3. Check browser console logs in the test output
4. Verify Amplify sandbox is running
5. Ensure `amplify_outputs.json` is up to date

## Test Architecture

The tests use multiple approaches to ensure data integrity:

1. **UI Verification**: Confirms messages appear in the UI
2. **Direct API Queries**: Uses Amplify client to verify backend storage
3. **Network Monitoring**: Intercepts GraphQL requests to verify correct API calls
4. **Cross-Session Testing**: Verifies data persists across browser sessions

This multi-layered approach ensures that the entire data flow from UI to database is working correctly.