# NGCloud — Zero-Knowledge Cloud Storage (Frontend)

Final Year Project — BS Cyber Security.

## Setup
```bash
npm install
cp .env.example .env   # adjust VITE_API_BASE_URL if needed
npm run dev
```
Open http://localhost:5173

## Demo Credentials (any input works in mock mode if backend is down)
- Client: register/login normally
- Admin: username `admin` (role check via API response)

## Stack
React 18 + Vite + Tailwind + Framer Motion + React Router + Axios + Sonner + Recharts.

## Backend
Expects backend at `VITE_API_BASE_URL` (default `https://localhost:5000`).
Admin endpoints fall back to mock data if unavailable.
