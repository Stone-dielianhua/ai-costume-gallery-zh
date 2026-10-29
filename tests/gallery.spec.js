const { test, expect } = require('@playwright/test');

// Interactions use deterministic local image responses. A separate asset test
// checks actual bundled files while all tests load the real 1,407-item dataset.
test.beforeEach(async ({ page }) => {
  await page.route(/\/(thumbs|img|png)\/[^/]+\.(webp|png)$/, route => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64');
    return route.fulfill({ body: png, contentType: 'image/png' });
  });
  await page.goto('/');
  await expect(page.locator('#resultCount')).toHaveText('1,407 套服装');
});

test('loads all categories and appends the next page without duplicates', async ({ page }) => {
  await expect(page.locator('[data-category]')).toHaveCount(9);
  await expect(page.locator('.costume-card[data-index]')).toHaveCount(60);
  await page.locator('#loadMore').click();
  await expect(page.locator('.costume-card[data-index]')).toHaveCount(120);
  const labels = await page.locator('.pose-no').allTextContents();
  expect(new Set(labels).size).toBe(120);
});

test('category, garment, color and bilingual search combine and survive a reload', async ({ page }, testInfo) => {
  await page.locator('[data-category="春季"]').click();
  await expect(page.locator('#resultCount')).toHaveText('215 套服装');
  if (testInfo.project.name === 'mobile') await page.locator('#filterToggle').click();
  await page.locator('#typeSelect').selectOption('skirt');
  await page.locator('#colorSelect').selectOption('white');
  await page.locator('#searchInput').fill('denim');
  await expect(page).toHaveURL(/q=denim/);
  const total = await page.locator('#resultCount').textContent();
  expect(total).not.toBe('0 套服装');
  for (const label of await page.locator('.main-image').evaluateAll(images => images.map(image => image.alt))) {
    expect(label).toContain('牛仔');
    expect(label).toContain('半身裙');
    expect(label).toMatch(/白色|象牙白|奶油色/);
  }
  await page.reload();
  await expect(page.locator('#resultCount')).toHaveText(total);
  await expect(page.locator('[data-category="春季"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#searchInput').fill('牛仔');
  await expect(page).toHaveURL(/q=/);
  await expect(page.locator('#resultCount')).toHaveText(total);
});

test('unknown searches show a recoverable empty state and pending text clears correctly', async ({ page }) => {
  await page.locator('#searchInput').fill('不存在的衣服zzzz');
  await expect(page.locator('#resultCount')).toHaveText('0 套服装');
  await page.locator('[data-reset]').click();
  await expect(page.locator('#resultCount')).toHaveText('1,407 套服装');
  await page.locator('#searchInput').fill('denim');
  await page.locator('#searchClear').click();
  await expect(page.locator('#searchInput')).toHaveValue('');
  await expect(page.locator('#resultCount')).toHaveText('1,407 套服装');
});

test('English garment words do not match inside accessory words, and IDs ignore case', async ({ page }) => {
  await page.locator('#searchInput').fill('lace');
  await expect(page.locator('#resultCount')).toHaveText('346 套服装');
  for (const label of await page.locator('.main-image').evaluateAll(images => images.map(image => image.alt))) {
    expect(label).toContain('蕾丝');
  }
  await page.locator('#searchInput').fill('spr-0001');
  await expect(page.locator('#resultCount')).toHaveText('1 套服装');
  await expect(page.locator('.pose-no')).toHaveText('SPR-0001');
});

test('viewer navigation, keyword search, and PNG filename work', async ({ page }) => {
  await page.locator('[data-index="0"]').click();
  await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#viewerId')).toHaveText('SPR-0001');
  await expect(page.locator('#previousImage')).toBeDisabled();
  await page.locator('#nextImage').click();
  await expect(page.locator('#viewerId')).toHaveText('SPR-0002');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#viewerId')).toHaveText('SPR-0001');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#downloadImage').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('SPR-0001.png');
  await expect(page.locator('#toast')).toContainText('已开始下载');
  await page.keyboard.press('Escape');
  await expect(page.locator('#viewer')).not.toBeVisible();
  await expect(page.locator('[data-index="0"]')).toBeFocused();
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-keyword="牛仔"]').click();
  await expect(page.locator('#viewer')).not.toBeVisible();
  await expect(page.locator('#searchInput')).toHaveValue('牛仔');
  await expect(page.locator('#resultCount')).toHaveText('175 套服装');
});

test('layout remains inside the viewport and help dialogs restore focus', async ({ page }, testInfo) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const help = page.locator('[data-info="guide"]');
  await help.click();
  await expect(page.locator('#infoDialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(help).toBeFocused();
  if (testInfo.project.name === 'mobile') {
    await page.locator('#filterToggle').click();
    await expect(page.locator('#filterPanel')).toBeVisible();
  }
  await page.locator('[data-view="compact"]').click();
  await expect(page.locator('#grid')).toHaveClass(/compact/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('failed data fetch can be retried', async ({ page }) => {
  await page.route('**/data/costume-zh.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.reload();
  await expect(page.locator('#resultCount')).toHaveText('图库加载失败');
  await page.unroute('**/data/costume-zh.json');
  await page.locator('[data-retry]').click();
  await expect(page.locator('#resultCount')).toHaveText('1,407 套服装');
});
