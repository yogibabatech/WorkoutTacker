import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import Page, { Loading } from '../components/Page.jsx';
import { fmtDate, num, useLoad } from '../util.js';

export default function Workout() {
  const { id } = useParams();
  const nav = useNavigate();
  const { notify } = useApp();
  const { data, error } = useLoad(`/workouts/${id}`);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setRows(Object.fromEntries(data.exercises.map((x) => [x.id, x.rows])));
  }, [data]);

  if (!data || !rows) return <Page title="Workout" back="/" nav={false}><Loading error={error} /></Page>;

  const upd = (exId, i, k, v) =>
    setRows((p) => ({ ...p, [exId]: p[exId].map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  const addSet = (exId) =>
    setRows((p) => {
      const l = p[exId][p[exId].length - 1];
      return { ...p, [exId]: [...p[exId], { w: l.w, r: l.r, d: '', ok: false }] };
    });
  const rmSet = (exId) =>
    setRows((p) => (p[exId].length > 1 ? { ...p, [exId]: p[exId].slice(0, -1) } : p));

  const all = Object.values(rows).flat();
  const done = all.filter((r) => r.ok).length;
  const pct = all.length ? Math.round((done * 100) / all.length) : 0;

  async function save(finish) {
    setBusy(true);
    try {
      const r = await api(`/workouts/${id}`, { method: 'PUT', body: { entries: rows, finish } });
      if (finish) {
        notify(r.done > 0 ? 'Workout logged. Nice work! 💪' : 'Finished, but no sets were ticked, so this day still counts as no training.', r.done > 0 ? 'ok' : 'err');
        nav('/');
      } else {
        notify('Saved.');
        window.scrollTo(0, 0);
      }
    } catch (ex) { notify(ex.message, 'err'); }
    setBusy(false);
  }
  async function discard() {
    if (!window.confirm('Discard this workout and everything logged in it?')) return;
    await api(`/workouts/${id}`, { method: 'DELETE' });
    notify('Workout discarded.');
    nav('/');
  }

  return (
    <Page title={data.name} back="/" nav={false}
      right={<span className="pill">{fmtDate(data.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>}>
      {!data.exercises.length && (
        <div className="card empty">
          <p>This training has no exercises{data.training_id ? '' : ' (it was deleted)'}.</p>
          {data.training_id && <Link className="btn primary" to={`/training/${data.training_id}`}>Add exercises</Link>}
        </div>
      )}
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save(false); }}>
        <div className="progress" aria-hidden="true"><i style={{ width: pct + '%' }} /></div>
        <div className="muted small">{done} of {all.length} done</div>

        {data.exercises.map((x) => (
          <section className="card ex" key={x.id}>
            <div className="exhead">
              <div className="grow">
                <h3>{x.name}</h3>
                <div className="chips">
                  {x.type === 'sets' ? (
                    <>
                      {x.target_weight !== null && <span className="chip">🎯 {num(x.target_weight)} kg</span>}
                      {!!x.est_duration_min && <span className="chip"><Icon name="clock" /> ~{x.est_duration_min} min</span>}
                      <span className="chip">{x.plan_sets} sets</span><span className="chip">{x.plan_reps} reps</span>
                    </>
                  ) : <span className="chip"><Icon name="clock" /> target {x.target_duration_min} min</span>}
                </div>
              </div>
              <Link className="iconbtn" to={`/timeline/${x.id}`} aria-label="Timeline"><Icon name="chart" /></Link>
            </div>
            {x.description && <details className="desc"><summary>How to</summary><p>{x.description}</p></details>}
            {x.last.length > 0 && (
              <div className="lasttime muted small">Last time:{' '}
                {x.type === 'sets' ? x.last.map((l) => `${num(l.weight)}×${l.reps}`).join(', ') : `${num(x.last[0].duration_min)} min`}
              </div>
            )}

            <div className="sets">
              {rows[x.id].map((r, i) => (
                <div className="setrow" key={i}>
                  <span className="setno">{i + 1}</span>
                  {x.type === 'sets' ? (
                    <>
                      <input inputMode="decimal" placeholder="kg" aria-label="Weight in kg" value={r.w} onChange={(e) => upd(x.id, i, 'w', e.target.value)} />
                      <span className="x">×</span>
                      <input inputMode="numeric" placeholder="reps" aria-label="Reps" value={r.r} onChange={(e) => upd(x.id, i, 'r', e.target.value)} />
                    </>
                  ) : (
                    <>
                      <input inputMode="decimal" placeholder={String(x.target_duration_min)} aria-label="Duration in minutes" value={r.d} onChange={(e) => upd(x.id, i, 'd', e.target.value)} />
                      <span className="unit">min</span>
                    </>
                  )}
                  <label className="chk">
                    <input type="checkbox" checked={r.ok} onChange={(e) => upd(x.id, i, 'ok', e.target.checked)} aria-label="Done" />
                    <span><Icon name="check" /></span>
                  </label>
                </div>
              ))}
            </div>
            {x.type === 'sets' && (
              <div className="row gap">
                <button type="button" className="btn small grow" onClick={() => addSet(x.id)}><Icon name="plus" /> Set</button>
                <button type="button" className="btn small grow" onClick={() => rmSet(x.id)}><Icon name="minus" /> Set</button>
              </div>
            )}
          </section>
        ))}

        {data.exercises.length > 0 && (
          <div className="savebar">
            <button type="submit" className="btn" disabled={busy}>Save</button>
            <button type="button" className="btn primary" disabled={busy} onClick={() => save(true)}>Finish workout</button>
          </div>
        )}
      </form>
      <button className="btn danger block" onClick={discard}><Icon name="trash" /> Discard this workout</button>
      <div className="spacer" />
    </Page>
  );
}
