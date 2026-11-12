import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';
import { api, setSecret } from './routes.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(dir, '..', 'client', 'dist');

let secret = process.env.JWT_SECRET;
if (!secret || secret === 'change-me') {
  secret = crypto.randomBytes(32).toString('hex');
  console.warn('WARNING: JWT_SECRET not set. Using a temporary secret, so logins reset on every restart. Set JWT_SECRET in .env.');
}
setSecret(secret);

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('/', (req, res) => res.send('API is running. Build the client with "npm run build" (or run "npm run dev").'));
}

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const port = Number(process.env.PORT || 3001);
initDb()
  .then(() => app.listen(port, () => console.log(`Workout Tracker running on http://localhost:${port}`)))
  .catch((e) => {
    console.error('Database setup failed. Check DB_* settings in .env:', e.message);
    process.exit(1);
  });
