import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron'
import { join } from 'path'

let tray: Tray | null = null

/**
 * Creates a system tray icon with context menu.
 * On macOS it sits in the menu bar; on Windows in the system tray.
 */
export function createTray(win: BrowserWindow): void {
  // Use a small 16x16 icon for the tray
  // In production this would be a proper .png asset
  const iconPath = join(__dirname, '../../assets/sprites/idle.png')

  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
    // Resize for tray (16x16 on macOS, 32x32 on Windows)
    icon = icon.resize({ width: 16, height: 16 })
  } catch {
    // If no icon file exists yet, create an empty icon
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('Ash — Your Desktop Companion')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Ash',
      click: () => {
        win.show()
        win.focus()
      }
    },
    {
      label: 'Hide Ash',
      click: () => {
        win.hide()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // Click on tray icon to toggle visibility
  tray.on('click', () => {
    if (win.isVisible()) {
      win.focus()
    } else {
      win.show()
    }
  })
}
