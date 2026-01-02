
import React, { useState, useEffect, useCallback } from 'react';
import { Employee, AttendanceRecord } from '../types.ts';
import Clock from '../components/Clock.tsx';
import Modal from '../components/Modal.tsx';
import { APP_NAME, MOTIVATIONAL_MESSAGES_START, MOTIVATIONAL_MESSAGES_END } from '../constants.tsx';

interface AttendanceSystemProps {
  employees: Employee[];
  onRegister: (record: AttendanceRecord) => void;
  onBack: () => void;
  onUpdateEmployees: (employees: Employee[]) => void;
}

const AttendanceSystem: React.FC<AttendanceSystemProps> = ({ employees, onRegister, onBack, onUpdateEmployees }) => {
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  
  // Estados para marcación a destiempo (Olvidada)
  const [isDelayedModalOpen, setIsDelayedModalOpen] = useState(false);
  const [delayedData, setDelayedData] = useState({
    pin: '',
    type: 'in' as 'in' | 'out',
    dateTime: new Date().toISOString().slice(0, 16),
    justification: '',
    adminPass: ''
  });

  const handleMark = useCallback((type: 'in' | 'out', customTime?: string) => {
    const targetEmp = currentEmployee || employees.find(e => e.pin === delayedData.pin);
    if (!targetEmp) return;

    const record: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: targetEmp.id,
      timestamp: customTime || new Date().toISOString(),
      type
    };

    onRegister(record);
    
    const messages = type === 'in' ? MOTIVATIONAL_MESSAGES_START : MOTIVATIONAL_MESSAGES_END;
    const motivationalText = messages[Math.floor(Math.random() * messages.length)];
    
    setMessage({ 
      text: `${motivationalText}\n\nMarcado ${customTime ? 'EXTEMPORÁNEO' : ''} de ${type === 'in' ? 'Ingreso' : 'Salida'} registrado con éxito.`, 
      type: 'success' 
    });
    
    setIsBlocked(true);
    setPin('');
    setIsDelayedModalOpen(false);
    
    setTimeout(() => {
      setIsBlocked(false);
      setMessage(null);
      setCurrentEmployee(null);
      setDelayedData({ pin: '', type: 'in', dateTime: new Date().toISOString().slice(0, 16), justification: '', adminPass: '' });
    }, 5000);
  }, [currentEmployee, employees, onRegister, delayedData.pin]);

  const handleDelayedSubmit = () => {
    if (delayedData.adminPass !== 'admin123') {
      alert("ERROR: La clave de autorización administrativa es incorrecta.");
      return;
    }
    if (!delayedData.justification.trim()) {
      alert("ERROR: Debe ingresar una justificación válida para el marcaje a destiempo.");
      return;
    }
    const emp = employees.find(e => e.pin === delayedData.pin && e.status === 'active');
    if (!emp) {
      alert("ERROR: No se encontró un empleado activo con ese PIN.");
      return;
    }

    handleMark(delayedData.type, new Date(delayedData.dateTime).toISOString());
  };

  const handlePinSubmit = useCallback(() => {
    const employee = employees.find(e => e.pin === pin && e.status === 'active');
    if (employee) {
      setCurrentEmployee(employee);
      setMessage({ text: `Hola ${employee.name}, confirme su marcaje:`, type: 'info' });
    } else {
      setMessage({ text: 'PIN INCORRECTO. Intente nuevamente.', type: 'error' });
      setPin('');
      setTimeout(() => setMessage(null), 3000);
    }
  }, [pin, employees]);

  useEffect(() => {
    if (pin.length === 6 && !isBlocked && !currentEmployee) {
      handlePinSubmit();
    }
  }, [pin, handlePinSubmit, isBlocked, currentEmployee]);

  // Soporte de Teclado Físico
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isBlocked || isDelayedModalOpen) return;
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 6) setPin(prev => prev + e.key);
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        setCurrentEmployee(null);
        setPin('');
      } else if (e.key === 'Enter' && currentEmployee) {
         handleMark('in');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isBlocked, currentEmployee, handleMark, isDelayedModalOpen]);

  return (
    <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-8 relative">
      <div className="absolute top-8 left-8 flex gap-4 no-print items-center">
        <button onClick={onBack} className="text-white/40 hover:text-white uppercase font-black text-[10px] tracking-widest transition-all">Panel Administrativo</button>
        <span className="w-1.5 h-1.5 bg-white/20 rounded-full"></span>
        <button onClick={() => setIsDelayedModalOpen(true)} className="text-blue-400 hover:text-white uppercase font-black text-[10px] tracking-widest border-b border-blue-400/20 hover:border-white transition-all">Reportar Marcación Olvidada</button>
      </div>

      <div className="w-full max-w-4xl bg-white/95 backdrop-blur-3xl rounded-[4rem] shadow-2xl p-16 flex flex-col items-center fade-in">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-black text-slate-900 mb-6 uppercase tracking-tighter">{APP_NAME}</h1>
          <Clock />
        </div>

        {isBlocked ? (
          <div className="text-center animate-pulse">
            <h2 className="text-3xl font-black text-blue-900 whitespace-pre-line leading-tight">{message?.text}</h2>
            <p className="mt-8 text-slate-400 font-bold uppercase tracking-[0.2em] text-[9px]">Sincronizando con la nube...</p>
          </div>
        ) : currentEmployee ? (
          <div className="text-center w-full max-w-xl animate-in zoom-in duration-300">
            <h2 className="text-4xl font-black text-slate-900 mb-10 uppercase tracking-tighter">{currentEmployee.name}</h2>
            <div className="grid grid-cols-2 gap-6">
              <button onClick={() => handleMark('in')} className="py-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl shadow-xl font-black text-2xl uppercase transition-all active:scale-95">Marcar Ingreso</button>
              <button onClick={() => handleMark('out')} className="py-10 bg-blue-700 hover:bg-blue-800 text-white rounded-3xl shadow-xl font-black text-2xl uppercase transition-all active:scale-95">Marcar Salida</button>
            </div>
            <button onClick={() => { setCurrentEmployee(null); setPin(''); setMessage(null); }} className="mt-10 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-red-500 transition-colors">Cancelar Operación</button>
          </div>
        ) : (
          <div className="w-full max-w-md text-center">
            <h3 className="text-[10px] font-black text-slate-400 mb-10 uppercase tracking-[0.4em]">Identificación por PIN</h3>
            <div className="flex gap-4 justify-center mb-12">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`w-12 h-16 border-b-4 flex items-center justify-center text-4xl font-black transition-all ${pin.length > i ? 'border-blue-600 text-slate-900 scale-110' : 'border-slate-100'}`}>{pin[i] ? '•' : ''}</div>
              ))}
            </div>
            {message?.type === 'error' && <p className="mb-8 text-red-500 font-black text-[10px] uppercase tracking-widest bg-red-50 py-2 rounded-full">{message.text}</p>}
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map((btn, idx) => (
                <button 
                  key={idx}
                  onClick={() => {
                    if (btn === 'C') setPin('');
                    else if (btn === '←') setPin(p => p.slice(0, -1));
                    else if (pin.length < 6) setPin(p => p + btn);
                  }}
                  className="h-16 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-2xl text-2xl font-black transition-all active:scale-90 shadow-sm"
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isDelayedModalOpen} 
        onClose={() => setIsDelayedModalOpen(false)} 
        title="Justificación de Marcado a Destiempo"
        footer={<button onClick={handleDelayedSubmit} className="px-10 py-3 bg-blue-700 text-white font-black rounded-2xl text-xs uppercase shadow-xl tracking-widest transition-all hover:bg-black">Validar y Registrar</button>}
      >
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-[11px] font-bold uppercase tracking-tight">
             ⚠ Requiere supervisión inmediata del Administrador Total.
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PIN de Empleado</label>
              <input 
                type="password" 
                maxLength={6}
                value={delayedData.pin}
                onChange={e => setDelayedData({...delayedData, pin: e.target.value.replace(/\D/g, '')})}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 font-black text-center text-xl tracking-[0.5em] outline-none focus:border-blue-500 transition-all"
                placeholder="••••••"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Marcado</label>
              <select 
                value={delayedData.type}
                onChange={e => setDelayedData({...delayedData, type: e.target.value as 'in' | 'out'})}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 font-bold text-sm outline-none"
              >
                <option value="in">INGRESO</option>
                <option value="out">SALIDA</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha y Hora Real del Marcaje</label>
            <input 
              type="datetime-local" 
              value={delayedData.dateTime}
              onChange={e => setDelayedData({...delayedData, dateTime: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 font-bold text-sm outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Justificación del Empleado</label>
            <textarea 
              value={delayedData.justification}
              onChange={e => setDelayedData({...delayedData, justification: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 font-medium text-sm h-24 outline-none resize-none focus:border-blue-500"
              placeholder="Describa el motivo detallado de la omisión del marcaje en horario reglamentario..."
            ></textarea>
          </div>

          <div className="pt-4 border-t border-dashed space-y-1">
            <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">Autorización (PIN ADMINISTRADOR TOTAL)</label>
            <input 
              type="password" 
              value={delayedData.adminPass}
              onChange={e => setDelayedData({...delayedData, adminPass: e.target.value})}
              className="w-full bg-red-50 border border-red-100 rounded-xl p-4 font-black text-center text-2xl tracking-[0.5em] focus:border-red-500 outline-none transition-all"
              placeholder="••••••"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AttendanceSystem;
