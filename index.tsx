import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  // Quitar el loader después de que React tome el control
  const loader = document.getElementById('initial-loader');
  if (loader) {
    setTimeout(() => {
      loader.classList.add('hidden');
    }, 100);
  }
}