import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

const pad = (n) => String(n).padStart(2, '0');
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const parseDate = (s) => new Date(s + 'T00:00:00');
export const fmtDate = (s, opts) => parseDate(s).toLocaleDateString(undefined, opts);
export const ymOf = (s) => s.slice(0, 7);
export const shiftMonth = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export const num = (v) => (v === null || v === undefined || v === '' ? '' : String(Math.round(Number(v) * 100) / 100));

/** Load data from the API. Returns { data, error, loading, reload, setData } */
export function useLoad(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(() => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path).then(
      (data) => setState({ data, error: null, loading: false }),
      (error) => setState({ data: null, error, loading: false })
    );
  }, [path]);
  useEffect(load, [load]);
  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) };
}
