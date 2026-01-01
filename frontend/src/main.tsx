import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { setupFontLoadingOptimization } from './utils/textEffectsRemover'

// Initialize font loading optimization
setupFontLoadingOptimization()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
