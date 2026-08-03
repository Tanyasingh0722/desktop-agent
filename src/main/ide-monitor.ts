import { exec } from 'child_process'
import { BrowserWindow } from 'electron'
import { getCurrentContext } from './context'

let monitorTimer: ReturnType<typeof setInterval> | null = null
let lastNotifiedLine: string | null = null
let lastKnownFile: string | null = null

export function startIDEMonitoring(win: BrowserWindow) {
  if (monitorTimer) return

  monitorTimer = setInterval(() => {
    // Find the most recently modified transcript
    const cmd = `find ~/.gemini/antigravity-ide/brain -name "transcript.jsonl" -exec stat -f "%m %N" {} \\; | sort -nr | head -n 1`
    
    exec(cmd, (err, stdout) => {
      if (err) return
      
      const match = stdout.trim().match(/^\d+\s+(.*)$/)
      if (!match) return
      
      const latestFile = match[1]
      
      // If the active file changes, reset the last line so we don't carry over stale state
      if (lastKnownFile !== latestFile) {
        lastKnownFile = latestFile
        lastNotifiedLine = null
      }

      // Read the last line
      exec(`tail -n 1 "${latestFile}"`, (err, stdoutTail) => {
        if (err) return
        
        const lastLine = stdoutTail.trim()
        if (!lastLine || lastLine === lastNotifiedLine) return
        
        // Parse the line just to be safe, or just check for substring
        if (lastLine.includes('"ask_permission"') || lastLine.includes('"name":"default_api:ask_permission"')) {
          
          console.log(`[IDE Monitor] Found ask_permission in last line!`)
          // Check context
          const context = getCurrentContext()
          const isAntigravityActive = 
            context.activeApp.toLowerCase().includes('antigravity') || 
            context.activeTab.toLowerCase().includes('antigravity')
          
          console.log(`[IDE Monitor] Context check: activeApp=${context.activeApp}, activeTab=${context.activeTab}, isAntigravityActive=${isAntigravityActive}`)

          if (!isAntigravityActive) {
            console.log(`[IDE Monitor] Sending mood:change alert!`)
            if (!win.isDestroyed()) {
              win.webContents.send('mood:change', 'remind', 'ide-permission')
            }
            lastNotifiedLine = lastLine
          } else {
            console.log(`[IDE Monitor] Not sending alert because user is on Antigravity.`)
          }
        } else {
          // If the last line is NOT asking for permission, we still record it so we don't alert on old lines
          lastNotifiedLine = lastLine
        }
      })
    })
  }, 3000)
}

export function stopIDEMonitoring() {
  if (monitorTimer) {
    clearInterval(monitorTimer)
    monitorTimer = null
  }
}
