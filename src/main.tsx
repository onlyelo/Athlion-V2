import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/athlion-tokens.css';
import './styles/global.css';
import { App } from './App';
import { ThemeProvider } from './contexts/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
