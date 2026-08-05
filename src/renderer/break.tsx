import React from 'react'
import ReactDOM from 'react-dom/client'
import BreathingOverlay from './components/BreathingOverlay'
import './styles/global.css'

// Immediately set background so no dark OS chrome shows before CSS loads
document.documentElement.style.background = '#F5F4F0'
document.body.style.background = '#F5F4F0'

// Parse duration from query params (default: 3 minutes)
const params = new URLSearchParams(window.location.search)
const duration = parseInt(params.get('duration') ?? '180', 10)

const root = ReactDOM.createRoot(document.getElementById('break-root')!)
root.render(
  <React.StrictMode>
    <BreathingOverlay durationSeconds={duration} />
  </React.StrictMode>
)

