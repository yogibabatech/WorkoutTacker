import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, all, one, run } from './db.js';

export const api = Router();
let SECRET = '';
export const setSecret = (s) => { SECRET = s; };

/* ---------------- helpers ---------------- */
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

const dec = (v, max = 99999) => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(',', '.').trim();
  if (s === '' || isNaN(Number(s))) return null;
  return Math.max(0, Math.min(max, Number(s)));
};
const iso = (d) => d.toISOString().slice(0, 10);
const utc = (s) => new Date(s + 'T00:00:00Z');
const validDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(utc(s)) && iso(utc(s)) === s;
const addDays = (s, n) => { const d = utc(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const mondayOf = (s) => addDays(s, -((utc(s).getUTCDay() + 6) % 7));
const monthEnd = (ym) => { const [y, m] = ym.split('-').map(Number); return iso(new Date(Date.UTC(y, m, 0))); };
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cell = (v) => (v === null || v === undefined ? '' : String(v));

/* ---------------- auth ---------------- */
function setCookie(req, res, uid) {
  const token = jwt.sign({ uid }, SECRET, { expiresIn: '60d' });
  res.cookie('wt_token', token, {
    httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 60 * 24 * 3600 * 1000, path: '/',
  });
}

api.post('/auth/signup', h(async (req, res) => {
  const username = str(req.body.username, 30);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const today = validDate(req.body.today) ? req.body.today : iso(new Date());
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) return bad(res, 'Username must be 3-30 characters: letters, numbers, . _ -');
  if (password.length < 4) return bad(res, 'Password must be at least 4 characters.');
  if (password.length > 200) return bad(res, 'Password too long.');
  if (await one('SELECT id FROM users WHERE username = ?', [username])) return bad(res, 'That username is taken. Try another.', 409);
  const r = await run('INSERT INTO users (username, password_hash, created_at) VALUES (?,?,?)',
    [username, await bcrypt.hash(password, 10), `${today} 00:00:00`]);
  setCookie(req, res, r.insertId);
  res.json({ id: r.insertId, username, since: today });
}));

api.post('/auth/login', h(async (req, res) => {
  const username = str(req.body.username, 30);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const u = await one('SELECT * FROM users WHERE username = ?', [username]);
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return bad(res, 'Wrong username or password.', 401);
  setCookie(req, res, u.id);
  res.json({ id: u.id, username: u.username, since: u.created_at.slice(0, 10) });
}));

api.post('/auth/logout', (req, res) => { res.clearCookie('wt_token', { path: '/' }); res.json({ ok: true }); });

// Everything below needs a logged-in user
api.use(h(async (req, res, next) => {
  try {
    const { uid } = jwt.verify(req.cookies.wt_token || '', SECRET);
    const u = await one('SELECT id, username, created_at FROM users WHERE id = ?', [uid]);
    if (!u) throw new Error('no user');
    req.user = { id: u.id, username: u.username, since: u.created_at.slice(0, 10) };
    next();
  } catch {
    bad(res, 'Not logged in', 401);
  }
}));

api.get('/me', (req, res) => res.json(req.user));

/* ---------------- domain helpers ---------------- */
async function trainedDays(uid, from, to) {
  const rows = await all(
    `SELECT w.workout_date d, COALESCE(t.name, w.training_name) n
       FROM workouts w LEFT JOIN trainings t ON t.id = w.training_id
      WHERE w.user_id = ? AND w.workout_date BETWEEN ? AND ?
        AND EXISTS (SELECT 1 FROM log_entries l WHERE l.workout_id = w.id AND l.done = 1)
      ORDER BY w.id`, [uid, from, to]);
  const m = {};
  for (const r of rows) (m[r.d] ||= []).push(r.n);
  return m;
}
const ownTraining = (uid, id) => one('SELECT * FROM trainings WHERE id = ? AND user_id = ?', [id, uid]);
const ownExercise = (uid, id) => one('SELECT * FROM exercises WHERE id = ? AND user_id = ?', [id, uid]);
const ownWorkout = (uid, id) => one(
  `SELECT w.*, COALESCE(t.name, w.training_name) AS tname FROM workouts w
     LEFT JOIN trainings t ON t.id = w.training_id WHERE w.id = ? AND w.user_id = ?`, [id, uid]);

/* ---------------- home ---------------- */
api.get('/summary', h(async (req, res) => {
  const uid = req.user.id;
  const today = validDate(req.query.today) ? req.query.today : iso(new Date());
  const monday = mondayOf(today);
  const week = await trainedDays(uid, monday, addDays(monday, 6));
  const monthStart = today.slice(0, 8) + '01';
  const month = await trainedDays(uid, monthStart, monthEnd(today.slice(0, 7)));
  const total = (await one(
    `SELECT COUNT(*) c FROM workouts w WHERE w.user_id = ? AND EXISTS
       (SELECT 1 FROM log_entries l WHERE l.workout_id = w.id AND l.done = 1)`, [uid])).c;
  const resume = await one(
    `SELECT w.id, COALESCE(t.name, w.training_name) name FROM workouts w LEFT JOIN trainings t ON t.id = w.training_id
      WHERE w.user_id = ? AND w.workout_date = ? AND w.finished_at IS NULL ORDER BY w.id DESC LIMIT 1`, [uid, today]);
  const exercises = await all(
    `SELECT e.id, e.name, e.type, t.id tid, t.name tname,
            MAX(l.weight) maxw, MAX(l.duration_min) maxd, MAX(w.workout_date) last_date
       FROM exercises e JOIN trainings t ON t.id = e.training_id
       LEFT JOIN log_entries l ON l.exercise_id = e.id AND l.done = 1
       LEFT JOIN workouts w ON w.id = l.workout_id
      WHERE e.user_id = ?
      GROUP BY e.id, e.name, e.type, t.id, t.name, t.sort_order, e.sort_order
      ORDER BY t.sort_order, t.id, e.sort_order, e.id`, [uid]);
  res.json({
    weekDates: Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    week, trainedToday: week[today] || null, monthCount: Object.keys(month).length, total, resume, exercises,
  });
}));

/* ---------------- trainings ---------------- */
api.get('/trainings', h(async (req, res) => {
  res.json(await all(
    `SELECT t.id, t.name, (SELECT COUNT(*) FROM exercises e WHERE e.training_id = t.id) n,
            (SELECT MAX(w.workout_date) FROM workouts w WHERE w.training_id = t.id
               AND EXISTS (SELECT 1 FROM log_entries l WHERE l.workout_id = w.id AND l.done = 1)) last_date
       FROM trainings t WHERE t.user_id = ? ORDER BY t.sort_order, t.id`, [req.user.id]));
}));

api.post('/trainings', h(async (req, res) => {
  const name = str(req.body.name, 60);
  if (!name) return bad(res, 'Enter a training name (max 60 characters).');
  const next = (await one('SELECT COALESCE(MAX(sort_order),0)+1 n FROM trainings WHERE user_id = ?', [req.user.id])).n;
  const r = await run('INSERT INTO trainings (user_id, name, sort_order) VALUES (?,?,?)', [req.user.id, name, next]);
  res.json({ id: r.insertId, name });
}));

api.get('/trainings/:id', h(async (req, res) => {
  const t = await ownTraining(req.user.id, +req.params.id);
  if (!t) return bad(res, 'Not found', 404);
  const exercises = await all(
    `SELECT e.id, e.name, e.type, e.target_weight, e.est_duration_min, e.target_duration_min,
            (SELECT COUNT(*) FROM exercise_sets s WHERE s.exercise_id = e.id) sets_count,
            (SELECT COALESCE(SUM(target_reps),0) FROM exercise_sets s WHERE s.exercise_id = e.id) reps_total
       FROM exercises e WHERE e.training_id = ? ORDER BY e.sort_order, e.id`, [t.id]);
  res.json({ id: t.id, name: t.name, exercises });
}));

api.put('/trainings/:id', h(async (req, res) => {
  const t = await ownTraining(req.user.id, +req.params.id);
  if (!t) return bad(res, 'Not found', 404);
  const name = str(req.body.name, 60);
  if (!name) return bad(res, 'Enter a valid name.');
  await run('UPDATE trainings SET name = ? WHERE id = ?', [name, t.id]);
  res.json({ ok: true });
}));

api.delete('/trainings/:id', h(async (req, res) => {
  const t = await ownTraining(req.user.id, +req.params.id);
  if (!t) return bad(res, 'Not found', 404);
  await run('DELETE FROM trainings WHERE id = ?', [t.id]);
  res.json({ ok: true });
}));

/* ---------------- exercises ---------------- */
function parseExercise(b) {
  const type = b.type === 'duration' ? 'duration' : 'sets';
  const name = str(b.name, 80);
  const description = typeof b.description === 'string' && b.description.trim() ? b.description.trim().slice(0, 2000) : null;
  const sets = [];
  for (const s of Array.isArray(b.sets) ? b.sets.slice(0, 50) : []) {
    const reps = dec(s.reps, 9999);
    if (reps && reps > 0) sets.push({ reps: Math.round(reps), weight: dec(s.weight, 9999) });
  }
  const tw = type === 'sets' ? dec(b.target_weight, 9999) : null;
  const est = type === 'sets' ? dec(b.est_duration_min, 9999) : null;
  const td = type === 'duration' ? dec(b.target_duration_min, 9999) : null;
  let err = '';
  if (!name) err = 'Enter an exercise name (max 80 characters).';
  else if (type === 'sets' && !sets.length) err = 'Add at least one set with reps.';
  else if (type === 'duration' && !(td > 0)) err = 'Enter a target duration in minutes.';
  return {
    err, name, description, type, sets: type === 'sets' ? sets : [],
    tw, est: est === null ? null : Math.round(est), td: td === null ? null : Math.round(td),
  };
}

async function saveSets(conn, exId, sets) {
  await conn.query('DELETE FROM exercise_sets WHERE exercise_id = ?', [exId]);
  for (let i = 0; i < sets.length; i++) {
    await conn.query('INSERT INTO exercise_sets (exercise_id, set_no, target_reps, target_weight) VALUES (?,?,?,?)',
      [exId, i + 1, sets[i].reps, sets[i].weight]);
  }
}

api.post('/trainings/:id/exercises', h(async (req, res) => {
  const t = await ownTraining(req.user.id, +req.params.id);
  if (!t) return bad(res, 'Not found', 404);
  const x = parseExercise(req.body);
  if (x.err) return bad(res, x.err);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const next = (await conn.query('SELECT COALESCE(MAX(sort_order),0)+1 n FROM exercises WHERE training_id = ?', [t.id]))[0][0].n;
    const r = (await conn.query(
      `INSERT INTO exercises (user_id, training_id, name, description, type, target_weight, est_duration_min, target_duration_min, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?)`, [req.user.id, t.id, x.name, x.description, x.type, x.tw, x.est, x.td, next]))[0];
    await saveSets(conn, r.insertId, x.sets);
    await conn.commit();
    res.json({ id: r.insertId });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

api.get('/exercises/:id', h(async (req, res) => {
  const x = await ownExercise(req.user.id, +req.params.id);
  if (!x) return bad(res, 'Not found', 404);
  const sets = await all('SELECT target_reps reps, target_weight weight FROM exercise_sets WHERE exercise_id = ? ORDER BY set_no', [x.id]);
  const t = await ownTraining(req.user.id, x.training_id);
  res.json({ ...x, training_name: t?.name, sets });
}));

api.put('/exercises/:id', h(async (req, res) => {
  const cur = await ownExercise(req.user.id, +req.params.id);
  if (!cur) return bad(res, 'Not found', 404);
  const x = parseExercise(req.body);
  if (x.err) return bad(res, x.err);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'UPDATE exercises SET name=?, description=?, type=?, target_weight=?, est_duration_min=?, target_duration_min=? WHERE id=?',
      [x.name, x.description, x.type, x.tw, x.est, x.td, cur.id]);
    await saveSets(conn, cur.id, x.sets);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

api.delete('/exercises/:id', h(async (req, res) => {
  const x = await ownExercise(req.user.id, +req.params.id);
  if (!x) return bad(res, 'Not found', 404);
  await run('DELETE FROM exercises WHERE id = ?', [x.id]);
  res.json({ ok: true, training_id: x.training_id });
}));

api.get('/exercises/:id/timeline', h(async (req, res) => {
  const x = await ownExercise(req.user.id, +req.params.id);
  if (!x) return bad(res, 'Not found', 404);
  const rows = await all(
    `SELECT w.id wid, w.workout_date d, l.weight, l.reps, l.duration_min
       FROM log_entries l JOIN workouts w ON w.id = l.workout_id
      WHERE l.exercise_id = ? AND l.done = 1 AND w.user_id = ?
      ORDER BY w.workout_date, w.id, l.set_no`, [x.id, req.user.id]);
  const map = new Map();
  for (const r of rows) {
    let s = map.get(r.wid);
    if (!s) { s = { date: r.d, sets: [], weight: 0, reps: 0, volume: 0, duration: 0 }; map.set(r.wid, s); }
    s.sets.push({ weight: r.weight, reps: r.reps });
    s.weight = Math.max(s.weight, r.weight || 0);
    s.reps += r.reps || 0;
    s.volume += (r.weight || 0) * (r.reps || 0);
    s.duration += r.duration_min || 0;
  }
  const sessions = [...map.values()].map((s) => ({ ...s, volume: Math.round(s.volume * 10) / 10, duration: Math.round(s.duration * 10) / 10 }));
  res.json({
    exercise: { id: x.id, name: x.name, type: x.type, description: x.description, target_duration_min: x.target_duration_min },
    sessions,
  });
}));

/* ---------------- workouts ---------------- */
api.post('/workouts', h(async (req, res) => {
  const uid = req.user.id;
  const t = await ownTraining(uid, +req.body.training_id);
  if (!t) return bad(res, 'Training not found', 404);
  const today = validDate(req.body.today) ? req.body.today : iso(new Date());
  let date = validDate(req.body.date) ? req.body.date : today;
  if (date > today) date = today;
  const w = await one('SELECT id FROM workouts WHERE user_id = ? AND training_id = ? AND workout_date = ?', [uid, t.id, date]);
  if (w) {
    await run('UPDATE workouts SET finished_at = NULL WHERE id = ?', [w.id]);
    return res.json({ id: w.id });
  }
  const r = await run(
    'INSERT INTO workouts (user_id, training_id, training_name, workout_date, started_at) VALUES (?,?,?,?,NOW())',
    [uid, t.id, t.name, date]);
  res.json({ id: r.insertId });
}));

api.get('/workouts/:id', h(async (req, res) => {
  const uid = req.user.id;
  const w = await ownWorkout(uid, +req.params.id);
  if (!w) return bad(res, 'Not found', 404);
  const exs = w.training_id
    ? await all('SELECT * FROM exercises WHERE training_id = ? AND user_id = ? ORDER BY sort_order, id', [w.training_id, uid]) : [];
  const ids = exs.map((e) => e.id);
  const logged = {}, plans = {}, last = {};
  if (ids.length) {
    for (const l of await all('SELECT * FROM log_entries WHERE workout_id = ? ORDER BY exercise_id, set_no', [w.id])) (logged[l.exercise_id] ||= []).push(l);
    for (const p of await all('SELECT * FROM exercise_sets WHERE exercise_id IN (?) ORDER BY exercise_id, set_no', [ids])) (plans[p.exercise_id] ||= []).push(p);
    const rows = await all(
      `SELECT l.exercise_id, l.workout_id, l.weight, l.reps, l.duration_min
         FROM log_entries l JOIN workouts wk ON wk.id = l.workout_id
        WHERE wk.user_id = ? AND wk.id <> ? AND wk.workout_date <= ? AND l.done = 1 AND l.exercise_id IN (?)
        ORDER BY wk.workout_date DESC, wk.id DESC, l.set_no`, [uid, w.id, w.workout_date, ids]);
    const first = {};
    for (const r of rows) {
      first[r.exercise_id] ??= r.workout_id;
      if (first[r.exercise_id] === r.workout_id) (last[r.exercise_id] ||= []).push({ weight: r.weight, reps: r.reps, duration_min: r.duration_min });
    }
  }
  const exercises = exs.map((x) => {
    let rows;
    if (logged[x.id]) {
      rows = logged[x.id].map((l) => ({ w: cell(l.weight), r: cell(l.reps), d: cell(l.duration_min), ok: !!l.done }));
    } else if (x.type === 'sets') {
      rows = (plans[x.id] || []).map((p) => ({ w: cell(p.target_weight ?? x.target_weight), r: cell(p.target_reps), d: '', ok: false }));
      if (!rows.length) rows = [{ w: cell(x.target_weight), r: '', d: '', ok: false }];
    } else {
      rows = [{ w: '', r: '', d: '', ok: false }];
    }
    const p = plans[x.id] || [];
    return {
      id: x.id, name: x.name, description: x.description, type: x.type,
      target_weight: x.target_weight, est_duration_min: x.est_duration_min, target_duration_min: x.target_duration_min,
      plan_sets: p.length, plan_reps: p.reduce((a, s) => a + s.target_reps, 0),
      rows, last: last[x.id] || [],
    };
  });
  res.json({ id: w.id, date: w.workout_date, name: w.tname, training_id: w.training_id, exercises });
}));

api.put('/workouts/:id', h(async (req, res) => {
  const uid = req.user.id;
  const w = await ownWorkout(uid, +req.params.id);
  if (!w) return bad(res, 'Not found', 404);
  const exs = w.training_id ? await all('SELECT * FROM exercises WHERE training_id = ? AND user_id = ?', [w.training_id, uid]) : [];
  const byId = new Map(exs.map((x) => [x.id, x]));
  const entries = req.body.entries && typeof req.body.entries === 'object' ? req.body.entries : {};

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (byId.size) await conn.query('DELETE FROM log_entries WHERE workout_id = ? AND exercise_id IN (?)', [w.id, [...byId.keys()]]);
    for (const [exId, rows] of Object.entries(entries)) {
      const x = byId.get(Number(exId));
      if (!x || !Array.isArray(rows)) continue;
      let n = 0;
      for (const r of rows.slice(0, 100)) {
        const ok = r.ok ? 1 : 0;
        let wt = dec(r.w, 9999), reps = dec(r.r, 9999), dur = dec(r.d, 9999);
        if (x.type === 'duration') {
          wt = reps = null;
          if (dur === null && !ok) continue;
          if (ok && dur === null) dur = x.target_duration_min;
        } else {
          dur = null;
          if (wt === null && reps === null && !ok) continue;
        }
        await conn.query(
          'INSERT INTO log_entries (workout_id, exercise_id, exercise_name, set_no, weight, reps, duration_min, done) VALUES (?,?,?,?,?,?,?,?)',
          [w.id, x.id, x.name, ++n, wt, reps === null ? null : Math.round(reps), dur, ok]);
      }
    }
    if (req.body.finish) await conn.query('UPDATE workouts SET finished_at = NOW() WHERE id = ?', [w.id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

  const done = (await one('SELECT COUNT(*) c FROM log_entries WHERE workout_id = ? AND done = 1', [w.id])).c;
  res.json({ ok: true, done });
}));

api.delete('/workouts/:id', h(async (req, res) => {
  const w = await ownWorkout(req.user.id, +req.params.id);
  if (!w) return bad(res, 'Not found', 404);
  await run('DELETE FROM workouts WHERE id = ?', [w.id]);
  res.json({ ok: true });
}));

/* ---------------- calendar ---------------- */
api.get('/calendar', h(async (req, res) => {
  const m = /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month || '') ? req.query.month : iso(new Date()).slice(0, 7);
  res.json({ days: await trainedDays(req.user.id, m + '-01', monthEnd(m)) });
}));

api.get('/day', h(async (req, res) => {
  if (!validDate(req.query.date)) return bad(res, 'Bad date');
  const ws = await all(
    `SELECT w.id, COALESCE(t.name, w.training_name) name FROM workouts w LEFT JOIN trainings t ON t.id = w.training_id
      WHERE w.user_id = ? AND w.workout_date = ? ORDER BY w.id`, [req.user.id, req.query.date]);
  const out = [];
  for (const w of ws) {
    const ents = await all('SELECT exercise_name, weight, reps, duration_min FROM log_entries WHERE workout_id = ? AND done = 1 ORDER BY exercise_name, set_no', [w.id]);
    if (!ents.length) continue;
    const by = {};
    for (const e of ents) (by[e.exercise_name] ||= []).push(e);
    out.push({ id: w.id, name: w.name, exercises: Object.entries(by).map(([name, list]) => ({ name, entries: list })) });
  }
  res.json({ workouts: out });
}));
