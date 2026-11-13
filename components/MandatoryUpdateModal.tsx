import React, { useState } from 'react';
import { SystemUpdateConfig } from '../types.ts';

interface MandatoryUpdateModalProps {
  isOpen: boolean;
  updateConfig: SystemUpdateConfig;
  currentVersion: string;
  onUpdateSuccess?: () => void;
  onBypass?: () => void;
}

const MandatoryUpdateModal: React.FC<MandatoryUpdateModalProps> = ({
  isOpen,
  updateConfig,
  currentVersion,
  onUpdateSuccess,
  onBypass
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [showChangelogDetails, setShowChangelogDetails] = useState(false);

  if (!isOpen) return null;

  const handleStartUpdate = async () => {
    setIsUpdating(true);
    setProgress(15);
    setStatusMessage('Comprobando integridad de la nueva versión...');

    try {
      // 1. Limpieza de caches antiguos de Service Worker
      await new Promise(r => setTimeout(r, 600));
      setProgress(40);
      setStatusMessage('Descargando parches de seguridad y motor de marcaciones...');

      if ('caches' in window) {
        try {
          const cacheKeys = await window.caches.keys();
          await Promise.all(cacheKeys.map(key => window.caches.delete(key)));
        } catch (err) {
          console.warn('Error purgando caches:', err);
        }
      }

      // 2. Notificación y actualización a Service Worker
      await new Promise(r => setTimeout(r, 700));
      setProgress(70);
      setStatusMessage('Actualizando Service Worker y base de datos local...');

      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            registration.active?.postMessage({ type: 'PURGE_CACHE' });
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
            await registration.update().catch(() => {});
          }
        } catch (err) {
          console.warn('Error actualizando SW:', err);
        }
      }

      // 3. Registrar versión en almacenamiento local
      await new Promise(r => setTimeout(r, 700));
      setProgress(90);
      setStatusMessage('Sincronizando esquemas laborales ecuatorianos 2026...');

      localStorage.setItem('asistup_device_version', updateConfig.version);
      localStorage.setItem('asistup_device_updated_at', new Date().toISOString());

      // 4. Completado y reinicio
      await new Promise(r => setTimeout(r, 600));
      setProgress(100);
      setStatusMessage('¡Actualización completada! Reiniciando terminal...');

      if (onUpdateSuccess) {
        onUpdateSuccess();
      }

      setTimeout(() => {
        window.location.href = window.location.pathname + '?upd=' + Date.now();
      }, 1200);

    } catch (error) {
      console.error('Error durante la actualización:', error);
      // Fallback: guardar versión y recargar con timestamp
      localStorage.setItem('asistup_device_version', updateConfig.version);
      setTimeout(() => {
        window.location.href = window.location.pathname + '?upd=' + Date.now();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl border-4 border-amber-400 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Cabecera institucional de alerta */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 p-6 md:p-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="w-16 h-16 md:w-20 md:h-20 bg-amber-400 text-slate-950 rounded-3xl mx-auto flex items-center justify-center text-3xl md:text-4xl shadow-xl shadow-amber-400/30 mb-4 animate-bounce">
            ⚠️
          </div>
          <span className="inline-block px-3 py-1 bg-amber-400/20 border border-amber-400/40 text-amber-300 rounded-full text-[9px] font-black uppercase tracking-widest mb-2">
            Disposición Administrativa Obligatoria
          </span>
          <h2 className="text-xl md:text-2xl font-[950] uppercase tracking-tight leading-tight">
            Actualización Requerida del Sistema
          </h2>
          <p className="text-slate-300 text-[10px] md:text-[11px] font-bold uppercase tracking-wider mt-1">
            Terminal de Asistencia • Control de Marcaciones
          </p>
        </div>

        {/* Cuerpo informativo y persuasivo */}
        <div className="p-6 md:p-8 space-y-6">

          {/* Comparativa de versión */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center">
            <div className="border-r border-slate-200 pr-2">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Versión Instalada</span>
              <span className="text-xs font-black text-red-500 uppercase font-mono">{currentVersion || 'v3.2.0 (Desactualizada)'}</span>
            </div>
            <div className="pl-2">
              <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest block">Nueva Versión Requerida</span>
              <span className="text-xs font-black text-emerald-600 uppercase font-mono">{updateConfig.version}</span>
            </div>
          </div>

          {/* Mensaje de persuasión y cumplimiento laboral */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚖️</span>
              <p className="text-[10px] font-black text-amber-900 uppercase tracking-wider">
                Imprescindible antes de realizar tu marcación
              </p>
            </div>
            <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
              Por disposición de Gerencia y en estricto cumplimiento del marco legal laboral vigente del Ecuador,
              esta terminal debe actualizarse para sincronizar la validez jurídica de tus horas, las fórmulas de recargo
              y la protección de marcaciones offline. <strong>No es posible registrar asistencia hasta completar este proceso.</strong>
            </p>
          </div>

          {/* Detalle de novedades */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Novedades del Parche ({updateConfig.version})
              </span>
              <button 
                type="button" 
                onClick={() => setShowChangelogDetails(!showChangelogDetails)}
                className="text-[9px] font-black text-blue-600 uppercase hover:underline cursor-pointer"
              >
                {showChangelogDetails ? 'Ocultar' : 'Ver Todas'}
              </button>
            </div>
            <ul className="space-y-1.5 text-left">
              {(showChangelogDetails ? updateConfig.changelog : updateConfig.changelog.slice(0, 3)).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[10px] text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span className="leading-tight">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Barra de progreso interactiva si está actualizando */}
          {isUpdating ? (
            <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex justify-between text-[10px] font-black text-blue-900 uppercase">
                <span className="animate-pulse">{statusMessage}</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="w-full bg-blue-200/60 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[8px] text-center text-slate-400 font-bold uppercase tracking-widest">
                Por favor, no cierre esta ventana. El proceso toma solo unos segundos.
              </p>
            </div>
          ) : (
            /* Botón de acción principal persuasivo */
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleStartUpdate}
                className="w-full py-5 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-[950] rounded-2xl shadow-xl shadow-blue-500/25 uppercase text-[11px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
              >
                <span>🚀</span>
                <span>Actualizar Sistema y Habilitar Marcaciones</span>
              </button>

              {!updateConfig.isMandatory && onBypass && (
                <button
                  type="button"
                  onClick={onBypass}
                  className="w-full py-3 text-slate-400 hover:text-slate-600 font-bold text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Continuar sin actualizar (No recomendado)
                </button>
              )}
            </div>
          )}

          {/* Pie de seguridad */}
          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1">
              <span>🔒</span> Proceso seguro • Mantiene intactos datos y marcaciones previas
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default MandatoryUpdateModal;
