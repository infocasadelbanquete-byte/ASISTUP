import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
  
  // Pequeño retardo para asegurar que el primer frame se pinte
  requestAnimationFrame(() => {
    const loader = document.getElementById('initial-loader');
    if (loader) loader.classList.add('hidden');
  });
}