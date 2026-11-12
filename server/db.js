import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

export let pool;

export async function initDb() {
  const base = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS ?? '',
  };
  // Cloud MySQL (Aiven, TiDB, PlanetScale...) usually requires TLS: set DB_SSL=true
  if (process.env.DB_SSL === 'true') {
    base.ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.DB_SSL_STRICT === 'true' };
  }
  const name = process.env.DB_NAME || 'workout_tracker';

  // Try to create the database (may be disallowed on shared hosting, that's fine)
  try {
    const c = await mysql.createConnection(base);
    await c.query(`CREATE DATABASE IF NOT EXISTS \`${name.replace(/`/g, '')}\` CHARACTER SET utf8mb4`);
    await c.end();
  } catch (e) {
    console.warn('Could not auto-create database (continuing):', e.code || e.message);
  }

  pool = mysql.createPool({
    ...base,
    database: name,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true, // DATE/DATETIME come back as plain strings
    decimalNumbers: true, // DECIMAL comes back as numbers
    charset: 'utf8mb4',
  });

  const sql = fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8');
  for (const stmt of sql.split(';')) {
    if (stmt.replace(/^\s*--.*$/gm, '').trim()) await pool.query(stmt);
  }
}

export const all = async (sql, params = []) => (await pool.query(sql, params))[0];
export const one = async (sql, params = []) => (await all(sql, params))[0] ?? null;
export const run = async (sql, params = []) => (await pool.query(sql, params))[0];
