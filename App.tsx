import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CompanyConfig, Employee, Role, AttendanceRecord, Payment, GlobalSettings, SavedReport, SystemBackupData } from './types.ts';
import AdminDashboard from './views/AdminDashboard.tsx';
import AttendanceSystem from './views/AttendanceSystem.tsx';
import Modal from './components/Modal.tsx';
import { db, enableNetwork, collection, doc, onSnapshot, setDoc, deleteDoc, compressData, decompressData } from './firebase.ts';
import { DEFAULT_SYSTEM_UPDATE } from './constants.tsx';
import { enqueueOfflineAction, processOfflineSync, getPendingSyncCount } from './utils/offlineSync.ts';

const App: React.FC = () => {
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const [view, setView] = useState<'selection' | 'admin' | 'attendance' | 'setup'>('selection');
  const [isDbConnected, setIsDbConnected] = useState(() => navigator.onLine);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');

  // Estado de conectividad y cola offline
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => getPendingSyncCount());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const [syncFeedbackBanner, setSyncFeedbackBanner] = useState<{ show: boolean; message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // Inicialización directa para evitar pantallas en blanco si el dispositivo inicia sin internet
  const [isLoadingData, setIsLoadingData] = useState(() => {
    if (!navigator.onLine) return false;
    const hasCache = localStorage.getItem('cache_employees') || localStorage.getItem('cache_company');
    return !hasCache;
  });

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

  const attachListeners = useCallback(() => {
    cleanListeners();
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const scheduleReconnect = () => {
      if (!navigator.onLine || reconnectTimerRef.current) return;
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (navigator.onLine) {
          enableNetwork(db).catch(() => {});
          attachListeners();
        }
      }, 5000);
    };

    const handleFirestoreError = (module: string, error: any) => {
      console.warn(`Firestore Error [${module}]:`, error?.message || error);
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
      scheduleReconnect();
    };

    try {
      const unsubCompany = onSnapshot(doc(db, "config", "company"), { includeMetadataChanges: true }, (docSnap) => {
        if (!docSnap.metadata.fromCache && navigator.onLine) {
          setIsDbConnected(true);
        } else if (navigator.onLine && docSnap.exists()) {
          setIsDbConnected(true);
        }
        if (docSnap.exists()) {
          const data = docSnap.data();
          const decompressed = data.payload ? decompressData(data.payload as string) : data as any;
          if (decompressed) {
            setCompany(decompressed);
            localStorage.setItem('cache_company', JSON.stringify(decompressed));
          }
        } else {
          const cached = localStorage.getItem('cache_company');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              setCompany(parsed);
              setDoc(doc(db, "config", "company"), { payload: compressData(parsed) }).catch(() => {});
            } catch (e) {}
          }
        }
        setIsLoadingData(false);
      }, (err) => handleFirestoreError('Company', err));
      unsubscribesRef.current.push(unsubCompany);

      const unsubSettings = onSnapshot(doc(db, "config", "settings"), (docSnap) => {
        if (!docSnap.metadata.fromCache && navigator.onLine) setIsDbConnected(true);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const dbSettings = data.payload ? decompressData(data.payload as string) : data as any;
          if (dbSettings) {
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
        if (!snapshot.metadata.fromCache && navigator.onLine) setIsDbConnected(true);
        const data = snapshot.docs.map(d => {
          const raw = d.data();
          return raw.payload ? { ...decompressData(raw.payload as string), id: d.id } : { ...raw, id: d.id };
        }).filter(Boolean) as Employee[];

        if (data.length > 0) {
          setEmployees(data);
          localStorage.setItem('cache_employees', JSON.stringify(data));
        } else {
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
        if (!snapshot.metadata.fromCache && navigator.onLine) setIsDbConnected(true);
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
        if (!snapshot.metadata.fromCache && navigator.onLine) setIsDbConnected(true);
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
        if (!snapshot.metadata.fromCache && navigator.onLine) setIsDbConnected(true);
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
  }, []);

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

    // Temporizador de seguridad para garantizar que la pantalla inicial nunca se quede en blanco
    const safetyTimer = setTimeout(() => {
      setIsLoadingData(false);
    }, 1500);

    attachListeners();

    return () => {
      clearTimeout(safetyTimer);
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      window.removeEventListener('keydown', handleEsc);
      cleanListeners();
    };
  }, [attachListeners]);

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

  // Sincronización manual y automática contra Firestore sin intermitencias
  const triggerSync = useCallback(async () => {
    if (isSyncingRef.current || !navigator.onLine) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      await enableNetwork(db).catch(() => {});
      const { syncedCount, errors } = await processOfflineSync(db);
      const remaining = getPendingSyncCount();
      setPendingSyncCount(remaining);
      if (errors === 0) {
        setIsDbConnected(true);
      }
      if (syncedCount > 0) {
        setSyncFeedbackBanner({
          show: true,
          message: `✓ Sincronización Exitosa: ${syncedCount} registro(s) sincronizado(s) con el servidor central.`,
          type: 'success'
        });
        setTimeout(() => setSyncFeedbackBanner(null), 4000);
      }
    } catch (e) {
      console.warn("Fallo durante sincronización offline:", e);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      enableNetwork(db).then(() => {
        setIsDbConnected(true);
        attachListeners();
      }).catch(() => {});
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsDbConnected(false);
      setSyncFeedbackBanner({
        show: true,
        message: 'Modo Offline Activado: El sistema seguirá operando normalmente y sincronizará los cambios al volver la conexión.',
        type: 'info'
      });
      setTimeout(() => setSyncFeedbackBanner(null), 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sincronización periódica y verificación de salud de conexión automática
    const interval = setInterval(() => {
      if (navigator.onLine) {
        if (getPendingSyncCount() > 0 && !isSyncingRef.current) {
          triggerSync();
        }
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [triggerSync, attachListeners]);

  const handleUpdateCompany = async (c: CompanyConfig) => {
    setCompany(c);
    localStorage.setItem('cache_company', JSON.stringify(c));
    if (!navigator.onLine) {
      enqueueOfflineAction('company_config', c, `Actualización empresa: ${c.name}`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }
    try {
      await setDoc(doc(db, "config", "company"), { payload: compressData(c) });
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Update company in Firestore failed, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('company_config', c, `Actualización empresa: ${c.name}`);
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  const handleUpdateSettings = async (s: GlobalSettings) => {
    setSettings(s);
    localStorage.setItem('cache_settings', JSON.stringify(s));
    if (!navigator.onLine) {
      enqueueOfflineAction('settings_config', s, 'Actualización de configuración general');
      setPendingSyncCount(getPendingSyncCount());
      return;
    }
    try {
      await setDoc(doc(db, "config", "settings"), { payload: compressData(s) });
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Update settings in Firestore failed, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('settings_config', s, 'Actualización de configuración general');
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  const handleUpdateEmployees = async (emps: Employee[]) => {
    const currentIds = new Set<string>(emps.map(e => e.id));
    const previousIds = new Set<string>(employees.map(e => e.id));
    const deletedIds: string[] = [];
    for (const id of previousIds) {
      if (!currentIds.has(id)) {
        deletedIds.push(id);
      }
    }

    // Actualización inmediata en memoria y caché local
    setEmployees(emps);
    localStorage.setItem('cache_employees', JSON.stringify(emps));

    if (!navigator.onLine) {
      enqueueOfflineAction('employee_batch', { emps, deletedIds }, `Gestión de personal (${emps.length} colaboradores)`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const deletePromises = deletedIds.map(id => deleteDoc(doc(db, "employees", id)));
      const savePromises = emps.map(e => setDoc(doc(db, "employees", e.id), { payload: compressData(e) }));
      const results = await Promise.allSettled([...deletePromises, ...savePromises]);
      if (results.some(r => r.status === 'rejected')) {
        throw new Error('Partial employee sync failure');
      }
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Update employees Firestore sync error, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('employee_batch', { emps, deletedIds }, `Gestión de personal (${emps.length} colaboradores)`);
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  const handleUpdatePayments = async (pys: Payment[]) => {
    const currentIds = new Set<string>(pys.map(p => p.id));
    const previousIds = new Set<string>(payments.map(p => p.id));
    const deletedIds: string[] = [];
    for (const id of previousIds) {
      if (!currentIds.has(id)) {
        deletedIds.push(id);
      }
    }

    setPayments(pys);
    localStorage.setItem('cache_payments', JSON.stringify(pys));

    if (!navigator.onLine) {
      enqueueOfflineAction('payment_batch', { payments: pys, deletedIds }, `Registro de nómina y pagos (${pys.length} registros)`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const deletePromises = deletedIds.map(id => deleteDoc(doc(db, "payments", id)));
      const savePromises = pys.map(p => setDoc(doc(db, "payments", p.id), { payload: compressData(p) }));
      const results = await Promise.allSettled([...deletePromises, ...savePromises]);
      if (results.some(r => r.status === 'rejected')) {
        throw new Error('Partial payment sync failure');
      }
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Update payments Firestore sync error, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('payment_batch', { payments: pys, deletedIds }, `Registro de nómina y pagos (${pys.length} registros)`);
      setPendingSyncCount(getPendingSyncCount());
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

    if (!navigator.onLine) {
      enqueueOfflineAction('attendance_batch', recs, `Lote de asistencia (${recs.length} registros)`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const savePromises = recs.map(r =>
        setDoc(doc(db, "attendance", r.id), { payload: compressData(r), timestamp: r.timestamp })
      );
      const results = await Promise.allSettled(savePromises);
      if (results.some(r => r.status === 'rejected')) {
        throw new Error('Partial attendance sync failure');
      }
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Update attendance Firestore sync error, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('attendance_batch', recs, `Lote de asistencia (${recs.length} registros)`);
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  const handleRegisterAttendance = (r: AttendanceRecord) => {
    setAttendance(prev => {
      const updated = [r, ...prev.filter(item => item.id !== r.id)];
      localStorage.setItem('cache_attendance', JSON.stringify(updated));
      return updated;
    });

    if (!navigator.onLine) {
      enqueueOfflineAction('attendance_record', r, `Marcación de asistencia (${r.type})`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    setDoc(doc(db, "attendance", r.id), { payload: compressData(r), timestamp: r.timestamp })
      .then(() => {
        setIsDbConnected(true);
      })
      .catch(e => {
        console.warn("Marcación encolada para sincronización offline:", e);
        setIsDbConnected(false);
        enqueueOfflineAction('attendance_record', r, `Marcación de asistencia (${r.type})`);
        setPendingSyncCount(getPendingSyncCount());
      });
  };

  const handleDeleteAttendance = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);

    setAttendance(prev => {
      const updated = prev.filter(item => !idSet.has(item.id));
      localStorage.setItem('cache_attendance', JSON.stringify(updated));
      return updated;
    });

    if (!navigator.onLine) {
      enqueueOfflineAction('attendance_delete', ids, `Anulación/reemplazo de asistencia (${ids.length} registros)`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const deletePromises = ids.map(id => deleteDoc(doc(db, "attendance", id)));
      const results = await Promise.allSettled(deletePromises);
      if (results.some(r => r.status === 'rejected')) {
        throw new Error('Partial delete attendance sync failure');
      }
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Delete attendance Firestore sync error, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('attendance_delete', ids, `Anulación/reemplazo de asistencia (${ids.length} registros)`);
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  const handleUpdateSavedReports = async (reps: SavedReport[]) => {
    setSavedReports(reps);
    localStorage.setItem('cache_saved_reports', JSON.stringify(reps));

    if (!navigator.onLine) {
      enqueueOfflineAction('saved_reports_batch', reps, `Guardado de reportes (${reps.length})`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const savePromises = reps.map(r => setDoc(doc(db, "saved_reports", r.id), { payload: compressData(r) }));
      const results = await Promise.allSettled(savePromises);
      if (results.some(r => r.status === 'rejected')) {
        throw new Error('Partial saved reports sync failure');
      }
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Update saved reports Firestore sync error, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('saved_reports_batch', reps, `Guardado de reportes (${reps.length})`);
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  const handleRestoreBackup = async (backup: SystemBackupData): Promise<{ syncedOnline: boolean }> => {
    const syncTasks: Promise<any>[] = [];
    let anyOfflineOrError = !navigator.onLine;

    if (backup.company && typeof backup.company === 'object') {
      const nextCompany = backup.company;
      setCompany(nextCompany);
      localStorage.setItem('cache_company', JSON.stringify(nextCompany));
      if (!navigator.onLine) {
        enqueueOfflineAction('company_config', nextCompany, `Restauración empresa: ${nextCompany.name || 'Compañía'}`);
      } else {
        syncTasks.push(
          setDoc(doc(db, "config", "company"), { payload: compressData(nextCompany) }).catch(() => {
            anyOfflineOrError = true;
            enqueueOfflineAction('company_config', nextCompany, `Restauración empresa: ${nextCompany.name || 'Compañía'}`);
          })
        );
      }
    }

    if (backup.settings && typeof backup.settings === 'object') {
      const s = backup.settings;
      const mergedSettings: GlobalSettings = {
        ...defaultSettings,
        ...s,
        holidays: Array.isArray(s.holidays) ? s.holidays : [],
        schedule: {
          ...defaultSettings.schedule,
          ...(s.schedule || {}),
          monFri: {
            ...defaultSettings.schedule.monFri,
            ...(s.schedule?.monFri || {}),
          },
          sat: {
            ...defaultSettings.schedule.sat,
            ...(s.schedule?.sat || {}),
          },
        },
        systemUpdate: {
          ...DEFAULT_SYSTEM_UPDATE,
          ...(s.systemUpdate || {}),
          changelog: Array.isArray(s.systemUpdate?.changelog)
            ? s.systemUpdate!.changelog
            : DEFAULT_SYSTEM_UPDATE.changelog,
        },
      };
      setSettings(mergedSettings);
      localStorage.setItem('cache_settings', JSON.stringify(mergedSettings));
      if (!navigator.onLine) {
        enqueueOfflineAction('settings_config', mergedSettings, 'Restauración de configuración global');
      } else {
        syncTasks.push(
          setDoc(doc(db, "config", "settings"), { payload: compressData(mergedSettings) }).catch(() => {
            anyOfflineOrError = true;
            enqueueOfflineAction('settings_config', mergedSettings, 'Restauración de configuración global');
          })
        );
      }
    }

    if (Array.isArray(backup.employees)) {
      const validEmps = backup.employees.filter(e => e && typeof e.id === 'string' && e.id.trim().length > 0);
      const nextIds = new Set(validEmps.map(e => e.id));
      const deletedEmpIds = employees.filter(e => !nextIds.has(e.id)).map(e => e.id);
      setEmployees(validEmps);
      localStorage.setItem('cache_employees', JSON.stringify(validEmps));
      if (!navigator.onLine) {
        enqueueOfflineAction('employee_batch', { emps: validEmps, deletedIds: deletedEmpIds }, `Restauración de colaboradores (${validEmps.length})`);
      } else {
        const empOps = [
          ...deletedEmpIds.map(id => deleteDoc(doc(db, "employees", id))),
          ...validEmps.map(e => setDoc(doc(db, "employees", e.id), { payload: compressData(e) })),
        ];
        syncTasks.push(
          Promise.allSettled(empOps).then(results => {
            if (results.some(r => r.status === 'rejected')) {
              anyOfflineOrError = true;
              enqueueOfflineAction('employee_batch', { emps: validEmps, deletedIds: deletedEmpIds }, `Restauración de colaboradores (${validEmps.length})`);
            }
          })
        );
      }
    }

    if (Array.isArray(backup.payments)) {
      const validPayments = backup.payments.filter(p => p && typeof p.id === 'string' && p.id.trim().length > 0);
      const nextIds = new Set(validPayments.map(p => p.id));
      const deletedPayIds = payments.filter(p => !nextIds.has(p.id)).map(p => p.id);
      setPayments(validPayments);
      localStorage.setItem('cache_payments', JSON.stringify(validPayments));
      if (!navigator.onLine) {
        enqueueOfflineAction('payment_batch', { payments: validPayments, deletedIds: deletedPayIds }, `Restauración de pagos (${validPayments.length})`);
      } else {
        const payOps = [
          ...deletedPayIds.map(id => deleteDoc(doc(db, "payments", id))),
          ...validPayments.map(p => setDoc(doc(db, "payments", p.id), { payload: compressData(p) })),
        ];
        syncTasks.push(
          Promise.allSettled(payOps).then(results => {
            if (results.some(r => r.status === 'rejected')) {
              anyOfflineOrError = true;
              enqueueOfflineAction('payment_batch', { payments: validPayments, deletedIds: deletedPayIds }, `Restauración de pagos (${validPayments.length})`);
            }
          })
        );
      }
    }

    if (Array.isArray(backup.attendance)) {
      const validAtt = backup.attendance.filter(a => a && typeof a.id === 'string' && a.id.trim().length > 0);
      const nextIds = new Set(validAtt.map(a => a.id));
      const deletedAttIds = attendance.filter(a => !nextIds.has(a.id)).map(a => a.id);
      setAttendance(validAtt);
      localStorage.setItem('cache_attendance', JSON.stringify(validAtt));
      if (!navigator.onLine) {
        if (deletedAttIds.length > 0) {
          enqueueOfflineAction('attendance_delete', deletedAttIds, `Limpieza de asistencia por respaldo (${deletedAttIds.length})`);
        }
        if (validAtt.length > 0) {
          enqueueOfflineAction('attendance_batch', validAtt, `Restauración de asistencias (${validAtt.length})`);
        }
      } else {
        const attOps = [
          ...deletedAttIds.map(id => deleteDoc(doc(db, "attendance", id))),
          ...validAtt.map(a => setDoc(doc(db, "attendance", a.id), { payload: compressData(a), timestamp: a.timestamp })),
        ];
        syncTasks.push(
          Promise.allSettled(attOps).then(results => {
            if (results.some(r => r.status === 'rejected')) {
              anyOfflineOrError = true;
              if (deletedAttIds.length > 0) {
                enqueueOfflineAction('attendance_delete', deletedAttIds, `Limpieza de asistencia por respaldo (${deletedAttIds.length})`);
              }
              if (validAtt.length > 0) {
                enqueueOfflineAction('attendance_batch', validAtt, `Restauración de asistencias (${validAtt.length})`);
              }
            }
          })
        );
      }
    }

    if (Array.isArray(backup.savedReports)) {
      const validReps = backup.savedReports.filter(r => r && typeof r.id === 'string' && r.id.trim().length > 0);
      const nextIds = new Set(validReps.map(r => r.id));
      const deletedRepIds = savedReports.filter(r => !nextIds.has(r.id)).map(r => r.id);
      setSavedReports(validReps);
      localStorage.setItem('cache_saved_reports', JSON.stringify(validReps));
      if (!navigator.onLine) {
        enqueueOfflineAction('saved_reports_batch', validReps, `Restauración de reportes (${validReps.length})`);
      } else {
        const repOps = [
          ...deletedRepIds.map(id => deleteDoc(doc(db, "saved_reports", id))),
          ...validReps.map(r => setDoc(doc(db, "saved_reports", r.id), { payload: compressData(r) })),
        ];
        syncTasks.push(
          Promise.allSettled(repOps).then(results => {
            if (results.some(r => r.status === 'rejected')) {
              anyOfflineOrError = true;
              enqueueOfflineAction('saved_reports_batch', validReps, `Restauración de reportes (${validReps.length})`);
            }
          })
        );
      }
    }

    if (syncTasks.length > 0) {
      await Promise.all(syncTasks);
    }

    setPendingSyncCount(getPendingSyncCount());
    setIsDbConnected(!anyOfflineOrError);
    return { syncedOnline: !anyOfflineOrError };
  };

  if (isLoadingData) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] relative">
      {/* Toast informativo de conectividad / sincronización */}
      {syncFeedbackBanner && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl shadow-2xl border text-[11px] font-black uppercase tracking-wider flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-300 max-w-lg ${
          syncFeedbackBanner.type === 'success'
            ? 'bg-emerald-600 text-white border-emerald-400'
            : 'bg-slate-900 text-white border-slate-700'
        }`}>
          <span>{syncFeedbackBanner.type === 'success' ? '✓' : 'ℹ️'}</span>
          <span>{syncFeedbackBanner.message}</span>
        </div>
      )}

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
          onUpdateAttendance={handleUpdateAttendance}
          onDeleteAttendance={handleDeleteAttendance}
          onUpdateEmployees={handleUpdateEmployees}
          isOnline={isOnline}
          pendingSyncCount={pendingSyncCount}
          onSyncNow={triggerSync}
          isSyncing={isSyncing}
        />
      )}

      {view === 'admin' && currentUserRole && appMode === 'full' && (
        <AdminDashboard
          role={currentUserRole}
          isDbConnected={isDbConnected}
          isOnline={isOnline}
          pendingSyncCount={pendingSyncCount}
          onSyncNow={triggerSync}
          isSyncing={isSyncing}
          onLogout={() => setShowLogoutFeedback(true)}
          company={company}
          onUpdateCompany={handleUpdateCompany}
          employees={employees}
          onUpdateEmployees={handleUpdateEmployees}
          attendance={attendance}
          onUpdateAttendance={handleUpdateAttendance}
          onDeleteAttendance={handleDeleteAttendance}
          payments={payments}
          onUpdatePayments={handleUpdatePayments}
          savedReports={savedReports}
          onUpdateSavedReports={handleUpdateSavedReports}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onRestoreBackup={handleRestoreBackup}
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
