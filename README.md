# Workout Tracker (React + Node + MySQL)

Mobile-first workout tracker. React (Vite) frontend, Express API, MySQL storage.

## Run locally
1. Start MySQL (XAMPP defaults: user `root`, empty password).
2. `copy .env.example .env` (edit if your DB differs).
3. `npm run install:all`
4. `npm run dev` then open http://localhost:5173 (API on :3001).

The database and tables are created automatically on first start.

## Deploy (live server)
Needs Node 18+ and MySQL. A plain PHP/shared host will not work, use a VPS, Render, Railway, or cPanel "Setup Node.js App".

1. Create a MySQL database and user (grant all on that database).
2. On the server create `.env` (see `.env.example`):
   - `NODE_ENV=production`, `PORT` (use the one your host gives)
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
   - `JWT_SECRET` = long random string
3. `npm install` then `npm run build` then `npm start`
4. Serve over HTTPS. Behind Nginx/Apache, proxy everything to the Node port and forward `X-Forwarded-Proto`.
