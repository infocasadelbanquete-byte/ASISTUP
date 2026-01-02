import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const mount = () => {
  const container = document.getElementById('root');
  if (!container) return;

  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    
    // Ocultar loader con un delay seguro para permitir que Firebase conecte
    setTimeout(() => {
      const loader = document.getElementById('initial-loader');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.classList.add('hidden'), 500);
      }
    }, 1500);
  } catch (err) {
    console.error('Fallo en el arranque:', err);
    const errorDisplay = document.getElementById('error-display');
    if (errorDisplay) {
      errorDisplay.innerText = "Fallo de renderizado: " + (err instanceof Error ? err.message : 'Conflicto de módulos');
      errorDisplay.classList.remove('hidden');
    }
  }
};

if (document.readyState === 'complete') {
  mount();
} else {
  window.addEventListener('load', mount);
}