import React, { useState, useEffect, useMemo } from 'react';
import { Employee, AttendanceRecord, GlobalSettings } from '../types.ts';
import Clock from '../components/Clock.tsx';
import Modal from '../components/Modal.tsx';

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
  const [status, setStatus] = useState<'idle' | 'confirm' | 'forgotten_form' | 'success' | 'error' | 'change_pin'>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);
  const [newPin, setNewPin] = useState('');
  const [forgotCi, setForgotCi] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [feedback, setFeedback] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info'}>({
    isOpen: false, title: '', message: '', type: 'success'
  });
  
  const handleMark = (type: 'in' | 'out' | 'half_day') => {
    if (!currentEmp || isProcessing) return;
    setIsProcessing(true);
    
    let isCriticalLate = false;
    if (type === 'in') {
      const now = new Date();
      const [schedH, schedM] = settings.schedule.monFri.in1.split(':').map(Number);
      const schedDate = new Date();
      schedDate.setHours(schedH, schedM, 0, 0);
      const diffMins = (now.getTime() - schedDate.getTime()) / (1000 * 60);
      if (diffMins > 15) {
        isCriticalLate = true;
        if (Notification.permission === "granted") {
          new Notification("ALERTA DE ASISTENCIA", {
            body: `El colaborador ${currentEmp.name} ${currentEmp.surname} ha marcado con más de 15 minutos de retraso.`,
            icon: "https://cdn-icons-png.flaticon.com/512/3844/3844724.png"
          });
        }
      }
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
    
    // Mensaje estricto de éxito solicitado
    if (type === 'in') {
      setSuccessMsg("INGRESO REGISTRADO CON ÉXITO");
    } else if (type === 'out') {
      setSuccessMsg("SALIDA REGISTRADA CON ÉXITO");
    } else {
      setSuccessMsg("MARCACIÓN REGISTRADA CON ÉXITO");
    }
    
    setStatus('success');
    setPin('');

    setTimeout(() => {
      setStatus('idle');
      setCurrentEmp(null);
      setIsProcessing(false);
    }, 4000);
  };

  const handlePinChange = () => {
    if (newPin.length !== 6 || newPin === currentEmp?.pin) {
      setFeedback({ isOpen: true, title: "Error de PIN", message: "Ingrese un PIN nuevo de 6 dígitos diferente al actual.", type: "error" });
      return;
    }
    
    const updated = employees.map(e => e.id === currentEmp?.id ? {
      ...e,
      pin: newPin,
      pinChanged: true,
      pinNeedsReset: false
    } : e);
    
    onUpdateEmployees(updated);

    setFeedback({ isOpen: true, title: "PIN Actualizado", message: "Su clave de acceso ha sido cambiada. Ahora puede marcar su asistencia.", type: "success" });
    setStatus('confirm');
    setNewPin('');
  };

  const handleRequestPinReset = () => {
    const emp = employees.find(e => e.identification === forgotCi && e.status === 'active');
    if (emp) {
      const updated = employees.map(e => e.id === emp.id ? { ...e, pinNeedsReset: true } : e);
      onUpdateEmployees(updated);
      
      if (Notification.permission === "granted") {
        new Notification("SOLICITUD DE ACCESO", {
          body: `El colaborador ${emp.name} solicita resetear su PIN de asistencia.`,
          icon: "https://cdn-icons-png.flaticon.com/512/3844/3844724.png"
        });
      }
      
      setFeedback({ 
        isOpen: true, 
        title: "Solicitud Recibida", 
        message: "Su solicitud ha sido enviada al administrador. RRHH autorizará su nuevo acceso a la brevedad.", 
        type: "info" 
      });
      setStatus('idle');
      setForgotCi('');
    } else {
      setFeedback({ 
        isOpen: true, 
        title: "Error", 
        message: "Identificación no encontrada en el sistema.", 
        type: "error" 
      });
    }
  };

  useEffect(() => {
    if (pin.length === 6 && status === 'idle' && !isProcessing) {
      const emp = employees.find(e => e.pin === pin && e.status === 'active');
      if (emp) {
        setCurrentEmp(emp);
        if (!emp.pinChanged || emp.pinNeedsReset) {
          setStatus('change_pin');
        } else {
          setStatus('confirm');
        }
      } else {
        setStatus('error');
        setTimeout(() => { setStatus('idle'); setPin(''); }, 1500);
      }
    }
  }, [pin, employees, status, isProcessing]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
      if (status !== 'idle' || isProcessing) return;
      if (e.key >= '0' && e.key <= '9' && pin.length < 6) setPin(p => p + e.key);
      if (e.key === 'Backspace') setPin(p => p.slice(0, -1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [pin, status, isProcessing]);

  return (
    <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-4">
      {status === 'success' && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-3xl flex flex-col items-center justify-center fade-in text-center p-8">
           <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center text-5xl mb-10 shadow-[0_0_50px_rgba(16,185,129,0.4)] animate-bounce">✓</div>
           <p className="text-white font-[950] text-4xl uppercase tracking-tighter text-center max-w-2xl leading-tight">{successMsg}</p>
        </div>
      )}

      <div className={`w-full max-w-lg bg-white/95 backdrop-blur-3xl rounded-[3.5rem] shadow-2xl p-6 md:p-12 flex flex-col items-center relative overflow-hidden ${status === 'success' ? 'opacity-0' : 'fade-in'}`}>
        <div className="mb-8 transform scale-[0.6] md:scale-[0.8]"><Clock /></div>

        {status === 'idle' && (
          <div className="w-full text-center">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Ingresar PIN de 6 dígitos</h2>
            <div className="flex gap-2 justify-center mb-10">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`w-10 h-16 border-b-4 flex items-center justify-center text-4xl font-black transition-all ${pin.length > i ? 'border-blue-600 text-slate-900' : 'border-slate-100'}`}>
                  {pin[i] ? '•' : ''}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 max-w-[340px] mx-auto mb-10">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map(btn => (
                <button 
                  key={btn} 
                  onClick={() => {
                    if (btn === 'C') setPin('');
                    else if (btn === '←') setPin(p => p.slice(0, -1));
                    else if (pin.length < 6) setPin(p => p + btn);
                  }} 
                  className="h-16 md:h-18 bg-white hover:bg-blue-700 hover:text-white rounded-2xl text-2xl font-black border border-slate-200 active:scale-90 transition-all shadow-sm flex items-center justify-center"
                >
                  {btn}
                </button>
              ))}
            </div>
            
            {/* OPCIÓN VISIBLE PARA RESETEO DE PIN */}
            <button 
              onClick={() => setStatus('forgotten_form')}
              className="w-full py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50 transition-all"
            >
              ¿Olvidó su PIN? Solicitar Reseteo
            </button>
          </div>
        )}

        {status === 'forgotten_form' && (
          <div className="text-center w-full space-y-6 animate-in zoom-in">
            <h2 className="text-2xl font-[950] text-slate-900 uppercase tracking-tighter">Solicitar Nuevo PIN</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Ingrese su Cédula / Identificación para validar su identidad</p>
            <input 
              maxLength={10} 
              type="text" 
              inputMode="numeric"
              value={forgotCi} 
              onChange={e => setForgotCi(e.target.value.replace(/\D/g,''))} 
              className="w-full border-2 p-5 rounded-2xl text-center text-3xl font-black focus:border-blue-600 outline-none bg-slate-50" 
              placeholder="0000000000" 
              autoFocus 
            />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setStatus('idle')} className="w-full py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all">Cancelar</button>
              <button onClick={handleRequestPinReset} className="w-full py-4 bg-blue-700 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Enviar</button>
            </div>
          </div>
        )}

        {status === 'change_pin' && currentEmp && (
          <div className="text-center w-full space-y-6">
            <h2 className="text-2xl font-[950] text-slate-900 uppercase">Seguridad Obligatoria</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Asigne su nuevo PIN personal de 6 dígitos</p>
            <input 
              maxLength={6} 
              type="password" 
              inputMode="numeric"
              value={newPin} 
              onChange={e => setNewPin(e.target.value.replace(/\D/g,''))} 
              className="w-full border-2 p-5 rounded-2xl text-center text-4xl font-black focus:border-blue-600 outline-none bg-slate-50" 
              placeholder="••••••" 
              autoFocus 
            />
            <button onClick={handlePinChange} className="w-full py-5 bg-blue-700 text-white font-black rounded-[2rem] uppercase text-[11px] tracking-widest shadow-2xl active:scale-95 transition-all">Establecer Nuevo PIN</button>
          </div>
        )}

        {status === 'confirm' && currentEmp && (
          <div className="text-center w-full animate-in zoom-in">
            <div className="w-28 h-28 bg-slate-100 rounded-[2.5rem] mx-auto flex items-center justify-center text-4xl font-black text-blue-700 uppercase border-4 border-white shadow-xl mb-6 overflow-hidden">
                 {currentEmp.photo ? <img src={currentEmp.photo} className="w-full h-full object-cover" /> : <span>{currentEmp.name[0]}</span>}
            </div>
            <h2 className="text-3xl font-[950] text-slate-900 mb-1 uppercase tracking-tighter leading-none">{currentEmp.name} {currentEmp.surname}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-10">{currentEmp.role}</p>
            <div className="grid grid-cols-1 gap-4">
              <button onClick={() => handleMark('in')} className="py-8 bg-blue-700 text-white rounded-[2rem] font-black text-xl uppercase shadow-2xl active:scale-95 transition-all border-b-4 border-blue-900">Registrar Ingreso</button>
              <button onClick={() => handleMark('out')} className="py-8 bg-slate-900 text-white rounded-[2rem] font-black text-xl uppercase shadow-2xl active:scale-95 transition-all border-b-4 border-black">Registrar Salida</button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center text-red-600 py-10 animate-pulse">
            <div className="text-7xl mb-4">✕</div>
            <h2 className="text-2xl font-[950] uppercase tracking-tighter">Acceso Denegado</h2>
            <p className="text-[10px] font-bold uppercase mt-2">PIN Incorrecto</p>
          </div>
        )}
      </div>

      <button onClick={onBack} className="mt-10 text-white/30 hover:text-white font-black text-[11px] uppercase tracking-[0.6em] p-4 transition-all">Salir del Terminal</button>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
          <div className="text-center space-y-6">
              <p className="text-slate-600 font-bold uppercase text-[12px] leading-relaxed">{feedback.message}</p>
              <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest active:scale-95">Entendido</button>
          </div>
      </Modal>
    </div>
  );
};

export default AttendanceSystem;