import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// En entorno de desarrollo / vista previa, desregistrar Service Workers antiguos
if (import.meta.env.DEV && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(<App />);

