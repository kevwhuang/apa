import { expect, test } from '@playwright/test';

test.describe('index page', () => {
    test('loads with the alliance title', async ({ page }) => {
        await page.goto('/');

        await expect(page).toHaveTitle('Austin Producer Alliance');
    });
});
