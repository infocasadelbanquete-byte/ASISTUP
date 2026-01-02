
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
  const [status, setStatus] = useState<'idle' | 'confirm' | 'success' | 'error'>('idle');
  const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);
  const [motivationalMsg, setMotivationalMsg] = useState('');

  const handleMark = (type: 'in' | 'out') => {
    if (!currentEmp) return;

    const record: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: currentEmp.id,
      timestamp: new Date().toISOString(),
      type
    };

    onRegister(record);
    
    const msgs = type === 'in' ? MOTIVATIONAL_MESSAGES_START : MOTIVATIONAL_MESSAGES_END;
    setMotivationalMsg(msgs[Math.floor(Math.random() * msgs.length)]);
    setStatus('success');
    setPin('');

    // Bloqueo de 5 segundos
    setTimeout(() => {
      setStatus('idle');
      setCurrentEmp(null);
    }, 5000);
  };

  useEffect(() => {
    if (pin.length === 6 && status === 'idle') {
      const emp = employees.find(e => e.pin === pin && e.status === 'active');
      if (emp) {
        setCurrentEmp(emp);
        setStatus('confirm');
      } else {
        setStatus('error');
        setTimeout(() => { setStatus('idle'); setPin(''); }, 2000);
      }
    }
  }, [pin, employees, status]);

  // Teclado Físico
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (status !== 'idle') return;
      if (e.key >= '0' && e.key <= '9' && pin.length < 6) setPin(p => p + e.key);
      if (e.key === 'Backspace') setPin(p => p.slice(0, -1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [pin, status]);

  return (
    <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-4xl bg-white/95 backdrop-blur-3xl rounded-[4rem] shadow-2xl p-16 flex flex-col items-center fade-in">
        <h1 className="text-4xl font-black text-slate-900 mb-8 tracking-tighter uppercase">{APP_NAME}</h1>
        <div className="mb-12"><Clock /></div>

        {status === 'idle' && (
          <div className="w-full max-w-md text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-10">Ingrese su PIN de 6 dígitos</p>
            <div className="flex gap-4 justify-center mb-12">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`w-12 h-16 border-b-4 flex items-center justify-center text-4xl font-black transition-all ${pin.length > i ? 'border-blue-600 text-slate-900' : 'border-slate-100'}`}>
                  {pin[i] ? '•' : ''}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map(btn => (
                <button 
                  key={btn}
                  onClick={() => {
                    if (btn === 'C') setPin('');
                    else if (btn === '←') setPin(p => p.slice(0, -1));
                    else if (pin.length < 6) setPin(p => p + btn);
                  }}
                  className="h-20 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-2xl text-2xl font-black transition-all active:scale-90"
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>
        )}

        {status === 'confirm' && currentEmp && (
          <div className="text-center animate-in zoom-in duration-300">
            <h2 className="text-4xl font-black text-slate-900 mb-2 uppercase">{currentEmp.name}</h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-12">Confirmación de Marcado</p>
            <div className="grid grid-cols-2 gap-8 w-full max-w-lg mx-auto">
              <button onClick={() => handleMark('in')} className="py-12 bg-emerald-600 text-white rounded-[2rem] font-black text-2xl uppercase shadow-xl hover:bg-emerald-700 transition-all active:scale-95">Ingreso</button>
              <button onClick={() => handleMark('out')} className="py-12 bg-blue-700 text-white rounded-[2rem] font-black text-2xl uppercase shadow-xl hover:bg-blue-800 transition-all active:scale-95">Salida</button>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center animate-in zoom-in">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner">✓</div>
            <h2 className="text-3xl font-black text-slate-900 mb-6 italic">"{motivationalMsg}"</h2>
            <p className="text-emerald-600 font-black uppercase tracking-widest">Marcado Registrado con Éxito</p>
            <p className="text-slate-400 text-[9px] mt-8 uppercase font-bold animate-pulse">Sistema bloqueado por sincronización...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center text-red-600 animate-bounce">
            <h2 className="text-2xl font-black uppercase">PIN INCORRECTO</h2>
            <p className="font-bold text-xs">Intente nuevamente</p>
          </div>
        )}
      </div>

      <button onClick={onBack} className="mt-8 text-white/40 hover:text-white font-black text-[10px] uppercase tracking-[0.4em] transition-all">Regresar al Inicio</button>
    </div>
  );
};

export default AttendanceSystem;
