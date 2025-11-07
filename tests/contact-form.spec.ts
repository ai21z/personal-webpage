import { test, expect } from '@playwright/test';

const turnstileStubScript = `
  window.turnstile = {
    render: function (container, options) {
      var widgetId = 'stub-widget';
      setTimeout(function () {
        if (options && typeof options.callback === 'function') {
          options.callback('test-turnstile-token');
        }
      }, 10);
      return widgetId;
    },
    reset: function () {},
    remove: function () {}
  };
  if (typeof window.__turnstileOnLoad === 'function') {
    window.__turnstileOnLoad();
  } else {
    document.dispatchEvent(new CustomEvent('turnstile-loaded'));
  }
`;

test.describe('Contact form', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://challenges.cloudflare.com/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: turnstileStubScript
      });
    });
  });

  test('submits successfully when fields are valid', async ({ page }) => {
    await page.route('**/api/contact', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.goto('/index.html#contact');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => {
      const contact = document.getElementById('contact');
      return !!contact && contact.classList.contains('active-section');
    });
    await page.waitForSelector('#contact-form');

    await page.getByLabel('Your Name').fill('Test Visitor');
    await page.getByLabel('Your Email').fill('visitor@example.com');
    await page.getByLabel('Subject').fill('Testing contact channel');
    await page.getByLabel('Message').fill('This is a test of the secure contact flow.');

    await expect(page.getByRole('button', { name: /send message/i })).toBeEnabled();

    await page.getByRole('button', { name: /send message/i }).click();

    await expect(page.locator('[data-status]')).toHaveText(/message sent/i);
  });

  test('shows backend error feedback when API responds with failure', async ({ page }) => {
    await page.route('**/api/contact', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Contact service misconfigured.' })
      });
    });

    await page.goto('/index.html#contact');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => {
      const contact = document.getElementById('contact');
      return !!contact && contact.classList.contains('active-section');
    });
    await page.waitForSelector('#contact-form');

    await page.getByLabel('Your Name').fill('Failing Visitor');
    await page.getByLabel('Your Email').fill('fail@example.com');
    await page.getByLabel('Subject').fill('Expecting failure');
    await page.getByLabel('Message').fill('Please simulate a backend failure so we can assert UI behaviour.');

    await page.getByRole('button', { name: /send message/i }).click();

    await expect(page.locator('[data-status]')).toHaveText(/misconfigured/i);
  });
});
