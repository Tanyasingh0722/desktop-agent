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
  - Built-in ambient sound player featuring high-quality audio tracks:
    - 🌧️ *Heavy Rain*
    - 🌦️ *Gentle Rain*
    - 🌊 *Ocean Waves*
    - 🏝️ *Beach Waves*
    - 🐦 *Nightingale Song*
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

## 🛠️ Tech Stack

- **Core**: [Electron](https://www.electronjs.org/) (v33+)
- **Bundler & Build Tool**: [electron-vite](https://electron-vite.org/) / [Vite](https://vitejs.dev/)
- **UI Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Icons & Styling**: [Lucide React](https://lucide.dev/), Custom Vanilla CSS with Glassmorphism
- **State & Storage**: `electron-store`, `lowdb`
- **Packaging**: `electron-builder`

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

In the project directory, you can run:

- `npm run dev`: Starts the application in development mode with live reloading via electron-vite.
- `npm run build`: Compiles main, preload, and renderer TypeScript code into the `out/` build directory.
- `npm run typecheck`: Runs TypeScript type checking for both main and web configs without emitting code.
- `npm run preview`: Previews the built production bundle.
- `npm run package:win`: Packages the application into a Windows executable (`.exe` / installer).
- `npm run package:mac`: Packages the application for macOS (`.dmg` / zip).

---

## 📁 Project Structure

```text
desktop-agent/
├── src/
│   ├── main/                 # Electron main process (window management, tray, timers, IPC)
│   │   ├── index.ts
│   │   ├── timers.ts
│   │   ├── tray.ts
│   │   └── ipc-handlers.ts
│   ├── preload/              # Preload scripts for safe IPC bridge
│   │   └── index.ts
│   └── renderer/             # React Frontend UI
│       ├── App.tsx           # Main App component & overlay launcher
│       ├── components/
│       │   ├── Companion.tsx        # Interactive pet sprite animations & interactions
│       │   ├── BreathingOverlay.tsx # Breathing modal & ambient audio player
│       │   ├── TodoDrawer.tsx       # Task manager, habits & stats drawer
│       │   ├── Pomodoro.tsx         # Focus timer modal
│       │   ├── CheckInPrompt.tsx    # Daily check-in dialogs
│       │   └── Notification.tsx     # Custom desktop nudges
│       ├── assets/           # Sprites, icons, and ambient audio files
│       ├── hooks/            # Custom React hooks (useDraggable, etc.)
│       └── styles/           # CSS design system & glassmorphic themes
├── electron.vite.config.ts   # Vite configuration for Electron
└── package.json
```

---

## 📄 License

This project is licensed under the MIT License - see the [package.json](package.json) file for details.

---

## 👤 Author

**Tanya Singh**  
- GitHub: [@Tanyasingh0722](https://github.com/Tanyasingh0722)
