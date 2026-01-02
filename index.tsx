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
    
    // Ocultar loader con un delay que permita a Firebase estabilizar la conexión
    setTimeout(() => {
      const loader = document.getElementById('initial-loader');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.classList.add('hidden'), 800);
      }
    }, 2000);
    
  } catch (err) {
    console.error('Fallo Crítico ASIST UP:', err);
    const errorDisplay = document.getElementById('error-display');
    if (errorDisplay) {
      errorDisplay.innerText = "Error de renderizado: " + (err instanceof Error ? err.message : 'Conflicto de módulos');
      errorDisplay.classList.remove('hidden');
    }
  }
};

if (document.readyState === 'complete') {
  mount();
} else {
  window.addEventListener('load', mount);
}