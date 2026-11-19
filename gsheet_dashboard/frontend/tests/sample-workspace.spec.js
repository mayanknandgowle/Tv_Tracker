import {readFile} from 'node:fs/promises';
import {expect, test} from '@playwright/test';

test('sample filters, drill-down and CSV stay entirely in the browser', async ({page}) => {
  const apiCalls = [];
  const errors = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/demo.html');
  const queue = page.getByRole('region', {name: 'Order queue'});
  await expect(queue.getByRole('status')).toHaveText('77 orders');
  await queue.getByRole('button', {name: 'Next page'}).click();
  await expect(queue.getByText('Page 2 of 13')).toBeVisible();

  await page.getByRole('button', {name: '14 days'}).click();
  await expect(queue.getByRole('status')).toHaveText('123 orders');
  await page.getByRole('button', {name: 'Nov 14: 10 received, 4 delivered'}).click();
  await page.getByRole('button', {name: 'Needs review 15'}).first().click();
  await expect(queue.getByRole('status')).toHaveText('2 orders · Nov 14 · Needs review');
  await queue.getByRole('searchbox').fill('TV-4428');
  await expect(queue.getByRole('status')).toHaveText('1 order · Nov 14 · Needs review');
  const order = queue.getByRole('button', {name: 'TV-4428'});
  await order.click();
  await expect(page.getByRole('dialog', {name: 'TV-4428'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(order).toBeFocused();

  const downloading = page.waitForEvent('download');
  await queue.getByRole('button', {name: 'Export CSV'}).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('tv-tracker-sample-orders.csv');
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv.split('\r\n')).toHaveLength(2);
  expect(csv).toContain('"TV-4428","Current Owner"');

  await queue.getByRole('searchbox').fill('nonexistent');
  await expect(queue.getByText('No orders match your filters.')).toBeVisible();
  await expect(queue.getByRole('button', {name: 'Export CSV'})).toBeDisabled();
  await queue.getByRole('button', {name: 'Clear filters'}).click();
  await expect(queue.getByRole('status')).toHaveText('123 orders');
  expect(apiCalls).toEqual([]);
  expect(errors).toEqual([]);
});

test('mobile layout keeps page width and allows chart filtering', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/demo.html');
  await page.getByRole('button', {name: '14 days'}).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button', {name: 'Nov 14: 10 received, 4 delivered'}).click();
  await expect(page.getByRole('status')).toHaveText('10 orders · Nov 14');
});
