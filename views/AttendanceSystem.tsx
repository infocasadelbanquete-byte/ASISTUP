import React, { useState, useEffect } from 'react';
import { Employee, AttendanceRecord } from '../types.ts';
import Clock from '../components/Clock.tsx';
import { APP_NAME, MOTIVATIONAL_MESSAGES_START, MOTIVATIONAL_MESSAGES_END, ECUADOR_HOLIDAYS } from '../constants.tsx';

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

  const today = new Date();
  const currentHoliday = ECUADOR_HOLIDAYS.find(h => h.month === today.getMonth() && h.day === today.getDate());

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

    // Bloqueo estricto de 5 segundos tras marcaje
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

  // Soporte para Teclado Físico habilitado permanentemente
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
      <div className="w-full max-w-4xl bg-white/95 backdrop-blur-3xl rounded-[4rem] shadow-2xl p-16 flex flex-col items-center fade-in relative overflow-hidden">
        
        {/* Notificación de Cumpleaños o Festivos en el sistema de asistencia */}
        {currentHoliday && (
          <div className="absolute top-0 w-full bg-emerald-600 text-white py-2 text-center text-[10px] font-black uppercase tracking-[0.4em]">
            ¡Hoy celebramos: {currentHoliday.name}!
          </div>
        )}

        <h1 className="text-5xl font-black text-slate-900 mb-8 tracking-tighter uppercase italic">{APP_NAME}</h1>
        <div className="mb-14"><Clock /></div>

        {status === 'idle' && (
          <div className="w-full max-w-md text-center">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] mb-12">DIGITE SU CÓDIGO DE IDENTIDAD</p>
            <div className="flex gap-4 justify-center mb-16">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`w-14 h-20 border-b-8 flex items-center justify-center text-5xl font-black transition-all duration-300 ${pin.length > i ? 'border-blue-600 text-slate-900 scale-110' : 'border-slate-100'}`}>
                  {pin[i] ? '•' : ''}
                </div>
              ))}
            </div>
            
            {/* Teclado Visual Aesthetic */}
            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map(btn => (
                <button 
                  key={btn}
                  onClick={() => {
                    if (btn === 'C') setPin('');
                    else if (btn === '←') setPin(p => p.slice(0, -1));
                    else if (pin.length < 6) setPin(p => p + btn);
                  }}
                  className="h-20 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-[1.5rem] text-3xl font-black transition-all active:scale-90 shadow-sm hover:shadow-xl"
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>
        )}

        {status === 'confirm' && currentEmp && (
          <div className="text-center animate-in zoom-in duration-300 w-full max-w-lg">
            <div className="mb-8">
               <div className="w-24 h-24 bg-blue-100 rounded-3xl mx-auto flex items-center justify-center text-4xl font-black text-blue-600 uppercase">
                 {currentEmp.name[0]}
               </div>
            </div>
            <h2 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tighter leading-tight">{currentEmp.name}</h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-14 italic">Verificación biométrica por PIN completada</p>
            <div className="grid grid-cols-2 gap-8">
              <button onClick={() => handleMark('in')} className="py-14 bg-emerald-600 text-white rounded-[2.5rem] font-black text-3xl uppercase shadow-2xl hover:bg-emerald-700 transition-all active:scale-95 group relative overflow-hidden">
                <span className="relative z-10">Ingreso</span>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
              </button>
              <button onClick={() => handleMark('out')} className="py-14 bg-blue-700 text-white rounded-[2.5rem] font-black text-3xl uppercase shadow-2xl hover:bg-blue-800 transition-all active:scale-95 group relative overflow-hidden">
                <span className="relative z-10">Salida</span>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
              </button>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center animate-in zoom-in">
            <div className="w-32 h-32 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-6xl mx-auto mb-10 shadow-inner">✓</div>
            <h2 className="text-4xl font-black text-slate-900 mb-6 italic tracking-tight">"{motivationalMsg}"</h2>
            <p className="text-emerald-600 font-black uppercase tracking-[0.3em] text-sm">Marcaje Registrado Correctamente</p>
            <p className="text-slate-300 text-[10px] mt-12 uppercase font-black animate-pulse">El sistema se reiniciará para el próximo empleado...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center text-red-600 animate-bounce">
            <div className="text-8xl mb-4">✕</div>
            <h2 className="text-3xl font-black uppercase tracking-tighter">ACCESO DENEGADO</h2>
            <p className="font-black text-xs uppercase tracking-widest mt-2">PIN incorrecto o empleado inactivo</p>
          </div>
        )}
      </div>

      <button onClick={onBack} className="mt-12 text-white/40 hover:text-white font-black text-[11px] uppercase tracking-[0.5em] transition-all">Administración ASIST UP</button>
    </div>
  );
};

export default AttendanceSystem;