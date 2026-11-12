import { useState } from 'react';
import { fmtDate } from '../util.js';

const UNITS = { weight: 'kg', reps: 'reps', volume: 'kg', duration: 'min' };
const fmt = (v) => String(Math.round(v * 10) / 10);
const short = (s) => fmtDate(s, { day: 'numeric', month: 'short' });

export default function Chart({ sessions, isSets }) {
  const [metric, setMetric] = useState(isSets ? 'weight' : 'duration');
  const W = 320, H = 170, L = 34, R = 12, T = 14, B = 26;
  const vals = sessions.map((p) => +p[metric]);
  let max = Math.max(...vals), min = Math.min(...vals);
  if (max === min) { max += 1; min = Math.max(0, min - 1); }
  const pad = (max - min) * 0.15;
  max += pad; min = Math.max(0, min - pad);
  const n = sessions.length;
  const x = (i) => (n === 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));

  return (
    <div>
      {isSets && (
        <div className="seg small">
          {[['weight', 'Weight'], ['reps', 'Reps'], ['volume', 'Volume']].map(([k, label]) => (
            <label key={k}>
              <input type="radio" name="metric" checked={metric === k} onChange={() => setMetric(k)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="chartsvg" role="img" aria-label="Progress chart">
        {[0, 1, 2, 3].map((g) => {
          const gv = min + ((max - min) * g) / 3;
          return (
            <g key={g}>
              <line x1={L} x2={W - R} y1={y(gv)} y2={y(gv)} className="grid" />
              <text x={L - 5} y={y(gv) + 3} textAnchor="end" className="ax">{fmt(gv)}</text>
            </g>
          );
        })}
        {n > 1 && <polyline className="line" points={vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />}
        {vals.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="4" className="pt">
            <title>{short(sessions[i].date)}: {fmt(v)} {UNITS[metric]}</title>
          </circle>
        ))}
        <text x={L} y={H - 6} className="ax">{short(sessions[0].date)}</text>
        {n > 1 && <text x={W - R} y={H - 6} textAnchor="end" className="ax">{short(sessions[n - 1].date)}</text>}
      </svg>
    </div>
  );
}
