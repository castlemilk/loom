import { expect, test } from 'playwright/test'

test('the local server renders MDX and hydrates the graph controls', async ({ page }) => {
  const response = await page.goto('docs/')
  expect(response.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your first graph')
  await expect(page.getByRole('heading', { name: /Install Loom/ })).toBeVisible()
  await page.getByRole('button', { name: 'Orbit', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Orbit', pressed: true })).toBeVisible()

  await page.getByRole('link', { name: 'Layouts and styling', exact: true }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Layouts and styling')
})
