import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import Page, { Loading } from '../components/Page.jsx';
import { useLoad } from '../util.js';

export default function Routine() {
  const { notify } = useApp();
  const nav = useNavigate();
  const { data, error } = useLoad('/trainings');
  const [name, setName] = useState('');

  async function add(e) {
    e.preventDefault();
    try {
      const t = await api('/trainings', { method: 'POST', body: { name } });
      notify(`Added ${t.name}. Now add exercises to it.`);
      nav(`/training/${t.id}`);
    } catch (ex) { notify(ex.message, 'err'); }
  }

  return (
    <Page title="My Routine">
      <p className="muted">Your trainings (like Push, Pull, Legs). Open one to add its exercises.</p>
      {!data ? <Loading error={error} /> : (
        <>
          {!data.length && <div className="card empty"><p>No trainings yet. Add your first one below.</p></div>}
          <div className="list">
            {data.map((t) => (
              <Link key={t.id} className="item" to={`/training/${t.id}`}>
                <div className="grow">
                  <div className="title">{t.name}</div>
                  <div className="muted small">{t.n} exercise{t.n === 1 ? '' : 's'}</div>
                </div>
                <Icon name="next" />
              </Link>
            ))}
          </div>
        </>
      )}
      <form className="card stack" onSubmit={add}>
        <label>Add training
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push, Pull, Legs, Cardio" maxLength={60} required />
        </label>
        <button className="btn primary block"><Icon name="plus" /> Add training</button>
      </form>
    </Page>
  );
}
