import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import Page, { Loading } from '../components/Page.jsx';
import { fmtDate, todayStr, useLoad } from '../util.js';

export default function Train() {
  const today = todayStr();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { notify } = useApp();
  let date = params.get('d') || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) date = today;
  const isToday = date === today;
  const { data, error } = useLoad('/trainings');

  async function start(t) {
    try {
      const w = await api('/workouts', { method: 'POST', body: { training_id: t.id, date, today } });
      nav(`/workout/${w.id}`);
    } catch (ex) { notify(ex.message, 'err'); }
  }

  return (
    <Page title={isToday ? "Today's training" : 'Log a past day'} nav>
      <p className="muted">
        {isToday ? 'What are you training today?' : <>Logging for <strong>{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</strong></>}
      </p>
      {!data ? <Loading error={error} /> : (
        <>
          {!data.length && (
            <div className="card empty"><p>You have no trainings yet.</p><Link className="btn primary" to="/routine">Build your routine</Link></div>
          )}
          {data.map((t) => (
            <div key={t.id} className="card pick">
              <div className="grow">
                <div className="title">{t.name}</div>
                <div className="muted small">
                  {t.n} exercise{t.n === 1 ? '' : 's'} · {t.last_date ? 'last ' + fmtDate(t.last_date, { day: 'numeric', month: 'short' }) : 'never done'}
                </div>
              </div>
              {t.n > 0
                ? <button className="btn primary" onClick={() => start(t)}>Start</button>
                : <Link className="btn" to={`/training/${t.id}`}>Add exercises</Link>}
            </div>
          ))}
        </>
      )}
    </Page>
  );
}
