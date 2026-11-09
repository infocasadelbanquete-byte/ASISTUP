
import React, { useState, useEffect, useRef } from 'react';
import { CompanyConfig, Employee, Role, AttendanceRecord, Payment, GlobalSettings, SavedReport } from './types.ts';
import AdminDashboard from './views/AdminDashboard.tsx';
import AttendanceSystem from './views/AttendanceSystem.tsx';
import Modal from './components/Modal.tsx';
import { db, collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, compressData, decompressData } from './firebase.ts';
import { DEFAULT_SYSTEM_UPDATE } from './constants.tsx';

const App: React.FC = () => {
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const [view, setView] = useState<'selection' | 'admin' | 'attendance' | 'setup'>('selection');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryRuc, setRecoveryRuc] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');

  const unsubscribesRef = useRef<(() => void)[]>([]);

  const [appMode, setAppMode] = useState<'full' | 'attendance' | null>(
    (localStorage.getItem('app_mode') as 'full' | 'attendance') || null
  );

  const [showLogoutFeedback, setShowLogoutFeedback] = useState(false);
  const [modalAlert, setModalAlert] = useState<{isOpen: boolean, title: string, message: string, type: 'info' | 'success' | 'error'}>({
    isOpen: false, title: '', message: '', type: 'info'
  });
  
  const [company, setCompany] = useState<CompanyConfig | null>(() => {
    try {
      const cached = localStorage.getItem('cache_company');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const cached = localStorage.getItem('cache_employees');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    try {
      const cached = localStorage.getItem('cache_attendance');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [payments, setPayments] = useState<Payment[]>(() => {
    try {
      const cached = localStorage.getItem('cache_payments');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [savedReports, setSavedReports] = useState<SavedReport[]>(() => {
    try {
      const cached = localStorage.getItem('cache_saved_reports');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });

  const defaultSettings: GlobalSettings = {
    sbu: 482.00,
    sbuPrev: 460.00,
    iessRate: 0.0945,
    reserveRate: 0.0833,
    holidays: [],
    schedule: {
      monFri: { in1: '08:30', out1: '13:00', in2: '15:00', out2: '18:00' },
      sat: { in: '08:30', out: '13:00' },
      halfDayOff: 'Miércoles tarde'
    },
    systemUpdate: DEFAULT_SYSTEM_UPDATE
  };

  const [settings, setSettings] = useState<GlobalSettings>(() => {
    try {
      const cached = localStorage.getItem('cache_settings');
      return cached ? { ...defaultSettings, ...JSON.parse(cached) } : defaultSettings;
    } catch (e) {
      return defaultSettings;
    }
  });

  useEffect(() => {
    if (settings.systemUpdate && settings.systemUpdate.version) {
      const currentInstalled = localStorage.getItem('asistup_device_version');
      if (currentInstalled !== settings.systemUpdate.version) {
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(`ACTUALIZACIÓN OBLIGATORIA DISPONIBLE: ${settings.systemUpdate.version}`, {
              body: `${settings.systemUpdate.title}. Actualización obligatoria requerida al abrir el terminal antes de marcar.`,
              icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='none' stroke='%233b82f6' stroke-width='6'/%3E%3C/svg%3E"
            });
          } catch (e) {}
        }
      }
    }
  }, [settings.systemUpdate]);

  useEffect(() => {
    if (!appMode) {
      setView('setup');
    }
  }, [appMode]);

  const handleSetDeviceMode = (mode: 'full' | 'attendance') => {
    localStorage.setItem('app_mode', mode);
    setAppMode(mode);
    setView('selection');
  };

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
        setIsRecoveryMode(false);
        setModalAlert(prev => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('keydown', handleEsc);
    
    cleanListeners();

    // Temporizador de seguridad para garantizar que la pantalla inicial nunca se quede en blanco
    const safetyTimer = setTimeout(() => {
      setIsLoadingData(false);
    }, 1500);

    const handleFirestoreError = (module: string, error: any) => {
      console.warn(`Firestore Error [${module}]:`, error.message || error);
      setIsDbConnected(false);
      
      const cached = localStorage.getItem(`cache_${module.toLowerCase()}`);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          if (module === 'Company') setCompany(data);
          if (module === 'Settings') setSettings(data);
          if (module === 'Employees') setEmployees(data);
          if (module === 'Attendance') setAttendance(data);
          if (module === 'Payments') setPayments(data);
          if (module === 'SavedReports') setSavedReports(data);
        } catch (e) {
          console.error("Error al restaurar caché:", e);
        }
      }
      setIsLoadingData(false);
    };

    try {
      const unsubCompany = onSnapshot(doc(db, "config", "company"), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const decompressed = data.payload ? decompressData(data.payload as string) : data as any;
          if (decompressed) {
            setCompany(decompressed);
            localStorage.setItem('cache_company', JSON.stringify(decompressed));
          }
        } else {
          // Si el documento remoto aún no existe, revisar si hay datos locales para inicializar
          const cached = localStorage.getItem('cache_company');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              setCompany(parsed);
              setDoc(doc(db, "config", "company"), { payload: compressData(parsed) }).catch(() => {});
            } catch (e) {}
          }
        }
        setIsDbConnected(true);
        setIsLoadingData(false);
      }, (err) => handleFirestoreError('Company', err));
      unsubscribesRef.current.push(unsubCompany);

      const unsubSettings = onSnapshot(doc(db, "config", "settings"), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const dbSettings = data.payload ? decompressData(data.payload as string) : data as any;
          if (dbSettings) {
            // Verificar si el código desplegado tiene una versión superior o actualizada respecto a Firestore
            const dbVersion = dbSettings.systemUpdate?.version;
            const isCodebaseNewer = !dbVersion || dbVersion !== DEFAULT_SYSTEM_UPDATE.version;

            const effectiveUpdate = isCodebaseNewer
              ? DEFAULT_SYSTEM_UPDATE
              : (dbSettings.systemUpdate || DEFAULT_SYSTEM_UPDATE);

            const mergedSettings = {
              ...defaultSettings,
              ...dbSettings,
              systemUpdate: effectiveUpdate,
              schedule: {
                ...defaultSettings.schedule,
                ...(dbSettings.schedule || {}),
                monFri: {
                  ...defaultSettings.schedule.monFri,
                  ...(dbSettings.schedule?.monFri || {})
                },
                sat: {
                  ...defaultSettings.schedule.sat,
                  ...(dbSettings.schedule?.sat || {})
                }
              }
            };
            setSettings(mergedSettings);
            localStorage.setItem('cache_settings', JSON.stringify(mergedSettings));

            // Si el código desplegado es más nuevo que la base de datos, sincronizar automáticamente a Firestore
            // para que TODOS los demás dispositivos instalados reciban la notificación obligatoria de inmediato
            if (isCodebaseNewer) {
              setDoc(doc(db, "config", "settings"), { payload: compressData(mergedSettings) }).catch(() => {});
            }
          }
        } else {
          const cached = localStorage.getItem('cache_settings');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              const withLatestUpdate = { ...defaultSettings, ...parsed, systemUpdate: DEFAULT_SYSTEM_UPDATE };
              setSettings(withLatestUpdate);
              setDoc(doc(db, "config", "settings"), { payload: compressData(withLatestUpdate) }).catch(() => {});
            } catch (e) {
              setSettings(defaultSettings);
              setDoc(doc(db, "config", "settings"), { payload: compressData(defaultSettings) }).catch(() => {});
            }
          } else {
            setSettings(defaultSettings);
            setDoc(doc(db, "config", "settings"), { payload: compressData(defaultSettings) }).catch(() => {});
          }
        }
      }, (err) => handleFirestoreError('Settings', err));
      unsubscribesRef.current.push(unsubSettings);

      const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
        const data = snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload as string), id: d.id } : { ...raw, id: d.id };
        }).filter(Boolean) as Employee[];

        if (data.length > 0) {
          setEmployees(data);
          localStorage.setItem('cache_employees', JSON.stringify(data));
        } else {
          // Si Firestore está vacío pero existe información local previamente guardada, preservarla y sincronizar
          const cached = localStorage.getItem('cache_employees');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setEmployees(parsed);
                parsed.forEach(e => {
                  setDoc(doc(db, "employees", e.id), { payload: compressData(e) }).catch(() => {});
                });
              }
            } catch (e) {}
          }
        }
      }, (err) => handleFirestoreError('Employees', err));
      unsubscribesRef.current.push(unsubEmployees);

      const unsubAttendance = onSnapshot(collection(db, "attendance"), (snapshot) => {
        const data = snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload as string), id: d.id } : { ...raw, id: d.id };
        }).filter(Boolean) as AttendanceRecord[];

        if (data.length > 0) {
          setAttendance(data);
          localStorage.setItem('cache_attendance', JSON.stringify(data));
        } else {
          const cached = localStorage.getItem('cache_attendance');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setAttendance(parsed);
                parsed.forEach(r => {
                  setDoc(doc(db, "attendance", r.id), { payload: compressData(r), timestamp: r.timestamp }).catch(() => {});
                });
              }
            } catch (e) {}
          }
        }
      }, (err) => handleFirestoreError('Attendance', err));
      unsubscribesRef.current.push(unsubAttendance);

      const unsubPayments = onSnapshot(collection(db, "payments"), (snapshot) => {
        const data = snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload as string), id: d.id } : { ...raw, id: d.id };
        }).filter(Boolean) as Payment[];

        if (data.length > 0) {
          setPayments(data);
          localStorage.setItem('cache_payments', JSON.stringify(data));
        } else {
          const cached = localStorage.getItem('cache_payments');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setPayments(parsed);
                parsed.forEach(p => {
                  setDoc(doc(db, "payments", p.id), { payload: compressData(p) }).catch(() => {});
                });
              }
            } catch (e) {}
          }
        }
      }, (err) => handleFirestoreError('Payments', err));
      unsubscribesRef.current.push(unsubPayments);

      const unsubSavedReports = onSnapshot(collection(db, "saved_reports"), (snapshot) => {
        const data = snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload as string), id: d.id } : { ...raw, id: d.id };
        }).filter(Boolean) as SavedReport[];

        if (data.length > 0) {
          setSavedReports(data);
          localStorage.setItem('cache_saved_reports', JSON.stringify(data));
        } else {
          const cached = localStorage.getItem('cache_saved_reports');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setSavedReports(parsed);
              }
            } catch (e) {}
          }
        }
      }, (err) => handleFirestoreError('SavedReports', err));
      unsubscribesRef.current.push(unsubSavedReports);

    } catch (e) {
      console.error("Initial load failed:", e);
      setIsLoadingData(false);
    }

    return () => {
      clearTimeout(safetyTimer);
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
      setView('admin');
      setIsAdminLoginModalOpen(false);
    } else {
      showAlert("Error de Acceso", "Credencial no válida o sin privilegios.", "error");
    }
    setAdminPassInput('');
  };

  const handleEmergencyRecovery = () => {
    const MASTER_RECOVERY_KEY = "ASISTUP-MASTER-ACCESS-2026";
    if (recoveryRuc === company?.ruc && recoveryKey === MASTER_RECOVERY_KEY) {
      setCurrentUserRole(Role.SUPER_ADMIN);
      localStorage.setItem('admin_logged_in', 'true');
      setView('admin');
      setIsAdminLoginModalOpen(false);
      setIsRecoveryMode(false);
      setRecoveryRuc('');
      setRecoveryKey('');
    } else {
      showAlert("Fallo de Autenticación", "Los datos de recuperación de emergencia son incorrectos.", "error");
    }
  };

  const finalizeLogout = () => {
    setCurrentUserRole(null);
    localStorage.removeItem('admin_logged_in');
    setView('selection');
    setShowLogoutFeedback(false);
  };

  useEffect(() => {
    if (showLogoutFeedback) {
      const timer = setTimeout(() => {
        finalizeLogout();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showLogoutFeedback]);

  const handleUpdateCompany = async (c: CompanyConfig) => {
    setCompany(c);
    localStorage.setItem('cache_company', JSON.stringify(c));
    await setDoc(doc(db, "config", "company"), { payload: compressData(c) }).catch(e => console.warn("Update company in Firestore failed:", e));
  };

  const handleUpdateSettings = async (s: GlobalSettings) => {
    setSettings(s);
    localStorage.setItem('cache_settings', JSON.stringify(s));
    await setDoc(doc(db, "config", "settings"), { payload: compressData(s) }).catch(e => console.warn("Update settings in Firestore failed:", e));
  };

  const handleUpdateEmployees = async (emps: Employee[]) => {
    // Actualización inmediata en memoria y caché local
    setEmployees(emps);
    localStorage.setItem('cache_employees', JSON.stringify(emps));

    try {
      const currentIds = new Set<string>(emps.map(e => e.id));
      const previousIds = new Set<string>(employees.map(e => e.id));
      const deletePromises: Promise<any>[] = [];
      for (const id of previousIds) {
        if (!currentIds.has(id)) {
          deletePromises.push(deleteDoc(doc(db, "employees", id)).catch(e => console.warn("Delete employee failed:", e)));
        }
      }
      const savePromises = emps.map(e => 
        setDoc(doc(db, "employees", e.id), { payload: compressData(e) }).catch(e => console.warn("Save employee failed:", e))
      );
      await Promise.allSettled([...deletePromises, ...savePromises]);
    } catch (e) {
      console.warn("Update employees Firestore sync error:", e);
    }
  };

  const handleUpdatePayments = async (pys: Payment[]) => {
    setPayments(pys);
    localStorage.setItem('cache_payments', JSON.stringify(pys));

    try {
      const currentIds = new Set<string>(pys.map(p => p.id));
      const previousIds = new Set<string>(payments.map(p => p.id));
      const deletePromises: Promise<any>[] = [];
      for (const id of previousIds) {
        if (!currentIds.has(id)) {
          deletePromises.push(deleteDoc(doc(db, "payments", id)).catch(e => console.warn("Delete payment failed:", e)));
        }
      }
      const savePromises = pys.map(p => 
        setDoc(doc(db, "payments", p.id), { payload: compressData(p) }).catch(e => console.warn("Update payment failed:", e))
      );
      await Promise.allSettled([...deletePromises, ...savePromises]);
    } catch (e) {
      console.warn("Update payments Firestore sync error:", e);
    }
  };

  const handleUpdateAttendance = async (recs: AttendanceRecord[]) => {
    setAttendance(prev => {
      const recMap = new Map(recs.map(r => [r.id, r]));
      const updated = prev.map(item => recMap.has(item.id) ? recMap.get(item.id)! : item);
      for (const r of recs) {
        if (!prev.some(item => item.id === r.id)) {
          updated.push(r);
        }
      }
      localStorage.setItem('cache_attendance', JSON.stringify(updated));
      return updated;
    });

    try {
      const savePromises = recs.map(r => 
        setDoc(doc(db, "attendance", r.id), { payload: compressData(r), timestamp: r.timestamp }).catch(e => console.warn("Update attendance failed:", e))
      );
      await Promise.allSettled(savePromises);
    } catch (e) {
      console.warn("Update attendance Firestore sync error:", e);
    }
  };

  const handleRegisterAttendance = (r: AttendanceRecord) => {
    setAttendance(prev => {
      const updated = [r, ...prev.filter(item => item.id !== r.id)];
      localStorage.setItem('cache_attendance', JSON.stringify(updated));
      return updated;
    });
    setDoc(doc(db, "attendance", r.id), { payload: compressData(r), timestamp: r.timestamp })
      .catch(e => console.warn("Marcación encolada (offline):", e));
  };

  const handleUpdateSavedReports = async (reps: SavedReport[]) => {
    setSavedReports(reps);
    localStorage.setItem('cache_saved_reports', JSON.stringify(reps));
    try {
      const savePromises = reps.map(r => 
        setDoc(doc(db, "saved_reports", r.id), { payload: compressData(r) }).catch(e => console.warn("Save report failed:", e))
      );
      await Promise.allSettled(savePromises);
    } catch (e) {
      console.warn("Update saved reports Firestore sync error:", e);
    }
  };

  if (isLoadingData) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {view === 'setup' && (
        <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-3xl p-10 md:p-16 rounded-[4rem] shadow-2xl text-center border border-white/20 fade-in">
            <h2 className="text-3xl font-[950] text-slate-900 mb-2 tracking-tighter uppercase leading-none">CONFIGURACIÓN INICIAL</h2>
            <p className="text-blue-600 font-black uppercase tracking-[0.4em] text-[9px] mb-12">Defina el tipo de instalación para este equipo</p>
            
            <div className="space-y-4">
              <button 
                onClick={() => handleSetDeviceMode('full')}
                className="w-full group p-6 border-2 border-slate-100 hover:border-blue-600 rounded-[2.5rem] bg-slate-50 transition-all text-left flex items-center gap-5 active:scale-95"
              >
                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">🖥️</div>
                <div>
                   <p className="font-black text-slate-900 text-xs uppercase tracking-tight">Administración Completa</p>
                   <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Acceso a todos los módulos y reportes.</p>
                </div>
              </button>

              <button 
                onClick={() => handleSetDeviceMode('attendance')}
                className="w-full group p-6 border-2 border-slate-100 hover:border-emerald-600 rounded-[2.5rem] bg-slate-50 transition-all text-left flex items-center gap-5 active:scale-95"
              >
                <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">🕒</div>
                <div>
                   <p className="font-black text-slate-900 text-xs uppercase tracking-tight">Terminal de Asistencia (Kiosco)</p>
                   <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Solo marcación. Sin funciones administrativas.</p>
                </div>
              </button>
            </div>
            
            <p className="text-[8px] text-slate-300 font-black uppercase mt-12 tracking-widest italic">Esta configuración podrá ser reseteada por un Super Administrador.</p>
          </div>
        </div>
      )}

      {view === 'selection' && (
        <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-3xl p-10 md:p-16 rounded-[4.5rem] shadow-2xl text-center border border-white/20">
            <h1 className="text-4xl md:text-5xl font-[950] text-slate-900 mb-2 tracking-tighter uppercase leading-none">ASIST UP</h1>
            <p className="text-blue-600 font-black uppercase tracking-[0.6em] text-[10px] mb-14">Management Suite</p>
            
            <div className="space-y-4">
              <button onClick={() => setView('attendance')} className="w-full py-6 bg-blue-700 text-white font-black rounded-[2.5rem] shadow-2xl hover:bg-blue-800 transition-all uppercase text-[11px] tracking-widest active:scale-95">Panel de Asistencia</button>
              
              {appMode === 'full' && (
                <button onClick={() => setIsAdminLoginModalOpen(true)} className="w-full py-5 text-slate-400 font-black hover:text-slate-900 transition-all uppercase text-[10px] tracking-widest">Consola Administrativa</button>
              )}
            </div>
          </div>

          <Modal isOpen={isAdminLoginModalOpen} onClose={() => { setIsAdminLoginModalOpen(false); setIsRecoveryMode(false); }} title={isRecoveryMode ? "Acceso de Emergencia" : "Autorización"} maxWidth="max-w-[320px]">
            {!isRecoveryMode ? (
              <div className="space-y-6 p-2 text-center relative">
                <button 
                  onClick={() => setIsRecoveryMode(true)} 
                  className="absolute -top-4 -right-4 w-10 h-10 flex items-center justify-center text-slate-50 hover:text-red-200 transition-colors opacity-10 hover:opacity-100 z-10"
                  aria-label="Acceso Crítico"
                >
                  <span className="text-[10px]">🛡️</span>
                </button>

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
            ) : (
              <div className="space-y-5 p-2 text-center">
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Protocolo de Emergencia</p>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="RUC INSTITUCIONAL" 
                    className="w-full p-4 border-2 rounded-xl text-[11px] font-black uppercase text-center focus:border-red-600 outline-none"
                    value={recoveryRuc}
                    onChange={e => setRecoveryRuc(e.target.value)}
                  />
                  <input 
                    type="password" 
                    placeholder="LLAVE MAESTRA DE SEGURIDAD" 
                    className="w-full p-4 border-2 rounded-xl text-[11px] font-black uppercase text-center focus:border-red-600 outline-none"
                    value={recoveryKey}
                    onChange={e => setRecoveryKey(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={handleEmergencyRecovery} className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Recuperar Acceso</button>
                  <button onClick={() => setIsRecoveryMode(false)} className="w-full py-3 bg-slate-100 text-slate-500 font-black rounded-xl uppercase text-[9px] tracking-widest">Volver</button>
                </div>
                <p className="text-[8px] text-slate-400 font-medium italic mt-2">Este acceso otorga privilegios de Super Administrador para restablecer credenciales perdidas.</p>
              </div>
            )}
          </Modal>
        </div>
      )}

      {view === 'attendance' && (
        <AttendanceSystem 
          employees={employees} 
          attendance={attendance} 
          onBack={() => setView('selection')} 
          settings={settings} 
          onRegister={handleRegisterAttendance} 
          onUpdateEmployees={handleUpdateEmployees} 
        />
      )}

      {view === 'admin' && currentUserRole && appMode === 'full' && (
        <AdminDashboard 
          role={currentUserRole} 
          isDbConnected={isDbConnected}
          onLogout={() => setShowLogoutFeedback(true)} 
          company={company}
          onUpdateCompany={handleUpdateCompany}
          employees={employees}
          onUpdateEmployees={handleUpdateEmployees}
          attendance={attendance}
          onUpdateAttendance={handleUpdateAttendance}
          payments={payments}
          onUpdatePayments={handleUpdatePayments}
          savedReports={savedReports}
          onUpdateSavedReports={handleUpdateSavedReports}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onUpdateAppMode={(mode) => { setAppMode(mode); localStorage.setItem('app_mode', mode); }}
          appMode={appMode}
        />
      )}

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
