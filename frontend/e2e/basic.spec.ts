import { test, expect } from '@playwright/test';

test.describe('CoreTask — Smoke Tests', () => {
    test('login page loads and renders the login form', async ({ page }) => {
        await page.goto('/login');

        // Verify the page has loaded by checking for a visible heading or form element
        await expect(page).toHaveTitle(/CoreTask|Login/i);

        // Check that an email input field exists
        const emailInput = page.getByPlaceholder(/email/i);
        await expect(emailInput).toBeVisible();

        // Check that a password input field exists
        const passwordInput = page.getByPlaceholder(/password/i);
        await expect(passwordInput).toBeVisible();

        // Check that a submit / login button exists
        const loginButton = page.getByRole('button', { name: /log\s*in|sign\s*in|submit/i });
        await expect(loginButton).toBeVisible();
    });

    test('unauthenticated user is redirected to login', async ({ page }) => {
        // Visiting root without auth should redirect to /login
        await page.goto('/');

        // Should end up on the login page
        await expect(page).toHaveURL(/login/);
    });

    test('register page loads correctly', async ({ page }) => {
        await page.goto('/register');

        const emailInput = page.getByPlaceholder(/email/i);
        await expect(emailInput).toBeVisible();

        const passwordInput = page.getByPlaceholder(/password/i);
        await expect(passwordInput).toBeVisible();

        const registerButton = page.getByRole('button', { name: /register|sign\s*up|create/i });
        await expect(registerButton).toBeVisible();
    });
});
