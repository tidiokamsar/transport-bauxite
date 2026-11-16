import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { rechargerApresEchecModule } from './lib/rechargementModule';
import './index.css';

// Un onglet ouvert avant un deploiement peut demander un fichier de l'ancienne
// version : la page est rechargee une fois pour prendre la version servie.
window.addEventListener('vite:preloadError', (evenement) => {
  if (rechargerApresEchecModule(window.sessionStorage, Date.now(), () => window.location.reload())) {
    evenement.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
