import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const mount = () => {
  const container = document.getElementById('root');
  if (!container) return;

  const root = createRoot(container);
  root.render(<App />);
  
  // Desactivar loader tras renderizado inicial
  setTimeout(() => {
    const loader = document.getElementById('initial-loader');
    if (loader) loader.classList.add('hidden');
  }, 1000);
};

// Registro de Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registrado:', registration);
    }).catch(error => {
      console.log('SW error:', error);
    });
  });
}

// Captura de evento de instalación para permitir "descarga"
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevenir que el navegador muestre automáticamente el prompt
  e.preventDefault();
  // Guardar el evento para dispararlo manualmente cuando el usuario haga clic en un botón de instalación
  (window as any).deferredPrompt = e;
});

if (document.readyState === 'complete') {
  mount();
} else {
  window.addEventListener('load', mount);
}