
import React, { useState, useEffect, useCallback } from 'react';
import { Employee, AttendanceRecord } from '../types.ts';
import Clock from '../components/Clock.tsx';
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

  const handleMark = useCallback((type: 'in' | 'out') => {
    if (!currentEmployee) return;

    const record: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: currentEmployee.id,
      timestamp: new Date().toISOString(),
      type
    };

    onRegister(record);
    
    const messages = type === 'in' ? MOTIVATIONAL_MESSAGES_START : MOTIVATIONAL_MESSAGES_END;
    const motivationalText = messages[Math.floor(Math.random() * messages.length)];
    
    setMessage({ 
      text: `${motivationalText}\n\nMarcado de ${type === 'in' ? 'Ingreso' : 'Salida'} registrado correctamente.`, 
      type: 'success' 
    });
    
    setIsBlocked(true);
    setPin('');
    
    setTimeout(() => {
      setIsBlocked(false);
      setMessage(null);
      setCurrentEmployee(null);
    }, 5000);
  }, [currentEmployee, onRegister]);

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
      if (isBlocked) return;
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 6) setPin(prev => prev + e.key);
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isBlocked]);

  return (
    <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-8">
      <button onClick={onBack} className="absolute top-8 left-8 text-white/50 hover:text-white uppercase font-black text-[10px] tracking-widest no-print">Panel Administrativo</button>

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
    </div>
  );
};

export default AttendanceSystem;
