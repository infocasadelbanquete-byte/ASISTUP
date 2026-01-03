import React, { useState, useEffect, useMemo } from 'react';
import { Employee, AttendanceRecord, GlobalSettings } from '../types.ts';
import Clock from '../components/Clock.tsx';
import Modal from '../components/Modal.tsx';
import { APP_NAME, MOTIVATIONAL_MESSAGES_START, MOTIVATIONAL_MESSAGES_END, ECUADOR_HOLIDAYS } from '../constants.tsx';

interface AttendanceSystemProps {
  employees: Employee[];
  attendance: AttendanceRecord[];
  onRegister: (record: AttendanceRecord) => void;
  onBack: () => void;
  onUpdateEmployees: (employees: Employee[]) => void;
  settings: GlobalSettings;
}

const AttendanceSystem: React.FC<AttendanceSystemProps> = ({ employees, attendance, onRegister, onBack, onUpdateEmployees, settings }) => {
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<'idle' | 'confirm' | 'forgotten_form' | 'success' | 'error'>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);
  const [motivationalMsg, setMotivationalMsg] = useState('');
  
  const [specialModal, setSpecialModal] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info'}>({
    isOpen: false, title: '', message: '', type: 'success'
  });

  const [forgottenData, setForgottenData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'in' as 'in' | 'out',
    justification: ''
  });

  const today = new Date();
  const currentHoliday = ECUADOR_HOLIDAYS.find(h => h.month === today.getMonth() && h.day === today.getDate());

  const isBirthday = useMemo(() => {
    if (!currentEmp) return false;
    const bday = new Date(currentEmp.birthDate);
    return bday.getUTCDate() === today.getDate() && bday.getUTCMonth() === today.getMonth();
  }, [currentEmp, today]);

  const handleMark = (type: 'in' | 'out' | 'half_day') => {
    if (!currentEmp || isProcessing) return;
    setIsProcessing(true);
    
    let isCriticalLate = false;
    if (type === 'in') {
      const now = new Date();
      // En jornada doble, verificamos contra el ingreso de la mañana (in1)
      const [schedH, schedM] = settings.schedule.monFri.in1.split(':').map(Number);
      const schedDate = new Date();
      schedDate.setHours(schedH, schedM, 0, 0);
      const diffMins = (now.getTime() - schedDate.getTime()) / (1000 * 60);
      if (diffMins > 15) isCriticalLate = true;
    }

    const record: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: currentEmp.id,
      timestamp: new Date().toISOString(),
      type,
      status: 'confirmed',
      isLate: isCriticalLate
    };

    onRegister(record);
    
    let baseMsg = "";
    if (type === 'half_day') {
      baseMsg = "Media jornada libre registrada. Disfruta tu tiempo personal.";
    } else {
      baseMsg = type === 'in' ? MOTIVATIONAL_MESSAGES_START[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES_START.length)] : MOTIVATIONAL_MESSAGES_END[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES_END.length)];
      if (isBirthday) baseMsg = `¡FELIZ CUMPLEAÑOS ${currentEmp.name.toUpperCase()}! 🎂`;
      else if (isCriticalLate) baseMsg = `Registro completado. Se notificó el atraso crítico.`;
    }

    setMotivationalMsg(baseMsg);
    setStatus('success');
    setPin('');

    setTimeout(() => {
      setStatus('idle');
      setCurrentEmp(null);
      setIsProcessing(false);
    }, 5000);
  };

  const handleForgottenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmp || !forgottenData.justification || isProcessing) return;
    setIsProcessing(true);
    const record: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: currentEmp.id,
      timestamp: new Date(forgottenData.date + 'T12:00:00').toISOString(),
      type: forgottenData.type,
      status: 'pending_approval',
      isForgotten: true,
      justification: forgottenData.justification
    };
    onRegister(record);
    setMotivationalMsg("Reporte enviado. Pendiente de validación.");
    setStatus('success');
    setPin('');
    setTimeout(() => {
      setStatus('idle');
      setCurrentEmp(null);
      setIsProcessing(false);
    }, 5000);
  };

  useEffect(() => {
    if (pin.length === 6 && status === 'idle' && !isProcessing) {
      const emp = employees.find(e => e.pin === pin && e.status === 'active');
      if (emp) {
        setCurrentEmp(emp);
        setStatus('confirm');
      } else {
        setStatus('error');
        setTimeout(() => { setStatus('idle'); setPin(''); }, 1500);
      }
    }
  }, [pin, employees, status, isProcessing]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (status !== 'idle' || specialModal.isOpen || isProcessing) return;
      if (e.key >= '0' && e.key <= '9' && pin.length < 6) setPin(p => p + e.key);
      if (e.key === 'Backspace') setPin(p => p.slice(0, -1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [pin, status, specialModal.isOpen, isProcessing]);

  return (
    <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-4">
      {status === 'success' && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-3xl flex flex-col items-center justify-center fade-in">
           <div className={`w-24 h-24 ${isBirthday ? 'bg-blue-600' : 'bg-emerald-500'} text-white rounded-[2rem] flex items-center justify-center text-4xl mb-8 shadow-2xl`}>
             {isBirthday ? '🎂' : '✓'}
           </div>
           <p className="text-white font-[950] text-3xl uppercase tracking-tighter text-center px-10 mb-8 max-w-2xl">{motivationalMsg}</p>
        </div>
      )}

      <div className={`w-full max-w-lg bg-white/95 backdrop-blur-3xl rounded-[3.5rem] shadow-2xl p-6 md:p-12 flex flex-col items-center relative overflow-hidden ${status === 'success' ? 'opacity-0' : 'fade-in'}`}>
        <div className="flex items-center gap-4 mb-8">
            <div className="ring-container scale-[0.35]">
                <div className="ring ring-1"></div>
                <div className="ring ring-2"></div>
                <div className="ring ring-3"></div>
                <div className="w-10 h-10 bg-blue-600 rounded-full"></div>
            </div>
            <h1 className="text-xl font-[950] text-slate-900 tracking-tighter uppercase leading-none">ASIST UP</h1>
        </div>

        <div className="mb-10 transform scale-[0.55] md:scale-[0.8]"><Clock /></div>

        {status === 'idle' && (
          <div className="w-full text-center">
            <div className="flex gap-3 justify-center mb-10">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`w-10 h-16 border-b-4 flex items-center justify-center text-4xl font-black transition-all ${pin.length > i ? 'border-blue-600 text-slate-900' : 'border-slate-100'}`}>
                  {pin[i] ? '•' : ''}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-3 gap-3 max-w-[320px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map(btn => (
                <button 
                  key={btn}
                  onClick={() => {
                    if (btn === 'C') setPin('');
                    else if (btn === '←') setPin(p => p.slice(0, -1));
                    else if (pin.length < 6) setPin(p => p + btn);
                  }}
                  className="h-14 md:h-18 bg-slate-50 hover:bg-blue-700 hover:text-white rounded-2xl text-xl font-black transition-all active:scale-90 border border-slate-100"
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>
        )}

        {status === 'confirm' && currentEmp && (
          <div className="text-center w-full animate-in zoom-in">
            <div className="w-24 h-24 bg-blue-50 rounded-[2rem] mx-auto flex items-center justify-center text-4xl font-black text-blue-700 uppercase border-4 border-white shadow-xl mb-6">
                 {currentEmp.name[0]}
            </div>
            <h2 className="text-3xl font-[950] text-slate-900 mb-1 uppercase tracking-tighter">{currentEmp.name} {currentEmp.surname}</h2>
            <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[10px] mb-8">Identidad Validada</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button onClick={() => handleMark('in')} className="py-8 bg-blue-700 text-white rounded-[2rem] font-black text-xl uppercase shadow-2xl active:scale-95 transition-all">Ingreso</button>
              <button onClick={() => handleMark('out')} className="py-8 bg-slate-900 text-white rounded-[2rem] font-black text-xl uppercase shadow-2xl active:scale-95 transition-all">Salida</button>
            </div>
            <button onClick={() => handleMark('half_day')} className="w-full py-5 bg-blue-100 text-blue-700 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm active:scale-95 transition-all mb-8 border border-blue-200">Media Jornada Libre</button>
            <button onClick={() => setStatus('forgotten_form')} className="text-blue-600 font-black uppercase text-[10px] tracking-widest hover:underline">Reportar Incidencia</button>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center text-red-600 py-10">
            <div className="text-7xl mb-4">✕</div>
            <h2 className="text-2xl font-[950] uppercase tracking-tighter">PIN Incorrecto</h2>
          </div>
        )}
      </div>

      <button onClick={onBack} className="mt-10 text-white/30 hover:text-white font-black text-[11px] uppercase tracking-[0.6em]">Consola Central</button>
    </div>
  );
};

export default AttendanceSystem;