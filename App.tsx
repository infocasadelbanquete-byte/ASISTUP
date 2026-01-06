
import React, { useState, useEffect, useRef } from 'react';
import { CompanyConfig, Employee, Role, AttendanceRecord, Payment, GlobalSettings } from './types.ts';
import AdminDashboard from './views/AdminDashboard.tsx';
import AttendanceSystem from './views/AttendanceSystem.tsx';
import Modal from './components/Modal.tsx';
import { db, collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, compressData, decompressData } from './firebase.ts';

const APP_ICON_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%233b82f6;'/%3E%3Cstop offset='100%25' style='stop-color:%231e3a8a;'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='none' stroke='url(%23g)' stroke-width='6' stroke-dasharray='15 5'/%3E%3Ccircle cx='50' cy='50' r='32' fill='none' stroke='url(%23g)' stroke-width='5' stroke-dasharray='10 4' opacity='0.7'/%3E%3Ccircle cx='50' cy='50' r='18' fill='none' stroke='url(%23g)' stroke-width='4' opacity='0.4'/%3E%3Ccircle cx='50' cy='50' r='6' fill='%233b82f6'/%3E%3C/svg%3E";

const App: React.FC = () => {
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const [view, setView] = useState<'selection' | 'admin' | 'attendance'>('selection');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  
  const unsubscribesRef = useRef<(() => void)[]>([]);

  const [appMode, setAppMode] = useState<'full' | 'attendance'>(
    (localStorage.getItem('app_mode') as 'full' | 'attendance') || 'full'
  );

  const [showWelcome, setShowWelcome] = useState(false);
  const [showLogoutFeedback, setShowLogoutFeedback] = useState(false);
  const [modalAlert, setModalAlert] = useState<{isOpen: boolean, title: string, message: string, type: 'info' | 'success' | 'error'}>({
    isOpen: false, title: '', message: '', type: 'info'
  });
  
  const [company, setCompany] = useState<CompanyConfig | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>({
    sbu: 482.00,
    iessRate: 0.0945,
    reserveRate: 0.0833,
    schedule: {
      monFri: { in1: '08:30', out1: '13:00', in2: '15:00', out2: '18:00' },
      sat: { in: '08:30', out: '13:00' },
      halfDayOff: 'Miércoles tarde'
    }
  });

  const showAlert = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setModalAlert({ isOpen: true, title, message, type });
  };

  const cleanListeners = () => {
    unsubscribesRef.current.forEach(unsub => unsub());
    unsubscribesRef.current = [];
  };

  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAdminLoginModalOpen(false);
        setShowWelcome(false);
        setModalAlert(prev => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('keydown', handleEsc);
    
    cleanListeners();

    try {
      const unsubCompany = onSnapshot(doc(db, "config", "company"), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCompany(data.payload ? decompressData(data.payload as string) : data as any);
        }
        setIsDbConnected(true);
        setIsLoadingData(false);
      }, () => setIsDbConnected(false));
      unsubscribesRef.current.push(unsubCompany);

      const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
        setEmployees(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload as string), id: d.id } : { ...raw, id: d.id };
        }) as Employee[]);
      });
      unsubscribesRef.current.push(unsubEmployees);

      const unsubAttendance = onSnapshot(collection(db, "attendance"), (snapshot) => {
        setAttendance(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload as string), id: d.id } : { ...raw, id: d.id };
        }) as AttendanceRecord[]);
      });
      unsubscribesRef.current.push(unsubAttendance);

      const unsubPayments = onSnapshot(collection(db, "payments"), (snapshot) => {
        setPayments(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload as string), id: d.id } : { ...raw, id: d.id };
        }) as Payment[]);
      });
      unsubscribesRef.current.push(unsubPayments);

    } catch (e) {
      setIsLoadingData(false);
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
      cleanListeners();
    };
  }, []);

  const handleAdminLogin = () => {
    let role: Role | null = null;
    if (adminPassInput === 'admin123') role = Role.SUPER_ADMIN;
    else {
      const foundAdmin = employees.find(e => e.pin === adminPassInput && (e.role === Role.SUPER_ADMIN || e.role === Role.PARTIAL_ADMIN));
      if (foundAdmin) role = foundAdmin.role;
    }

    if (role) {
      setCurrentUserRole(role);
      localStorage.setItem('admin_logged_in', 'true');
      setShowWelcome(true);
      setView('admin');
      setIsAdminLoginModalOpen(false);
      
      // Auto-cerrar mensaje de bienvenida después de 1.5 segundos
      setTimeout(() => setShowWelcome(false), 1500);
    } else {
      showAlert("Error de Acceso", "Credencial no válida o sin privilegios.", "error");
    }
    setAdminPassInput('');
  };

  const finalizeLogout = () => {
    setCurrentUserRole(null);
    localStorage.removeItem('admin_logged_in');
    setView('selection');
    setShowLogoutFeedback(false);
  };

  // Efecto para auto-finalizar el logout cuando se activa la señal de salida
  useEffect(() => {
    if (showLogoutFeedback) {
      const timer = setTimeout(() => {
        finalizeLogout();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showLogoutFeedback]);

  const handleUpdateEmployees = async (emps: Employee[]) => {
    const currentIds = new Set<string>(emps.map(e => e.id));
    const previousIds = new Set<string>(employees.map(e => e.id));
    
    for (const id of previousIds) {
      if (!currentIds.has(id)) {
        await deleteDoc(doc(db, "employees", id));
      }
    }
    
    for (const e of emps) {
      await setDoc(doc(db, "employees", e.id), { payload: compressData(e) });
    }
  };

  const handleUpdatePayments = async (pys: Payment[]) => {
    const currentIds = new Set<string>(pys.map(p => p.id));
    const previousIds = new Set<string>(payments.map(p => p.id));
    
    for (const id of previousIds) {
      if (!currentIds.has(id)) {
        await deleteDoc(doc(db, "payments", id));
      }
    }

    for (const p of pys) {
      if (p.id.length > 15) {
        await addDoc(collection(db, "payments"), { payload: compressData(p) });
      } else {
        await setDoc(doc(db, "payments", p.id), { payload: compressData(p) });
      }
    }
  };

  if (isLoadingData) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {view === 'selection' && (
        <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-3xl p-10 md:p-16 rounded-[4.5rem] shadow-2xl text-center border border-white/20">
            <h1 className="text-4xl md:text-5xl font-[950] text-slate-900 mb-2 tracking-tighter uppercase leading-none">ASIST UP</h1>
            <p className="text-blue-600 font-black uppercase tracking-[0.6em] text-[10px] mb-14">Management Suite</p>
            
            <div className="space-y-4">
              <button onClick={() => setView('attendance')} className="w-full py-6 bg-blue-700 text-white font-black rounded-[2.5rem] shadow-2xl hover:bg-blue-800 transition-all uppercase text-[11px] tracking-widest active:scale-95">Panel de Asistencia</button>
              <button onClick={() => setIsAdminLoginModalOpen(true)} className="w-full py-5 text-slate-400 font-black hover:text-slate-900 transition-all uppercase text-[10px] tracking-widest">Consola Administrativa</button>
            </div>
          </div>

          <Modal isOpen={isAdminLoginModalOpen} onClose={() => setIsAdminLoginModalOpen(false)} title="Autorización" maxWidth="max-w-[280px]">
            <div className="space-y-6 p-2 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contraseña o PIN</p>
              <input 
                type="password"
                value={adminPassInput} 
                onChange={e => setAdminPassInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} 
                className="w-full border-2 border-slate-100 rounded-2xl p-4 text-center text-2xl font-black focus:border-blue-600 outline-none bg-slate-50" 
                placeholder="••••••" 
                autoFocus 
              />
              <button onClick={handleAdminLogin} className="w-full py-4 bg-blue-700 text-white font-black rounded-xl uppercase text-[11px] tracking-widest shadow-2xl active:scale-95 transition-all">Ingresar</button>
            </div>
          </Modal>
        </div>
      )}

      {view === 'attendance' && (
        <AttendanceSystem 
          employees={employees} 
          attendance={attendance} 
          onBack={() => setView('selection')} 
          settings={settings} 
          onRegister={async (r) => { await addDoc(collection(db, "attendance"), { payload: compressData(r), timestamp: r.timestamp }); }} 
          onUpdateEmployees={handleUpdateEmployees} 
        />
      )}

      {view === 'admin' && currentUserRole && (
        <AdminDashboard 
          role={currentUserRole} 
          isDbConnected={isDbConnected}
          onLogout={() => setShowLogoutFeedback(true)} 
          company={company}
          onUpdateCompany={async (c) => await setDoc(doc(db, "config", "company"), { payload: compressData(c) })}
          employees={employees}
          onUpdateEmployees={handleUpdateEmployees}
          attendance={attendance}
          payments={payments}
          onUpdatePayments={handleUpdatePayments}
          settings={settings}
          onUpdateSettings={async (s) => await setDoc(doc(db, "config", "settings"), { payload: compressData(s) })}
          onUpdateAppMode={(mode) => { setAppMode(mode); localStorage.setItem('app_mode', mode); }}
          appMode={appMode}
        />
      )}

      <Modal isOpen={showWelcome} onClose={() => setShowWelcome(false)} title="Autorizado" type="success" maxWidth="max-w-[280px]">
         <div className="text-center space-y-4 p-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto animate-bounce">✓</div>
            <h2 className="text-xl font-[950] text-slate-900 uppercase tracking-tight leading-none">Acceso Exitoso</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando panel de control...</p>
         </div>
      </Modal>

      <Modal isOpen={showLogoutFeedback} onClose={() => {}} title="Salida" type="success" maxWidth="max-w-[280px]">
         <div className="text-center space-y-6 p-2">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl mx-auto animate-pulse">🔒</div>
            <h3 className="text-xl font-[950] text-slate-900 uppercase tracking-tighter leading-none">Cerrando Sesión</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando datos finales...</p>
         </div>
      </Modal>

      <Modal isOpen={modalAlert.isOpen} onClose={() => setModalAlert({...modalAlert, isOpen: false})} title={modalAlert.title} type={modalAlert.type} maxWidth="max-w-[280px]">
           <div className="text-center p-4">
              <p className="text-slate-800 font-bold uppercase text-[11px]">{modalAlert.message}</p>
              <button onClick={() => setModalAlert({...modalAlert, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase mt-6 active:scale-95 transition-all">Ok</button>
           </div>
      </Modal>
    </div>
  );
};

export default App;
