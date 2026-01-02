
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
  const [canInstall, setCanInstall] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  
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
    // Monitor de conexión
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleCanInstall = () => setCanInstall(true);
    window.addEventListener('can-install-app', handleCanInstall);
    
    const unsubCompany = onSnapshot(doc(db, "config", "company"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCompany(data.payload ? decompressData(data.payload) : data as CompanyConfig);
      }
      setIsLoading(false);
    });

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

    return () => {
      window.removeEventListener('can-install-app', handleCanInstall);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubCompany(); unsubSettings(); unsubEmployees();
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

  const handleInstallClick = () => {
    (window as any).installApp();
  };

  // Componente de estado de nube
  const CloudStatus = () => (
    <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-slate-100 no-print transition-all hover:scale-105">
      <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-red-500'}`}></div>
      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
        {isOnline ? 'Nube Activa y Sincronizada' : 'Conexión Inestable'}
      </span>
    </div>
  );

  if (view === 'selection') {
    return (
      <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-6 relative">
        <CloudStatus />
        
        {/* Botón de Instalación */}
        <div className="absolute top-10 left-10 flex gap-4 no-print">
          <button 
            onClick={handleInstallClick}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Instalar App
          </button>
        </div>

        <button 
          onClick={() => setIsAdminLoginModalOpen(true)}
          className="absolute top-10 right-10 text-white opacity-20 hover:opacity-100 p-2 no-print"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        </button>

        <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl p-16 rounded-[4rem] shadow-2xl text-center fade-in">
          <div className="mb-14 flex justify-center">
            <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center shadow-xl">
              <svg viewBox="0 0 100 100" className="w-12 h-12 stroke-white fill-none" strokeWidth="8"><path d="M20 80V60M50 80V40M80 80V20" strokeOpacity="0.5"/><path d="M20 50L50 30L80 10" stroke="#3b82f6"/></svg>
            </div>
          </div>
          
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter">ASIST UP</h1>
          <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[9px] mb-12">Sistema de Gestión de Talento</p>
          
          <button 
            onClick={() => setView('attendance')}
            className="w-full py-6 bg-blue-600 text-white font-black rounded-3xl shadow-xl hover:bg-blue-700 transition-all active:scale-95 text-lg"
          >
            MARCAR ASISTENCIA
          </button>
        </div>

        <Modal 
          isOpen={isAdminLoginModalOpen} 
          onClose={() => setIsAdminLoginModalOpen(false)} 
          title="Acceso Administrativo"
          footer={<button onClick={handleAdminLogin} className="px-8 py-2 bg-blue-600 text-white font-black rounded-xl text-xs uppercase shadow-md">Ingresar</button>}
        >
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Credenciales Requeridas</p>
            <input 
              type="password" 
              value={adminPassInput} 
              onChange={e => setAdminPassInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdminLogin(); }}
              className="w-full border-2 rounded-2xl p-4 text-center text-2xl font-black tracking-widest outline-none focus:border-blue-500 transition-all"
              placeholder="••••••"
              autoFocus
            />
            <p className="text-[9px] text-slate-400 text-center italic">Presione Enter para acceder rápidamente</p>
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
            const compressed = compressData(r);
            await addDoc(collection(db, "attendance"), { payload: compressed, timestamp: r.timestamp });
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
            await setDoc(doc(db, "payments", p.id), { payload: compressData(p) });
          }
        }}
        settings={settings}
        onUpdateSettings={async (s) => await setDoc(doc(db, "config", "settings"), { payload: compressData(s) })}
      />
    </>
  );
};

export default App;
