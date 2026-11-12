import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import Page, { Loading } from '../components/Page.jsx';
import { fmtDate, num, todayStr, useLoad } from '../util.js';

export default function Home() {
  const { user, setUser } = useApp();
  const today = todayStr();
  const { data, error } = useLoad(`/summary?today=${today}`);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const right = (
    <button className="iconbtn" onClick={logout} aria-label="Log out" title="Log out"><Icon name="out" /></button>
  );
  if (!data) return <Page title="Home" right={right}><Loading error={error} /></Page>;

  const groups = {};
  for (const x of data.exercises) (groups[x.tname] ||= []).push(x);

  return (
    <Page title="Home" right={right}>
      <p className="hello">Hi, <strong>{user.username}</strong> 👋</p>

      <section className={`card today ${data.trainedToday ? 'good' : ''}`}>
        <div className="muted small">{fmtDate(today, { weekday: 'long', day: 'numeric', month: 'short' })}</div>
        {data.trainedToday
          ? <h2 className="ok-text"><Icon name="check" /> {data.trainedToday.join(' + ')} done</h2>
          : <h2>No training logged yet</h2>}
        {data.resume
          ? <Link className="btn primary block" to={`/workout/${data.resume.id}`}>Continue {data.resume.name}</Link>
          : <Link className="btn primary block" to="/train">{data.trainedToday ? 'Train again' : "Choose today's training"}</Link>}
      </section>

      <section className="card">
        <div className="weekstrip">
          {data.weekDates.map((d) => {
            const st = data.week[d] ? 'done' : d < today && d >= user.since ? 'miss' : d === today ? 'now' : 'none';
            return (
              <Link key={d} to={`/calendar?d=${d}`} className={`wd ${st}`}>
                <span>{fmtDate(d, { weekday: 'short' })}</span>
                <b>{st === 'done' ? <Icon name="check" /> : st === 'miss' ? <Icon name="x" /> : Number(d.slice(8))}</b>
              </Link>
            );
          })}
        </div>
        <div className="stats">
          <div><b>{Object.keys(data.week).length}</b><span>this week</span></div>
          <div><b>{data.monthCount}</b><span>this month</span></div>
          <div><b>{data.total}</b><span>total</span></div>
        </div>
      </section>

      <h3 className="section">Exercise summary</h3>
      {!data.exercises.length && (
        <div className="card empty">
          <p>No exercises yet. Build your routine first: add a training like <em>Push</em>, then add exercises to it.</p>
          <Link className="btn primary" to="/routine">Build routine</Link>
        </div>
      )}
      {Object.entries(groups).map(([tname, list]) => (
        <div key={tname} className="stack tight">
          <h4 className="group">{tname}</h4>
          <div className="list">
            {list.map((x) => (
              <Link key={x.id} className="item" to={`/timeline/${x.id}`}>
                <div className="grow">
                  <div className="title">{x.name}</div>
                  <div className="muted small">{x.last_date ? 'Last: ' + fmtDate(x.last_date, { day: 'numeric', month: 'short' }) : 'Not logged yet'}</div>
                </div>
                <div className="pr">
                  {x.type === 'sets'
                    ? <><b>{x.maxw !== null ? num(x.maxw) + ' kg' : '–'}</b><span>max weight</span></>
                    : <><b>{x.maxd !== null ? num(x.maxd) + ' min' : '–'}</b><span>max duration</span></>}
                </div>
                <Icon name="next" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </Page>
  );
}
