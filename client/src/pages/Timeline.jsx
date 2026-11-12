import { Link, useParams } from 'react-router-dom';
import Chart from '../components/Chart.jsx';
import Icon from '../components/Icon.jsx';
import Page, { Loading } from '../components/Page.jsx';
import { fmtDate, num, useLoad } from '../util.js';

export default function Timeline() {
  const { id } = useParams();
  const { data, error } = useLoad(`/exercises/${id}/timeline`);
  if (!data) return <Page title="Timeline" back="/"><Loading error={error} /></Page>;

  const { exercise: x, sessions } = data;
  const isSets = x.type === 'sets';
  const best = (k) => (sessions.length ? Math.max(...sessions.map((s) => s[k])) : null);

  return (
    <Page title={x.name} back="/"
      right={<Link className="iconbtn" to={`/exercise/${x.id}`} aria-label="Edit"><Icon name="edit" /></Link>}>
      {x.description && <p className="muted">{x.description}</p>}

      <div className="card stats">
        {isSets ? (
          <>
            <div><b>{sessions.length ? num(best('weight')) : '–'}</b><span>max kg</span></div>
            <div><b>{sessions.length ? num(best('volume')) : '–'}</b><span>best volume</span></div>
          </>
        ) : (
          <>
            <div><b>{sessions.length ? num(best('duration')) : '–'}</b><span>max min</span></div>
            <div><b>{x.target_duration_min || '–'}</b><span>target min</span></div>
          </>
        )}
        <div><b>{sessions.length}</b><span>sessions</span></div>
      </div>

      {!sessions.length ? (
        <div className="card empty">
          <p>Nothing logged for this exercise yet. Tick sets as done in a workout and they show up here.</p>
          <Link className="btn primary" to="/train">Start training</Link>
        </div>
      ) : (
        <>
          <div className="card"><Chart sessions={sessions} isSets={isSets} /></div>
          <h3 className="section">Timeline</h3>
          <div className="timeline">
            {[...sessions].reverse().map((s, i) => (
              <div className="tl" key={i}>
                <i />
                <div className="card">
                  <div className="row between">
                    <b>{fmtDate(s.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</b>
                    <span className="pill">{isSets ? `${num(s.weight)} kg max` : `${num(s.duration)} min`}</span>
                  </div>
                  {isSets && (
                    <>
                      <div className="chips">{s.sets.map((st, j) => <span className="chip" key={j}>{num(st.weight)} × {st.reps}</span>)}</div>
                      <div className="muted small">{s.sets.length} sets · {s.reps} reps · volume {num(s.volume)} kg</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
