import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';

const ITEMS = [
  { to: '/', label: 'Accueil', icon: 'home', end: true },
  { to: '/sleep', label: 'Sommeil', icon: 'moon', end: false },
  { to: '/planning', label: 'Planning', icon: 'calendar', end: false },
  { to: '/nutrition', label: 'Nutrition', icon: 'cup', end: false },
  { to: '/coach', label: 'Coach', icon: 'chat', end: false },
  { to: '/profile', label: 'Profil', icon: 'user', end: false },
] as const;

export function BottomNav() {
  return (
    <nav className="app__nav">
      <div className="nav-bar">
        {ITEMS.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                <Icon name={it.icon} size={22} sw={isActive ? 2.1 : 1.75} />
                <span className="nav-item__label">{it.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
