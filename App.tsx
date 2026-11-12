import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CompanyConfig, Employee, Role, AttendanceRecord, Payment, GlobalSettings, SavedReport, SystemBackupData } from './types.ts';
import AdminDashboard from './views/AdminDashboard.tsx';
import AttendanceSystem from './views/AttendanceSystem.tsx';
import Modal from './components/Modal.tsx';
import { db, enableNetwork, getDocFromServer, getDocsFromServer, collection, doc, onSnapshot, setDoc, deleteDoc, compressData, decompressData } from './firebase.ts';
import { DEFAULT_SYSTEM_UPDATE } from './constants.tsx';
import { enqueueOfflineAction, processOfflineSync, getPendingSyncCount, mergePendingEntityQueue, hasPendingOfflineForTypes } from './utils/offlineSync.ts';

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

  const companyRef = useRef<CompanyConfig | null>(company);
  const employeesRef = useRef<Employee[]>(employees);
  const attendanceRef = useRef<AttendanceRecord[]>(attendance);
  const paymentsRef = useRef<Payment[]>(payments);
  const savedReportsRef = useRef<SavedReport[]>(savedReports);
  const settingsRef = useRef<GlobalSettings>(settings);
  const lastServerPullRef = useRef<number>(0);

  useEffect(() => { companyRef.current = company; }, [company]);
  useEffect(() => { employeesRef.current = employees; }, [employees]);
  useEffect(() => { attendanceRef.current = attendance; }, [attendance]);
  useEffect(() => { paymentsRef.current = payments; }, [payments]);
  useEffect(() => { savedReportsRef.current = savedReports; }, [savedReports]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const compareSemver = (a?: string, b?: string): number => {
    const parse = (v?: string) => String(v || '0.0.0').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const pa = parse(a);
    const pb = parse(b);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const va = pa[i] || 0;
      const vb = pb[i] || 0;
      if (va > vb) return 1;
      if (va < vb) return -1;
    }
    return 0;
  };

  const withWriteTimeout = <T,>(promise: Promise<T>, ms = 10000): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('FIRESTORE_WRITE_TIMEOUT')), ms);
      promise
        .then(res => {
          window.clearTimeout(timer);
          resolve(res);
        })
        .catch(err => {
          window.clearTimeout(timer);
          reject(err);
        });
    });
  };

  const decodeDocData = <T,>(raw: any, id?: string): T | null => {
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.payload === 'string' && raw.payload.trim().length > 0) {
      const decompressed = decompressData(raw.payload);
      if (!decompressed || typeof decompressed !== 'object') return null;
      return id ? ({ ...decompressed, id } as T) : (decompressed as T);
    }
    return id ? ({ ...raw, id } as T) : (raw as T);
  };

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

  const applyServerCompany = useCallback((docSnap: any, allowEmptyOverwrite = false) => {
    if (hasPendingOfflineForTypes(['company_config'])) return;
    const fromCache = !!docSnap?.metadata?.fromCache;
    if (docSnap.exists()) {
      const decoded = decodeDocData<CompanyConfig>(docSnap.data());
      if (decoded) {
        companyRef.current = decoded;
        setCompany(decoded);
        localStorage.setItem('cache_company', JSON.stringify(decoded));
      }
    } else if (!fromCache && allowEmptyOverwrite) {
      companyRef.current = null;
      setCompany(null);
      localStorage.removeItem('cache_company');
    }
  }, []);

  const applyServerSettings = useCallback((docSnap: any) => {
    if (hasPendingOfflineForTypes(['settings_config'])) return;
    const fromCache = !!docSnap?.metadata?.fromCache;
    if (docSnap.exists()) {
      const dbSettings = decodeDocData<GlobalSettings>(docSnap.data());
      if (dbSettings) {
        const dbVersion = dbSettings.systemUpdate?.version;
        const isCodebaseStrictlyNewer = !dbVersion || compareSemver(DEFAULT_SYSTEM_UPDATE.version, dbVersion) > 0;
        const effectiveUpdate = isCodebaseStrictlyNewer
          ? DEFAULT_SYSTEM_UPDATE
          : (dbSettings.systemUpdate || DEFAULT_SYSTEM_UPDATE);

        const mergedSettings: GlobalSettings = {
          ...defaultSettings,
          ...dbSettings,
          holidays: Array.isArray(dbSettings.holidays) ? dbSettings.holidays : [],
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
        settingsRef.current = mergedSettings;
        setSettings(mergedSettings);
        localStorage.setItem('cache_settings', JSON.stringify(mergedSettings));

        if (!fromCache && isCodebaseStrictlyNewer && navigator.onLine) {
          const payload = compressData(mergedSettings);
          if (payload) {
            setDoc(doc(db, "config", "settings"), { payload }).catch(() => {});
          }
        }
      }
    } else if (!fromCache) {
      const currentLocal = settingsRef.current || defaultSettings;
      const payload = compressData(currentLocal);
      if (payload && navigator.onLine) {
        setDoc(doc(db, "config", "settings"), { payload }).catch(() => {});
      }
    }
  }, []);

  const applyServerEmployees = useCallback((snapshot: any) => {
    const fromCache = !!snapshot?.metadata?.fromCache;
    const rawItems = snapshot.docs
      .map((d: any) => decodeDocData<Employee>(d.data(), d.id))
      .filter((item: Employee | null): item is Employee => !!item && typeof item.id === 'string');

    if (fromCache && rawItems.length === 0 && employeesRef.current.length > 0) {
      return;
    }

    const reconciled = mergePendingEntityQueue<Employee>(
      rawItems,
      ['employee_batch'],
      'employee_single',
      'employee_delete'
    );
    employeesRef.current = reconciled;
    setEmployees(reconciled);
    localStorage.setItem('cache_employees', JSON.stringify(reconciled));
  }, []);

  const applyServerAttendance = useCallback((snapshot: any) => {
    const fromCache = !!snapshot?.metadata?.fromCache;
    const rawItems = snapshot.docs
      .map((d: any) => decodeDocData<AttendanceRecord>(d.data(), d.id))
      .filter((item: AttendanceRecord | null): item is AttendanceRecord => !!item && typeof item.id === 'string');

    if (fromCache && rawItems.length === 0 && attendanceRef.current.length > 0) {
      return;
    }

    const reconciled = mergePendingEntityQueue<AttendanceRecord>(
      rawItems,
      ['attendance_batch', 'attendance_delete'],
      'attendance_record'
    );
    attendanceRef.current = reconciled;
    setAttendance(reconciled);
    localStorage.setItem('cache_attendance', JSON.stringify(reconciled));
  }, []);

  const applyServerPayments = useCallback((snapshot: any) => {
    const fromCache = !!snapshot?.metadata?.fromCache;
    const rawItems = snapshot.docs
      .map((d: any) => decodeDocData<Payment>(d.data(), d.id))
      .filter((item: Payment | null): item is Payment => !!item && typeof item.id === 'string');

    if (fromCache && rawItems.length === 0 && paymentsRef.current.length > 0) {
      return;
    }

    const reconciled = mergePendingEntityQueue<Payment>(rawItems, ['payment_batch']);
    paymentsRef.current = reconciled;
    setPayments(reconciled);
    localStorage.setItem('cache_payments', JSON.stringify(reconciled));
  }, []);

  const applyServerSavedReports = useCallback((snapshot: any) => {
    const fromCache = !!snapshot?.metadata?.fromCache;
    const rawItems = snapshot.docs
      .map((d: any) => decodeDocData<SavedReport>(d.data(), d.id))
      .filter((item: SavedReport | null): item is SavedReport => !!item && typeof item.id === 'string');

    if (fromCache && rawItems.length === 0 && savedReportsRef.current.length > 0) {
      return;
    }

    const reconciled = mergePendingEntityQueue<SavedReport>(rawItems, ['saved_reports_batch']);
    savedReportsRef.current = reconciled;
    setSavedReports(reconciled);
    localStorage.setItem('cache_saved_reports', JSON.stringify(reconciled));
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (!navigator.onLine) return;
    lastServerPullRef.current = Date.now();
    try {
      const [compRes, settRes, empRes, attRes, payRes, repRes] = await Promise.allSettled([
        getDocFromServer(doc(db, "config", "company")),
        getDocFromServer(doc(db, "config", "settings")),
        getDocsFromServer(collection(db, "employees")),
        getDocsFromServer(collection(db, "attendance")),
        getDocsFromServer(collection(db, "payments")),
        getDocsFromServer(collection(db, "saved_reports"))
      ]);

      let anySuccess = false;
      if (compRes.status === 'fulfilled') {
        anySuccess = true;
        applyServerCompany(compRes.value, true);
      }
      if (settRes.status === 'fulfilled') {
        anySuccess = true;
        applyServerSettings(settRes.value);
      }
      if (empRes.status === 'fulfilled') {
        anySuccess = true;
        applyServerEmployees(empRes.value);
      }
      if (attRes.status === 'fulfilled') {
        anySuccess = true;
        applyServerAttendance(attRes.value);
      }
      if (payRes.status === 'fulfilled') {
        anySuccess = true;
        applyServerPayments(payRes.value);
      }
      if (repRes.status === 'fulfilled') {
        anySuccess = true;
        applyServerSavedReports(repRes.value);
      }
      if (anySuccess) {
        setIsDbConnected(true);
      }
    } catch (e) {
      console.warn("Refresh from server warning:", e);
    }
  }, [applyServerCompany, applyServerSettings, applyServerEmployees, applyServerAttendance, applyServerPayments, applyServerSavedReports]);

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
          refreshFromServer();
        }
      }, 5000);
    };

    const cacheKeyByModule: Record<string, string> = {
      Company: 'cache_company',
      Settings: 'cache_settings',
      Employees: 'cache_employees',
      Attendance: 'cache_attendance',
      Payments: 'cache_payments',
      SavedReports: 'cache_saved_reports'
    };

    const handleFirestoreError = (module: string, error: any) => {
      console.warn(`Firestore Error [${module}]:`, error?.message || error);
      setIsDbConnected(false);

      const cacheKey = cacheKeyByModule[module];
      const cached = cacheKey ? localStorage.getItem(cacheKey) : null;
      if (cached) {
        try {
          const data = JSON.parse(cached);
          if (module === 'Company') setCompany(data);
          if (module === 'Settings') setSettings(data);
          if (module === 'Employees' && Array.isArray(data)) setEmployees(data);
          if (module === 'Attendance' && Array.isArray(data)) setAttendance(data);
          if (module === 'Payments' && Array.isArray(data)) setPayments(data);
          if (module === 'SavedReports' && Array.isArray(data)) setSavedReports(data);
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
        }
        applyServerCompany(docSnap, true);
        setIsLoadingData(false);
      }, (err) => handleFirestoreError('Company', err));
      unsubscribesRef.current.push(unsubCompany);

      const unsubSettings = onSnapshot(doc(db, "config", "settings"), { includeMetadataChanges: true }, (docSnap) => {
        if (!docSnap.metadata.fromCache && navigator.onLine) {
          setIsDbConnected(true);
        }
        applyServerSettings(docSnap);
      }, (err) => handleFirestoreError('Settings', err));
      unsubscribesRef.current.push(unsubSettings);

      const unsubEmployees = onSnapshot(collection(db, "employees"), { includeMetadataChanges: true }, (snapshot) => {
        if (!snapshot.metadata.fromCache && navigator.onLine) {
          setIsDbConnected(true);
        }
        applyServerEmployees(snapshot);
      }, (err) => handleFirestoreError('Employees', err));
      unsubscribesRef.current.push(unsubEmployees);

      const unsubAttendance = onSnapshot(collection(db, "attendance"), { includeMetadataChanges: true }, (snapshot) => {
        if (!snapshot.metadata.fromCache && navigator.onLine) {
          setIsDbConnected(true);
        }
        applyServerAttendance(snapshot);
      }, (err) => handleFirestoreError('Attendance', err));
      unsubscribesRef.current.push(unsubAttendance);

      const unsubPayments = onSnapshot(collection(db, "payments"), { includeMetadataChanges: true }, (snapshot) => {
        if (!snapshot.metadata.fromCache && navigator.onLine) {
          setIsDbConnected(true);
        }
        applyServerPayments(snapshot);
      }, (err) => handleFirestoreError('Payments', err));
      unsubscribesRef.current.push(unsubPayments);

      const unsubSavedReports = onSnapshot(collection(db, "saved_reports"), { includeMetadataChanges: true }, (snapshot) => {
        if (!snapshot.metadata.fromCache && navigator.onLine) {
          setIsDbConnected(true);
        }
        applyServerSavedReports(snapshot);
      }, (err) => handleFirestoreError('SavedReports', err));
      unsubscribesRef.current.push(unsubSavedReports);

    } catch (e) {
      console.error("Initial load failed:", e);
      setIsLoadingData(false);
    }
  }, [applyServerCompany, applyServerSettings, applyServerEmployees, applyServerAttendance, applyServerPayments, applyServerSavedReports, refreshFromServer]);

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

  // Sincronización manual y automática contra Firestore sin intermitencias ni pérdidas entre equipos
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
        await refreshFromServer();
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
  }, [refreshFromServer]);

  useEffect(() => {
    if (navigator.onLine && getPendingSyncCount() > 0) {
      triggerSync();
    }

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

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        if (getPendingSyncCount() > 0) {
          triggerSync();
        } else if (Date.now() - lastServerPullRef.current > 8000) {
          enableNetwork(db).catch(() => {});
          refreshFromServer();
        }
      }
    };

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === 'asistup_offline_sync_queue') {
        setPendingSyncCount(getPendingSyncCount());
      } else if (e.key === 'cache_employees' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) { employeesRef.current = parsed; setEmployees(parsed); }
        } catch {}
      } else if (e.key === 'cache_attendance' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) { attendanceRef.current = parsed; setAttendance(parsed); }
        } catch {}
      } else if (e.key === 'cache_payments' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) { paymentsRef.current = parsed; setPayments(parsed); }
        } catch {}
      } else if (e.key === 'cache_saved_reports' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) { savedReportsRef.current = parsed; setSavedReports(parsed); }
        } catch {}
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('storage', handleStorageSync);

    // Sincronización periódica y respaldo de salud contra desconexiones silenciosas entre dispositivos
    const interval = setInterval(() => {
      if (!navigator.onLine) return;
      if (getPendingSyncCount() > 0 && !isSyncingRef.current) {
        triggerSync();
      } else if (Date.now() - lastServerPullRef.current > 45000) {
        refreshFromServer();
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorageSync);
      clearInterval(interval);
    };
  }, [triggerSync, attachListeners, refreshFromServer]);

  const handleUpdateCompany = async (c: CompanyConfig) => {
    companyRef.current = c;
    setCompany(c);
    localStorage.setItem('cache_company', JSON.stringify(c));
    if (!navigator.onLine) {
      enqueueOfflineAction('company_config', c, `Actualización empresa: ${c.name}`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }
    try {
      const payload = compressData(c);
      if (!payload) throw new Error('Serialization failed');
      await withWriteTimeout(setDoc(doc(db, "config", "company"), { payload }));
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Update company in Firestore failed, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('company_config', c, `Actualización empresa: ${c.name}`);
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  const handleUpdateSettings = async (s: GlobalSettings) => {
    settingsRef.current = s;
    setSettings(s);
    localStorage.setItem('cache_settings', JSON.stringify(s));
    if (!navigator.onLine) {
      enqueueOfflineAction('settings_config', s, 'Actualización de configuración general');
      setPendingSyncCount(getPendingSyncCount());
      return;
    }
    try {
      const payload = compressData(s);
      if (!payload) throw new Error('Serialization failed');
      await withWriteTimeout(setDoc(doc(db, "config", "settings"), { payload }));
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Update settings in Firestore failed, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('settings_config', s, 'Actualización de configuración general');
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  const handleUpdateEmployees = async (emps: Employee[]) => {
    const prevMap = new Map<string, Employee>(employeesRef.current.map(e => [e.id, e]));
    const currentIds = new Set<string>(emps.map(e => e.id));
    const deletedIds: string[] = [];
    for (const id of prevMap.keys()) {
      if (!currentIds.has(id)) {
        deletedIds.push(id);
      }
    }

    // Enviar únicamente los registros realmente creados o modificados para evitar sobrescribir cambios concurrentes de otros equipos
    const changedEmps = emps.filter(e => {
      const prev = prevMap.get(e.id);
      return !prev || JSON.stringify(prev) !== JSON.stringify(e);
    });

    employeesRef.current = emps;
    setEmployees(emps);
    localStorage.setItem('cache_employees', JSON.stringify(emps));

    if (changedEmps.length === 0 && deletedIds.length === 0) {
      return;
    }

    if (!navigator.onLine) {
      enqueueOfflineAction('employee_batch', { changedEmps, deletedIds }, `Gestión de personal (${changedEmps.length} act., ${deletedIds.length} elim.)`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const deletePromises = deletedIds.map(id => deleteDoc(doc(db, "employees", id)));
      const savePromises = changedEmps.map(e => {
        const payload = compressData(e);
        if (!payload) return Promise.reject(new Error(`Empty payload for employee ${e.id}`));
        return setDoc(doc(db, "employees", e.id), { payload });
      });
      const results = await withWriteTimeout(Promise.allSettled([...deletePromises, ...savePromises]), 12000);
      if (results.some(r => r.status === 'rejected')) {
        throw new Error('Partial employee sync failure');
      }
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Update employees Firestore sync error, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('employee_batch', { changedEmps, deletedIds }, `Gestión de personal (${changedEmps.length} act., ${deletedIds.length} elim.)`);
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  const handleUpdatePayments = async (pys: Payment[]) => {
    const prevMap = new Map<string, Payment>(paymentsRef.current.map(p => [p.id, p]));
    const currentIds = new Set<string>(pys.map(p => p.id));
    const deletedIds: string[] = [];
    for (const id of prevMap.keys()) {
      if (!currentIds.has(id)) {
        deletedIds.push(id);
      }
    }

    const changedPayments = pys.filter(p => {
      const prev = prevMap.get(p.id);
      return !prev || JSON.stringify(prev) !== JSON.stringify(p);
    });

    paymentsRef.current = pys;
    setPayments(pys);
    localStorage.setItem('cache_payments', JSON.stringify(pys));

    if (changedPayments.length === 0 && deletedIds.length === 0) {
      return;
    }

    if (!navigator.onLine) {
      enqueueOfflineAction('payment_batch', { changedPayments, deletedIds }, `Registro de nómina y pagos (${changedPayments.length} act., ${deletedIds.length} elim.)`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const deletePromises = deletedIds.map(id => deleteDoc(doc(db, "payments", id)));
      const savePromises = changedPayments.map(p => {
        const payload = compressData(p);
        if (!payload) return Promise.reject(new Error(`Empty payload for payment ${p.id}`));
        return setDoc(doc(db, "payments", p.id), { payload });
      });
      const results = await withWriteTimeout(Promise.allSettled([...deletePromises, ...savePromises]), 12000);
      if (results.some(r => r.status === 'rejected')) {
        throw new Error('Partial payment sync failure');
      }
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Update payments Firestore sync error, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('payment_batch', { changedPayments, deletedIds }, `Registro de nómina y pagos (${changedPayments.length} act., ${deletedIds.length} elim.)`);
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  const handleUpdateAttendance = async (recs: AttendanceRecord[]) => {
    if (!recs || recs.length === 0) return;

    const prev = attendanceRef.current;
    const recMap = new Map(recs.map(r => [r.id, r]));
    const updated = prev.map(item => recMap.has(item.id) ? recMap.get(item.id)! : item);
    for (const r of recs) {
      if (!prev.some(item => item.id === r.id)) {
        updated.push(r);
      }
    }
    attendanceRef.current = updated;
    setAttendance(updated);
    localStorage.setItem('cache_attendance', JSON.stringify(updated));

    if (!navigator.onLine) {
      enqueueOfflineAction('attendance_batch', recs, `Lote de asistencia (${recs.length} registros)`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const savePromises = recs.map(r => {
        const payload = compressData(r);
        if (!payload) return Promise.reject(new Error(`Empty payload for attendance ${r.id}`));
        return setDoc(doc(db, "attendance", r.id), { payload, timestamp: r.timestamp || new Date().toISOString() });
      });
      const results = await withWriteTimeout(Promise.allSettled(savePromises), 12000);
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

  const handleRegisterAttendance = async (r: AttendanceRecord) => {
    const safeRec: AttendanceRecord = {
      ...r,
      timestamp: r.timestamp || new Date().toISOString()
    };

    const updated = [safeRec, ...attendanceRef.current.filter(item => item.id !== safeRec.id)];
    attendanceRef.current = updated;
    setAttendance(updated);
    localStorage.setItem('cache_attendance', JSON.stringify(updated));

    if (!navigator.onLine) {
      enqueueOfflineAction('attendance_record', safeRec, `Marcación de asistencia (${safeRec.type})`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const payload = compressData(safeRec);
      if (!payload) throw new Error('Serialization failed');
      await withWriteTimeout(setDoc(doc(db, "attendance", safeRec.id), { payload, timestamp: safeRec.timestamp }), 10000);
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Marcación encolada para sincronización offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('attendance_record', safeRec, `Marcación de asistencia (${safeRec.type})`);
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  const handleDeleteAttendance = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);

    const updated = attendanceRef.current.filter(item => !idSet.has(item.id));
    attendanceRef.current = updated;
    setAttendance(updated);
    localStorage.setItem('cache_attendance', JSON.stringify(updated));

    if (!navigator.onLine) {
      enqueueOfflineAction('attendance_delete', ids, `Anulación/reemplazo de asistencia (${ids.length} registros)`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const deletePromises = ids.map(id => deleteDoc(doc(db, "attendance", id)));
      const results = await withWriteTimeout(Promise.allSettled(deletePromises), 12000);
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
    const prevMap = new Map<string, SavedReport>(savedReportsRef.current.map(r => [r.id, r]));
    const currentIds = new Set<string>(reps.map(r => r.id));
    const deletedIds: string[] = [];
    for (const id of prevMap.keys()) {
      if (!currentIds.has(id)) {
        deletedIds.push(id);
      }
    }

    const changedReports = reps.filter(r => {
      const prev = prevMap.get(r.id);
      return !prev || JSON.stringify(prev) !== JSON.stringify(r);
    });

    savedReportsRef.current = reps;
    setSavedReports(reps);
    localStorage.setItem('cache_saved_reports', JSON.stringify(reps));

    if (changedReports.length === 0 && deletedIds.length === 0) {
      return;
    }

    if (!navigator.onLine) {
      enqueueOfflineAction('saved_reports_batch', { changedReports, deletedIds }, `Guardado de reportes (${changedReports.length})`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const deletePromises = deletedIds.map(id => deleteDoc(doc(db, "saved_reports", id)));
      const savePromises = changedReports.map(r => {
        const payload = compressData(r);
        if (!payload) return Promise.reject(new Error(`Empty payload for report ${r.id}`));
        return setDoc(doc(db, "saved_reports", r.id), { payload });
      });
      const results = await withWriteTimeout(Promise.allSettled([...deletePromises, ...savePromises]), 12000);
      if (results.some(r => r.status === 'rejected')) {
        throw new Error('Partial saved reports sync failure');
      }
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Update saved reports Firestore sync error, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('saved_reports_batch', { changedReports, deletedIds }, `Guardado de reportes (${changedReports.length})`);
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  const handleRestoreBackup = async (backup: SystemBackupData): Promise<{ syncedOnline: boolean }> => {
    const syncTasks: Promise<any>[] = [];
    let anyOfflineOrError = !navigator.onLine;

    if (backup.company && typeof backup.company === 'object') {
      const nextCompany = backup.company;
      companyRef.current = nextCompany;
      setCompany(nextCompany);
      localStorage.setItem('cache_company', JSON.stringify(nextCompany));
      if (!navigator.onLine) {
        enqueueOfflineAction('company_config', nextCompany, `Restauración empresa: ${nextCompany.name || 'Compañía'}`);
      } else {
        const payload = compressData(nextCompany);
        if (payload) {
          syncTasks.push(
            withWriteTimeout(setDoc(doc(db, "config", "company"), { payload }), 12000).catch(() => {
              anyOfflineOrError = true;
              enqueueOfflineAction('company_config', nextCompany, `Restauración empresa: ${nextCompany.name || 'Compañía'}`);
            })
          );
        }
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
      settingsRef.current = mergedSettings;
      setSettings(mergedSettings);
      localStorage.setItem('cache_settings', JSON.stringify(mergedSettings));
      if (!navigator.onLine) {
        enqueueOfflineAction('settings_config', mergedSettings, 'Restauración de configuración global');
      } else {
        const payload = compressData(mergedSettings);
        if (payload) {
          syncTasks.push(
            withWriteTimeout(setDoc(doc(db, "config", "settings"), { payload }), 12000).catch(() => {
              anyOfflineOrError = true;
              enqueueOfflineAction('settings_config', mergedSettings, 'Restauración de configuración global');
            })
          );
        }
      }
    }

    if (Array.isArray(backup.employees)) {
      const validEmps = backup.employees.filter(e => e && typeof e.id === 'string' && e.id.trim().length > 0);
      const nextIds = new Set(validEmps.map(e => e.id));
      const deletedEmpIds = employeesRef.current.filter(e => !nextIds.has(e.id)).map(e => e.id);
      employeesRef.current = validEmps;
      setEmployees(validEmps);
      localStorage.setItem('cache_employees', JSON.stringify(validEmps));
      if (!navigator.onLine) {
        enqueueOfflineAction('employee_batch', { changedEmps: validEmps, deletedIds: deletedEmpIds }, `Restauración de colaboradores (${validEmps.length})`);
      } else {
        const empOps = [
          ...deletedEmpIds.map(id => deleteDoc(doc(db, "employees", id))),
          ...validEmps.map(e => setDoc(doc(db, "employees", e.id), { payload: compressData(e) })),
        ];
        syncTasks.push(
          withWriteTimeout(Promise.allSettled(empOps), 15000).then(results => {
            if (results.some(r => r.status === 'rejected')) {
              anyOfflineOrError = true;
              enqueueOfflineAction('employee_batch', { changedEmps: validEmps, deletedIds: deletedEmpIds }, `Restauración de colaboradores (${validEmps.length})`);
            }
          }).catch(() => {
            anyOfflineOrError = true;
            enqueueOfflineAction('employee_batch', { changedEmps: validEmps, deletedIds: deletedEmpIds }, `Restauración de colaboradores (${validEmps.length})`);
          })
        );
      }
    }

    if (Array.isArray(backup.payments)) {
      const validPayments = backup.payments.filter(p => p && typeof p.id === 'string' && p.id.trim().length > 0);
      const nextIds = new Set(validPayments.map(p => p.id));
      const deletedPayIds = paymentsRef.current.filter(p => !nextIds.has(p.id)).map(p => p.id);
      paymentsRef.current = validPayments;
      setPayments(validPayments);
      localStorage.setItem('cache_payments', JSON.stringify(validPayments));
      if (!navigator.onLine) {
        enqueueOfflineAction('payment_batch', { changedPayments: validPayments, deletedIds: deletedPayIds }, `Restauración de pagos (${validPayments.length})`);
      } else {
        const payOps = [
          ...deletedPayIds.map(id => deleteDoc(doc(db, "payments", id))),
          ...validPayments.map(p => setDoc(doc(db, "payments", p.id), { payload: compressData(p) })),
        ];
        syncTasks.push(
          withWriteTimeout(Promise.allSettled(payOps), 15000).then(results => {
            if (results.some(r => r.status === 'rejected')) {
              anyOfflineOrError = true;
              enqueueOfflineAction('payment_batch', { changedPayments: validPayments, deletedIds: deletedPayIds }, `Restauración de pagos (${validPayments.length})`);
            }
          }).catch(() => {
            anyOfflineOrError = true;
            enqueueOfflineAction('payment_batch', { changedPayments: validPayments, deletedIds: deletedPayIds }, `Restauración de pagos (${validPayments.length})`);
          })
        );
      }
    }

    if (Array.isArray(backup.attendance)) {
      const validAtt = backup.attendance.filter(a => a && typeof a.id === 'string' && a.id.trim().length > 0);
      const nextIds = new Set(validAtt.map(a => a.id));
      const deletedAttIds = attendanceRef.current.filter(a => !nextIds.has(a.id)).map(a => a.id);
      attendanceRef.current = validAtt;
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
          ...validAtt.map(a => setDoc(doc(db, "attendance", a.id), { payload: compressData(a), timestamp: a.timestamp || new Date().toISOString() })),
        ];
        syncTasks.push(
          withWriteTimeout(Promise.allSettled(attOps), 15000).then(results => {
            if (results.some(r => r.status === 'rejected')) {
              anyOfflineOrError = true;
              if (deletedAttIds.length > 0) {
                enqueueOfflineAction('attendance_delete', deletedAttIds, `Limpieza de asistencia por respaldo (${deletedAttIds.length})`);
              }
              if (validAtt.length > 0) {
                enqueueOfflineAction('attendance_batch', validAtt, `Restauración de asistencias (${validAtt.length})`);
              }
            }
          }).catch(() => {
            anyOfflineOrError = true;
            if (deletedAttIds.length > 0) {
              enqueueOfflineAction('attendance_delete', deletedAttIds, `Limpieza de asistencia por respaldo (${deletedAttIds.length})`);
            }
            if (validAtt.length > 0) {
              enqueueOfflineAction('attendance_batch', validAtt, `Restauración de asistencias (${validAtt.length})`);
            }
          })
        );
      }
    }

    if (Array.isArray(backup.savedReports)) {
      const validReps = backup.savedReports.filter(r => r && typeof r.id === 'string' && r.id.trim().length > 0);
      const nextIds = new Set(validReps.map(r => r.id));
      const deletedRepIds = savedReportsRef.current.filter(r => !nextIds.has(r.id)).map(r => r.id);
      savedReportsRef.current = validReps;
      setSavedReports(validReps);
      localStorage.setItem('cache_saved_reports', JSON.stringify(validReps));
      if (!navigator.onLine) {
        enqueueOfflineAction('saved_reports_batch', { changedReports: validReps, deletedIds: deletedRepIds }, `Restauración de reportes (${validReps.length})`);
      } else {
        const repOps = [
          ...deletedRepIds.map(id => deleteDoc(doc(db, "saved_reports", id))),
          ...validReps.map(r => setDoc(doc(db, "saved_reports", r.id), { payload: compressData(r) })),
        ];
        syncTasks.push(
          withWriteTimeout(Promise.allSettled(repOps), 15000).then(results => {
            if (results.some(r => r.status === 'rejected')) {
              anyOfflineOrError = true;
              enqueueOfflineAction('saved_reports_batch', { changedReports: validReps, deletedIds: deletedRepIds }, `Restauración de reportes (${validReps.length})`);
            }
          }).catch(() => {
            anyOfflineOrError = true;
            enqueueOfflineAction('saved_reports_batch', { changedReports: validReps, deletedIds: deletedRepIds }, `Restauración de reportes (${validReps.length})`);
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
