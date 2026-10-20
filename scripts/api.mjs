import { readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const args = process.argv.slice(2);
function option(name) {
  const at = args.indexOf(name);
  return at < 0 ? undefined : args[at + 1];
}
const method = (args[0] || 'GET').toUpperCase(),
  route = args[1] || '/v1/health';
if (
  !['GET', 'POST', 'PATCH', 'DELETE'].includes(method) ||
  !route.startsWith('/v1/') ||
  route.startsWith('//')
)
  throw new Error(
    'Usage: node scripts/api.mjs GET /v1/activities [--connection api.json] [--data-file request.json] [--idempotency-key key]',
  );
const configRoot =
  process.platform === 'win32'
    ? process.env.APPDATA
    : process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
const candidates = [
  option('--connection'),
  process.env.TIMELOG_API_CONNECTION,
  path.join(process.cwd(), '.runtime', 'desktop', 'api.json'),
  ...['Open Timelog', 'open-timelog'].map((name) => path.join(configRoot, name, 'api.json')),
].filter(Boolean);
let connection;
for (const file of candidates) {
  try {
    connection = JSON.parse(await readFile(file, 'utf8'));
    break;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
if (!connection || typeof connection.token !== 'string' || typeof connection.url !== 'string')
  throw new Error(
    'Open the desktop app, then use its api.json path from Settings → AI and local API with --connection.',
  );
const target = new URL(connection.url);
if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1')
  throw new Error('Connection file must identify a loopback HTTP service.');
const dataFile = option('--data-file');
const raw = dataFile
  ? await readFile(dataFile, 'utf8')
  : method === 'GET'
    ? undefined
    : await new Promise((resolve, reject) => {
        let text = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (part) => {
          text += part;
          if (text.length > 1024 * 1024) reject(new Error('Body exceeds 1 MiB'));
        });
        process.stdin.on('end', () => resolve(text.trim() || '{}'));
        process.stdin.on('error', reject);
      });
if (raw) JSON.parse(raw);
const headers = { Authorization: `Bearer ${connection.token}` };
if (method !== 'GET') headers['Content-Type'] = 'application/json';
if (option('--idempotency-key')) headers['Idempotency-Key'] = option('--idempotency-key');
try {
  const response = await fetch(new URL(route, target), {
    method,
    headers,
    body: raw,
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  console.error(
    'Cannot reach the local API. Open the desktop app and inspect state before retrying a write.',
  );
  process.exitCode = 1;
}
