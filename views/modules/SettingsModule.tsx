
import React, { useState } from 'react';
import { GlobalSettings, Role } from '../../types.ts';
import Modal from '../../components/Modal.tsx';
import LZString from 'lz-string';

interface SettingsModuleProps {
  settings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
  role: Role;
  onPurge?: () => void;
  allData?: any;
}

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
    }
  });

  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [purgePassword, setPurgePassword] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [feedback, setFeedback] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info' | 'warning'}>({
    isOpen: false, title: '', message: '', type: 'info'
  });

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
    if (role !== Role.SUPER_ADMIN) return;
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
