import { test, expect, _electron as electron, type Page } from '@playwright/test';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const screenshots = path.join(root, 'work', 'screenshots');
const profileRoot =
  process.platform === 'win32'
    ? path.join(os.tmpdir(), '.agents', 'open-timelog')
    : '/tmp/.agents/open-timelog';
const nav = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name, exact: true })
    .click();
const dialog = (page: Page) => page.getByRole('dialog');
async function addRecord(page: Page, note = '阅读物理化学，整理本章笔记') {
  await page.getByRole('button', { name: '补记时间', exact: true }).click();
  await dialog(page).getByLabel('描述', { exact: true }).fill(note);
  await dialog(page).getByLabel('标签', { exact: true }).fill('课程, 物理化学');
  await dialog(page).getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('.record-row')).toHaveCount(1);
}

test('records, goals, points, edits, deletion and backup work end to end', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '让今天，留下痕迹。' })).toBeVisible();
  await addRecord(page);
  await page.reload();
  await expect(page.getByText('阅读物理化学，整理本章笔记')).toBeVisible();
  await nav(page, '目标');
  await page.getByRole('button', { name: '创建目标', exact: true }).first().click();
  await dialog(page).getByLabel('目标名称').fill('每日学习');
  await dialog(page).getByLabel('目标时长（分钟）').fill('30');
  await dialog(page).getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.goal-card')).toContainText('30 / 30 分钟');
  await nav(page, '奖励');
  await page.getByRole('button', { name: '添加奖励', exact: true }).first().click();
  await dialog(page).getByLabel('奖励名称').fill('喝杯咖啡');
  await dialog(page).getByLabel('需要积分').fill('5');
  await dialog(page).getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: '兑换奖励', exact: true }).click();
  await dialog(page).getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('.redemption-panel')).toContainText('喝杯咖啡');
  await expect(page.locator('.balance-panel strong')).toContainText('5');
  await nav(page, '今日');
  await page.getByRole('button', { name: '编辑记录 学习', exact: true }).click();
  await dialog(page).getByLabel('描述', { exact: true }).fill('已完成章节复习');
  await dialog(page).getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('已完成章节复习')).toBeVisible();
  await nav(page, '数据与设置');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON', exact: true }).click();
  const backupFile = await (await downloading).path();
  expect(backupFile).toBeTruthy();
  await page.getByLabel('导入备份文件').setInputFiles(backupFile!);
  await expect(dialog(page)).toContainText('1 条有效记录');
  const safetyBackup = page.waitForEvent('download');
  await dialog(page).getByRole('button', { name: '备份当前数据并合并' }).click();
  await safetyBackup;
  await expect(dialog(page)).toHaveCount(0);
  await nav(page, '今日');
  await expect(page.locator('.record-row')).toHaveCount(1);
  await page.getByRole('button', { name: '删除记录 学习', exact: true }).click();
  await dialog(page).getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('.record-row')).toHaveCount(0);
  await nav(page, '数据与设置');
  await page.getByRole('button', { name: '恢复', exact: true }).click();
  await nav(page, '今日');
  await expect(page.locator('.record-row')).toHaveCount(1);
  await nav(page, '统计');
  await expect(page.locator('.distribution-row')).toContainText('学习');
  expect(errors).toEqual([]);
});

test('timer persists through reload, pause and a second window', async ({ page, context }) => {
  await page.goto('/');
  await page.getByLabel('计时描述').fill('专注阅读');
  await page.getByRole('button', { name: '开始计时', exact: true }).click();
  await expect(page.locator('.badge.live')).toHaveText('计时中');
  await page.reload();
  await expect(page.getByText('专注阅读', { exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.locator('.badge.live')).toHaveText('计时中');
  await other.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(page.locator('.badge.live')).toHaveText('已暂停');
  const clock = await page.getByLabel('计时时长').textContent();
  await page.reload();
  await expect(page.getByLabel('计时时长')).toHaveText(clock!);
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect(other.locator('.badge.live')).toHaveText('计时中');
  // A clock-based wait is part of the behavior under test, not tool polling.
  await expect
    .poll(async () => await page.getByLabel('计时时长').textContent())
    .not.toBe('00:00:00');
  await page.getByRole('button', { name: '进入专注模式' }).click();
  await expect(page.getByRole('dialog', { name: '专注模式' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '专注模式' })).toHaveCount(0);
  await page.getByRole('button', { name: '结束并保存', exact: true }).click();
  await expect(page.locator('.record-row')).toHaveCount(1);
  await expect(other.locator('.badge.live')).toHaveCount(0);
});

test('rejected imports leave existing data untouched', async ({ page }) => {
  await page.goto('/');
  await addRecord(page, '保留这条记录');
  await nav(page, '数据与设置');
  await page.getByLabel('导入备份文件').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"documents":[]}'),
  });
  await expect(page.getByRole('alert')).toContainText('UpTimer');
  await nav(page, '今日');
  await expect(page.getByText('保留这条记录')).toBeVisible();
});

