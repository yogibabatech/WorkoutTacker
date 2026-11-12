import { Link, NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useApp } from '../App.jsx';

const tabs = [
  ['/', 'Home', 'home'],
  ['/train', 'Train', 'play'],
  ['/calendar', 'Calendar', 'cal'],
  ['/routine', 'Routine', 'list'],
];

export function Loading({ error }) {
  return <p className="muted center">{error ? error.message : 'Loading…'}</p>;
}

export default function Page({ title, back, right, nav = true, children }) {
  const { flash } = useApp();
  return (
    <div className="app">
      <header className="top">
        {back && <Link className="iconbtn" to={back} aria-label="Back"><Icon name="back" /></Link>}
        <h1>{title}</h1>
        <div className="top-right">{right}</div>
      </header>
      <main>
        {flash && <div className={`flash ${flash.type === 'err' ? 'err' : ''}`} role="status">{flash.msg}</div>}
        {children}
      </main>
      {nav && (
        <nav className="tabbar">
          {tabs.map(([to, label, ic]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>
              <Icon name={ic} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
