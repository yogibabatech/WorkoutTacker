import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api.js';
import Auth from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import Train from './pages/Train.jsx';
import Workout from './pages/Workout.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import Routine from './pages/Routine.jsx';
import Training from './pages/Training.jsx';
import ExerciseForm from './pages/ExerciseForm.jsx';
import Timeline from './pages/Timeline.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [flash, setFlash] = useState(null);
  const timer = useRef();

  const notify = useCallback((msg, type = 'ok') => {
    setFlash({ msg, type });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(null), 4000);
  }, []);

  useEffect(() => {
    api('/me').then(setUser, () => setUser(null));
  }, []);

  if (user === undefined) return <p className="muted center" style={{ padding: 40 }}>Loading…</p>;

  const guard = (el) => (user ? el : <Navigate to="/auth" replace />);

  return (
    <Ctx.Provider value={{ user, setUser, flash, notify }}>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
        <Route path="/" element={guard(<Home />)} />
        <Route path="/train" element={guard(<Train />)} />
        <Route path="/workout/:id" element={guard(<Workout />)} />
        <Route path="/calendar" element={guard(<CalendarPage />)} />
        <Route path="/routine" element={guard(<Routine />)} />
        <Route path="/training/:id" element={guard(<Training />)} />
        <Route path="/exercise/new" element={guard(<ExerciseForm />)} />
        <Route path="/exercise/:id" element={guard(<ExerciseForm />)} />
        <Route path="/timeline/:id" element={guard(<Timeline />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Ctx.Provider>
  );
}
