import React, { useState } from 'react';
import { GlobalSettings, Role, SystemUpdateConfig } from '../../types.ts';
import Modal from '../../components/Modal.tsx';
import LZString from 'lz-string';
import { DEFAULT_SYSTEM_UPDATE } from '../../constants.tsx';

interface SettingsModuleProps {
  settings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
  role: Role;
  onPurge?: () => void;
  allData?: any;
}

const defaultSystemUpdate: SystemUpdateConfig = DEFAULT_SYSTEM_UPDATE;

const SettingsModule: React.FC<SettingsModuleProps> = ({ settings, onUpdate, role, onPurge, allData }) => {
  const [local, setLocal] = useState<GlobalSettings>({
    ...settings,
    sbuPrev: settings.sbuPrev || 460.00,
    reserveRate: settings.reserveRate || 0.0833,
    holidays: settings.holidays || [],
    schedule: {
      ...(settings.schedule || {
        monFri: { in1: '08:30', out1: '13:00', in2: '15:00', out2: '18:00' },
        sat: { in: '08:30', out: '13:00' },
        halfDayOff: 'Miércoles tarde'
      })
    },
    systemUpdate: settings.systemUpdate || defaultSystemUpdate
  });

  // Mantener sincronizado el estado local cuando las configuraciones se carguen o cambien
  React.useEffect(() => {
    if (settings) {
      setLocal({
        ...settings,
        sbuPrev: settings.sbuPrev || 460.00,
        reserveRate: settings.reserveRate || 0.0833,
        holidays: settings.holidays || [],
        schedule: {
          ...(settings.schedule || {
            monFri: { in1: '08:30', out1: '13:00', in2: '15:00', out2: '18:00' },
            sat: { in: '08:30', out: '13:00' },
            halfDayOff: 'Miércoles tarde'
          })
        },
        systemUpdate: settings.systemUpdate || defaultSystemUpdate
      });
    }
  }, [settings]);

  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [purgePassword, setPurgePassword] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newChangelogItem, setNewChangelogItem] = useState('');
  const [localDeviceVersion, setLocalDeviceVersion] = useState<string>(() => {
    return localStorage.getItem('asistup_device_version') || 'v3.2.0';
  });

  const [feedback, setFeedback] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info' | 'warning'}>({
    isOpen: false, title: '', message: '', type: 'info'
  });

  const handleAddChangelog = () => {
    if (!newChangelogItem.trim()) return;
    const currentList = local.systemUpdate?.changelog || [];
    setLocal({
      ...local,
      systemUpdate: {
        ...(local.systemUpdate || defaultSystemUpdate),
        changelog: [...currentList, newChangelogItem.trim()]
      }
    });
    setNewChangelogItem('');
  };

  const handleRemoveChangelog = (idx: number) => {
    const currentList = local.systemUpdate?.changelog || [];
    setLocal({
      ...local,
      systemUpdate: {
        ...(local.systemUpdate || defaultSystemUpdate),
        changelog: currentList.filter((_, i) => i !== idx)
      }
    });
  };

  const handleBroadcastUpdate = () => {
    if (role !== Role.SUPER_ADMIN) {
      setFeedback({
        isOpen: true,
        title: "Acceso Denegado",
        message: "Solo el Super Administrador puede emitir actualizaciones para toda la red de terminales.",
        type: "error"
      });
      return;
    }

    const currentConfig = local.systemUpdate || defaultSystemUpdate;
    if (!currentConfig.version.trim()) {
      setFeedback({
        isOpen: true,
        title: "Versión Inválida",
        message: "Debe ingresar un identificador de versión válido (ej. v3.3.0).",
        type: "error"
      });
      return;
    }

    const updatedConfig: SystemUpdateConfig = {
      ...currentConfig,
      publishedAt: new Date().toISOString()
    };

    const newSettings: GlobalSettings = {
      ...local,
      systemUpdate: updatedConfig
    };

    setLocal(newSettings);
    onUpdate(newSettings);

    // Disparar notificación push/desktop local
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(`ACTUALIZACIÓN DIFUNDIDA: ${updatedConfig.version}`, {
          body: `${updatedConfig.title}. Notificación transmitida a todas las terminales conectadas.`,
          icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='none' stroke='%233b82f6' stroke-width='6'/%3E%3C/svg%3E"
        });
      } catch (e) {}
    }

    setFeedback({
      isOpen: true,
      title: "Actualización Difundida a Terminales",
      message: `La versión ${updatedConfig.version} ha sido transmitida exitosamente. Todos los dispositivos y terminales en los que esté instalada la aplicación recibirán la notificación y exigirán la actualización obligatoria al abrir el terminal, antes de que cualquier colaborador realice su marcación.`,
      type: "success"
    });
  };

  const handleUpdateThisDevice = async () => {
    try {
      const targetVersion = local.systemUpdate?.version || 'v3.3.0';
      if ('caches' in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map(k => window.caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.update();
        }
      }
      localStorage.setItem('asistup_device_version', targetVersion);
      setLocalDeviceVersion(targetVersion);
      setFeedback({
        isOpen: true,
        title: "Dispositivo Actualizado",
        message: `Este equipo ha sincronizado su memoria local y Service Worker con la versión ${targetVersion}. Se recargará la interfaz.`,
        type: "success"
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      console.warn("Update device error:", e);
    }
  };

  const handleBackup = () => {
    try {
      if (!allData) {
         setFeedback({ isOpen: true, title: "Error", message: "Sin datos para respaldar.", type: "error" });
         return;
      }
      const dataStr = JSON.stringify(allData);
      const compressed = LZString.compressToEncodedURIComponent(dataStr);
      const blob = new Blob([compressed], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RESPALDO_ASISTUP_${new Date().toISOString().split('T')[0]}.bin`;
      link.click();
      setFeedback({ isOpen: true, title: "Respaldo OK", message: "Archivo de seguridad generado.", type: "success" });
    } catch (e) {
      setFeedback({ isOpen: true, title: "Error", message: "Fallo al generar el respaldo.", type: "error" });
    }
  };

  const handleResetDevice = () => {
    setFeedback({
      isOpen: true,
      title: "Confirmación",
      message: "¿Restablecer configuración de terminal? Se recargará la aplicación.",
      type: "warning"
    });
    localStorage.removeItem('app_mode');
    setTimeout(() => window.location.reload(), 2000);
  };

  const handlePurgeExecution = () => {
    // Clave obligatoria para acciones críticas
    if (purgePassword === 'admin123') {
      onPurge?.();
      setShowPurgeConfirm(false);
      setPurgePassword('');
      setFeedback({ isOpen: true, title: "Limpieza", message: "Base de datos purgada permanentemente.", type: "success" });
    } else {
      setFeedback({ isOpen: true, title: "Error de Seguridad", message: "Contraseña administrativa incorrecta.", type: "error" });
    }
  };

  const handleAddHoliday = () => {
    if (!newHolidayDate) return;
    if (local.holidays.includes(newHolidayDate)) return;
    setLocal({ ...local, holidays: [...local.holidays, newHolidayDate].sort() });
    setNewHolidayDate('');
  };

  const handleRemoveHoliday = (date: string) => {
    setLocal({ ...local, holidays: local.holidays.filter(d => d !== date) });
  };

  const handleSave = () => {
    if (role !== Role.SUPER_ADMIN) {
      setFeedback({ isOpen: true, title: "Acceso Denegado", message: "Solo el Super Administrador tiene autorización para modificar los parámetros maestros del sistema.", type: "error" });
      return;
    }
    onUpdate(local);
    setFeedback({ isOpen: true, title: "Guardado", message: "Parámetros globales institucionales sincronizados.", type: "success" });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 fade-in pb-20">
      <div className="bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-sm border space-y-10">
        <header className="border-b pb-6 flex items-center gap-4">
          <div className="w-10 h-10">
             <svg viewBox="0 0 100 100" className="w-full h-full">
               <circle cx="50" cy="50" r="45" fill="none" stroke="#3b82f6" strokeWidth="6" strokeDasharray="15 5" />
               <circle cx="50" cy="50" r="6" fill="#3b82f6" />
             </svg>
          </div>
          <h2 className="text-2xl font-[900] text-slate-900 uppercase italic">Ajustes del Sistema Maestro</h2>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-3">
              <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest">SBU Año Vigente ($)</label>
              <input type="number" step="0.01" className="w-full p-4 border-2 rounded-2xl font-[950] text-2xl focus:border-blue-500 outline-none" value={local.sbu} onChange={e => setLocal({...local, sbu: Number(e.target.value)})} />
           </div>
           <div className="space-y-3">
              <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest">SBU Año Anterior ($)</label>
              <input type="number" step="0.01" className="w-full p-4 border-2 rounded-2xl font-[950] text-2xl focus:border-blue-500 outline-none" value={local.sbuPrev} onChange={e => setLocal({...local, sbuPrev: Number(e.target.value)})} />
           </div>
           <div className="space-y-3">
              <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Aporte IESS Personal (%)</label>
              <input type="number" step="0.01" className="w-full p-4 border-2 rounded-2xl font-[950] text-2xl focus:border-blue-500 outline-none" value={local.iessRate * 100} onChange={e => setLocal({...local, iessRate: Number(e.target.value) / 100})} />
           </div>
           <div className="space-y-3">
              <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Fondos de Reserva (%)</label>
              <input type="number" step="0.01" className="w-full p-4 border-2 rounded-2xl font-[950] text-2xl focus:border-blue-500 outline-none" value={local.reserveRate * 100} onChange={e => setLocal({...local, reserveRate: Number(e.target.value) / 100})} />
           </div>
        </section>

        <section className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-6">
           <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-4">Horario Laboral Corporativo</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 bg-white rounded-2xl border space-y-4">
                 <p className="text-[10px] font-black text-blue-600 uppercase">Jornada Lunes a Viernes</p>
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                       <label className="text-[8px] font-bold text-slate-400 uppercase">Entrada 1</label>
                       <input type="time" className="w-full p-2 border rounded-lg text-xs font-black" value={local.schedule.monFri.in1} onChange={e => setLocal({...local, schedule: {...local.schedule, monFri: {...local.schedule.monFri, in1: e.target.value}}})} />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[8px] font-bold text-slate-400 uppercase">Salida 1</label>
                       <input type="time" className="w-full p-2 border rounded-lg text-xs font-black" value={local.schedule.monFri.out1} onChange={e => setLocal({...local, schedule: {...local.schedule, monFri: {...local.schedule.monFri, out1: e.target.value}}})} />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[8px] font-bold text-slate-400 uppercase">Entrada 2</label>
                       <input type="time" className="w-full p-2 border rounded-lg text-xs font-black" value={local.schedule.monFri.in2} onChange={e => setLocal({...local, schedule: {...local.schedule, monFri: {...local.schedule.monFri, in2: e.target.value}}})} />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[8px] font-bold text-slate-400 uppercase">Salida 2</label>
                       <input type="time" className="w-full p-2 border rounded-lg text-xs font-black" value={local.schedule.monFri.out2} onChange={e => setLocal({...local, schedule: {...local.schedule, monFri: {...local.schedule.monFri, out2: e.target.value}}})} />
                    </div>
                 </div>
              </div>
              <div className="p-5 bg-white rounded-2xl border space-y-4">
                 <p className="text-[10px] font-black text-blue-600 uppercase">Jornada Sábados</p>
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                       <label className="text-[8px] font-bold text-slate-400 uppercase">Entrada</label>
                       <input type="time" className="w-full p-2 border rounded-lg text-xs font-black" value={local.schedule.sat.in} onChange={e => setLocal({...local, schedule: {...local.schedule, sat: {...local.schedule.sat, in: e.target.value}}})} />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[8px] font-bold text-slate-400 uppercase">Salida</label>
                       <input type="time" className="w-full p-2 border rounded-lg text-xs font-black" value={local.schedule.sat.out} onChange={e => setLocal({...local, schedule: {...local.schedule, sat: {...local.schedule.sat, out: e.target.value}}})} />
                    </div>
                 </div>
                 <div className="pt-2">
                    <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Día de Media Jornada</label>
                    <input type="text" className="w-full p-2 border rounded-lg text-xs font-black uppercase" value={local.schedule.halfDayOff} onChange={e => setLocal({...local, schedule: {...local.schedule, halfDayOff: e.target.value.toUpperCase()}})} />
                 </div>
              </div>
           </div>
        </section>

        <section className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-6">
           <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-4">Gestión de Feriados Institucionales</h3>
           <div className="flex gap-3">
              <input type="date" className="flex-1 p-3 border-2 rounded-xl text-sm font-black" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} />
              <button onClick={handleAddHoliday} className="px-6 py-3 bg-blue-700 text-white font-black rounded-xl text-[10px] uppercase">Agregar</button>
           </div>
           <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scroll">
              {local.holidays.map(d => (
                 <div key={d} className="bg-white border p-2 rounded-lg flex justify-between items-center group">
                    <span className="text-[10px] font-black text-slate-700">{new Date(d + 'T00:00:00').toLocaleDateString()}</span>
                    <button onClick={() => handleRemoveHoliday(d)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                 </div>
              ))}
           </div>
        </section>

        {/* HERRAMIENTA DE CONTROL Y DIFUSIÓN DE ACTUALIZACIONES A TERMINALES */}
        <section className="bg-slate-50 p-8 rounded-[2rem] border border-blue-100 space-y-6">
           <header className="border-b pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                 <div className="flex items-center gap-2">
                    <span className="text-xl">📢</span>
                    <h3 className="text-sm font-[950] text-slate-900 uppercase tracking-tight">
                       Herramienta de Control y Difusión de Actualizaciones a Terminales
                    </h3>
                 </div>
                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Notifica a cada dispositivo instalado y exige actualización obligatoria antes de marcar
                 </p>
              </div>
              <div className="flex items-center gap-2">
                 <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-black text-[9px] uppercase tracking-wider">
                    Versión Oficial: {local.systemUpdate?.version || 'v3.3.0'}
                 </span>
              </div>
           </header>

           {/* Estado del equipo actual y diagnóstico local */}
           <div className="p-5 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                 <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Este Equipo / Dispositivo:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                       localDeviceVersion === (local.systemUpdate?.version || 'v3.3.0')
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700 animate-pulse'
                    }`}>
                       {localDeviceVersion === (local.systemUpdate?.version || 'v3.3.0') ? '✓ Actualizado' : '⚠️ Desactualizado'}
                    </span>
                 </div>
                 <p className="text-[10px] text-slate-600 font-bold uppercase">
                    Versión local: <span className="font-mono font-black text-slate-900">{localDeviceVersion}</span> • Service Worker: <span className="text-emerald-600 font-black">Activo</span>
                 </p>
              </div>
              <button
                 type="button"
                 onClick={handleUpdateThisDevice}
                 className="px-5 py-3 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-black rounded-xl text-[10px] uppercase tracking-wider transition-all border border-slate-200 cursor-pointer active:scale-95"
              >
                 🔄 Forzar Actualización en Este Equipo
              </button>
           </div>

           {/* Parámetros de la Actualización a Difundir */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-blue-700 uppercase tracking-widest">
                    Número de Versión Oficial
                 </label>
                 <input
                    type="text"
                    className="w-full p-3 border-2 rounded-xl text-xs font-black uppercase font-mono focus:border-blue-500 outline-none"
                    value={local.systemUpdate?.version || ''}
                    onChange={e => setLocal({
                       ...local,
                       systemUpdate: {
                          ...(local.systemUpdate || defaultSystemUpdate),
                          version: e.target.value.trim()
                       }
                    })}
                    placeholder="ej. v3.3.0"
                 />
              </div>

              <div className="space-y-1">
                 <label className="text-[9px] font-black text-blue-700 uppercase tracking-widest">
                    Fecha de Entrada en Vigencia
                 </label>
                 <input
                    type="date"
                    className="w-full p-3 border-2 rounded-xl text-xs font-black focus:border-blue-500 outline-none"
                    value={local.systemUpdate?.releaseDate || ''}
                    onChange={e => setLocal({
                       ...local,
                       systemUpdate: {
                          ...(local.systemUpdate || defaultSystemUpdate),
                          releaseDate: e.target.value
                       }
                    })}
                 />
              </div>

              <div className="space-y-1 flex flex-col justify-end">
                 <label className="flex items-center gap-3 p-3 bg-white border-2 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
                    <input
                       type="checkbox"
                       checked={local.systemUpdate?.isMandatory ?? true}
                       onChange={e => setLocal({
                          ...local,
                          systemUpdate: {
                             ...(local.systemUpdate || defaultSystemUpdate),
                             isMandatory: e.target.checked
                          }
                       })}
                       className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <div>
                       <span className="text-[10px] font-black text-slate-900 uppercase block leading-tight">
                          Actualización Obligatoria
                       </span>
                       <span className="text-[8px] font-bold text-slate-400 uppercase">
                          Bloquea marcación previa
                       </span>
                    </div>
                 </label>
              </div>
           </div>

           {/* Título y descripción persuasiva */}
           <div className="space-y-4">
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-blue-700 uppercase tracking-widest">
                    Título del Comunicado de Actualización
                 </label>
                 <input
                    type="text"
                    className="w-full p-3 border-2 rounded-xl text-xs font-black focus:border-blue-500 outline-none"
                    value={local.systemUpdate?.title || ''}
                    onChange={e => setLocal({
                       ...local,
                       systemUpdate: {
                          ...(local.systemUpdate || defaultSystemUpdate),
                          title: e.target.value
                       }
                    })}
                    placeholder="Título visible para los empleados"
                 />
              </div>

              <div className="space-y-1">
                 <label className="text-[9px] font-black text-blue-700 uppercase tracking-widest">
                    Justificación Persuasiva de Cumplimiento Laboral
                 </label>
                 <textarea
                    rows={2}
                    className="w-full p-3 border-2 rounded-xl text-xs font-medium focus:border-blue-500 outline-none"
                    value={local.systemUpdate?.description || ''}
                    onChange={e => setLocal({
                       ...local,
                       systemUpdate: {
                          ...(local.systemUpdate || defaultSystemUpdate),
                          description: e.target.value
                       }
                    })}
                    placeholder="Mensaje explicativo para exigir la actualización..."
                 />
              </div>
           </div>

           {/* Lista de cambios / Mejoras incluidas */}
           <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
                 Novedades y Puntos del Parche (Visibles en Terminal)
              </label>
              <div className="flex gap-2">
                 <input
                    type="text"
                    className="flex-1 p-3 border-2 rounded-xl text-xs font-medium focus:border-blue-500 outline-none"
                    placeholder="Describa una mejora o cambio (ej. Ajuste en cálculo de décimos)..."
                    value={newChangelogItem}
                    onChange={e => setNewChangelogItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddChangelog())}
                 />
                 <button
                    type="button"
                    onClick={handleAddChangelog}
                    className="px-5 py-3 bg-blue-700 hover:bg-blue-800 text-white font-black rounded-xl text-[10px] uppercase tracking-wider cursor-pointer"
                 >
                    Añadir
                 </button>
              </div>

              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scroll">
                 {(local.systemUpdate?.changelog || []).map((item, idx) => (
                    <div key={idx} className="bg-white border p-2.5 rounded-xl flex justify-between items-center group">
                       <span className="text-[10px] font-medium text-slate-700 flex items-center gap-2">
                          <span className="text-emerald-500 font-bold">✓</span> {item}
                       </span>
                       <button
                          type="button"
                          onClick={() => handleRemoveChangelog(idx)}
                          className="text-red-500 hover:text-red-700 opacity-60 hover:opacity-100 text-xs px-2 cursor-pointer"
                       >
                          ✕
                       </button>
                    </div>
                 ))}
              </div>
           </div>

           {/* Botón de Difusión Masiva */}
           <div className="pt-2">
              <button
                 type="button"
                 onClick={handleBroadcastUpdate}
                 className="w-full py-5 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:from-blue-800 hover:to-indigo-800 text-white font-[950] rounded-2xl shadow-xl shadow-blue-500/20 uppercase text-[11px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
              >
                 <span>📢</span>
                 <span>Emitir y Notificar Actualización a Todos los Dispositivos</span>
              </button>
              {local.systemUpdate?.publishedAt && (
                 <p className="text-[8px] text-center text-slate-400 font-bold uppercase tracking-widest mt-2">
                    Última emisión registrada: {new Date(local.systemUpdate.publishedAt).toLocaleString()}
                 </p>
              )}
           </div>
        </section>

        <section className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-6">
           <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-4">Mantenimiento Crítico</h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={handleBackup} className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 transition-all text-left flex items-center gap-4 group">
                 <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl">💾</div>
                 <div>
                    <p className="text-[11px] font-black text-slate-900 uppercase">Respaldo Local</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Exportar Base .bin</p>
                 </div>
              </button>
              <button onClick={handleResetDevice} className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-orange-500 transition-all text-left flex items-center gap-4 group">
                 <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center text-xl">🔄</div>
                 <div>
                    <p className="text-[11px] font-black text-slate-900 uppercase">Reset Terminal</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Configuración local</p>
                 </div>
              </button>
           </div>
           <button onClick={() => setShowPurgeConfirm(true)} className="w-full p-6 bg-red-50 text-red-600 border border-red-100 rounded-2xl hover:bg-red-600 hover:text-white transition-all text-left flex items-center gap-4 group">
              <div className="w-12 h-12 bg-white/50 rounded-xl flex items-center justify-center text-xl">🗑️</div>
              <div>
                 <p className="text-[11px] font-black uppercase">Purga Definitiva</p>
                 <p className="text-[9px] font-bold uppercase mt-1 opacity-70 italic">Eliminación masiva protegida por clave</p>
              </div>
           </button>
        </section>

        <button onClick={handleSave} className="w-full py-6 bg-slate-900 text-white font-[950] rounded-[2rem] shadow-2xl uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all">Sincronizar Parámetros Globales</button>
      </div>

      <Modal isOpen={showPurgeConfirm} onClose={() => { setShowPurgeConfirm(false); setPurgePassword(''); }} title="AUTORIZACIÓN ADMINISTRATIVA" type="error">
         <div className="space-y-8 text-center p-4">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner">🔒</div>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Debe ingresar la contraseña maestra para proceder con la eliminación total de los registros del sistema.</p>
            <input type="password" value={purgePassword} onChange={e => setPurgePassword(e.target.value)} className="w-full p-5 border-2 rounded-2xl text-center text-3xl font-black focus:border-red-600 outline-none" placeholder="••••••••" autoFocus />
            <div className="flex gap-3">
               <button onClick={() => { setShowPurgeConfirm(false); setPurgePassword(''); }} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px]">Cancelar</button>
               <button onClick={handlePurgeExecution} className="flex-1 py-4 bg-red-600 text-white font-black rounded-xl uppercase text-[10px] shadow-xl">Confirmar Purga</button>
            </div>
         </div>
      </Modal>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type as any}>
          <div className="text-center space-y-6 p-4">
              <p className="text-slate-600 font-bold uppercase text-[11px] leading-relaxed">{feedback.message}</p>
              <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest active:scale-95">Aceptar</button>
          </div>
      </Modal>
    </div>
  );
};

export default SettingsModule;
