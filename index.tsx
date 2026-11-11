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

// Registro de Service Worker para PWA con verificación agresiva de actualizaciones
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
      // 1. Comprobación inmediata al cargar
      registration.update().catch(() => {});

      // 2. Detección de nueva versión encontrada
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] Nueva versión disponible en segundo plano. Activando inmediatamente...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });

      // 3. Comprobación periódica automática cada 3 minutos para terminales encendidas de forma continua
      setInterval(() => {
        registration.update().catch(() => {});
      }, 3 * 60 * 1000);
    }).catch(error => {
      console.warn('SW error:', error);
    });

    // 4. Comprobación al reactivar o enfocar la aplicación (cuando el dispositivo se desbloquea)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg) reg.update().catch(() => {});
        });
      }
    });

    // 5. Notificación y recarga cuando el nuevo Service Worker toma el control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] Nuevo Service Worker activado. Difundiendo actualización a la aplicación...');
      if (!(window as any).__asistup_reloading) {
        (window as any).__asistup_reloading = true;
        window.location.reload();
      }
    });
  });
}

// Captura de evento de instalación para permitir "descarga"
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevenir que el navegador muestre automáticamente el prompt
  e.preventDefault();
  // Guardar el evento para dispararlo manualmente
  (window as any).deferredPrompt = e;
  console.log('Evento beforeinstallprompt capturado y listo.');
});

if (document.readyState === 'complete') {
  mount();
} else {
  window.addEventListener('load', mount);
}
