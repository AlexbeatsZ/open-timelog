import { test, expect, _electron as electron, type Page } from '@playwright/test';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const root = process.cwd(),
  screenshots = path.join(root, 'work', 'screenshots');
const temp =
  process.platform === 'win32'
    ? path.join(os.tmpdir(), '.agents', 'open-timelog')
    : '/tmp/.agents/open-timelog';
const nav = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name, exact: true })
    .click();
const dialog = (page: Page) => page.getByRole('dialog');
const settings = (page: Page) =>
  page.getByRole('button', { name: '设置与数据', exact: true }).filter({ visible: true }).click();
const close = (page: Page) => dialog(page).getByRole('button', { name: '关闭对话框' }).click();
async function add(page: Page, note = '阅读物理化学，整理本章笔记', range?: [string, string]) {
  await page.getByRole('button', { name: '添加记录', exact: true }).click();
  if (range) {
    await dialog(page).getByLabel('开始时间', { exact: true }).fill(range[0]);
    await dialog(page).getByLabel('结束时间', { exact: true }).fill(range[1]);
  }
  await dialog(page).getByLabel('描述', { exact: true }).fill(note);
  await dialog(page).getByLabel('标签', { exact: true }).fill('课程, 物理化学');
  await dialog(page).getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
}
async function begin(page: Page, note: string) {
  await nav(page, '计时');
  await page.locator('.activity-tile').filter({ hasText: '学习' }).click();
  await expect(page.locator('.timer-state')).toHaveText('计时中');
  await page.getByLabel('计时描述').fill(note);
}

test('four panels support records, goals, edits, deletion, restore and backup', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('navigation').getByRole('button')).toHaveCount(4);
  await add(page);
  await page.reload();
  await expect(page.getByText('阅读物理化学，整理本章笔记')).toBeVisible();
  await nav(page, '目标');
  await page.getByRole('button', { name: '添加目标', exact: true }).first().click();
  await dialog(page).getByLabel('目标名称').fill('每日学习');
  await dialog(page).getByLabel('目标时长（分钟）').fill('30');
  await dialog(page).getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.goal-card')).toContainText('已达标');
  await nav(page, '时间线');
  await page.getByLabel('记录操作 学习').click();
  await page.getByRole('button', { name: '编辑记录', exact: true }).click();
  await dialog(page).getByLabel('描述', { exact: true }).fill('已完成章节复习');
  await dialog(page).getByRole('button', { name: '保存', exact: true }).click();
  await settings(page);
  const exporting = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON', exact: true }).click();
  const file = await (await exporting).path();
  await page.getByLabel('导入备份文件').setInputFiles(file!);
  await expect(dialog(page)).toContainText('1 条有效记录');
  const safety = page.waitForEvent('download');
  await page.getByRole('button', { name: '备份当前数据并合并' }).click();
  await safety;
  await expect(page.locator('.import-preview')).toHaveCount(0);
  await close(page);
  await page.getByLabel('记录操作 学习').click();
  await page.getByRole('button', { name: '删除记录', exact: true }).click();
  await dialog(page).getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('.record-card')).toHaveCount(0);
  await settings(page);
  await page.getByRole('button', { name: '恢复', exact: true }).click();
  await close(page);
  await expect(page.locator('.record-card')).toHaveCount(1);
  await nav(page, '分析');
  await expect(page.locator('.activity-stats')).toContainText('学习');
  expect(errors).toEqual([]);
});

test('latest-first timeline fills nearest upper/lower gaps and clicking idle preselects its exact range', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('查看日期').fill('2026-10-15');
  await add(page, '早间记录', ['2026-10-15T10:00', '2026-10-15T11:00']);
  await add(page, '午后记录', ['2026-10-15T14:00', '2026-10-15T15:00']);
  await expect(page.locator('.record-card').first()).toContainText('午后记录');
  await page.getByRole('button', { name: '添加空闲记录 11:00-14:00', exact: true }).click();
  await expect(dialog(page).getByLabel('开始时间', { exact: true })).toHaveValue(
    '2026-10-15T11:00',
  );
  await expect(dialog(page).getByLabel('结束时间', { exact: true })).toHaveValue(
    '2026-10-15T14:00',
  );
  await close(page);
  await page
    .locator('.record-card')
    .first()
    .getByRole('button', { name: '填满上方空闲时间 学习', exact: true })
    .click();
  await dialog(page).getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('.record-card').first()).toContainText('14:00–24:00');
  await page
    .locator('.record-card')
    .first()
    .getByRole('button', { name: '填满下方空闲时间 学习', exact: true })
    .click();
  await dialog(page).getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('.record-card').first()).toContainText('11:00–24:00');
  await expect(
    page.getByRole('button', { name: '添加空闲记录 11:00-14:00', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '添加空闲记录 00:00-10:00', exact: true }).click();
  await dialog(page).getByLabel('描述', { exact: true }).fill('补齐空闲');
  await dialog(page).getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.record-card')).toHaveCount(3);
});

