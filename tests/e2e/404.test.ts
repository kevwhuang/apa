import { expect, test } from '@playwright/test';

test.describe('404 page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/this-page-does-not-exist');
    });

    test('returns 404 status', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('404');
        expect(page.url()).toContain('/this-page-does-not-exist');
    });

    test('displays 404 heading', async ({ page }) => {
        const h1 = page.locator('h1');
        await expect(h1).toContainText('404');
    });
});
