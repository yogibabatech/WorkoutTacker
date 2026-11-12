import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import Page, { Loading } from '../components/Page.jsx';
import { num, useLoad } from '../util.js';

const blank = {
  name: '', description: '', type: 'sets', target_weight: '', est_duration_min: '', target_duration_min: '',
  sets: [{ reps: '10', weight: '' }, { reps: '10', weight: '' }, { reps: '10', weight: '' }],
};

export default function ExerciseForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { notify } = useApp();
  const nav = useNavigate();
  const editing = !!id;
  const { data, error } = useLoad(editing ? `/exercises/${id}` : null);
  const [f, setF] = useState(blank);
  const [trainingId, setTrainingId] = useState(params.get('training'));
  const [trainingName, setTrainingName] = useState('');

  useEffect(() => {
    if (!data) return;
    setTrainingId(String(data.training_id));
    setTrainingName(data.training_name);
    setF({
      name: data.name, description: data.description || '', type: data.type,
      target_weight: num(data.target_weight), est_duration_min: data.est_duration_min ?? '',
      target_duration_min: data.target_duration_min ?? '',
      sets: data.sets.length ? data.sets.map((s) => ({ reps: String(s.reps), weight: num(s.weight) })) : blank.sets,
    });
  }, [data]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setSet = (i, k, v) => setF((p) => ({ ...p, sets: p.sets.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));
  const addSet = () => setF((p) => ({ ...p, sets: [...p.sets, { ...(p.sets[p.sets.length - 1] || { reps: '10', weight: '' }) }] }));
  const rmSet = () => setF((p) => (p.sets.length > 1 ? { ...p, sets: p.sets.slice(0, -1) } : p));

  const validSets = f.sets.filter((s) => parseInt(s.reps, 10) > 0);
  const totalReps = validSets.reduce((a, s) => a + parseInt(s.reps, 10), 0);

  async function save(e) {
    e.preventDefault();
    try {
      if (editing) {
        await api(`/exercises/${id}`, { method: 'PUT', body: f });
        notify('Exercise saved.');
      } else {
        await api(`/trainings/${trainingId}/exercises`, { method: 'POST', body: f });
        notify('Exercise added.');
      }
      nav(`/training/${trainingId}`);
    } catch (ex) { notify(ex.message, 'err'); window.scrollTo(0, 0); }
  }
  async function del() {
    if (!window.confirm('Delete this exercise? Logged history for it stays in the calendar.')) return;
    await api(`/exercises/${id}`, { method: 'DELETE' });
    notify('Exercise deleted.');
    nav(`/training/${trainingId}`);
  }

  const back = trainingId ? `/training/${trainingId}` : '/routine';
  if (editing && !data) return <Page title="Edit exercise" back="/routine"><Loading error={error} /></Page>;
  if (!editing && !trainingId) return <Page title="New exercise" back="/routine"><p className="muted">Pick a training first.</p></Page>;

  return (
    <Page title={editing ? 'Edit exercise' : 'New exercise'} back={back}>
      {trainingName && <p className="muted">In <strong>{trainingName}</strong></p>}
      <form className="stack" onSubmit={save}>
        <div className="card stack">
          <label>Name
            <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Bench Press" maxLength={80} required />
          </label>
          <label>Description <span className="muted small">(optional)</span>
            <textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)}
              placeholder="How to do it, form cues, machine settings…" />
          </label>
          <div>
            <div className="lbl">Type</div>
            <div className="seg">
              <label><input type="radio" name="type" checked={f.type === 'sets'} onChange={() => set('type', 'sets')} /><span>Sets × reps</span></label>
              <label><input type="radio" name="type" checked={f.type === 'duration'} onChange={() => set('type', 'duration')} /><span>Duration</span></label>
            </div>
          </div>
        </div>

        {f.type === 'sets' ? (
          <div className="card stack">
            <div className="two">
              <label>Target weight (kg)
                <input inputMode="decimal" value={f.target_weight} onChange={(e) => set('target_weight', e.target.value)} placeholder="80" />
              </label>
              <label>Est. time to hit it (min)
                <input inputMode="numeric" value={f.est_duration_min} onChange={(e) => set('est_duration_min', e.target.value)} placeholder="45" />
              </label>
            </div>
            <div className="lbl">Sets <span className="muted small">weight blank = target weight</span></div>
            <div className="stack tight">
              {f.sets.map((s, i) => (
                <div className="setdef" key={i}>
                  <span className="setno">{i + 1}</span>
                  <input inputMode="numeric" placeholder="reps" aria-label="Reps" value={s.reps} onChange={(e) => setSet(i, 'reps', e.target.value)} />
                  <input inputMode="decimal" placeholder="kg" aria-label="Weight" value={s.weight} onChange={(e) => setSet(i, 'weight', e.target.value)} />
                </div>
              ))}
            </div>
            <div className="row gap">
              <button type="button" className="btn grow" onClick={addSet}><Icon name="plus" /> Add set</button>
              <button type="button" className="btn grow" onClick={rmSet}><Icon name="minus" /> Remove set</button>
            </div>
            <div className="muted">Total: {validSets.length} sets, {totalReps} reps</div>
          </div>
        ) : (
          <div className="card stack">
            <label>Target duration (min)
              <input inputMode="numeric" value={f.target_duration_min} onChange={(e) => set('target_duration_min', e.target.value)} placeholder="30" />
            </label>
          </div>
        )}
        <button className="btn primary block">Save exercise</button>
      </form>

      {editing && (
        <>
          <button className="btn danger block" onClick={del}><Icon name="trash" /> Delete exercise</button>
          <Link className="btn block" to={`/timeline/${id}`}><Icon name="chart" /> View timeline</Link>
        </>
      )}
    </Page>
  );
}
