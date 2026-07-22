import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright-only setup for the vanilla-js-web-app-example.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './tests',

    // Keep every test snappy: at most 5 seconds per test and per assertion/action.
    timeout: 5_000,
    expect: { timeout: 5_000 },

    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: 'html',

    use: {
        baseURL: 'https://erickwendel.github.io/vanilla-js-web-app-example/',
        actionTimeout: 5_000,
        navigationTimeout: 5_000,
        trace: 'on-first-retry',
    },

    // Chromium only — smaller and faster, matches the CI job.
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
})
