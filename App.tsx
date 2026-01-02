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
    let companyLoaded = false;
    
    const unsub = [
      onSnapshot(doc(db, "config", "company"), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.payload) {
            setCompany(decompressData(data.payload));
          } else {
            const { name, legalRep, ruc, address, phone, email, logo } = data as any;
            setCompany({ name: name || '', legalRep: legalRep || '', ruc: ruc || '', address: address || '', phone: phone || '', email: email || '', logo: logo || '' });
          }
        }
        companyLoaded = true;
        setIsLoading(false);
      }, (err) => {
        console.error("Firebase Company Error:", err);
        companyLoaded = true;
        setIsLoading(false);
      }),

      onSnapshot(collection(db, "employees"), (snapshot) => {
        setEmployees(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
        }) as Employee[]);
      }),

      onSnapshot(collection(db, "attendance"), (snapshot) => {
        setAttendance(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
        }) as AttendanceRecord[]);
      }),

      onSnapshot(collection(db, "payments"), (snapshot) => {
        setPayments(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
        }) as Payment[]);
      })
    ];

    const timer = setTimeout(() => {
      if (!companyLoaded) setIsLoading(false);
    }, 4000);

    return () => {
      unsub.forEach(u => u());
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const loader = document.getElementById('initial-loader');
    if (!isLoading && loader) {
      loader.style.opacity = '0';
      setTimeout(() => {
        if (loader.parentNode) loader.remove();
      }, 500);
    }
  }, [isLoading]);

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
      alert('Clave incorrecta');
    }
    setAdminPassInput('');
  };

  if (isLoading) return null;

  if (view === 'selection') {
    return (
      <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-6 relative">
        <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl p-16 rounded-[4rem] shadow-2xl text-center fade-in">
          <div className="mb-14 flex justify-center">
            <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center shadow-xl">
              <svg viewBox="0 0 100 100" className="w-12 h-12 stroke-white fill-none" strokeWidth="8"><path d="M20 50L50 30L80 10" stroke="#3b82f6"/></svg>
            </div>
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter">ASIST UP</h1>
          <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[9px] mb-12">Panel de Control General</p>
          <div className="space-y-4">
            <button onClick={() => setView('attendance')} className="w-full py-6 bg-blue-600 text-white font-black rounded-3xl shadow-xl hover:bg-blue-700 transition-all uppercase text-sm">Registro de Asistencia</button>
            <button onClick={() => setIsAdminLoginModalOpen(true)} className="w-full py-4 text-slate-400 font-black hover:text-slate-900 transition-all uppercase text-[10px] tracking-widest">Acceso Administrativo</button>
          </div>
        </div>

        <Modal isOpen={isAdminLoginModalOpen} onClose={() => setIsAdminLoginModalOpen(false)} title="Login Administrativo">
          <div className="space-y-6">
            <input 
              type="password" 
              value={adminPassInput} 
              onChange={e => setAdminPassInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              className="w-full border-2 rounded-2xl p-5 text-center text-3xl font-black focus:border-blue-500 outline-none"
              placeholder="••••••"
              autoFocus
            />
            <button onClick={handleAdminLogin} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl uppercase text-xs">Entrar al Sistema</button>
          </div>
        </Modal>
      </div>
    );
  }

  if (view === 'attendance') {
    return (
      <AttendanceSystem 
        employees={employees} 
        onBack={() => setView('selection')}
        onRegister={async (r) => {
          await addDoc(collection(db, "attendance"), { payload: compressData(r), timestamp: r.timestamp });
        }}
        onUpdateEmployees={async (emps) => {
          for (const e of emps) {
            await setDoc(doc(db, "employees", e.id), { payload: compressData(e) });
          }
        }}
      />
    );
  }

  return (
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
          if (p.id.length > 15) await addDoc(collection(db, "payments"), { payload: compressData(p) });
          else await setDoc(doc(db, "payments", p.id), { payload: compressData(p) });
        }
      }}
      settings={settings}
      onUpdateSettings={async (s) => await setDoc(doc(db, "config", "settings"), { payload: compressData(s) })}
    />
  );
};

export default App;