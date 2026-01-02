
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
  
  // Estados para marcación a destiempo
  const [isDelayedModalOpen, setIsDelayedModalOpen] = useState(false);
  const [delayedData, setDelayedData] = useState({
    pin: '',
    type: 'in' as 'in' | 'out',
    dateTime: new Date().toISOString().slice(0, 16),
    justification: '',
    adminPass: ''
  });

  const handleMark = useCallback((type: 'in' | 'out', customTime?: string) => {
    if (!currentEmployee && !customTime) return;
    
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
      text: `${motivationalText}\n\nMarcado ${customTime ? 'EXTEMPORÁNEO' : ''} de ${type === 'in' ? 'Ingreso' : 'Salida'} registrado.`, 
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
    // Validar Admin Pass (Authorization)
    if (delayedData.adminPass !== 'admin123') {
      alert("ERROR: Clave de autorización administrativa incorrecta.");
      return;
    }

    if (!delayedData.justification.trim()) {
      alert("ERROR: La justificación es obligatoria.");
      return;
    }

    const emp = employees.find(e => e.pin === delayedData.pin && e.status === 'active');
    if (!emp) {
      alert("ERROR: PIN de empleado no encontrado.");
      return;
    }

    handleMark(delayedData.type, new Date(delayedData.dateTime).toISOString());
  };

  const handlePinSubmit = useCallback(() => {
    const employee = employees.find(e => e.pin === pin && e.status === 'active');
    if (employee) {
      setCurrentEmployee(employee);
      setMessage({ text: `Hola ${employee.name}, ¿deseas marcar tu asistencia ahora?`, type: 'info' });
    } else {
      setMessage({ text: 'PIN INCORRECTO. Vuelva a intentarlo.', type: 'error' });
      setPin('');
      setTimeout(() => setMessage(null), 3000);
    }
  }, [pin, employees]);

  useEffect(() => {
    if (pin.length === 6 && !isBlocked && !currentEmployee) {
      handlePinSubmit();
    }
  }, [pin, handlePinSubmit, isBlocked, currentEmployee]);

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
      <div className="absolute top-8 left-8 flex gap-4 no-print">
        <button onClick={onBack} className="text-white/50 hover:text-white uppercase font-black text-[10px] tracking-widest">Panel Administrativo</button>
        <span className="text-white/20">|</span>
        <button onClick={() => setIsDelayedModalOpen(true)} className="text-blue-400 hover:text-white uppercase font-black text-[10px] tracking-widest border-b border-blue-400/30 hover:border-white transition-all">Reportar Marcación Olvidada</button>
      </div>

      <div className="w-full max-w-4xl bg-white rounded-[4rem] shadow-2xl p-16 flex flex-col items-center">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-black text-blue-900 mb-6 uppercase tracking-tighter">{APP_NAME}</h1>
          <Clock />
        </div>

        {isBlocked ? (
          <div className="text-center animate-pulse">
            <h2 className="text-3xl font-black text-blue-900 whitespace-pre-line leading-tight">{message?.text}</h2>
            <p className="mt-8 text-gray-400 font-bold uppercase tracking-[0.2em] text-xs">Sistema bloqueado por seguridad...</p>
          </div>
        ) : currentEmployee ? (
          <div className="text-center w-full max-w-xl">
            <h2 className="text-4xl font-black text-blue-900 mb-10 uppercase tracking-tighter">{currentEmployee.name}</h2>
            <div className="grid grid-cols-2 gap-6">
              <button onClick={() => handleMark('in')} className="py-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl shadow-xl font-black text-2xl uppercase">Marcar Ingreso</button>
              <button onClick={() => handleMark('out')} className="py-10 bg-blue-700 hover:bg-blue-800 text-white rounded-3xl shadow-xl font-black text-2xl uppercase">Marcar Salida</button>
            </div>
            <button onClick={() => { setCurrentEmployee(null); setPin(''); setMessage(null); }} className="mt-10 text-gray-400 font-bold uppercase text-xs">Cancelar</button>
          </div>
        ) : (
          <div className="w-full max-w-md text-center">
            <h3 className="text-xs font-black text-gray-400 mb-8 uppercase tracking-widest">Ingrese su PIN de 6 dígitos</h3>
            <div className="flex gap-4 justify-center mb-12">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`w-12 h-16 border-b-4 flex items-center justify-center text-4xl font-black ${pin.length > i ? 'border-blue-600 text-blue-900' : 'border-gray-100'}`}>{pin[i] ? '•' : ''}</div>
              ))}
            </div>
            {message?.type === 'error' && <p className="mb-8 text-red-500 font-black text-xs uppercase">{message.text}</p>}
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map((btn, idx) => (
                <button 
                  key={idx}
                  onClick={() => {
                    if (btn === 'C') setPin('');
                    else if (btn === '←') setPin(p => p.slice(0, -1));
                    else if (pin.length < 6) setPin(p => p + btn);
                  }}
                  className="h-16 bg-gray-50 hover:bg-blue-600 hover:text-white rounded-2xl text-2xl font-black transition-all"
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
        title="Justificación de Marcación a Destiempo"
        footer={<button onClick={handleDelayedSubmit} className="px-10 py-3 bg-blue-700 text-white font-black rounded-2xl text-xs uppercase shadow-xl tracking-widest">Autorizar y Registrar</button>}
      >
        <div className="space-y-6">
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-blue-800 text-xs font-medium">
             Este registro requiere la clave del Administrador Total para ser validado en el sistema.
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PIN Empleado</label>
              <input 
                type="password" 
                maxLength={6}
                value={delayedData.pin}
                onChange={e => setDelayedData({...delayedData, pin: e.target.value.replace(/\D/g, '')})}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 font-black text-center text-lg tracking-[0.5em]"
                placeholder="••••••"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Marcado</label>
              <select 
                value={delayedData.type}
                onChange={e => setDelayedData({...delayedData, type: e.target.value as 'in' | 'out'})}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 font-bold text-sm"
              >
                <option value="in">INGRESO</option>
                <option value="out">SALIDA</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha y Hora Real</label>
            <input 
              type="datetime-local" 
              value={delayedData.dateTime}
              onChange={e => setDelayedData({...delayedData, dateTime: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 font-bold text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Justificación de la Extemporaneidad</label>
            <textarea 
              value={delayedData.justification}
              onChange={e => setDelayedData({...delayedData, justification: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 font-medium text-sm h-24"
              placeholder="Describa el motivo por el cual no se realizó el marcaje en el tiempo reglamentario..."
            ></textarea>
          </div>

          <div className="pt-4 border-t space-y-1">
            <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">Autorización Administrativa (PIN ADMIN)</label>
            <input 
              type="password" 
              value={delayedData.adminPass}
              onChange={e => setDelayedData({...delayedData, adminPass: e.target.value})}
              className="w-full bg-red-50 border border-red-100 rounded-xl p-3 font-black text-center text-lg tracking-[0.5em] focus:border-red-500 outline-none"
              placeholder="••••••"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AttendanceSystem;
