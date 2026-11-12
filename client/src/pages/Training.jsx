import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import Page, { Loading } from '../components/Page.jsx';
import { num, useLoad } from '../util.js';

export default function Training() {
  const { id } = useParams();
  const { notify } = useApp();
  const nav = useNavigate();
  const { data, error, reload } = useLoad(`/trainings/${id}`);
  const [name, setName] = useState('');
  useEffect(() => { if (data) setName(data.name); }, [data?.name]); // eslint-disable-line

  async function rename(e) {
    e.preventDefault();
    try { await api(`/trainings/${id}`, { method: 'PUT', body: { name } }); notify('Renamed.'); reload(); }
    catch (ex) { notify(ex.message, 'err'); }
  }
  async function del() {
    if (!window.confirm('Delete this training and all its exercises?')) return;
    await api(`/trainings/${id}`, { method: 'DELETE' });
    notify('Training deleted. Your past logs are kept in the calendar.');
    nav('/routine');
  }

  if (!data) return <Page title="Training" back="/routine"><Loading error={error} /></Page>;
  return (
    <Page title={data.name} back="/routine">
      <h3 className="section">Exercises</h3>
      {!data.exercises.length && <div className="card empty"><p>No exercises yet. Add the first one.</p></div>}
      <div className="list">
        {data.exercises.map((x) => (
          <Link key={x.id} className="item" to={`/exercise/${x.id}`}>
            <div className="grow">
              <div className="title">{x.name}</div>
              <div className="muted small">
                {x.type === 'sets'
                  ? <>{x.sets_count} sets · {x.reps_total} reps{x.target_weight !== null && ` · ${num(x.target_weight)} kg`}{x.est_duration_min ? ` · ~${x.est_duration_min} min` : ''}</>
                  : <>Duration · target {x.target_duration_min} min</>}
              </div>
            </div>
            <Icon name="edit" />
          </Link>
        ))}
      </div>
      <Link className="btn primary block" to={`/exercise/new?training=${id}`}><Icon name="plus" /> Add exercise</Link>

      <h3 className="section">Training settings</h3>
      <form className="card stack" onSubmit={rename}>
        <label>Name <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required /></label>
        <button className="btn block">Save name</button>
      </form>
      <button className="btn danger block" onClick={del}><Icon name="trash" /> Delete training</button>
    </Page>
  );
}
