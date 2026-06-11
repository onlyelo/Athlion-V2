import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export function AppShell() {
  return (
    <div className="app">
      <div className="aurora" aria-hidden="true">
        <span className="a1" /><span className="a2" /><span className="a3" />
      </div>
      <header className="app__header">
        <div className="app__brand">
          <img src="/logo-athlion.png" alt="" />
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
