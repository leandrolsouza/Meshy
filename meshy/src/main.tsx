import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/global.css'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import App from './App'

// Guard: ensure the Meshy API is available via contextBridge.
// In development without Electron, this prevents cryptic runtime errors.
if (typeof window.meshy === 'undefined') {
    console.warn(
        '[Meshy] window.meshy is not available. ' +
        'The app must run inside Electron with the preload script configured.',
    )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
)
