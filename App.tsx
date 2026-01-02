
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
      unsubCompany(); unsubSettings(); unsubEmployees(); unsubAttendance(); unsubPayments();
    };
  }, []);

  const handleRegisterAttendance = async (record: AttendanceRecord) => {
    try {
      const compressedPayload = compressData(record);
      await addDoc(collection(db, "attendance"), { payload: compressedPayload, timestamp: record.timestamp });
    } catch (e) {
      console.error("Error al registrar asistencia:", e);
    }
  };

  const handleUpdateEmployees = async (newEmployees: Employee[]) => {
    for (const emp of newEmployees) {
      const compressedPayload = compressData(emp);
      await setDoc(doc(db, "employees", emp.id), { payload: compressedPayload });
    }
  };

  const handleUpdateCompany = async (config: CompanyConfig) => {
    const compressedPayload = compressData(config);
    await setDoc(doc(db, "config", "company"), { payload: compressedPayload });
  };

  const handleUpdatePayments = async (newPayments: Payment[]) => {
    for (const pay of newPayments) {
      const compressedPayload = compressData(pay);
      await setDoc(doc(db, "payments", pay.id), { payload: compressedPayload });
    }
  };

  const handleUpdateSettings = async (newSettings: GlobalSettings) => {
    const compressedPayload = compressData(newSettings);
    await setDoc(doc(db, "config", "settings"), { payload: compressedPayload });
  };

  const handleAdminLogin = () => {
    if (adminPassInput === 'admin123') {
      setCurrentUserRole(Role.SUPER_ADMIN);
      setView('admin');
      setIsAdminLoginModalOpen(false);
      setAdminPassInput('');
    } else if (adminPassInput === 'partial123') {
      setCurrentUserRole(Role.PARTIAL_ADMIN);
      setView('admin');
      setIsAdminLoginModalOpen(false);
      setAdminPassInput('');
    } else {
      alert('Contraseña Incorrecta');
      setAdminPassInput('');
    }
  };

  if (view === 'selection') {
    return (
      <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <button 
          onClick={() => setIsAdminLoginModalOpen(true)}
          className="absolute top-10 right-10 text-white opacity-20 hover:opacity-100 hover:scale-110 transition-all duration-700 z-50 p-2"
          title="Administración"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
        </button>

        <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl p-16 md:p-20 rounded-[4rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] text-center fade-in border border-white/20">
          <div className="mb-14 flex justify-center">
            <div className="w-32 h-32 bg-gradient-to-br from-slate-800 to-slate-950 rounded-[2.5rem] flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.4)] ring-1 ring-white/10 logo-shimmer group transform transition-transform duration-700 hover:scale-105">
              <svg viewBox="0 0 100 100" className="w-16 h-16 fill-none stroke-white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M25 75V60" strokeOpacity="0.3" />
                <path d="M45 75V45" strokeOpacity="0.6" />
                <path d="M65 75V30" strokeOpacity="0.8" />
                <path d="M25 55L45 35L60 50L85 15" stroke="#3b82f6" strokeWidth="8" />
              </svg>
            </div>
          </div>
          
          <h1 className="text-5xl font-[900] text-slate-900 mb-4 tracking-tight">ASIST UP</h1>
          <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px] mb-14 opacity-80">Enterprise Resource Planning</p>
          
          <button 
            onClick={() => { setView('attendance'); }}
            className="w-full py-6 bg-slate-900 text-white font-[900] rounded-3xl transition-all shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] active:scale-95 hover:bg-blue-600 flex items-center justify-center gap-4 text-lg group overflow-hidden relative"
          >
            <span className="relative z-10 flex items-center gap-3">
              <svg className="w-6 h-6 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              CONTROL DE ASISTENCIA
            </span>
          </button>
          
          <div className="mt-16 pt-10 border-t border-slate-100 flex items-center justify-center gap-10">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Real-time Sync</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">AES-256 Cloud</span>
            </div>
          </div>
        </div>

        <Modal 
          isOpen={isAdminLoginModalOpen} 
          onClose={() => setIsAdminLoginModalOpen(false)} 
          title="Acceso Administrativo"
          footer={
            <div className="flex gap-2">
              <button onClick={() => setIsAdminLoginModalOpen(false)} className="px-6 py-2 text-gray-400 font-black text-[10px] uppercase">Cancelar</button>
              <button onClick={handleAdminLogin} className="px-8 py-2 bg-blue-600 text-white font-black rounded-xl text-[10px] uppercase">Ingresar</button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500 font-medium">Por favor, ingrese la contraseña de acceso para el panel de control:</p>
            <input 
              type="password" 
              value={adminPassInput} 
              onChange={e => setAdminPassInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              className="w-full border-gray-200 border-2 rounded-2xl p-4 text-center text-xl font-black tracking-[0.5em] outline-none focus:border-blue-500"
              placeholder="••••••••"
              autoFocus
            />
            <p className="text-[9px] text-slate-400 font-bold uppercase text-center italic">Cifrado de grado militar activo</p>
          </div>
        </Modal>
        
        <div className="absolute bottom-8 text-white/20 text-[9px] font-black uppercase tracking-[0.5em] select-none">
          Ecuador Industrial Standard Compliance
        </div>
      </div>
    );
  }

  if (view === 'attendance') {
    return (
      <AttendanceSystem 
        employees={employees} 
        onRegister={handleRegisterAttendance} 
        onBack={() => setView('selection')}
        onUpdateEmployees={handleUpdateEmployees}
      />
    );
  }

  return (
    <AdminDashboard 
      role={currentUserRole!} 
      onLogout={() => setView('selection')} 
      company={company}
      onUpdateCompany={handleUpdateCompany}
      employees={employees}
      onUpdateEmployees={handleUpdateEmployees}
      attendance={attendance}
      payments={payments}
      onUpdatePayments={handleUpdatePayments}
      settings={settings}
      onUpdateSettings={handleUpdateSettings}
    />
  );
};

export default App;
