const { app, BrowserWindow, protocol, net, session, ipcMain, nativeTheme } = require('electron');
const { startApi } = require('./api-server.cjs');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

// A stable secure origin keeps IndexedDB independent of installation paths.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'timelog',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
const profileFlag = process.argv.find((arg) => arg.startsWith('--profile='));
if (profileFlag) app.setPath('userData', path.resolve(profileFlag.slice('--profile='.length)));
else if (!app.isPackaged)
  app.setPath('userData', path.join(app.getAppPath(), '.runtime', 'desktop'));
app.setName('Open Timelog');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  let mainWindow;
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(async () => {
    const root = path.join(app.getAppPath(), 'dist');
    protocol.handle('timelog', (request) => {
      const url = new URL(request.url);
      if (url.hostname !== 'app') return new Response('Forbidden', { status: 403 });
      let requested;
      try {
        requested = decodeURIComponent(url.pathname);
      } catch {
        return new Response('Invalid path', { status: 400 });
      }
      const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile())
        return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(file).href);
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    // Application has no remote features; block any unexpected network request.
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
      (_details, callback) => callback({ cancel: true }),
    );
    mainWindow = new BrowserWindow({
      width: 1360,
      height: 920,
      minWidth: 400,
      minHeight: 640,
      title: '时迹 · Open Timelog',
      backgroundColor: '#f5f7f8',
      show: false,
      icon: path.join(root, 'icon-192.png'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        spellcheck: false,
      },
    });
    let ready = false;
    const pending = new Map();
    const trusted = (event) =>
      event.sender === mainWindow.webContents &&
      event.senderFrame === mainWindow.webContents.mainFrame &&
      event.senderFrame.url.startsWith('timelog://app/');
    ipcMain.on('timelog:ready', (event) => {
      if (trusted(event)) ready = true;
    });
    ipcMain.on('timelog:response', (event, message) => {
      if (!trusted(event) || !message || typeof message.id !== 'string') return;
      const callback = pending.get(message.id);
      if (
        callback &&
        Number.isInteger(message.result?.status) &&
        message.result.status >= 200 &&
        message.result.status < 600
      ) {
        pending.delete(message.id);
        callback(message.result);
      }
    });
    const apiPortFlag = process.argv.find((arg) => arg.startsWith('--api-port='));
    let api;
    try {
      api = await startApi({
        userData: app.getPath('userData'),
        preferredPort: apiPortFlag ? Number(apiPortFlag.slice(11)) : 43127,
        dispatch(request) {
          if (!ready || mainWindow.webContents.isDestroyed() || pending.size >= 32)
            return Promise.resolve({ status: 503, body: { error: 'Application is not ready' } });
          const id = require('node:crypto').randomUUID();
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              pending.delete(id);
              resolve({
                status: 503,
                body: { error: 'Request timed out; inspect state before retrying writes' },
              });
            }, 15000);
            pending.set(id, (result) => {
              clearTimeout(timeout);
              resolve(result);
            });
            mainWindow.webContents.send('timelog:request', { ...request, id });
          });
        },
      });
    } catch (error) {
      console.error('Local API unavailable:', error.message);
    }
    ipcMain.handle('timelog:connection', (event) =>
      trusted(event) ? api?.descriptor || null : null,
    );
    ipcMain.on('timelog:theme', (event, preference) => {
      if (trusted(event) && ['system', 'light', 'dark'].includes(preference))
        nativeTheme.themeSource = preference;
    });
    app.on('before-quit', () => api?.close());
    mainWindow.webContents.on('did-start-loading', () => {
      ready = false;
    });
    mainWindow.removeMenu();
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('timelog://app/')) event.preventDefault();
    });
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.loadURL('timelog://app/');
  });
  app.on('window-all-closed', () => app.quit());
}
