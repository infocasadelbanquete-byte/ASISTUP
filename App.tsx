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
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  
  const [company, setCompany] = useState<CompanyConfig | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>({
    sbu: 482.00, // ACTUALIZADO SEGÚN REQUERIMIENTO 2026
    iessRate: 0.0945,
    reserveRate: 0.0833,
    schedule: {
      monFri: { in: '08:30', out: '13:00' },
      sat: { in: '08:30', out: '13:00' },
      halfDayOff: 'Miércoles tarde'
    }
  });

  useEffect(() => {
    const rescueTimer = setTimeout(() => setIsLoadingData(false), 6000);
    const unsubscribes: (() => void)[] = [];

    try {
      const unsubCompany = onSnapshot(doc(db, "config", "company"), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCompany(data.payload ? decompressData(data.payload) : data as any);
        }
        setIsLoadingData(false);
        clearTimeout(rescueTimer);
      });
      unsubscribes.push(unsubCompany);

      const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
        setEmployees(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
        }) as Employee[]);
      });
      unsubscribes.push(unsubEmployees);

      const unsubAttendance = onSnapshot(collection(db, "attendance"), (snapshot) => {
        setAttendance(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
        }) as AttendanceRecord[]);
      });
      unsubscribes.push(unsubAttendance);

      const unsubPayments = onSnapshot(collection(db, "payments"), (snapshot) => {
        setPayments(snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload), id: d.id } : { ...raw, id: d.id };
        }) as Payment[]);
      });
      unsubscribes.push(unsubPayments);
    } catch (e) {
      setIsLoadingData(false);
    }

    return () => { unsubscribes.forEach(unsub => unsub()); clearTimeout(rescueTimer); };
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
    } else { alert('Clave incorrecta.'); }
    setAdminPassInput('');
  };

  if (isLoadingData) return null;

  if (view === 'selection') {
    return (
      <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl p-16 rounded-[4rem] shadow-2xl text-center border border-white/20">
          <div className="mb-14 flex justify-center">
            <div className="w-24 h-24 bg-blue-700 rounded-3xl flex items-center justify-center shadow-2xl border-4 border-blue-500/20 italic font-black text-white text-4xl">AU</div>
          </div>
          <h1 className="text-5xl font-[900] text-slate-900 mb-2 tracking-tighter uppercase italic leading-none">ASIST UP</h1>
          <p className="text-blue-600 font-black uppercase tracking-[0.5em] text-[9px] mb-12">Control de Talento Humano</p>
          <div className="space-y-4">
            <button onClick={() => setView('attendance')} className="w-full py-6 bg-blue-700 text-white font-black rounded-3xl shadow-xl hover:bg-blue-800 transition-all uppercase text-xs tracking-widest active:scale-95">Control de Asistencia</button>
            <button onClick={() => setIsAdminLoginModalOpen(true)} className="w-full py-4 text-slate-400 font-black hover:text-slate-900 transition-all uppercase text-[10px] tracking-widest">Acceso Administrativo</button>
          </div>
        </div>

        <Modal isOpen={isAdminLoginModalOpen} onClose={() => setIsAdminLoginModalOpen(false)} title="Login Administrativo">
          <div className="space-y-6">
            <input type="password" value={adminPassInput} onChange={e => setAdminPassInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} className="w-full border-2 border-slate-100 rounded-2xl p-5 text-center text-3xl font-black focus:border-blue-600 outline-none transition-all bg-slate-50" placeholder="••••••" autoFocus />
            <button onClick={handleAdminLogin} className="w-full py-5 bg-blue-700 text-white font-black rounded-2xl uppercase text-xs tracking-widest shadow-lg">Entrar al Sistema</button>
          </div>
        </Modal>
      </div>
    );
  }

  if (view === 'attendance') {
    return <AttendanceSystem employees={employees} onBack={() => setView('selection')} onRegister={async (r) => { await addDoc(collection(db, "attendance"), { payload: compressData(r), timestamp: r.timestamp }); }} onUpdateEmployees={async (emps) => { for (const e of emps) { await setDoc(doc(db, "employees", e.id), { payload: compressData(e) }); } }} />;
  }

  return (
    <AdminDashboard 
      role={currentUserRole!} 
      onLogout={() => { setCurrentUserRole(null); setView('selection'); }} 
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
  );
};

export default App;