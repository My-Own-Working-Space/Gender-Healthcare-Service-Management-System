import { test, expect } from '@playwright/test';

// PRODUCTION TEST SUITE
const BASE_URL = 'http://localhost:4200';

test.describe('Gender Healthcare - Production E2E Suite', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to homepage before each test
    await page.goto(BASE_URL);
  });

  async function clickNavLink(page: any, linkSelector: string) {
    const hamburger = page.locator('.hamburger').first();
    if (await hamburger.isVisible()) {
      await hamburger.click();
      // Wait for menu animation
      await page.waitForTimeout(500);
    }
    await page.locator(linkSelector).click();
  }

  test('Homepage loads correctly', async ({ page }) => {
    // Check title (exactly matches the received string)
    await expect(page).toHaveTitle(/GenderHealthcare/i);

    // Verify Logo is visible
    const logo = page.locator('img[alt="logo"]').first();
    await expect(logo).toBeVisible();
  });

  test('Navigation - Doctors Page', async ({ page }) => {
    await clickNavLink(page, 'nav a[routerlink="/doctor"]');
    await expect(page).toHaveURL(/.*doctor/);

    // Wait for loading to finish (skeleton disappearing)
    await page.waitForSelector('.animate-pulse', { state: 'hidden', timeout: 15000 });

    const doctorCards = page.locator('a[routerlink*="/doctor/"]');
    const emptyMsg = page.locator('text=Không tìm thấy bác sĩ nào');

    if (await doctorCards.count() > 0) {
      await expect(doctorCards.first()).toBeVisible();
    } else {
      await expect(emptyMsg.first()).toBeVisible();
    }
  });

  test('Navigation - Services Page', async ({ page }) => {
    await clickNavLink(page, 'nav a[routerlink="/service"]');
    await expect(page).toHaveURL(/.*service/);

    await page.waitForSelector('.animate-pulse', { state: 'hidden', timeout: 15000 });

    const serviceCards = page.locator('a[routerlink*="/service/"]');
    const emptyMsg = page.locator('text=Không tìm thấy dịch vụ nào.');

    if (await serviceCards.count() > 0) {
      await expect(serviceCards.first()).toBeVisible();
    } else {
      // Allow for variation in empty state messages
      const emptyMsgGeneral = page.locator('text=Không tìm thấy').first();
      await expect(emptyMsgGeneral).toBeVisible({ timeout: 10000 });
    }
  });

  test('Navigation - Blog Page', async ({ page }) => {
    await clickNavLink(page, 'nav a[routerlink="/blog"]');
    await expect(page).toHaveURL(/.*blog/);
  });

  test('Authentication Flow - Login & Register UI', async ({ page }) => {
    // Login UI check
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('input#phone')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Register UI check
    await page.goto(`${BASE_URL}/register`);
    await expect(page.locator('input').nth(2)).toBeVisible();
  });

  test('AI Chatbot - Real-time Interaction', async ({ page }) => {
    const fab = page.locator('.tgdd-fab');
    await expect(fab).toBeVisible();
    await fab.click();

    // Check if panel opened
    const chatPanel = page.locator('.tgdd-chat-panel');
    await expect(chatPanel).toHaveClass(/active/);

    // Send a message in Vietnamese
    const input = page.locator('.message-input');
    await input.fill('Tui muốn tìm hiểu về dịch vụ nội tiết');
    await page.keyboard.press('Enter');

    // Typing indicator should appear
    await expect(page.locator('.typing-indicator')).toBeVisible();

    // WAIT for actual Bot response from Edge Function
    // Set a generous timeout for the AI response
    const botResponse = page.locator('.message-bot').last();
    await expect(botResponse).toBeVisible({ timeout: 30000 });

    const botText = await page.locator('.message-bot .message-text').last().innerText();
    console.log('Bot Response:', botText);
    expect(botText.length).toBeGreaterThan(5);
  });

  test('Responsive Check - Mobile Navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL);

    const hamburger = page.locator('.hamburger').first();
    await expect(hamburger).toBeVisible();

    // Open menu
    await hamburger.click();
    const slideMenu = page.locator('nav div.fixed');
    await expect(slideMenu).toHaveClass(/translate-x-0/);

    // Ensure mobile brand logo is visible
    await expect(page.locator('img[src*="LogoPhone"]')).toBeVisible();
  });

  test('Period Tracking - Flo Dashboard Verification', async ({ page }) => {
    // Navigate to period tracking
    await page.goto(`${BASE_URL}/period-tracking`);

    // 1. Verify "Flo" branding elements (based on my new UI)
    await expect(page.locator('text=Flo')).toBeVisible();
    await expect(page.locator('text=Track Cycle')).toBeVisible();

    // 2. Verify the 3-column app structure indirectly
    const sidebar = page.locator('aside.flo-sidebar');
    if (await sidebar.isVisible()) {
      await expect(page.locator('text=Home')).toBeVisible();
    }

    // 3. Verify the main status circle
    const countdownTitle = page.locator('text=Upcoming Events');
    await expect(countdownTitle).toBeVisible();

    const statusCircle = page.locator('.period-circle');
    await expect(statusCircle).toBeVisible();

    // 4. Test "Log Period" button and modal
    const logButton = page.locator('button:has-text("Log Period")');
    await logButton.click();

    // Modal should appear
    const modalTitle = page.locator('text=Log Cycle');
    await expect(modalTitle).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modalTitle).not.toBeVisible();
  });
});
