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

if (document.readyState === 'complete') {
  mount();
} else {
  window.addEventListener('load', mount);
}