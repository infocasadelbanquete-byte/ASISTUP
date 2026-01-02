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
    
    // Ocultar loader una vez que React tome el control
    const hideLoader = () => {
      const loader = document.getElementById('initial-loader');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.classList.add('hidden'), 500);
      }
    };

    // Forzar desaparición del loader tras 2 segundos para asegurar visibilidad
    setTimeout(hideLoader, 2000);
    
  } catch (err) {
    console.error('Fallo de Montaje ASIST UP:', err);
    const errorDisplay = document.getElementById('error-display');
    if (errorDisplay) {
      errorDisplay.innerText = "Error de inicialización. Refresque la página.";
      errorDisplay.classList.remove('hidden');
    }
  }
};

if (document.readyState === 'complete') {
  mount();
} else {
  window.addEventListener('load', mount);
}