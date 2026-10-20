import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const root = process.cwd();
const temp =
  process.platform === 'win32'
    ? path.join(os.tmpdir(), '.agents', 'open-timelog')
    : '/tmp/.agents/open-timelog';

test('theme follows the system, preserves manual preference, and renders every dark page', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: '切换到暗色模式' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const background = await page
    .locator('body')
    .evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(background).toBe('rgb(19, 30, 35)');
  for (const name of ['时间线', '计时', '目标', '分析']) {
    await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page
    .getByRole('button', { name: '设置与数据', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByLabel('颜色模式').selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('颜色模式').selectOption('dark');
  await page.getByRole('button', { name: '关闭对话框' }).click();
  await page.getByRole('navigation').getByRole('button', { name: '时间线', exact: true }).click();
  await page.getByRole('button', { name: '添加记录', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
    'rgb(255, 255, 255)',
  );
  await page.keyboard.press('Escape');
  await mkdir('work/screenshots', { recursive: true });
  await page.screenshot({ path: 'work/screenshots/dark-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'work/screenshots/dark-mobile.png', fullPage: true });
});

test('authenticated desktop API writes through to UI, detects conflicts and deduplicates writes', async () => {
  test.skip(!['win32', 'darwin'].includes(process.platform), 'Desktop API');
  await mkdir(temp, { recursive: true });
  const profile = await mkdtemp(path.join(temp, 'api-'));
  const app = await electron.launch(
    process.env.TIMELOG_PACKAGED_EXE
      ? {
          executablePath: process.env.TIMELOG_PACKAGED_EXE,
          args: [`--profile=${profile}`, '--api-port=0'],
        }
      : { args: [root, `--profile=${profile}`, '--api-port=0'] },
  );
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '时间线', exact: true })).toBeVisible({
      timeout: 15000,
    });
    const connection = await page.evaluate(() => window.timelogDesktop!.connection());
    expect(connection).toBeTruthy();
    const request = async (method: string, route: string, body?: unknown, key?: string) => {
      const response = await fetch(connection!.url + route, {
        method,
        headers: {
          Authorization: `Bearer ${connection!.token}`,
          ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
          ...(key ? { 'Idempotency-Key': key } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, value: (await response.json()) as any };
    };
    expect((await fetch(connection!.url + '/v1/activities')).status).toBe(401);
    expect(
      (
        await fetch(connection!.url + '/v1/activities', {
          headers: { Authorization: `Bearer ${connection!.token}`, Origin: 'https://example.com' },
        })
      ).status,
    ).toBe(403);
    expect((await request('GET', '/v1/openapi')).value.openapi).toBe('3.0.3');
    const activity = await request('POST', '/v1/activities', {
      name: 'API 学习',
      nature: 'positive',
      pointsPerHour: 20,
    });
    expect(activity.status).toBe(201);
    const now = Date.now();
    const body = {
      activityId: activity.value.id,
      note: 'API 补记验证',
      tags: ['automation'],
      spans: [{ start: now - 3600000, end: now - 1800000 }],
    };
    const created = await request('POST', '/v1/records', body, 'record-1');
    expect(created.status).toBe(201);
    const again = await request('POST', '/v1/records', body, 'record-1');
    expect(again.value.id).toBe(created.value.id);
    expect(
      (await request('POST', '/v1/records', { ...body, note: 'different' }, 'record-1')).status,
    ).toBe(409);
    await expect(page.getByText('API 补记验证', { exact: true })).toBeVisible();
    expect(
      (await request('PATCH', `/v1/records/${created.value.id}`, { note: 'bad edit' })).status,
    ).toBe(428);
    const edited = await request('PATCH', `/v1/records/${created.value.id}`, {
      expectedUpdatedAt: created.value.updatedAt,
      note: 'AI 已更新',
    });
    expect(edited.status).toBe(200);
    await expect(page.getByText('AI 已更新', { exact: true })).toBeVisible();
    const timeline = await request('GET', '/v1/timeline');
    expect(timeline.value.items.some((row: any) => row.kind === 'gap')).toBe(true);
    const filled = await request('POST', `/v1/records/${created.value.id}/fill`, {
      date: await page.getByLabel('查看日期').inputValue(),
      spanIndex: 0,
      direction: 'up',
      expectedUpdatedAt: edited.value.updatedAt,
    });
    expect(filled.status).toBe(200);
    expect(filled.value.spans[0].end).toBeGreaterThan(body.spans[0].end);
    expect((await request('GET', '/v1/rewards')).status).toBe(404);
    expect(
      (
        await request('PATCH', `/v1/records/${created.value.id}`, {
          expectedUpdatedAt: created.value.updatedAt,
          note: 'stale',
        })
      ).status,
    ).toBe(409);
    const started = await request('POST', '/v1/timer/start', {
      activityId: activity.value.id,
      note: 'AI 计时验证',
    });
    expect(started.status).toBe(200);
    await expect(page.locator('.active-timer-strip')).toContainText('计时中');
    expect((await request('POST', '/v1/timer/pause', { timerId: 'wrong' })).status).toBe(409);
    expect((await request('POST', '/v1/timer/pause', { timerId: started.value.id })).status).toBe(
      200,
    );
    await expect(page.locator('.active-timer-strip')).toContainText('已暂停');
    await request('POST', '/v1/timer/cancel', { timerId: started.value.id });
    expect((await request('GET', '/v1/backup')).value.data.records).toHaveLength(1);
    await request('DELETE', `/v1/records/${created.value.id}`, {
      expectedUpdatedAt: filled.value.updatedAt,
    });
    await expect(page.locator('.record-card')).toHaveCount(0);
    const after = await request('GET', `/v1/records/${created.value.id}`);
    const restored = await request('PATCH', `/v1/records/${created.value.id}`, {
      expectedUpdatedAt: after.value.updatedAt,
      restore: true,
    });
    expect(restored.status).toBe(200);
    await expect(page.locator('.record-card')).toHaveCount(1);
  } finally {
    await app.close();
  }
});