test('timer persists through reload and another window; one stop click saves the current note and returns to timeline', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await begin(page, '专注阅读');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(page.locator('.timer-state')).toHaveText('已暂停');
  await page.reload();
  await nav(page, '计时');
  await expect(page.getByLabel('计时描述')).toHaveValue('专注阅读');
  const other = await context.newPage();
  await other.goto('/');
  await nav(other, '计时');
  await other.getByRole('button', { name: '继续', exact: true }).click();
  await expect(page.locator('.timer-state')).toHaveText('计时中');
  await expect.poll(() => page.getByLabel('计时时长').textContent()).not.toBe('00:00:00');
  await page.getByRole('button', { name: '专注模式', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('计时描述').fill('结束前修改的描述');
  await page.getByRole('button', { name: '结束并保存', exact: true }).click();
  await expect(page.getByRole('heading', { name: '时间线', exact: true })).toBeVisible();
  await expect(page.locator('.record-card').first()).toContainText('结束前修改的描述');
  await expect(other.locator('.timer-state')).toHaveCount(0);
});

test('rejected imports preserve records, responsive panels and offline shell work', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await add(page);
  await settings(page);
  await page.getByLabel('导入备份文件').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"documents":[]}'),
  });
  await expect(page.getByRole('alert')).toContainText('UpTimer');
  await close(page);
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: path.join(screenshots, 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['时间线', '计时', '目标', '分析']) {
    await nav(page, name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await nav(page, '时间线');
  await page.screenshot({ path: path.join(screenshots, 'mobile.png'), fullPage: true });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('阅读物理化学，整理本章笔记')).toBeVisible();
  await context.setOffline(false);
});

test('desktop app persists a timer across process restarts using a secure local origin', async () => {
  test.skip(!['win32', 'darwin'].includes(process.platform), 'Desktop');
  await mkdir(temp, { recursive: true });
  const profile = await mkdtemp(path.join(temp, 'desktop-'));
  const launch = process.env.TIMELOG_PACKAGED_EXE
    ? { executablePath: process.env.TIMELOG_PACKAGED_EXE, args: [`--profile=${profile}`] }
    : { args: [root, `--profile=${profile}`] };
  let app = await electron.launch(launch);
  try {
    let page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '时间线', exact: true })).toBeVisible({
      timeout: 15000,
    });
    expect(new URL(page.url()).protocol).toBe('timelog:');
    expect(await page.evaluate(() => typeof (window as any).require)).toBe('undefined');
    await begin(page, '桌面端持久化检查');
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await app.close();
    app = await electron.launch(launch);
    page = await app.firstWindow();
    await nav(page, '计时');
    await expect(page.getByLabel('计时描述')).toHaveValue('桌面端持久化检查');
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await expect.poll(() => page.getByLabel('计时时长').textContent()).not.toBe('00:00:00');
    await page.getByRole('button', { name: '结束并保存', exact: true }).click();
    await expect(page.locator('.record-card')).toHaveCount(2);
    await mkdir(screenshots, { recursive: true });
    await page.screenshot({
      path: path.join(screenshots, process.platform === 'darwin' ? 'macos.png' : 'windows.png'),
      fullPage: true,
    });
  } finally {
    await app.close();
  }
});

test('complete backup restores an active timer into a separate profile', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await begin(page, '迁移进行中的计时');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await settings(page);
  const exporting = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON', exact: true }).click();
  const file = await (await exporting).path();
  const receiver = await browser.newContext({
    baseURL: 'http://127.0.0.1:4178',
    acceptDownloads: true,
  });
  try {
    const other = await receiver.newPage();
    await other.goto('/');
    await settings(other);
    await other.getByLabel('导入备份文件').setInputFiles(file!);
    await expect(other.getByRole('button', { name: '备份当前数据并合并' })).toBeDisabled();
    await other.getByLabel('导入方式').selectOption('restore');
    const safety = other.waitForEvent('download');
    await other.getByRole('button', { name: '备份当前数据并完整恢复' }).click();
    await safety;
    await expect(other.locator('.import-preview')).toHaveCount(0);
    await close(other);
    await other.reload();
    await nav(other, '计时');
    await expect(other.getByLabel('计时描述')).toHaveValue('迁移进行中的计时');
    await expect(other.locator('.timer-state')).toHaveText('已暂停');
  } finally {
    await receiver.close();
  }
});

test('corrupt storage remains exportable', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '时间线', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('open-timelog', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put({ marker: 'keep-original-corruption' }, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '暂时无法读取数据' })).toBeVisible();
  const exporting = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出恢复文件' }).click();
  const file = await (await exporting).path();
  expect(JSON.parse(await readFile(file!, 'utf8')).current).toEqual({
    marker: 'keep-original-corruption',
  });
});
