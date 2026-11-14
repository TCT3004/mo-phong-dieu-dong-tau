const { app, BrowserWindow, Menu } = require('electron');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const w = new BrowserWindow({ width: 1500, height: 950, backgroundColor: '#0B1116', title: 'Mô phỏng điều động tàu', webPreferences: { contextIsolation: true, backgroundThrottling: false } });
  w.maximize();
  w.loadFile('index.html');
  w.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && i.key === 'F11') w.setFullScreen(!w.isFullScreen()); });
});
app.on('window-all-closed', () => app.quit());
