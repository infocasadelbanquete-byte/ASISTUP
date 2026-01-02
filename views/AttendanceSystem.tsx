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
  const [status, setStatus] = useState<'idle' | 'confirm' | 'forgotten_form' | 'success' | 'error'>('idle');
  const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);
  const [motivationalMsg, setMotivationalMsg] = useState('');
  
  // Estado para el formulario de marcaje olvidado
  const [forgottenData, setForgottenData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'in' as 'in' | 'out',
    justification: ''
  });

  const today = new Date();
  const currentHoliday = ECUADOR_HOLIDAYS.find(h => h.month === today.getMonth() && h.day === today.getDate());

  const handleMark = (type: 'in' | 'out') => {
    if (!currentEmp) return;

    const record: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: currentEmp.id,
      timestamp: new Date().toISOString(),
      type,
      status: 'confirmed'
    };

    onRegister(record);
    
    const msgs = type === 'in' ? MOTIVATIONAL_MESSAGES_START : MOTIVATIONAL_MESSAGES_END;
    setMotivationalMsg(msgs[Math.floor(Math.random() * msgs.length)]);
    setStatus('success');
    setPin('');

    setTimeout(() => {
      setStatus('idle');
      setCurrentEmp(null);
    }, 4000);
  };

  const handleForgottenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmp || !forgottenData.justification) return alert("Debe ingresar una justificación.");

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
    setMotivationalMsg("Solicitud enviada. El administrador validará su marcaje.");
    setStatus('success');
    setPin('');

    setTimeout(() => {
      setStatus('idle');
      setCurrentEmp(null);
      setForgottenData({ date: new Date().toISOString().split('T')[0], type: 'in', justification: '' });
    }, 4000);
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
    <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white/95 backdrop-blur-3xl rounded-[3rem] shadow-2xl p-8 md:p-12 flex flex-col items-center fade-in relative overflow-hidden">
        
        {currentHoliday && (
          <div className="absolute top-0 w-full bg-emerald-600 text-white py-1.5 text-center text-[9px] font-black uppercase tracking-[0.3em]">
            FESTIVO: {currentHoliday.name}
          </div>
        )}

        <h1 className="text-3xl font-black text-slate-900 mb-6 tracking-tighter uppercase italic">{APP_NAME}</h1>
        <div className="mb-8 transform scale-75 md:scale-90"><Clock /></div>

        {status === 'idle' && (
          <div className="w-full text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-8">INGRESE PIN DE ACCESO</p>
            <div className="flex gap-3 justify-center mb-10">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`w-10 h-14 border-b-4 flex items-center justify-center text-3xl font-black transition-all ${pin.length > i ? 'border-blue-600 text-slate-900 scale-105' : 'border-slate-100'}`}>
                  {pin[i] ? '•' : ''}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-3 gap-3 md:gap-4 max-w-[320px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map(btn => (
                <button 
                  key={btn}
                  onClick={() => {
                    if (btn === 'C') setPin('');
                    else if (btn === '←') setPin(p => p.slice(0, -1));
                    else if (pin.length < 6) setPin(p => p + btn);
                  }}
                  className="h-14 md:h-16 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-2xl text-xl font-black transition-all active:scale-90"
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>
        )}

        {status === 'confirm' && currentEmp && (
          <div className="text-center animate-in zoom-in duration-300 w-full">
            <div className="mb-6">
               <div className="w-20 h-20 bg-blue-100 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black text-blue-600 uppercase">
                 {currentEmp.name[0]}
               </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-1 uppercase tracking-tighter leading-tight">{currentEmp.name}</h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-10 italic">Verificación Exitosa</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button onClick={() => handleMark('in')} className="py-8 bg-emerald-600 text-white rounded-3xl font-black text-xl uppercase shadow-xl hover:bg-emerald-700 transition-all active:scale-95">Ingreso</button>
              <button onClick={() => handleMark('out')} className="py-8 bg-blue-700 text-white rounded-3xl font-black text-xl uppercase shadow-xl hover:bg-blue-800 transition-all active:scale-95">Salida</button>
            </div>
            
            <button onClick={() => setStatus('forgotten_form')} className="text-blue-600 font-black uppercase text-[10px] tracking-widest hover:underline">Olvidé marcar jornada anterior</button>
          </div>
        )}

        {status === 'forgotten_form' && currentEmp && (
          <form onSubmit={handleForgottenSubmit} className="w-full space-y-4 animate-in slide-in-from-bottom">
            <h2 className="text-xl font-black text-slate-900 uppercase text-center mb-4">Justificar Marcaje Olvidado</h2>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400">Fecha del olvido</label>
                <input type="date" required className="w-full border p-3 rounded-xl text-xs font-bold" value={forgottenData.date} onChange={e => setForgottenData({...forgottenData, date: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setForgottenData({...forgottenData, type: 'in'})} className={`py-3 rounded-xl text-[10px] font-black uppercase ${forgottenData.type === 'in' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>Entrada</button>
                <button type="button" onClick={() => setForgottenData({...forgottenData, type: 'out'})} className={`py-3 rounded-xl text-[10px] font-black uppercase ${forgottenData.type === 'out' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>Salida</button>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400">Justificación del olvido</label>
                <textarea required className="w-full border p-3 rounded-xl text-xs h-24 focus:border-blue-500 outline-none" placeholder="Ej: Fallo de sistema, Salida de emergencia..." value={forgottenData.justification} onChange={e => setForgottenData({...forgottenData, justification: e.target.value})}></textarea>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStatus('confirm')} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Atrás</button>
              <button type="submit" className="flex-[2] py-4 bg-blue-700 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Enviar Solicitud</button>
            </div>
          </form>
        )}

        {status === 'success' && (
          <div className="text-center animate-in zoom-in">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner">✓</div>
            <h2 className="text-2xl font-black text-slate-900 mb-4 italic tracking-tight leading-tight">"{motivationalMsg}"</h2>
            <p className="text-emerald-600 font-black uppercase tracking-[0.2em] text-[10px]">Marcaje Procesado</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center text-red-600 animate-bounce">
            <div className="text-6xl mb-2">✕</div>
            <h2 className="text-xl font-black uppercase tracking-tighter">ERROR PIN</h2>
          </div>
        )}
      </div>

      <button onClick={onBack} className="mt-8 text-white/40 hover:text-white font-black text-[10px] uppercase tracking-[0.4em] transition-all">Administración</button>
    </div>
  );
};

export default AttendanceSystem;