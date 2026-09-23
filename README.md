# 🐾 Ash Companion

> **Ash** is your friendly interactive desktop companion built with Electron, Vite, React, and TypeScript. Ash lives right on your desktop, checking in on your day, tracking tasks, nudging healthy habits, playing relaxing ambient sounds, and guiding mindfulness breathing sessions.

---

## ✨ Features

- 🐶 **Interactive Desktop Pet (Ash)**:
  - Frameless, transparent floating pet window that stays smoothly on top of your workspace.
  - Dynamic sprite animations including idle, walking, sleeping, thinking, happy, angry, success, and dragging states.
  - Interactive desktop roaming and drag-to-reposition support.

- 🫁 **Breathing Exercises & Guided Relaxation**:
  - Interactive breathing modal with synchronized visual guide and phase indicators (*Inhale*, *Hold*, *Exhale*).
  - Customizable session durations (1 min, 2 min, 3 min, 5 min).
  - Built-in ambient sound player featuring high-quality audio tracks.
  - Volume slider and background audio toggles.

- 📋 **Comprehensive Task & Habit Drawer**:
  - Full task manager with category filtering, priority indicators, completion status, and search.
  - Daily goals, productivity metrics, and streak tracking.
  - Paginated list views and clean, responsive UI drawer.

- ⏱️ **Pomodoro & Focus Sessions**:
  - Integrated focus timer with custom work/break intervals.
  - Friendly reminders from Ash to take rest breaks and stay hydrated.

- 💧 **Hydration & Wellness Nudges**:
  - Timed water break check-ins and subtle desktop notifications.
  - Context-aware background monitoring.

- ⚙️ **System Tray Integration**:
  - Quick access tray menu to toggle visibility, open drawers, manage audio, or exit.

---

## 🧠 Architecture & Technical Details (For Developer/AI Context)

This section details the critical inner workings of the application to ensure stable future development.

### 1. The Evasion Sequence & Intent Tracking
Ash has a highly specific mouse-evasion mechanism defined in `src/main/index.ts` (`triggerRoam` and the polling loop):
- **Intent Tracking**: The app polls the system idle time and cursor velocity every 80ms. If the cursor is near Ash, it checks the `cursorSpeed`. If the mouse is moving slowly (`< 10px`) or is *directly over* Ash, the app enters an "intent window" and **freezes Ash in place** so the user can easily click, pet, or open the drawer without Ash running away.
- **Short Evasions**: If the mouse sweeps quickly near Ash, Ash takes a quick `200px` step away from the cursor.
- **Corner Jumps (The 3-Strike Rule)**: If Ash is disturbed 3 times consecutively within 10 seconds, `consecutiveEvadeCount` triggers a teleport logic. Ash will bypass the 200px step and jump completely across the screen to the **far opposite corner**.

### 2. Multi-Monitor Dragging & Window Sizing
Ash's window relies on precise `BrowserWindow.setBounds` manipulation and layout synchronization between the main and renderer processes:
- **Instant Drawer Collapse**: When dragging starts (`App.tsx` `onDragStart`), all side panels (`panelVisible`, `drawerOpen`) are forced to close instantly (bypassing CSS timers) to shrink the window back to `120x120`. This ensures the user isn't accidentally dragging a massive invisible 560x580 window which causes jarring snaps.
- **Unclamped Dragging**: During the `window:move-by` IPC event, boundary clamping is intentionally **disabled** to allow Ash to be dragged freely across multiple monitors. Clamping only occurs at the end of the drag (`window:snap-to-corner`).
- **Dynamic Anchoring**: When the window resizes (to open the drawer), `getCompanionAnchor()` ensures the window expands *inward* toward the center of the screen so Ash's sprite remains visually stationary.

### 3. Asynchronous Timers & Quiet Hours
Background wellness nudges (Water, Posture, Task cadence) are handled in `src/main/timers.ts`:
- **Timer Execution**: Timers use `setInterval` with long delays (e.g. 30, 50, 90 minutes). Note that these timers reset entirely whenever the main process restarts (e.g. during Vite HMR hot-reloads).
- **Quiet Hours**: The "Pause All Nudges" feature acts as a Quiet Hours enforcer. Even if the toggle is ON, it only silences notifications if the current system time falls between the designated hours (e.g. 10:00 PM to 08:00 AM).

---

## 🛠️ Tech Stack

- **Core**: [Electron](https://www.electronjs.org/) (v33+)
- **Bundler & Build Tool**: [electron-vite](https://electron-vite.org/) / [Vite](https://vitejs.dev/)
- **UI Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Icons & Styling**: [Lucide React](https://lucide.dev/), Custom Vanilla CSS with Glassmorphism
- **State & Storage**: `electron-store`, `lowdb`

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18.0 or higher recommended)
- `npm` or `yarn` / `pnpm`

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Tanyasingh0722/desktop-agent.git
   cd desktop-agent
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start Development Mode**:
   ```bash
   npm run dev
   ```

---

## 📜 Available Scripts

- `npm run dev`: Starts the application in development mode with live reloading via electron-vite.
- `npm run build`: Compiles main, preload, and renderer TypeScript code into the `out/` build directory.
- `npm run typecheck`: Runs TypeScript type checking for both main and web configs without emitting code.
- `npm run preview`: Previews the built production bundle.
- `npm run package:win`: Packages the application into a Windows executable (`.exe` / installer).
- `npm run package:mac`: Packages the application for macOS (`.dmg` / zip).

---

## 📄 License

This project is licensed under the MIT License - see the [package.json](package.json) file for details.

---

## 👤 Author

**Tanya Singh**  
- GitHub: [@Tanyasingh0722](https://github.com/Tanyasingh0722)
