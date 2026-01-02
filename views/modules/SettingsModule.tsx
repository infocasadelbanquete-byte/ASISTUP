import React, { useState } from 'react';
import { GlobalSettings, Role } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface SettingsModuleProps {
  settings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
  role: Role;
}

const SettingsModule: React.FC<SettingsModuleProps> = ({ settings, onUpdate, role }) => {
  const [local, setLocal] = useState<GlobalSettings>({ ...settings, sbu: settings.sbu || 475 });
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = () => {
    if (role !== Role.SUPER_ADMIN) return alert("Permiso denegado.");
    setShowConfirm(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 fade-in">
      <div className="bg-white p-10 rounded-[3rem] shadow-sm border space-y-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Configuración de Sistema 2026</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Parámetros Laborales Nacionales</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-2">
              <label className="text-[11px] font-black text-blue-700 uppercase tracking-widest">Sueldo Básico Unificado (SBU)</label>
              <div className="relative">
                 <span className="absolute left-5 top-4 font-black text-slate-300 text-xl">$</span>
                 <input type="number" step="0.01" className="w-full p-5 pl-10 border-2 rounded-2xl font-black text-2xl focus:border-blue-500 transition-all outline-none" value={local.sbu} onChange={e => setLocal({...local, sbu: Number(e.target.value)})} />
              </div>
              <p className="text-[9px] text-slate-400 font-bold italic uppercase">* Valor proyectado para el año 2026</p>
           </div>
           
           <div className="space-y-2">
              <label className="text-[11px] font-black text-blue-700 uppercase tracking-widest">Aporte Personal IESS (%)</label>
              <div className="relative">
                 <input type="number" step="0.01" className="w-full p-5 border-2 rounded-2xl font-black text-2xl focus:border-blue-500 transition-all outline-none" value={(local.iessRate * 100).toFixed(2)} onChange={e => setLocal({...local, iessRate: Number(e.target.value) / 100})} />
                 <span className="absolute right-5 top-4 font-black text-slate-300 text-xl">%</span>
              </div>
           </div>
        </div>

        <div className="p-6 bg-yellow-50 rounded-[2rem] border border-yellow-100 flex gap-4 items-center">
           <span className="text-3xl">⚠️</span>
           <p className="text-[10px] text-yellow-800 font-bold uppercase leading-relaxed">Advertencia: Modificar estos valores afectará todos los cálculos de nómina, aportes y fondos de reserva de forma inmediata para el período vigente.</p>
        </div>

        <button onClick={handleSave} className="w-full py-5 bg-slate-900 text-white font-black rounded-3xl shadow-xl uppercase text-xs tracking-widest hover:scale-105 transition-transform">Actualizar Parámetros Maestros</button>
      </div>

      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="Confirmar Modificación" type="warning">
        <div className="space-y-4">
           <p className="text-sm font-medium text-slate-600">¿Está seguro de que desea modificar el Sueldo Básico y los porcentajes de aporte? Esta acción quedará registrada en el historial de auditoría del sistema.</p>
           <button onClick={() => { onUpdate(local); setShowConfirm(false); alert("Cambios aplicados."); }} className="w-full py-4 bg-blue-700 text-white font-black rounded-2xl uppercase text-xs">Confirmar y Aplicar</button>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsModule;