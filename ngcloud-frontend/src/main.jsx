import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { initialize as initCrypto } from './crypto/CryptoService'
import './index.css'

// Initialize the WASM cryptographic engine using top-level await
await initCrypto()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster position="top-right" theme="dark" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

