const { test, expect } = require('@playwright/test');
const { readFile } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const manifest = require('../data/assets-manifest.json');

test('bundled images and PNG download work with every external request blocked', async ({ page }) => {
  const external = [];
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:5173') {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto('/');
  await expect(page.locator('#resultCount')).toHaveText('1,407 套服装');
  const thumbnail = page.locator('.main-image').first();
  await expect.poll(() => thumbnail.evaluate(image => image.complete && image.naturalWidth)).toBe(360);
  await expect(thumbnail).toHaveAttribute('src', 'http://127.0.0.1:5173/thumbs/SPR-0001.webp');
  await page.locator('[data-index="0"]').click();
  const original = manifest.files['img/SPR-0001.webp'];
  await expect.poll(() => page.locator('#viewerImage').evaluate(image => image.naturalWidth)).toBe(original.width);
  await expect(page.locator('#viewerImage')).toHaveAttribute('src', 'http://127.0.0.1:5173/img/SPR-0001.webp');
  const downloading = page.waitForEvent('download');
  await page.locator('#downloadImage').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('SPR-0001.png');
  const content = await readFile(await download.path());
  const png = manifest.files['png/SPR-0001.png'];
  expect(content.length).toBe(png.bytes);
  expect(createHash('sha256').update(content).digest('hex')).toBe(png.sha256);
  expect(external).toEqual([]);
});
