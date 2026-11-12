import { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import Page from '../components/Page.jsx';
import { todayStr } from '../util.js';

export default function Auth() {
  const { setUser, notify } = useApp();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const u = await api(signup ? '/auth/signup' : '/auth/login', {
        method: 'POST', body: { username, password, today: todayStr() },
      });
      if (signup) notify('Welcome! Start by building your routine.');
      setUser(u);
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  }

  return (
    <Page title={signup ? 'Sign up' : 'Log in'} nav={false}>
      <div className="auth">
        <div className="logo"><img src="/icon.svg" alt="" width="72" height="72" /></div>
        <h2>{signup ? 'Create your account' : 'Welcome back'}</h2>
        <p className="muted center">
          {signup ? 'Pick a username and password. No email or OTP needed.' : 'Log in to continue your training.'}
        </p>
        {err && <div className="flash err">{err}</div>}
        <form className="card stack" onSubmit={submit}>
          <label>Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
              autoCapitalize="none" maxLength={30} required autoFocus />
          </label>
          <label>Password
            <span className="pw">
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={signup ? 'new-password' : 'current-password'} required />
              <button type="button" className="link" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          <button className="btn primary block" disabled={busy}>{signup ? 'Sign up' : 'Log in'}</button>
        </form>
        <p className="center">
          {signup ? 'Already have an account? ' : 'New here? '}
          <button type="button" className="link" onClick={() => { setMode(signup ? 'login' : 'signup'); setErr(''); }}>
            {signup ? 'Log in' : 'Create an account'}
          </button>
        </p>
      </div>
    </Page>
  );
}
