import React, { useState, useEffect, useMemo } from 'react';
import { Employee, AttendanceRecord, GlobalSettings } from '../types.ts';
import Clock from '../components/Clock.tsx';
import Modal from '../components/Modal.tsx';

const APP_ICON_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%233b82f6;'/%3E%3Cstop offset='100%25' style='stop-color:%231e3a8a;'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='none' stroke='url(%23g)' stroke-width='6' stroke-dasharray='15 5'/%3E%3Ccircle cx='50' cy='50' r='32' fill='none' stroke='url(%23g)' stroke-width='5' stroke-dasharray='10 4' opacity='0.7'/%3E%3Ccircle cx='50' cy='50' r='18' fill='none' stroke='url(%23g)' stroke-width='4' opacity='0.4'/%3E%3Ccircle cx='50' cy='50' r='6' fill='%233b82f6'/%3E%3C/svg%3E";

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
  const [status, setStatus] = useState<'idle' | 'confirm' | 'forgotten_form' | 'success' | 'error' | 'change_pin' | 'justification_form'>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);
  const [pendingMarkData, setPendingMarkData] = useState<{ type: 'in' | 'out' | 'half_day', isLate: boolean } | null>(null);
  const [justificationText, setJustificationText] = useState('');
  const [newPin, setNewPin] = useState('');
  const [forgotCi, setForgotCi] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [feedback, setFeedback] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info'}>({
    isOpen: false, title: '', message: '', type: 'success'
  });

  const isWithinRange = (now: Date, startStr: string, endStr: string) => {
    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);
    const s = new Date(now); s.setHours(sh, sm, 0, 0);
    const e = new Date(now); e.setHours(eh, em, 0, 0);
    return now >= s && now <= e;
  };
  
  const handleMark = (type: 'in' | 'out' | 'half_day') => {
    if (!currentEmp || isProcessing) return;
    
    const now = new Date();
    const day = now.getDay();
    let isOffSchedule = false;
    let isCriticalLate = false;

    if (type !== 'half_day') {
      if (day >= 1 && day <= 5) {
        const in1 = isWithinRange(now, settings.schedule.monFri.in1, settings.schedule.monFri.out1);
        const in2 = isWithinRange(now, settings.schedule.monFri.in2, settings.schedule.monFri.out2);
        if (!in1 && !in2) isOffSchedule = true;

        if (type === 'in') {
          const [schedH, schedM] = settings.schedule.monFri.in1.split(':').map(Number);
          const schedDate = new Date(now);
          schedDate.setHours(schedH, schedM, 0, 0);
          const diffMins = (now.getTime() - schedDate.getTime()) / (1000 * 60);
          if (diffMins > 15) isCriticalLate = true;
        }
      } else if (day === 6) {
        if (!isWithinRange(now, settings.schedule.sat.in, settings.schedule.sat.out)) isOffSchedule = true;
      } else {
        isOffSchedule = true;
      }
    }

    if (isOffSchedule || isCriticalLate) {
      setPendingMarkData({ type, isLate: isCriticalLate });
      setStatus('justification_form');
      return;
    }

    processRegistration(type, isCriticalLate);
  };

  const processRegistration = (type: 'in' | 'out' | 'half_day', isLate: boolean, justification?: string) => {
    setIsProcessing(true);
    
    if (isLate && Notification.permission === "granted") {
      new Notification("ALERTA DE ASISTENCIA", {
        body: `El colaborador ${currentEmp?.name} ${currentEmp?.surname} ha marcado con más de 15 minutos de retraso.`,
        icon: APP_ICON_SVG
      });
    }

    const record: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: currentEmp!.id,
      timestamp: new Date().toISOString(),
      type,
      status: 'confirmed',
      isLate,
      justification
    };

    onRegister(record);
    
    if (type === 'in') setSuccessMsg("INGRESO REGISTRADO");
    else if (type === 'out') setSuccessMsg("SALIDA REGISTRADA");
    else setSuccessMsg("MEDIA JORNADA REGISTRADA");
    
    setStatus('success');
    setPin('');
    setJustificationText('');
    setPendingMarkData(null);

    setTimeout(() => {
      setStatus('idle');
      setCurrentEmp(null);
      setIsProcessing(false);
    }, 3000);
  };

  const handleConfirmJustification = () => {
    if (!justificationText.trim()) {
      setFeedback({ isOpen: true, title: "Requerido", message: "Debe ingresar un motivo para continuar.", type: "error" });
      return;
    }
    if (pendingMarkData) {
      processRegistration(pendingMarkData.type, pendingMarkData.isLate, justificationText);
    }
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
      pinNeedsReset: false,
      pinResetRequested: false
    } : e);
    
    onUpdateEmployees(updated);

    setFeedback({ isOpen: true, title: "PIN Actualizado", message: "Su clave de acceso ha sido cambiada. Ahora puede marcar su asistencia.", type: "success" });
    setStatus('confirm');
    setNewPin('');
  };

  const handleRequestPinReset = () => {
    const emp = employees.find(e => e.identification === forgotCi && e.status === 'active');
    if (emp) {
      const updated = employees.map(e => e.id === emp.id ? { ...e, pinResetRequested: true } : e);
      onUpdateEmployees(updated);
      
      if (Notification.permission === "granted") {
        new Notification("SOLICITUD DE ACCESO", {
          body: `El colaborador ${emp.name} solicita resetear su PIN de asistencia.`,
          icon: APP_ICON_SVG
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
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center fade-in p-6">
           <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center text-center animate-in zoom-in max-w-sm">
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center text-3xl mb-4 shadow-lg animate-bounce">✓</div>
              <h2 className="text-slate-900 font-[950] text-xl uppercase tracking-tighter leading-none">{successMsg}</h2>
              <p className="text-slate-400 font-bold text-[9px] uppercase tracking-widest mt-2 italic">Sincronizado con RRHH</p>
           </div>
        </div>
      )}

      <div className={`w-full max-w-lg bg-white/95 backdrop-blur-3xl rounded-3xl md:rounded-[3.5rem] shadow-2xl p-6 md:p-12 flex flex-col items-center relative overflow-hidden ${status === 'success' ? 'opacity-0' : 'fade-in'}`}>
        <div className="mb-6 md:mb-8 transform scale-[0.6] sm:scale-[0.8]"><Clock /></div>

        {status === 'idle' && (
          <div className="w-full text-center">
            <h2 className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 md:mb-6">Ingresar PIN de 6 dígitos</h2>
            <div className="flex gap-1.5 md:gap-2 justify-center mb-8 md:mb-10">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`w-8 h-12 md:w-10 md:h-16 border-b-4 flex items-center justify-center text-2xl md:text-4xl font-black transition-all ${pin.length > i ? 'border-blue-600 text-slate-900' : 'border-slate-100'}`}>
                  {pin[i] ? '•' : ''}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-3 max-w-[280px] md:max-w-[340px] mx-auto mb-8 md:mb-10">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map(btn => (
                <button 
                  key={btn} 
                  onClick={() => {
                    if (btn === 'C') setPin('');
                    else if (btn === '←') setPin(p => p.slice(0, -1));
                    else if (pin.length < 6) setPin(p => p + btn);
                  }} 
                  className="h-14 md:h-18 bg-white hover:bg-blue-700 hover:text-white rounded-xl md:rounded-2xl text-xl md:text-2xl font-black border border-slate-200 active:scale-90 transition-all shadow-sm flex items-center justify-center"
                >
                  {btn}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setStatus('forgotten_form')}
              className="w-full py-3 md:py-4 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50 transition-all active:scale-95"
            >
              ¿Olvidó su PIN? Solicitar Reseteo
            </button>
          </div>
        )}

        {status === 'justification_form' && (
          <div className="text-center w-full space-y-4 md:space-y-6 animate-in zoom-in">
             <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-50 text-blue-600 rounded-2xl md:rounded-3xl flex items-center justify-center text-3xl mx-auto mb-2 border border-blue-100 shadow-inner">📝</div>
             <h2 className="text-xl md:text-2xl font-[950] text-slate-900 uppercase tracking-tighter">Justificación Requerida</h2>
             <p className="text-[9px] md:text-[10px] text-slate-500 font-black uppercase tracking-widest leading-relaxed">Su marcación presenta una excepción horaria.</p>
             <textarea 
               value={justificationText}
               onChange={e => setJustificationText(e.target.value)}
               className="w-full border-2 p-4 md:p-5 rounded-xl md:rounded-2xl text-[11px] font-black uppercase focus:border-blue-600 outline-none bg-slate-50 min-h-[100px] md:min-h-[120px]" 
               placeholder="Escriba el motivo..." 
               autoFocus 
             />
             <div className="grid grid-cols-2 gap-2 md:gap-3">
                <button onClick={() => setStatus('confirm')} className="w-full py-3 md:py-4 bg-slate-100 text-slate-600 font-black rounded-xl md:rounded-2xl uppercase text-[9px] md:text-[10px] tracking-widest active:scale-95">Cancelar</button>
                <button onClick={handleConfirmJustification} className="w-full py-3 md:py-4 bg-blue-700 text-white font-black rounded-xl md:rounded-2xl uppercase text-[9px] md:text-[10px] tracking-widest shadow-xl active:scale-95">Confirmar</button>
             </div>
          </div>
        )}

        {status === 'forgotten_form' && (
          <div className="text-center w-full space-y-4 md:space-y-6 animate-in zoom-in">
            <h2 className="text-xl md:text-2xl font-[950] text-slate-900 uppercase tracking-tighter">Solicitar Nuevo PIN</h2>
            <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-widest">Ingrese su Identificación</p>
            <input 
              maxLength={10} 
              type="text" 
              inputMode="numeric"
              value={forgotCi} 
              onChange={e => setForgotCi(e.target.value.replace(/\D/g,''))} 
              className="w-full border-2 p-4 md:p-5 rounded-xl md:rounded-2xl text-center text-2xl md:text-3xl font-black focus:border-blue-600 outline-none bg-slate-50" 
              placeholder="0000000000" 
              autoFocus 
            />
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <button onClick={() => setStatus('idle')} className="w-full py-3 md:py-4 bg-slate-100 text-slate-600 font-black rounded-xl md:rounded-2xl uppercase text-[9px] md:text-[10px] tracking-widest active:scale-95">Cancelar</button>
              <button onClick={handleRequestPinReset} className="w-full py-3 md:py-4 bg-blue-700 text-white font-black rounded-xl uppercase text-[9px] md:text-[10px] tracking-widest shadow-xl active:scale-95">Enviar</button>
            </div>
          </div>
        )}

        {status === 'change_pin' && currentEmp && (
          <div className="text-center w-full space-y-4 md:space-y-6">
            <h2 className="text-xl md:text-2xl font-[950] text-slate-900 uppercase">Seguridad Obligatoria</h2>
            <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-widest">Establezca su PIN de 6 dígitos</p>
            <input 
              maxLength={6} 
              type="password" 
              inputMode="numeric"
              value={newPin} 
              onChange={e => setNewPin(e.target.value.replace(/\D/g,''))} 
              className="w-full border-2 p-4 md:p-5 rounded-xl md:rounded-2xl text-center text-3xl md:text-4xl font-black focus:border-blue-600 outline-none bg-slate-50" 
              placeholder="••••••" 
              autoFocus 
            />
            <button onClick={handlePinChange} className="w-full py-4 md:py-5 bg-blue-700 text-white font-black rounded-xl md:rounded-[2rem] uppercase text-[10px] md:text-[11px] tracking-widest shadow-2xl active:scale-95 transition-all">Guardar PIN</button>
          </div>
        )}

        {status === 'confirm' && currentEmp && (
          <div className="text-center w-full animate-in zoom-in">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-100 rounded-2xl md:rounded-[2rem] mx-auto flex items-center justify-center text-3xl md:text-4xl font-black text-blue-700 uppercase border-4 border-white shadow-xl mb-3 md:mb-4 overflow-hidden">
                 {currentEmp.photo ? <img src={currentEmp.photo} className="w-full h-full object-cover" /> : <span>{currentEmp.name[0]}</span>}
            </div>
            <h2 className="text-xl md:text-2xl font-[950] text-slate-900 mb-1 uppercase tracking-tighter leading-none">{currentEmp.name} {currentEmp.surname}</h2>
            <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6 md:mb-8">{currentEmp.role}</p>
            
            <div className="space-y-4">
              <section className="space-y-2">
                <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest text-left">Primera Jornada (Mañana)</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleMark('in')} className="py-4 bg-blue-700 text-white rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all border-b-2 border-blue-900">Ingreso</button>
                  <button onClick={() => handleMark('out')} className="py-4 bg-slate-800 text-white rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all border-b-2 border-slate-950">Salida</button>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest text-left">Segunda Jornada (Tarde)</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleMark('in')} className="py-4 bg-blue-600 text-white rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all border-b-2 border-blue-800">Ingreso</button>
                  <button onClick={() => handleMark('out')} className="py-4 bg-slate-700 text-white rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all border-b-2 border-slate-900">Salida</button>
                </div>
              </section>

              <button 
                onClick={() => handleMark('half_day')} 
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all border-b-2 border-emerald-800 flex items-center justify-center gap-2"
              >
                <span>📅</span> Media Jornada Libre
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center text-red-600 py-6 md:py-10 animate-pulse">
            <div className="text-6xl md:text-7xl mb-4">✕</div>
            <h2 className="text-xl md:text-2xl font-[950] uppercase tracking-tighter">Denegado</h2>
            <p className="text-[9px] md:text-[10px] font-bold uppercase mt-2">PIN Incorrecto</p>
          </div>
        )}
      </div>

      <button onClick={onBack} className="mt-8 md:mt-10 text-white/30 hover:text-white font-black text-[10px] md:text-[11px] uppercase tracking-[0.4em] md:tracking-[0.6em] p-4 transition-all active:scale-95">Salir del Terminal</button>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
          <div className="text-center space-y-4 md:space-y-6">
              <p className="text-slate-600 font-bold uppercase text-[11px] md:text-[12px] leading-relaxed">{feedback.message}</p>
              <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest">Aceptar</button>
          </div>
      </Modal>
    </div>
  );
};

export default AttendanceSystem;