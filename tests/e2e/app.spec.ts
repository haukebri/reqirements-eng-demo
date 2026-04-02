import { test, expect } from '@playwright/test';

const MOCK_SESSION = {
  id: 'test-session-id',
  name: 'Test Session',
  createdAt: new Date().toISOString(),
};

test.beforeEach(async ({ page }) => {
  // Mock session creation so tests don't require a live backend
  await page.route('http://localhost:3001/api/sessions', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION),
      });
    } else {
      route.continue();
    }
  });
});

// P0: App loads with welcome message and empty tree
test('app loads with welcome message and empty tree', async ({ page }) => {
  await page.goto('/');

  // Welcome message is visible in chat
  await expect(page.locator('.message--ai .message__bubble').first()).toContainText(
    "Hi! I'm here to help you define your requirements"
  );

  // Tree panel shows empty state
  await expect(page.locator('#treeEmpty')).toBeVisible();
  await expect(page.locator('#treeEmpty')).toContainText('No features captured yet');

  // Input bar is rendered and focusable
  await expect(page.locator('#chatInput')).toBeVisible();
  await expect(page.locator('#sendBtn')).toBeVisible();
});

// P0: Send a message -> SSE response appears in chat
test('sends a message and shows streaming AI response', async ({ page }) => {
  // Mock chat SSE endpoint to return a simple message chunk
  await page.route('http://localhost:3001/api/sessions/*/chat', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'event: message_chunk\ndata: {"text":"Hello! I can help with that."}\n\n',
        'event: done\ndata: {}\n\n',
      ].join(''),
    });
  });

  await page.goto('/');
  // Wait for session init mock to resolve
  await page.waitForTimeout(300);

  // Type and send a message
  await page.fill('#chatInput', 'I need a user authentication system');
  await page.click('#sendBtn');

  // User message appears in chat
  await expect(page.locator('.message--user .message__bubble')).toContainText(
    'I need a user authentication system'
  );

  // AI response appears (last AI bubble contains streamed text)
  await expect(page.locator('.message--ai .message__bubble').last()).toContainText(
    'Hello! I can help with that.',
    { timeout: 10000 }
  );
});

// P0: Feature tree populates after AI response with tree_mutation event
test('feature tree populates after AI response', async ({ page }) => {
  // Mock chat SSE with a tree_mutation create event
  await page.route('http://localhost:3001/api/sessions/*/chat', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'event: message_chunk\ndata: {"text":"I\'ll track user authentication for you."}\n\n',
        'event: tree_mutation\ndata: {"action":"create","node":{"id":"node-1","name":"User Authentication","score":70}}\n\n',
        'event: done\ndata: {}\n\n',
      ].join(''),
    });
  });

  await page.goto('/');
  await page.waitForTimeout(300);

  await page.fill('#chatInput', 'We need users to log in securely');
  await page.click('#sendBtn');

  // Empty state should be hidden once a node is created
  await expect(page.locator('#treeEmpty')).toBeHidden({ timeout: 10000 });

  // Tree node with the correct name should appear
  await expect(page.locator('.tree-node__name')).toContainText('User Authentication', {
    timeout: 10000,
  });
});
