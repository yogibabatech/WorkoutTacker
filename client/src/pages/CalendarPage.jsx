import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import Page from '../components/Page.jsx';
import { fmtDate, num, shiftMonth, todayStr, useLoad, ymOf } from '../util.js';

const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

function DayDetail({ date, today }) {
  const { data } = useLoad(`/day?date=${date}`);
  return (
    <>
      <h3 className="section">{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</h3>
      {!data ? <p className="muted">Loading…</p> : data.workouts.length === 0 ? (
        <div className="card empty">
          <p className="bad-text"><Icon name="x" /> No training{date > today ? ' (future day)' : ''}</p>
          {date <= today && <Link className="btn primary" to={`/train?d=${date}`}>Log training for this day</Link>}
        </div>
      ) : data.workouts.map((w) => (
        <section className="card" key={w.id}>
          <div className="row between">
            <h3 className="ok-text"><Icon name="check" /> {w.name}</h3>
            <Link className="btn small" to={`/workout/${w.id}`}>Edit</Link>
          </div>
          {w.exercises.map((x) => (
            <div className="logline" key={x.name}>
              <b>{x.name}</b>
              <span className="muted">
                {x.entries[0].duration_min !== null
                  ? `${num(x.entries[0].duration_min)} min`
                  : x.entries.map((l) => `${num(l.weight)}×${l.reps}`).join(', ')}
              </span>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

export default function CalendarPage() {
  const { user } = useApp();
  const [params, setParams] = useSearchParams();
  const today = todayStr();
  const sel = validDate(params.get('d')) ? params.get('d') : '';
  const ym = /^\d{4}-\d{2}$/.test(params.get('m') || '') ? params.get('m') : sel ? ymOf(sel) : ymOf(today);
  const { data } = useLoad(`/calendar?month=${ym}`);
  const days = data?.days || {};

  const [y, m] = ym.split('-').map(Number);
  const daysIn = new Date(y, m, 0).getDate();
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday first
  const go = (nm) => setParams({ m: nm });

  return (
    <Page title="Calendar">
      <div className="monthbar">
        <button className="iconbtn" onClick={() => go(shiftMonth(ym, -1))} aria-label="Previous month"><Icon name="back" /></button>
        <strong>{fmtDate(ym + '-01', { month: 'long', year: 'numeric' })}</strong>
        <button className="iconbtn" onClick={() => go(shiftMonth(ym, 1))} aria-label="Next month"><Icon name="next" /></button>
      </div>

      <div className="cal card">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((h, i) => <div className="dow" key={i}>{h}</div>)}
        {Array.from({ length: offset }, (_, i) => <div key={'o' + i} />)}
        {Array.from({ length: daysIn }, (_, i) => {
          const d = i + 1;
          const date = `${ym}-${String(d).padStart(2, '0')}`;
          const names = days[date];
          const cls = names ? 'done' : date < today && date >= user.since ? 'miss' : 'none';
          return (
            <button key={d} onClick={() => setParams({ m: ym, d: date })}
              className={`day ${cls}${date === today ? ' today' : ''}${date === sel ? ' sel' : ''}`}>
              <span className="n">{d}</span>
              {cls === 'done' && <><span className="mark"><Icon name="check" /></span><span className="nm">{names[0]}{names.length > 1 ? ` +${names.length - 1}` : ''}</span></>}
              {cls === 'miss' && <><span className="mark"><Icon name="x" /></span><span className="nm">No training</span></>}
            </button>
          );
        })}
      </div>

      <div className="legend small muted">
        <span><i className="dot g" /> Trained</span><span><i className="dot r" /> No training</span>
      </div>

      {sel && <DayDetail key={sel} date={sel} today={today} />}
    </Page>
  );
}
