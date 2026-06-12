import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export function AppShell() {
  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__brand-logo">A</span>
          Athlion
        </div>
      </header>
      <main className="app__main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
