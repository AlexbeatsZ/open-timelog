const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

async function startApi({ userData, dispatch, preferredPort = 43127 }) {
  const tokenPath = path.join(userData, 'api-token');
  await fs.mkdir(userData, { recursive: true });
  let token;
  try {
    token = (await fs.readFile(tokenPath, 'utf8')).trim();
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new Error('Invalid API token file; preserve and repair it manually');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    token = crypto.randomBytes(32).toString('hex');
    await fs.writeFile(tokenPath, token, { mode: 0o600, flag: 'wx' });
  }
  const expected = Buffer.from(`Bearer ${token}`);
  const idempotency = new Map();
  let baseUrl;
  const server = http.createServer(async (req, res) => {
    const respond = (status, body) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.headers.origin || req.headers.host !== new URL(baseUrl).host)
        return respond(403, { error: 'Browser origins and non-loopback hosts are not allowed' });
      const auth = Buffer.from(req.headers.authorization || '');
      if (auth.length !== expected.length || !crypto.timingSafeEqual(auth, expected))
        return respond(401, { error: 'Bearer token required' });
      if (!req.url?.startsWith('/v1/')) return respond(404, { error: 'Route not found' });
      if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method))
        return respond(405, { error: 'Method not allowed' });
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 1024 * 1024) return respond(413, { error: 'Request body exceeds 1 MiB' });
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (req.method !== 'GET' && !req.headers['content-type']?.startsWith('application/json'))
        return respond(415, { error: 'Use application/json' });
      let body;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        return respond(400, { error: 'Invalid JSON' });
      }
      const key = req.headers['idempotency-key'];
      if (key && (typeof key !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(key)))
        return respond(400, { error: 'Invalid Idempotency-Key' });
      const fingerprint = crypto
        .createHash('sha256')
        .update(`${req.method}\n${req.url}\n${raw}`)
        .digest('hex');
      let result;
      if (key && req.method !== 'GET') {
        const cached = idempotency.get(key);
        if (cached && cached.fingerprint !== fingerprint)
          return respond(409, { error: 'Idempotency-Key already used for another request' });
        if (cached) result = await cached.promise;
        else {
          if (idempotency.size >= 256) idempotency.delete(idempotency.keys().next().value);
          const promise = dispatch({ method: req.method, path: req.url, body });
          idempotency.set(key, { fingerprint, promise });
          result = await promise;
        }
      } else result = await dispatch({ method: req.method, path: req.url, body });
      respond(result.status, result.body);
    } catch (error) {
      if (!res.headersSent)
        respond(503, {
          error: 'Application unavailable; inspect current state before retrying a write',
        });
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => {
    const listen = (port) => server.listen(port, '127.0.0.1', resolve);
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        server.once('error', reject);
        listen(0);
      } else reject(error);
    });
    listen(preferredPort);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const discoveryPath = path.join(userData, 'api.json');
  const descriptor = { url: baseUrl, token, pid: process.pid, discoveryPath };
  await fs.writeFile(discoveryPath + '.tmp', JSON.stringify(descriptor, null, 2), { mode: 0o600 });
  await fs.rename(discoveryPath + '.tmp', discoveryPath);
  return {
    descriptor,
    close() {
      server.close();
    },
  };
}
module.exports = { startApi };
