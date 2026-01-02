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
    
    // Ocultar loader una vez React tome el control
    setTimeout(() => {
      const loader = document.getElementById('initial-loader');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.classList.add('hidden'), 500);
      }
    }, 800);
  } catch (err) {
    console.error('Error crítico de montaje:', err);
    const errorDisplay = document.getElementById('error-display');
    if (errorDisplay) {
      errorDisplay.innerText = "Error de Renderizado: " + (err instanceof Error ? err.message : 'Fallo en React');
      errorDisplay.classList.remove('hidden');
    }
  }
};

// Iniciar lo más pronto posible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}