test('responsive screens and offline app shell render without overflow', async ({
  page,
  context,
}) => {
  await mkdir(screenshots, { recursive: true });
  await page.goto('/');
  await addRecord(page);
  await page.screenshot({
    path: path.join(screenshots, 'desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['今日', '时间轴', '统计', '活动', '目标', '奖励', '数据与设置']) {
    await nav(page, name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await nav(page, '今日');
  await page.screenshot({
    path: path.join(screenshots, 'mobile.png'),
    fullPage: true,
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('阅读物理化学，整理本章笔记')).toBeVisible();
  await context.setOffline(false);
});

test('Windows desktop app uses local secure origin and persists a timer across process restarts', async () => {
  test.skip(process.platform !== 'win32', 'Windows desktop acceptance');
  await mkdir(profileRoot, { recursive: true });
  const profile = await mkdtemp(path.join(profileRoot, 'desktop-'));
  const launchOptions = process.env.TIMELOG_PACKAGED_EXE
    ? { executablePath: process.env.TIMELOG_PACKAGED_EXE, args: [`--profile=${profile}`] }
    : { args: [root, `--profile=${profile}`] };
  let app = await electron.launch(launchOptions);
  let page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: '让今天，留下痕迹。' })).toBeVisible();
  expect(new URL(page.url()).protocol).toBe('timelog:');
  expect(
    await page.evaluate(() => typeof (window as unknown as { require?: unknown }).require),
  ).toBe('undefined');
  await page.getByLabel('计时描述').fill('桌面端持久化检查');
  await page.getByRole('button', { name: '开始计时', exact: true }).click();
  await expect(page.locator('.badge.live')).toHaveText('计时中');
  await app.close();
  app = await electron.launch(launchOptions);
  page = await app.firstWindow();
  await expect(page.getByText('桌面端持久化检查', { exact: true })).toBeVisible();
  await expect.poll(() => page.getByLabel('计时时长').textContent()).not.toBe('00:00:00');
  await page.getByRole('button', { name: '结束并保存', exact: true }).click();
  await expect(page.locator('.record-row')).toHaveCount(1);
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({
    path: path.join(screenshots, 'windows.png'),
    fullPage: true,
  });
  await app.close();
});

test('a complete backup restores an active timer into a separate device profile', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page.getByLabel('计时描述').fill('迁移进行中的计时');
  await page.getByRole('button', { name: '开始计时', exact: true }).click();
  await nav(page, '数据与设置');
  const exporting = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON', exact: true }).click();
  const backupPath = await (await exporting).path();
  const receiver = await browser.newContext({
    baseURL: 'http://127.0.0.1:4178',
    acceptDownloads: true,
  });
  try {
    const other = await receiver.newPage();
    await other.goto('/');
    await nav(other, '数据与设置');
    await other.getByLabel('导入备份文件').setInputFiles(backupPath!);
    await expect(dialog(other).getByRole('button', { name: '备份当前数据并合并' })).toBeDisabled();
    await dialog(other).getByLabel('导入方式').selectOption('restore');
    const safetyBackup = other.waitForEvent('download');
    await dialog(other).getByRole('button', { name: '备份当前数据并完整恢复' }).click();
    await safetyBackup;
    await expect(dialog(other)).toHaveCount(0);
    await nav(other, '今日');
    await expect(other.getByText('迁移进行中的计时', { exact: true })).toBeVisible();
    await other.reload();
    await expect(other.locator('.badge.live')).toHaveText('计时中');
  } finally {
    await receiver.close();
  }
});

test('corrupt storage is preserved and exportable rather than silently reset', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '让今天，留下痕迹。' })).toBeVisible();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('open-timelog', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction('state', 'readwrite');
      tx.objectStore('state').put({ marker: 'keep-original-corruption' }, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    database.close();
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '暂时无法读取数据' })).toBeVisible();
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出恢复文件' }).click();
  const file = await (await exported).path();
  expect(JSON.parse(await readFile(file!, 'utf8')).current).toEqual({
    marker: 'keep-original-corruption',
  });
});
