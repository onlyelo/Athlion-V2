import { NavLink } from 'react-router-dom';

const ITEMS = [
  { to: '/', label: 'Accueil', icon: '◎', end: true },
  { to: '/sleep', label: 'Sommeil', icon: '☾' },
  { to: '/planning', label: 'Planning', icon: '◷' },
  { to: '/nutrition', label: 'Nutrition', icon: '◍' },
  { to: '/coach', label: 'Coach', icon: '✦' },
  { to: '/profile', label: 'Profil', icon: '◐' },
];

export function BottomNav() {
  return (
    <nav className="app__nav">
      <div className="nav-bar">
        {ITEMS.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            <span className="nav-item__icon">{it.icon}</span>
            <span className="nav-item__label">{it.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
