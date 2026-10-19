const { app, BrowserWindow, protocol, net, session } = require('electron');
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
  app.whenReady().then(() => {
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
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        spellcheck: false,
      },
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
