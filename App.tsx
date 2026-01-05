import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CompanyConfig, Employee, Role, AttendanceRecord, Payment, GlobalSettings } from './types.ts';
import AdminDashboard from './views/AdminDashboard.tsx';
import AttendanceSystem from './views/AttendanceSystem.tsx';
import Modal from './components/Modal.tsx';
import { db, collection, doc, onSnapshot, setDoc, addDoc, compressData, decompressData } from './firebase.ts';

const App: React.FC = () => {
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const [view, setView] = useState<'selection' | 'admin' | 'attendance'>('selection');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  
  // Ref para evitar fugas de memoria en listeners
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
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAdminLoginModalOpen(false);
        setShowWelcome(false);
        setModalAlert(prev => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('keydown', handleEsc);
    
    // Iniciar listeners con limpieza
    cleanListeners();

    try {
      const unsubCompany = onSnapshot(doc(db, "config", "company"), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCompany(data.payload ? decompressData(data.payload) : data as any);
        }
        setIsDbConnected(true);
        setIsLoadingData(false);
      }, () => setIsDbConnected(false));
      unsubscribesRef.current.push(unsubCompany);

      const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
        setEmployees(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
        }) as Employee[]);
      });
      unsubscribesRef.current.push(unsubEmployees);

      const unsubAttendance = onSnapshot(collection(db, "attendance"), (snapshot) => {
        setAttendance(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
        }) as AttendanceRecord[]);
      });
      unsubscribesRef.current.push(unsubAttendance);

      const unsubPayments = onSnapshot(collection(db, "payments"), (snapshot) => {
        setPayments(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
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

  if (isLoadingData) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {view === 'selection' && (
        <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-3xl p-10 md:p-16 rounded-[4.5rem] shadow-2xl text-center border border-white/20">
            <div className="mb-14 flex justify-center">
              <div className="ring-container scale-75">
                  <div className="ring ring-1"></div>
                  <div className="ring ring-2"></div>
                  <div className="ring ring-3"></div>
                  <div className="w-10 h-10 bg-blue-600 rounded-full"></div>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-[950] text-slate-900 mb-2 tracking-tighter uppercase leading-none">ASIST UP</h1>
            <p className="text-blue-600 font-black uppercase tracking-[0.6em] text-[10px] mb-14">Management Suite</p>
            
            <div className="space-y-4">
              <button onClick={() => setView('attendance')} className="w-full py-6 bg-blue-700 text-white font-black rounded-[2.5rem] shadow-2xl hover:bg-blue-800 transition-all uppercase text-[11px] tracking-widest active:scale-95">Panel de Asistencia</button>
              {appMode === 'full' && (
                <button onClick={() => setIsAdminLoginModalOpen(true)} className="w-full py-5 text-slate-400 font-black hover:text-slate-900 transition-all uppercase text-[10px] tracking-widest">Consola Administrativa</button>
              )}
            </div>
          </div>

          <Modal isOpen={isAdminLoginModalOpen} onClose={() => setIsAdminLoginModalOpen(false)} title="Autorización">
            <div className="space-y-8 p-2 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingrese Password o PIN Administrativo</p>
              <input 
                type="password"
                value={adminPassInput} 
                onChange={e => setAdminPassInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} 
                className="w-full border-2 border-slate-100 rounded-[2.5rem] p-8 text-center text-4xl font-black focus:border-blue-600 outline-none transition-all bg-slate-50" 
                placeholder="••••••" 
                autoFocus 
              />
              <button onClick={handleAdminLogin} className="w-full py-6 bg-blue-700 text-white font-black rounded-3xl uppercase text-[11px] tracking-widest shadow-2xl active:scale-95 transition-all">Validar Ingreso</button>
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
          onUpdateEmployees={async (emps) => { for (const e of emps) { await setDoc(doc(db, "employees", e.id), { payload: compressData(e) }); } }} 
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
          onUpdateEmployees={async (emps) => { for (const e of emps) { await setDoc(doc(db, "employees", e.id), { payload: compressData(e) }); } }}
          attendance={attendance}
          payments={payments}
          onUpdatePayments={async (pys) => { for (const p of pys) { if (p.id.length > 15) await addDoc(collection(db, "payments"), { payload: compressData(p) }); else await setDoc(doc(db, "payments", p.id), { payload: compressData(p) }); } }}
          settings={settings}
          onUpdateSettings={async (s) => await setDoc(doc(db, "config", "settings"), { payload: compressData(s) })}
          onUpdateAppMode={(mode) => { setAppMode(mode); localStorage.setItem('app_mode', mode); }}
          appMode={appMode}
        />
      )}

      <Modal isOpen={showWelcome} onClose={() => setShowWelcome(false)} title="Acceso Validado" type="success" maxWidth="max-w-sm">
         <div className="text-center space-y-6 p-2">
            <h2 className="text-2xl font-[950] text-slate-900 uppercase tracking-tight leading-none">Bienvenido</h2>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Iniciando Ecosistema...</p>
            <button onClick={() => setShowWelcome(false)} className="w-full py-4 bg-blue-700 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all">Ingresar</button>
         </div>
      </Modal>

      <Modal isOpen={showLogoutFeedback} onClose={finalizeLogout} title="Cierre de Sesión" type="success" maxWidth="max-w-sm">
         <div className="text-center space-y-6 p-2">
            <h3 className="text-2xl font-[950] text-slate-900 uppercase tracking-tighter leading-none">Sincronizado</h3>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Sesión Segura Finalizada</p>
            <button onClick={finalizeLogout} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all">Finalizar</button>
         </div>
      </Modal>

      <Modal isOpen={modalAlert.isOpen} onClose={() => setModalAlert({...modalAlert, isOpen: false})} title={modalAlert.title} type={modalAlert.type}>
           <div className="text-center p-4">
              <p className="text-slate-800 font-bold uppercase text-[12px]">{modalAlert.message}</p>
              <button onClick={() => setModalAlert({...modalAlert, isOpen: false})} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl uppercase mt-6 active:scale-95 transition-all">Aceptar</button>
           </div>
      </Modal>
    </div>
  );
};

export default App;