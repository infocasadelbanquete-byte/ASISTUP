
import React, { useState, useEffect } from 'react';
import { CompanyConfig, Employee, Role, AttendanceRecord, Payment, GlobalSettings } from './types.ts';
import AdminDashboard from './views/AdminDashboard.tsx';
import AttendanceSystem from './views/AttendanceSystem.tsx';
import Modal from './components/Modal.tsx';
import { db, collection, doc, onSnapshot, setDoc, addDoc, compressData, decompressData } from './firebase.ts';

const App: React.FC = () => {
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const [view, setView] = useState<'selection' | 'admin' | 'attendance'>('selection');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Data State
  const [company, setCompany] = useState<CompanyConfig | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>({
    sbu: 460,
    iessRate: 0.0945,
    reserveRate: 0.0833,
    schedule: {
      weekdays: {
        morning: { start: '08:30', end: '13:00', enabled: true },
        afternoon: { start: '14:30', end: '18:30', enabled: true }
      },
      saturdays: {
        morning: { start: '08:30', end: '13:00', enabled: true },
        afternoon: { start: '14:00', end: '18:00', enabled: false }
      }
    }
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Listeners de Firestore
    const unsubCompany = onSnapshot(doc(db, "config", "company"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCompany(data.payload ? decompressData(data.payload) : data as CompanyConfig);
      }
      setIsLoading(false);
    }, () => setIsLoading(false));

    const unsubSettings = onSnapshot(doc(db, "config", "settings"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const loadedSettings = data.payload ? decompressData(data.payload) : data as GlobalSettings;
        setSettings(prev => ({ ...prev, ...loadedSettings }));
      }
    });

    const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
      const data = snapshot.docs.map(d => {
        const raw = d.data();
        return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
      }) as Employee[];
      setEmployees(data);
    });

    const unsubAttendance = onSnapshot(collection(db, "attendance"), (snapshot) => {
      const data = snapshot.docs.map(d => {
        const raw = d.data();
        return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
      }) as AttendanceRecord[];
      setAttendance(data);
    });

    const unsubPayments = onSnapshot(collection(db, "payments"), (snapshot) => {
      const data = snapshot.docs.map(d => {
        const raw = d.data();
        return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
      }) as Payment[];
      setPayments(data);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubCompany(); unsubSettings(); unsubEmployees(); unsubAttendance(); unsubPayments();
    };
  }, []);

  const handleAdminLogin = () => {
    if (adminPassInput === 'admin123') {
      setCurrentUserRole(Role.SUPER_ADMIN);
      setView('admin');
      setIsAdminLoginModalOpen(false);
    } else if (adminPassInput === 'partial123') {
      setCurrentUserRole(Role.PARTIAL_ADMIN);
      setView('admin');
      setIsAdminLoginModalOpen(false);
    } else {
      alert('Contraseña Incorrecta');
    }
    setAdminPassInput('');
  };

  const CloudStatus = () => (
    <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 bg-white/95 backdrop-blur-md px-4 py-2 rounded-full shadow-xl border border-slate-200 no-print">
      <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-red-500'}`}></div>
      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
        {isOnline ? 'NUBE ACTIVA' : 'MODO OFFLINE'}
      </span>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-blue flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-white font-black text-[10px] tracking-[0.4em] uppercase">Sincronizando con Firebase...</div>
      </div>
    );
  }

  if (view === 'selection') {
    return (
      <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-6 relative">
        <CloudStatus />
        
        <button 
          onClick={() => setIsAdminLoginModalOpen(true)}
          className="absolute top-10 right-10 text-white opacity-20 hover:opacity-100 p-2 no-print transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        </button>

        <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl p-16 rounded-[4rem] shadow-2xl text-center fade-in">
          <div className="mb-14 flex justify-center">
            <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center shadow-xl">
              <svg viewBox="0 0 100 100" className="w-12 h-12 stroke-white fill-none" strokeWidth="8"><path d="M20 80V60M50 80V40M80 80V20" strokeOpacity="0.5"/><path d="M20 50L50 30L80 10" stroke="#3b82f6"/></svg>
            </div>
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter">ASIST UP</h1>
          <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[9px] mb-12">Gestión Administrativa y Asistencia</p>
          <button 
            onClick={() => setView('attendance')}
            className="w-full py-6 bg-blue-600 text-white font-black rounded-3xl shadow-xl hover:bg-blue-700 transition-all active:scale-95 text-lg uppercase"
          >
            MARCAR ASISTENCIA
          </button>
        </div>

        <Modal 
          isOpen={isAdminLoginModalOpen} 
          onClose={() => setIsAdminLoginModalOpen(false)} 
          title="Login Administrativo"
          footer={<button onClick={handleAdminLogin} className="px-10 py-3 bg-blue-600 text-white font-black rounded-xl text-xs uppercase">Ingresar</button>}
        >
          <div className="space-y-6">
            <input 
              type="password" 
              value={adminPassInput} 
              onChange={e => setAdminPassInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdminLogin(); }}
              className="w-full border-2 rounded-2xl p-5 text-center text-3xl font-black outline-none focus:border-blue-500"
              placeholder="••••••"
              autoFocus
            />
            <p className="text-[10px] text-slate-400 text-center italic uppercase font-bold tracking-widest">Presione ENTER para acceder</p>
          </div>
        </Modal>
      </div>
    );
  }

  if (view === 'attendance') {
    return (
      <>
        <CloudStatus />
        <AttendanceSystem 
          employees={employees} 
          onRegister={async (r) => {
            await addDoc(collection(db, "attendance"), { payload: compressData(r), timestamp: r.timestamp });
          }} 
          onBack={() => setView('selection')}
          onUpdateEmployees={async (emps) => {
            for (const e of emps) {
              await setDoc(doc(db, "employees", e.id), { payload: compressData(e) });
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <CloudStatus />
      <AdminDashboard 
        role={currentUserRole!} 
        onLogout={() => setView('selection')} 
        company={company}
        onUpdateCompany={async (c) => await setDoc(doc(db, "config", "company"), { payload: compressData(c) })}
        employees={employees}
        onUpdateEmployees={async (emps) => {
          for (const e of emps) {
            await setDoc(doc(db, "employees", e.id), { payload: compressData(e) });
          }
        }}
        attendance={attendance}
        payments={payments}
        onUpdatePayments={async (pys) => {
          for (const p of pys) {
            if (p.id) {
              await setDoc(doc(db, "payments", p.id), { payload: compressData(p) });
            } else {
              await addDoc(collection(db, "payments"), { payload: compressData(p) });
            }
          }
        }}
        settings={settings}
        onUpdateSettings={async (s) => await setDoc(doc(db, "config", "settings"), { payload: compressData(s) })}
      />
    </>
  );
};

export default App;
