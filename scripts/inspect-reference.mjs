import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// Read-only, bounded metadata inspection; no account/database access or dump.
const root = process.argv[2] || 'C:/Portable Programs/UpTimer-Windows-x64/Official-UpTimer';
const binary = await readFile(path.join(root, 'data/app.so'));
const keys = [
  'activityId',
  'activity',
  'record',
  'goal',
  'plan',
  'tag',
  'hook_type',
  'webhook',
  'CouchbaseLite',
  'SyncGateway',
  '积极',
  '消极',
  '计时',
  '目标',
  '积分',
  '时间轴',
  '流程',
  '商品',
  '经验',
  '导出',
  '备份',
  '以上条记录结尾为开始时间',
  '隐藏顶部空闲时间',
  '填满上方空闲时间',
  '填满下方空闲时间',
  '从上条记录结尾计时',
  '显示间隔小于1分钟的空白时间',
  '向上、向下合并记录',
];
const evidence = keys.map((key) => ({
  token: key,
  utf8: binary.includes(Buffer.from(key)),
  utf16le: binary.includes(Buffer.from(key, 'utf16le')),
}));
const files = await readdir(root);
console.log(
  JSON.stringify(
    {
      method: 'read-only package and exact-token presence; not decompiled source',
      aotBytes: binary.length,
      libraries: files.filter((name) => /flutter|cbl|notification|timezone|auth/i.test(name)),
      evidence,
    },
    null,
    2,
  ),
);
