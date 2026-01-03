import React, { useState } from 'react';
import { GlobalSettings, Role } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface SettingsModuleProps {
  settings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
  role: Role;
}

const SettingsModule: React.FC<SettingsModuleProps> = ({ settings, onUpdate, role }) => {
  const [local, setLocal] = useState<GlobalSettings>({ ...settings });
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = () => {
    if (role !== Role.SUPER_ADMIN) return alert("Acceso restringido solo para Super Administrador.");
    setShowConfirm(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 fade-in">
      <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border space-y-12">
        <header className="border-b pb-6">
          <h2 className="text-3xl font-[900] text-slate-900 tracking-tighter uppercase italic">Configuración Maestra 2026</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-2">Marco Legal, Sueldos y Jornadas Laborales</p>
        </header>

        <section className="grid grid-cols-2 gap-10">
           <div className="space-y-4">
              <label className="text-[11px] font-black text-blue-700 uppercase tracking-widest">Sueldo Básico Unificado (2026)</label>
              <div className="relative group">
                 <span className="absolute left-6 top-5 font-black text-slate-300 text-2xl group-focus-within:text-blue-500 transition-colors">$</span>
                 <input type="number" step="0.01" className="w-full p-6 pl-12 border-2 rounded-3xl font-[950] text-3xl focus:border-blue-500 outline-none transition-all" value={local.sbu} onChange={e => setLocal({...local, sbu: Number(e.target.value)})} />
              </div>
              <p className="text-[9px] text-slate-400 font-bold uppercase italic">Fijado por decreto para el ejercicio fiscal 2026.</p>
           </div>
           <div className="space-y-4">
              <label className="text-[11px] font-black text-blue-700 uppercase tracking-widest">Aporte Personal IESS (%)</label>
              <div className="relative group">
                 <input type="number" step="0.01" className="w-full p-6 border-2 rounded-3xl font-[950] text-3xl focus:border-blue-500 outline-none transition-all" value={(local.iessRate * 100).toFixed(2)} onChange={e => setLocal({...local, iessRate: Number(e.target.value) / 100})} />
                 <span className="absolute right-6 top-5 font-black text-slate-300 text-2xl group-focus-within:text-blue-500 transition-colors">%</span>
              </div>
           </div>
        </section>

        <section className="p-10 bg-slate-50 rounded-[3rem] border border-slate-200 space-y-8">
           <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Horario Comercial y Jornada Laboral</h3>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[9px] font-black uppercase">Vigente 2026</span>
           </div>
           <div className="space-y-6">
              <div className="space-y-3">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lunes a Viernes (Jornada Doble)</p>
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
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sábados</p>
                   <div className="flex items-center gap-3">
                      <input type="time" className="w-full p-3 border-2 rounded-xl text-xs font-black" value={local.schedule.sat.in} onChange={e => setLocal({...local, schedule: {...local.schedule, sat: {...local.schedule.sat, in: e.target.value}}})} />
                      <span className="font-black text-slate-300">-</span>
                      <input type="time" className="w-full p-3 border-2 rounded-xl text-xs font-black" value={local.schedule.sat.out} onChange={e => setLocal({...local, schedule: {...local.schedule, sat: {...local.schedule.sat, out: e.target.value}}})} />
                   </div>
                </div>
                <div className="space-y-3">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medio día libre configurable</p>
                   <input type="text" className="w-full p-3 border-2 rounded-xl text-xs font-black uppercase text-blue-600 bg-white" value={local.schedule.halfDayOff} onChange={e => setLocal({...local, schedule: {...local.schedule, halfDayOff: e.target.value}})} />
                   <p className="text-[8px] text-slate-400 font-bold uppercase italic leading-none">Ej: Miércoles en la tarde</p>
                </div>
              </div>
           </div>
        </section>

        <div className="flex items-center gap-5 p-6 bg-red-50 text-red-800 rounded-3xl border-2 border-red-100 italic font-black text-[11px] uppercase shadow-inner">
           <span className="text-3xl">⚠️</span>
           <span>Advertencia Crítica: Cualquier modificación a estos parámetros afectará los cálculos de nómina, aportes patronales y fondos de reserva de forma global e inmediata.</span>
        </div>

        <button onClick={handleSave} className="w-full py-6 bg-slate-900 text-white font-[900] rounded-[2.5rem] shadow-2xl uppercase text-xs tracking-[0.3em] hover:scale-[1.02] transition-all hover:bg-black">Actualizar Parámetros Maestros</button>
      </div>

      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="Autorización de Cambio de Sistema" type="warning">
         <div className="space-y-6 text-center">
            <p className="text-sm font-medium text-slate-600 leading-relaxed italic">"Al confirmar, se re-calibrarán los sueldos y jornadas de todos los colaboradores según el nuevo marco legal decretado."</p>
            <button onClick={() => { onUpdate(local); setShowConfirm(false); alert("Ecosistema de talento actualizado con los nuevos parámetros."); }} className="w-full py-5 bg-blue-700 text-white font-black rounded-2xl uppercase text-xs shadow-xl tracking-widest active:scale-95 transition-all">Confirmar y Aplicar Cambios</button>
         </div>
      </Modal>
    </div>
  );
};

export default SettingsModule;