import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
  ],
  server: {
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://localhost:5000 https://localhost:5000 http://localhost:5001 https://localhost:5001 http://192.168.136.200:9003 http://localhost:9003 http://127.0.0.1:9003 https://localhost:9003 ws://localhost:5173 ws://localhost:5174 ws://127.0.0.1:5173 ws://127.0.0.1:5174 wss://localhost:5173 wss://localhost:5174 wss://127.0.0.1:5173 wss://127.0.0.1:5174; img-src 'self' data: blob:; object-src 'none';",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    }
  }
})