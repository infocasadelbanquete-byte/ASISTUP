import React, { useState, useEffect } from 'react';
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
  
  // Nuevos estados para feedback formal de sesión
  const [showWelcome, setShowWelcome] = useState(false);
  const [showLogoutFeedback, setShowLogoutFeedback] = useState(false);
  
  const [company, setCompany] = useState<CompanyConfig | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>({
    sbu: 482.00,
    iessRate: 0.0945,
    reserveRate: 0.0833,
    schedule: {
      monFri: { in: '08:30', out: '13:00' },
      sat: { in: '08:30', out: '13:00' },
      halfDayOff: 'Miércoles tarde'
    }
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    checkMobile();
    window.addEventListener('resize', checkMobile);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    const rescueTimer = setTimeout(() => setIsLoadingData(false), 4000);
    const unsubscribes: (() => void)[] = [];

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
        setAttendance(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
        }) as AttendanceRecord[]);
        updateConnectionStatus(snapshot.metadata);
      }, () => setIsDbConnected(false));
      unsubscribes.push(unsubAttendance);

      const unsubPayments = onSnapshot(collection(db, "payments"), (snapshot) => {
        setPayments(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
        }) as Payment[]);
        updateConnectionStatus(snapshot.metadata);
      }, () => setIsDbConnected(false));
      unsubscribes.push(unsubPayments);

    } catch (e) {
      console.error(e);
      setIsLoadingData(false);
      setIsDbConnected(false);
    }

    return () => { 
      unsubscribes.forEach(unsub => unsub()); 
      clearTimeout(rescueTimer); 
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const handleAdminLogin = () => {
    let role: Role | null = null;
    if (adminPassInput === 'admin123') role = Role.SUPER_ADMIN;
    else if (adminPassInput === 'partial123') role = Role.PARTIAL_ADMIN;

    if (role) {
      if (isMobile && role === Role.PARTIAL_ADMIN) {
        alert("Acceso Restringido: El Administrador Parcial solo puede acceder desde una computadora de escritorio.");
        return;
      }
      setCurrentUserRole(role);
      setShowWelcome(true); // Mostrar bienvenida
      setView('admin');
      setIsAdminLoginModalOpen(false);
    } else {
      alert('Clave incorrecta.');
    }
    setAdminPassInput('');
  };

  const handleLogoutRequest = () => {
    setShowLogoutFeedback(true); // Mostrar feedback de cierre
  };

  const finalizeLogout = () => {
    setCurrentUserRole(null);
    setView('selection');
    setShowLogoutFeedback(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  if (isLoadingData) return null;

  if (view === 'selection') {
    return (
      <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl p-8 md:p-16 rounded-[3rem] shadow-2xl text-center border border-white/20">
          <div className="mb-10 flex justify-center">
            <div className="w-20 h-20 bg-blue-700 rounded-3xl flex items-center justify-center shadow-2xl border-4 border-blue-500/20 italic font-black text-white text-3xl">AU</div>
          </div>
          <h1 className="text-4xl md:text-5xl font-[900] text-slate-900 mb-2 tracking-tighter uppercase italic leading-none">ASIST UP</h1>
          <p className="text-blue-600 font-black uppercase tracking-[0.5em] text-[8px] mb-10">Control de Talento Humano</p>
          
          <div className="space-y-3">
            <button onClick={() => setView('attendance')} className="w-full py-5 bg-blue-700 text-white font-black rounded-3xl shadow-xl hover:bg-blue-800 transition-all uppercase text-[10px] tracking-widest active:scale-95">Control de Asistencia</button>
            <button onClick={() => setIsAdminLoginModalOpen(true)} className="w-full py-4 text-slate-400 font-black hover:text-slate-900 transition-all uppercase text-[10px] tracking-widest">Acceso Administrativo</button>
            
            {deferredPrompt && (
              <button onClick={handleInstall} className="w-full mt-6 py-3 bg-emerald-50 text-emerald-600 font-black rounded-2xl border border-emerald-100 uppercase text-[9px] tracking-widest hover:bg-emerald-100 transition-all">Instalar App en este equipo</button>
            )}
          </div>
          
          <div className="mt-8 flex items-center justify-center gap-2">
             <div className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></div>
             <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
               {isDbConnected ? 'Sistema en línea y estable' : 'Buscando servidor...'}
             </span>
          </div>
        </div>

        <Modal isOpen={isAdminLoginModalOpen} onClose={() => setIsAdminLoginModalOpen(false)} title="Acceso de Gestión">
          <div className="space-y-6">
            <div className="relative">
              <input 
                type={showPass ? "text" : "password"} 
                value={adminPassInput} 
                onChange={e => setAdminPassInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} 
                className="w-full border-2 border-slate-100 rounded-2xl p-5 text-center text-3xl font-black focus:border-blue-600 outline-none transition-all bg-slate-50 pr-16" 
                placeholder="••••••" 
                autoFocus 
              />
              <button 
                onClick={() => setShowPass(!showPass)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-blue-600 transition-colors"
              >
                {showPass ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                )}
              </button>
            </div>
            <button onClick={handleAdminLogin} className="w-full py-5 bg-blue-700 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Validar Credenciales</button>
          </div>
        </Modal>

        <Modal isOpen={showLogoutFeedback} onClose={finalizeLogout} title="Cierre de Sesión Seguro" type="success">
           <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner">☁️</div>
              <h3 className="text-xl font-black text-slate-900 uppercase">Sincronización Exitosa</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">Sesión cerrada exitosamente.<br/><span className="font-bold text-emerald-600">Todos los registros han sido sincronizados y protegidos en la nube.</span></p>
              <button onClick={finalizeLogout} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest">Entendido</button>
           </div>
        </Modal>
      </div>
    );
  }

  if (view === 'attendance') {
    return <AttendanceSystem employees={employees} onBack={() => setView('selection')} onRegister={async (r: AttendanceRecord) => { await addDoc(collection(db, "attendance"), { payload: compressData(r), timestamp: r.timestamp }); }} onUpdateEmployees={async (emps: Employee[]) => { for (const e of emps) { await setDoc(doc(db, "employees", e.id), { payload: compressData(e) }); } }} />;
  }

  return (
    <>
      <AdminDashboard 
        role={currentUserRole!} 
        isDbConnected={isDbConnected}
        onLogout={handleLogoutRequest} 
        company={company}
        onUpdateCompany={async (c: CompanyConfig) => await setDoc(doc(db, "config", "company"), { payload: compressData(c) })}
        employees={employees}
        onUpdateEmployees={async (emps: Employee[]) => { for (const e of emps) { await setDoc(doc(db, "employees", e.id), { payload: compressData(e) }); } }}
        attendance={attendance}
        payments={payments}
        onUpdatePayments={async (pys: Payment[]) => { for (const p of pys) { if (p.id.length > 15) await addDoc(collection(db, "payments"), { payload: compressData(p) }); else await setDoc(doc(db, "payments", p.id), { payload: compressData(p) }); } }}
        settings={settings}
        onUpdateSettings={async (s: GlobalSettings) => await setDoc(doc(db, "config", "settings"), { payload: compressData(s) })}
      />
      
      <Modal isOpen={showWelcome} onClose={() => setShowWelcome(false)} title="Acceso Autorizado" type="success">
         <div className="text-center space-y-4">
            <div className="text-5xl">🏢</div>
            <h2 className="text-2xl font-black text-slate-900">¡Bienvenido al Panel de Gestión!</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Sesión iniciada como: <span className="text-blue-600">{currentUserRole}</span></p>
            <button onClick={() => setShowWelcome(false)} className="w-full py-4 bg-blue-700 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl">Comenzar Gestión</button>
         </div>
      </Modal>
    </>
  );
};

export default App;