const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 400, height: 400 });
  win.on('moved', () => console.log('moved'));
  win.on('move', () => console.log('move'));
});
