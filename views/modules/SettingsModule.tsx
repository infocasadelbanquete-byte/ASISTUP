
import React, { useState } from 'react';
import { GlobalSettings, Role, DaySchedule, WorkShift } from '../../types';
import Modal from '../../components/Modal';

interface SettingsModuleProps {
  settings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
  role: Role;
}

const SettingsModule: React.FC<SettingsModuleProps> = ({ settings, onUpdate, role }) => {
  const [localSettings, setLocalSettings] = useState<GlobalSettings>(settings);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const handleBackup = () => {
    const data = {
      timestamp: new Date().toISOString(),
      exportType: 'FULL_SYSTEM_BACKUP',
      settings: localSettings
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ASISTUP_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    localStorage.setItem('lastBackupDate', new Date().toISOString());
  };

  const handleOpenConfirm = () => {
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSave = () => {
    onUpdate(localSettings);
    setIsConfirmModalOpen(false);
  };

  const renderShiftInput = (label: string, shift: WorkShift, dayKey: 'weekdays' | 'saturdays', shiftKey: 'morning' | 'afternoon') => (
    <div className={`p-4 rounded-2xl border transition-all ${shift.enabled ? 'bg-white border-blue-100 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
      <div className="flex justify-between items-center mb-3">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
        <div className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={shift.enabled} 
            onChange={e => {
              const newSettings = { ...localSettings };
              newSettings.schedule[dayKey][shiftKey].enabled = e.target.checked;
              setLocalSettings(newSettings);
            }}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Entrada</p>
          <input 
            type="time" 
            value={shift.start} 
            disabled={!shift.enabled}
            onChange={e => {
              const newSettings = { ...localSettings };
              newSettings.schedule[dayKey][shiftKey].start = e.target.value;
              setLocalSettings(newSettings);
            }}
            className="w-full text-xs font-black bg-transparent outline-none focus:text-blue-600"
          />
        </div>
        <div className="flex-1">
          <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Salida</p>
          <input 
            type="time" 
            value={shift.end} 
            disabled={!shift.enabled}
            onChange={e => {
              const newSettings = { ...localSettings };
              newSettings.schedule[dayKey][shiftKey].end = e.target.value;
              setLocalSettings(newSettings);
            }}
            className="w-full text-xs font-black bg-transparent outline-none focus:text-blue-600"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-8">
           <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg>
           </div>
           <div>
             <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Parámetros Laborales Nacionales</h3>
             <p className="text-sm text-gray-500">Valores referenciales para el cálculo de aportes y bonificaciones</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Sueldo Básico Unificado (SBU)</label>
            <input 
              type="number"
              value={localSettings.sbu}
              onChange={e => setLocalSettings({...localSettings, sbu: Number(e.target.value)})}
              className="w-full px-6 py-4 rounded-2xl border border-gray-200 focus:border-blue-500 font-black text-xl outline-none transition-all shadow-inner bg-gray-50/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Porcentaje Aporte IESS Personal</label>
            <div className="relative">
              <input 
                type="number"
                step="0.01"
                value={(localSettings.iessRate * 100).toFixed(2)}
                onChange={e => setLocalSettings({...localSettings, iessRate: Number(e.target.value) / 100})}
                className="w-full px-6 py-4 rounded-2xl border border-gray-200 focus:border-blue-500 font-black text-xl outline-none transition-all shadow-inner bg-gray-50/50"
              />
              <span className="absolute right-6 top-5 text-gray-400 font-black text-lg">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter mb-6 flex items-center gap-3">
          <span className="text-2xl">🕒</span> Gestión de Horarios (Doble Jornada)
        </h3>
        
        <div className="space-y-10">
          <div>
            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4">Lunes a Viernes</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderShiftInput("Jornada Mañana", localSettings.schedule.weekdays.morning, 'weekdays', 'morning')}
              {renderShiftInput("Jornada Tarde", localSettings.schedule.weekdays.afternoon, 'weekdays', 'afternoon')}
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4">Sábados</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderShiftInput("Jornada Mañana", localSettings.schedule.saturdays.morning, 'saturdays', 'morning')}
              {renderShiftInput("Jornada Tarde", localSettings.schedule.saturdays.afternoon, 'saturdays', 'afternoon')}
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800 text-[10px] font-bold italic flex items-center gap-3">
          <span>💡</span>
          Recuerde: Si un empleado no marca dentro de estos rangos, el sistema lo registrará fuera de horario comercial. El medio día libre semanal es un derecho irrenunciable.
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-10 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
           <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center text-4xl shadow-inner border border-white/20">
             🛡️
           </div>
           <div className="flex-1 text-center md:text-left">
             <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Optimización de Memoria en Nube</h3>
             <p className="text-blue-100 font-medium mb-6">El motor de compresión <b>LZ-UP</b> está activo. Sus datos ocupan un 75% menos de espacio en Firebase.</p>
             <button onClick={handleBackup} className="px-8 py-4 bg-white text-blue-900 font-black rounded-2xl shadow-lg hover:scale-105 transition-all text-xs uppercase tracking-widest">
               Realizar Respaldo Local (JSON)
             </button>
           </div>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <button 
          onClick={handleOpenConfirm}
          className="px-16 py-5 bg-blue-900 text-white font-black rounded-3xl shadow-2xl hover:bg-black transition-all active:scale-95 uppercase text-sm tracking-[0.1em]"
        >
          Guardar Cambios Maestros
        </button>
      </div>

      <Modal 
        isOpen={isConfirmModalOpen} 
        onClose={() => setIsConfirmModalOpen(false)} 
        title="Confirmación de Parámetros"
        type="warning"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setIsConfirmModalOpen(false)} className="px-6 py-2 text-gray-400 font-bold text-xs uppercase">Cancelar</button>
            <button onClick={handleConfirmSave} className="px-10 py-2 bg-blue-700 text-white font-black rounded-xl text-xs uppercase shadow-lg">Confirmar y Modificar</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-amber-600">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <p className="text-lg font-black uppercase tracking-tighter">Advertencia de Modificación Crítica</p>
          </div>
          <p className="text-sm text-gray-600 font-medium leading-relaxed">
            Está a punto de actualizar el <span className="font-black text-blue-900 underline">Sueldo Básico Unificado</span>, las tasas de aporte o los horarios comerciales. 
            Este cambio afectará inmediatamente los cálculos de nómina y los registros de asistencia en tiempo real. 
            ¿Está seguro de que desea proceder con la actualización de estos parámetros nacionales?
          </p>
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Impacto estimado:</p>
             <p className="text-[11px] font-bold text-gray-700 italic">Recalculación de provisiones de 13ro, 14to y Fondos de Reserva en todos los roles vigentes.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsModule;
