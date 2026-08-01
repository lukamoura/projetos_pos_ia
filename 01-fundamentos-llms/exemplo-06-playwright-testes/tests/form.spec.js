import { test, expect } from '@playwright/test'

// The app ships with 3 static cards; each test starts with a fresh
// browser context, so localStorage is empty and the count is stable.
const INITIAL_CARDS = 3

test.beforeEach(async ({ page }) => {
    // baseURL points at the app folder, so '' navigates straight to it.
    await page.goto('')
})

test('submits the form and adds the item to the list', async ({ page }) => {
    const cards = page.locator('#card-list article')
    await expect(cards).toHaveCount(INITIAL_CARDS)

    const title = 'AI Robot'
    const imageUrl = 'https://img.com/ai-robot.png'

    await page.locator('#title').fill(title)
    await page.locator('#imageUrl').fill(imageUrl)
    await page.locator('#btnSubmit').click()

    // The new card is appended, so the list grows by one.
    await expect(cards).toHaveCount(INITIAL_CARDS + 1)

    const lastCard = cards.last()
    await expect(lastCard.locator('.card-title')).toHaveText(title)
    await expect(lastCard.locator('img.card-img')).toHaveAttribute('src', imageUrl)

    // The form resets after a successful submit.
    await expect(page.locator('#title')).toHaveValue('')
    await expect(page.locator('#imageUrl')).toHaveValue('')
})

test('blocks submit and flags the fields when the form is empty', async ({ page }) => {
    await page.locator('#btnSubmit').click()

    // Bootstrap marks the form as validated and surfaces the feedback messages.
    await expect(page.locator('form.needs-validation')).toHaveClass(/was-validated/)
    await expect(page.locator('#titleFeedback')).toBeVisible()

    // Nothing was added to the list.
    await expect(page.locator('#card-list article')).toHaveCount(INITIAL_CARDS)
})

test('rejects an invalid image URL', async ({ page }) => {
    await page.locator('#title').fill('Broken image')
    await page.locator('#imageUrl').fill('not-a-valid-url')
    await page.locator('#btnSubmit').click()

    // type="url" fails HTML5 validation, so the field is invalid...
    await expect(page.locator('#imageUrl')).toHaveJSProperty('validity.valid', false)
    await expect(page.locator('#urlFeedback')).toBeVisible()

    // ...and the list stays untouched.
    await expect(page.locator('#card-list article')).toHaveCount(INITIAL_CARDS)
})
