import { test, expect } from '@playwright/test';

test.describe('AI Chat Supportbot', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4200');
  });

  test('should open chat panel when clicking FAB', async ({ page }) => {
    const fab = page.locator('.tgdd-fab');
    await fab.click();
    
    const panel = page.locator('.tgdd-chat-panel');
    await expect(panel).toHaveClass(/active/);
  });

  test('should show welcome message', async ({ page }) => {
    await page.locator('.tgdd-fab').click();
    
    // Wait for the welcome message from the bot
    const firstBotMessage = page.locator('.message-bot .message-text').first();
    await expect(firstBotMessage).toBeVisible();
    const text = await firstBotMessage.innerText();
    expect(text.length).toBeGreaterThan(0);
  });

  test('should send a message and show typing indicator', async ({ page }) => {
    await page.locator('.tgdd-fab').click();
    
    const input = page.locator('.message-input');
    await input.fill('Hi, I have a question about your healthcare services.');
    await page.keyboard.press('Enter');
    
    // Check if user message appears
    const userMessage = page.locator('.message-user .message-text').last();
    await expect(userMessage).toContainText('healthcare services');
    
    // Check if typing indicator appears
    const typing = page.locator('.typing-indicator');
    await expect(typing).toBeVisible();
  });
});
