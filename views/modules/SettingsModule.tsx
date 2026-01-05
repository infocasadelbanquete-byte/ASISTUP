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
  const [local, setLocal] = useState<GlobalSettings>({ ...settings });
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info'}>({
    isOpen: false, title: '', message: '', type: 'info'
  });

  const handleBackup = () => {
    try {
      if (!allData) return;
      const dataStr = JSON.stringify(allData);
      const compressed = LZString.compressToEncodedURIComponent(dataStr);
      const blob = new Blob([compressed], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Respaldo_ASISTUP_${new Date().getMonth() + 1}_${new Date().getFullYear()}.zip`;
      link.click();
      setFeedback({ isOpen: true, title: "Respaldo Generado", message: "El archivo de respaldo comprimido (.zip) se ha descargado con éxito.", type: "success" });
    } catch (e) {
      setFeedback({ isOpen: true, title: "Error", message: "No se pudo generar el respaldo.", type: "error" });
    }
  };

  const handleSave = () => {
    if (role !== Role.SUPER_ADMIN) {
        setFeedback({ isOpen: true, title: "Acceso Denegado", message: "Solo el Super Administrador puede modificar los parámetros maestros.", type: "error" });
        return;
    }
    onUpdate(local);
    setFeedback({ isOpen: true, title: "Sincronizado", message: "Parámetros globales actualizados correctamente.", type: "success" });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 fade-in pb-20">
      <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border space-y-12">
        <header className="border-b pb-6">
          <h2 className="text-3xl font-[900] text-slate-900 tracking-tighter uppercase italic">Configuración Maestra 2026</h2>
        </header>

        <section className="grid grid-cols-2 gap-10">
           <div className="space-y-4">
              <label className="text-[11px] font-black text-blue-700 uppercase tracking-widest">Sueldo Básico Unificado (SBU)</label>
              <input type="number" step="0.01" className="w-full p-6 border-2 rounded-3xl font-[950] text-3xl focus:border-blue-500 outline-none transition-all" value={local.sbu} onChange={e => setLocal({...local, sbu: Number(e.target.value)})} />
           </div>
           <div className="space-y-4">
              <label className="text-[11px] font-black text-blue-700 uppercase tracking-widest">Aporte IESS (%)</label>
              <input type="number" step="0.01" className="w-full p-6 border-2 rounded-3xl font-[950] text-3xl focus:border-blue-500 outline-none transition-all" value={(local.iessRate * 100).toFixed(2)} onChange={e => setLocal({...local, iessRate: Number(e.target.value) / 100})} />
           </div>
        </section>

        {/* Sección de Horario Laboral */}
        <section className="p-10 bg-slate-50 rounded-[3rem] border border-slate-200 space-y-8">
           <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Jornada Laboral y Horarios de Marcación</h3>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[9px] font-black uppercase">Vigente</span>
           </div>
           
           <div className="space-y-6">
              <div className="space-y-4">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lunes a Viernes</p>
                 <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Entrada AM</p>
                      <input type="time" className="w-full p-3 border-2 rounded-xl text-xs font-black" value={local.schedule.monFri.in1} onChange={e => setLocal({...local, schedule: {...local.schedule, monFri: {...local.schedule.monFri, in1: e.target.value}}})} />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Salida AM</p>
                      <input type="time" className="w-full p-3 border-2 rounded-xl text-xs font-black" value={local.schedule.monFri.out1} onChange={e => setLocal({...local, schedule: {...local.schedule, monFri: {...local.schedule.monFri, out1: e.target.value}}})} />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Entrada PM</p>
                      <input type="time" className="w-full p-3 border-2 rounded-xl text-xs font-black" value={local.schedule.monFri.in2} onChange={e => setLocal({...local, schedule: {...local.schedule, monFri: {...local.schedule.monFri, in2: e.target.value}}})} />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Salida PM</p>
                      <input type="time" className="w-full p-3 border-2 rounded-xl text-xs font-black" value={local.schedule.monFri.out2} onChange={e => setLocal({...local, schedule: {...local.schedule, monFri: {...local.schedule.monFri, out2: e.target.value}}})} />
                    </div>
                 </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sábados</p>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Entrada</p>
                      <input type="time" className="w-full p-3 border-2 rounded-xl text-xs font-black" value={local.schedule.sat.in} onChange={e => setLocal({...local, schedule: {...local.schedule, sat: {...local.schedule.sat, in: e.target.value}}})} />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Salida</p>
                      <input type="time" className="w-full p-3 border-2 rounded-xl text-xs font-black" value={local.schedule.sat.out} onChange={e => setLocal({...local, schedule: {...local.schedule, sat: {...local.schedule.sat, out: e.target.value}}})} />
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* Sección de Respaldo y Mantenimiento */}
        {role === Role.SUPER_ADMIN && (
          <section className="p-10 border-2 border-dashed border-slate-200 rounded-[3rem] bg-slate-50 space-y-8">
             <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Seguridad y Purga de Datos</h3>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <button onClick={handleBackup} className="flex flex-col items-center gap-4 p-8 bg-white border rounded-3xl hover:border-blue-500 transition-all group">
                   <span className="text-4xl group-hover:scale-110 transition-transform">📦</span>
                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:text-blue-600">Respaldo Mensual (.zip)</span>
                </button>
                <button onClick={() => setShowPurgeConfirm(true)} className="flex flex-col items-center gap-4 p-8 bg-white border rounded-3xl hover:border-red-500 transition-all group">
                   <span className="text-4xl group-hover:scale-110 transition-transform">🧹</span>
                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:text-red-600">Reiniciar Base de Datos</span>
                </button>
             </div>
          </section>
        )}

        <button onClick={handleSave} className="w-full py-6 bg-slate-900 text-white font-[900] rounded-[2.5rem] shadow-2xl uppercase text-xs tracking-[0.3em] hover:scale-[1.02] transition-all">Sincronizar Parámetros Maestros</button>
      </div>

      <Modal isOpen={showPurgeConfirm} onClose={() => setShowPurgeConfirm(false)} title="REINICIO DE SISTEMA" type="error">
         <div className="space-y-6 text-center">
            <p className="text-xs font-black text-red-600 uppercase tracking-tighter italic">ADVERTENCIA: Acción Irreversible</p>
            <p className="text-[11px] text-slate-500 font-medium">Se borrará personal, pagos y asistencia. Solo la configuración institucional permanecerá.</p>
            <div className="flex gap-3">
               <button onClick={() => setShowPurgeConfirm(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[9px]">Cancelar</button>
               <button onClick={() => { onPurge?.(); setShowPurgeConfirm(false); setFeedback({isOpen: true, title: "Purga Completa", message: "Sistema reiniciado con éxito.", type: "success"}); }} className="flex-1 py-4 bg-red-600 text-white font-black rounded-xl uppercase text-[9px] shadow-lg">Confirmar Limpieza</button>
            </div>
         </div>
      </Modal>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
          <div className="text-center space-y-6">
              <p className="text-slate-600 font-bold uppercase text-[12px]">{feedback.message}</p>
              <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest">Aceptar</button>
          </div>
      </Modal>
    </div>
  );
};

export default SettingsModule;