import React, { useState, useEffect, useCallback } from 'react';
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
  const [showPass, setShowPass] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  const [appMode, setAppMode] = useState<'full' | 'attendance'>(
    (localStorage.getItem('app_mode') as 'full' | 'attendance') || 'full'
  );

  const [showWelcome, setShowWelcome] = useState(false);
  const [showLogoutFeedback, setShowLogoutFeedback] = useState(false);
  const [showConfigPrompt, setShowConfigPrompt] = useState(false);
  const [configBoot, setConfigBoot] = useState(true);
  const [configMode, setConfigMode] = useState<'full' | 'attendance'>('full');
  
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

  const sendPushNotification = useCallback((title: string, body: string) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: 'https://cdn-icons-png.flaticon.com/512/1063/1063376.png' });
    }
  }, []);

  // Habilitar tecla Escape global
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAdminLoginModalOpen(false);
        setShowWelcome(false);
        setModalAlert(prev => ({ ...prev, isOpen: false }));
        setShowConfigPrompt(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    checkMobile();
    window.addEventListener('resize', checkMobile);

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    window.addEventListener('appinstalled', () => {
      setShowConfigPrompt(true);
    });

    const unsubscribes: (() => void)[] = [];
    const rescueTimer = setTimeout(() => setIsLoadingData(false), 3000);

    const updateConnectionStatus = (metadata: any) => {
      if (!metadata.fromCache) setIsDbConnected(true);
    };

    try {
      const unsubCompany = onSnapshot(doc(db, "config", "company"), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCompany(data.payload ? decompressData(data.payload) : data as any);
        }
        updateConnectionStatus(docSnap.metadata);
        setIsLoadingData(false);
        clearTimeout(rescueTimer);
      }, () => setIsDbConnected(false));
      unsubscribes.push(unsubCompany);

      const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
        setEmployees(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
        }) as Employee[]);
        updateConnectionStatus(snapshot.metadata);
      }, () => setIsDbConnected(false));
      unsubscribes.push(unsubEmployees);

      const unsubAttendance = onSnapshot(collection(db, "attendance"), (snapshot) => {
        const newRecords = snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
        }) as AttendanceRecord[];
        
        if (localStorage.getItem('admin_logged_in') === 'true') {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added" && !change.doc.metadata.fromCache) {
              const rec = decompressData(change.doc.data().payload) as AttendanceRecord;
              const emp = employees.find(e => e.id === rec.employeeId);
              if (rec.isForgotten) {
                sendPushNotification("Solicitud de Marcaje", `${emp?.surname} ha enviado una justificación.`);
              }
              if (rec.isLate) {
                sendPushNotification("Atraso Crítico", `${emp?.surname} ha marcado con más de 15m de atraso.`);
              }
            }
          });
        }
        
        setAttendance(newRecords);
        updateConnectionStatus(snapshot.metadata);
      }, () => setIsDbConnected(false));
      unsubscribes.push(unsubAttendance);

      onSnapshot(collection(db, "payments"), (snapshot) => {
        setPayments(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
        }) as Payment[]);
      });

    } catch (e) {
      setIsLoadingData(false);
      setIsDbConnected(false);
    }

    return () => { 
      unsubscribes.forEach(unsub => unsub()); 
      clearTimeout(rescueTimer);
      window.removeEventListener('resize', checkMobile);
    };
  }, [employees, sendPushNotification]);

  const handleAdminLogin = () => {
    let role: Role | null = null;
    
    // Passwords estáticos de emergencia
    if (adminPassInput === 'admin123') role = Role.SUPER_ADMIN;
    else if (adminPassInput === 'partial123') role = Role.PARTIAL_ADMIN;
    else {
      // Validar mediante PIN de empleado con cargo administrativo
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
      showAlert("Error de Acceso", "Credencial administrativa no válida o sin privilegios.", "error");
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
              <div className="relative">
                <input 
                  type={showPass ? "text" : "password"} 
                  value={adminPassInput} 
                  onChange={e => setAdminPassInput(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} 
                  className="w-full border-2 border-slate-100 rounded-[2.5rem] p-8 text-center text-4xl font-black focus:border-blue-600 outline-none transition-all bg-slate-50" 
                  placeholder="••••••" 
                  autoFocus 
                />
              </div>
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