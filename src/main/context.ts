import { exec } from 'child_process'
import { BrowserWindow } from 'electron'

export interface UserContext {
  activeApp: string
  activeTab: string
  windowBounds: { x: number; y: number; width: number; height: number } | null
}

let currentContext: UserContext = {
  activeApp: '',
  activeTab: '',
  windowBounds: null
}

let contextTimer: ReturnType<typeof setInterval> | null = null

const APPLESCRIPT = `
tell application "System Events"
	set frontApp to first application process whose frontmost is true
	set appName to name of frontApp
	set winBounds to {0, 0, 0, 0}
	try
		set wBounds to position of front window of frontApp & size of front window of frontApp
		set winBounds to wBounds
	end try
end tell
set tabName to ""
if appName is in {"Google Chrome", "Brave Browser", "Microsoft Edge", "Arc", "Opera", "Orion"} then
	try
		tell application appName
			if (count of windows) > 0 then
				set tabName to title of active tab of front window
			end if
		end tell
	end try
else if appName is "Safari" then
	try
		tell application "Safari"
			if (count of windows) > 0 then
				set tabName to name of current tab of front window
			end if
		end tell
	end try
end if
return appName & "||" & tabName & "||" & item 1 of winBounds & "," & item 2 of winBounds & "," & item 3 of winBounds & "," & item 4 of winBounds
`


export function startContextMonitoring(win: BrowserWindow) {
  if (contextTimer) return

  contextTimer = setInterval(() => {
    exec(`osascript -e '${APPLESCRIPT.replace(/'/g, "'\\''")}'`, (err, stdout) => {
      if (err) return
      
      const parts = stdout.trim().split('||')
      if (parts.length >= 3) {
        const activeApp = parts[0]
        const activeTab = parts[1]
        const boundsParts = parts[2].split(',').map(Number)
        
        let windowBounds = null
        if (boundsParts.length === 4 && boundsParts.some(n => n !== 0)) {
          windowBounds = {
            x: boundsParts[0],
            y: boundsParts[1],
            width: boundsParts[2],
            height: boundsParts[3]
          }
        }

        const newContext = { activeApp, activeTab, windowBounds }

        // Send context update periodically so the frontend doesn't miss the initial state
        if (!win.isDestroyed()) {
          win.webContents.send('context:update', newContext)
        }
        
        currentContext = newContext
      }
    })
  }, 3000)
}

export function stopContextMonitoring() {
  if (contextTimer) {
    clearInterval(contextTimer)
    contextTimer = null
  }
}

export function getCurrentContext(): UserContext {
  return currentContext
}
