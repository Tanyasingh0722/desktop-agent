/// <reference types="vite/client" />

import type { AshAPI } from '../preload/index'

declare global {
  interface Window {
    ashAPI: AshAPI
  }
}

declare module '*.png' {
  const value: string
  export default value
}
