import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CompanyConfig, Employee, Role, AttendanceRecord, Payment, GlobalSettings, SavedReport, SystemBackupData } from './types.ts';
import AdminDashboard from './views/AdminDashboard.tsx';
import AttendanceSystem from './views/AttendanceSystem.tsx';
import Modal from './components/Modal.tsx';
import { db, enableNetwork, getDocFromServer, getDocsFromServer, collection, doc, onSnapshot, setDoc, compressData, decompressData } from './firebase.ts';
import { DEFAULT_SYSTEM_UPDATE } from './constants.tsx';
import { buildSafeGlobalSettings, rolloverSettingsToYear } from './utils/ecuadorianLabor.ts';
import {
  enqueueOfflineAction,
  processOfflineSync,
  getPendingSyncCount,
  mergePendingEntityQueue,
  hasPendingOfflineForTypes,
  commitFirestoreBatchOps,
  broadcastSyncMessage,
  TAB_INSTANCE_ID,
  BatchWriteOp
} from './utils/offlineSync.ts';
import { getOrCreateDeviceId, parseRecordEpochMs } from './utils/attendanceHelpers.ts';

class AppViewErrorBoundary extends React.Component<
  { children: React.ReactNode; onResetView?: () => void },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode; onResetView?: () => void }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMsg: error?.message || 'Error inesperado de interfaz' };
  }

  componentDidCatch(error: any, info: any) {
    console.error('Error de renderizado en módulo ASIST UP:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen gradient-blue flex items-center justify-center p-6">
          <div className="bg-white max-w-md w-full rounded-[2.5rem] p-8 shadow-2xl text-center space-y-5 border-2 border-amber-300">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-3xl mx-auto">⚠️</div>
            <h2 className="text-lg font-[950] text-slate-900 uppercase">Recuperación Automática de Pantalla</h2>
            <p className="text-xs font-bold text-slate-600 uppercase leading-relaxed">
              Se detectó una interrupción temporal al mostrar esta vista. Sus datos permanecen seguros y respaldados.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, errorMsg: '' });
                  if (this.props.onResetView) this.props.onResetView();
                }}
                className="flex-1 py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-black rounded-xl uppercase text-[10px] tracking-wider cursor-pointer"
              >
                Reintentar Vista
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl uppercase text-[10px] tracking-wider cursor-pointer"
              >
                Recargar Sistema
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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

  const defaultSettings: GlobalSettings = buildSafeGlobalSettings(undefined, new Date().getFullYear());

  const [settings, setSettings] = useState<GlobalSettings>(() => {
    try {
      const cached = localStorage.getItem('cache_settings');
      if (cached) {
        return rolloverSettingsToYear(JSON.parse(cached), new Date().getFullYear()).nextSettings;
      }
      return defaultSettings;
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
  const lastSnapshotEventRef = useRef<number>(Date.now());
  const inFlightAttUpsertsRef = useRef<Map<string, { item: AttendanceRecord; expiresAt: number }>>(new Map());
  const inFlightAttDeletesRef = useRef<Map<string, number>>(new Map());
  const inFlightEmpUpsertsRef = useRef<Map<string, { item: Employee; expiresAt: number }>>(new Map());
  const inFlightEmpDeletesRef = useRef<Map<string, number>>(new Map());
  const hasServerAuthoritativeRef = useRef<Record<string, boolean>>({
    company: false,
    settings: false,
    employees: false,
    attendance: false,
    payments: false,
    savedReports: false
  });

  useEffect(() => { companyRef.current = company; }, [company]);
  useEffect(() => { employeesRef.current = employees; }, [employees]);
  useEffect(() => { attendanceRef.current = attendance; }, [attendance]);
  useEffect(() => { paymentsRef.current = payments; }, [payments]);
  useEffect(() => { savedReportsRef.current = savedReports; }, [savedReports]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const mergeInFlightEntities = <T extends { id: string; updatedAt?: string }>(
    serverItems: T[],
    upsertMap: Map<string, { item: T; expiresAt: number }>,
    deleteMap: Map<string, number>
  ): T[] => {
    const now = Date.now();
    for (const [k, exp] of deleteMap.entries()) {
      if (exp <= now) deleteMap.delete(k);
    }
    for (const [k, entry] of upsertMap.entries()) {
      if (entry.expiresAt <= now) upsertMap.delete(k);
    }

    if (deleteMap.size === 0 && upsertMap.size === 0) {
      return serverItems;
    }

    const resultMap = new Map<string, T>();
    for (const srv of serverItems) {
      if (deleteMap.has(srv.id)) continue;
      resultMap.set(srv.id, srv);
    }

    for (const [id, entry] of upsertMap.entries()) {
      if (deleteMap.has(id)) continue;
      const existing = resultMap.get(id);
      if (!existing) {
        resultMap.set(id, entry.item);
      } else {
        const srvUpdated = parseRecordEpochMs(existing.updatedAt);
        const locUpdated = parseRecordEpochMs(entry.item.updatedAt);
        if (locUpdated >= srvUpdated) {
          resultMap.set(id, entry.item);
        }
      }
    }

    return Array.from(resultMap.values());
  };

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
    const hasPendingWrites = !!docSnap?.metadata?.hasPendingWrites;
    // Evitar que caché IndexedDB obsoleto sobrescriba datos más recientes en línea o caché local ya cargado
    if (fromCache && !hasPendingWrites && navigator.onLine && (hasServerAuthoritativeRef.current.company || companyRef.current !== null)) {
      return;
    }
    if (!fromCache) {
      hasServerAuthoritativeRef.current.company = true;
    }
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
    const hasPendingWrites = !!docSnap?.metadata?.hasPendingWrites;
    if (fromCache && !hasPendingWrites && navigator.onLine && (hasServerAuthoritativeRef.current.settings || !!localStorage.getItem('cache_settings'))) {
      return;
    }
    if (!fromCache) {
      hasServerAuthoritativeRef.current.settings = true;
    }
    if (docSnap.exists()) {
      const dbSettings = decodeDocData<GlobalSettings>(docSnap.data());
      if (dbSettings) {
        const dbVersion = dbSettings.systemUpdate?.version;
        const isCodebaseStrictlyNewer = !dbVersion || compareSemver(DEFAULT_SYSTEM_UPDATE.version, dbVersion) > 0;
        const effectiveUpdate = isCodebaseStrictlyNewer
          ? DEFAULT_SYSTEM_UPDATE
          : (dbSettings.systemUpdate || DEFAULT_SYSTEM_UPDATE);

        const baseMerged = buildSafeGlobalSettings(
          {
            ...dbSettings,
            systemUpdate: effectiveUpdate
          },
          dbSettings.activeFiscalYear || new Date().getFullYear()
        );
        const { nextSettings: rolledSettings, changed: didRollover } = rolloverSettingsToYear(
          baseMerged,
          new Date().getFullYear()
        );

        settingsRef.current = rolledSettings;
        setSettings(rolledSettings);
        localStorage.setItem('cache_settings', JSON.stringify(rolledSettings));

        if (!fromCache && (isCodebaseStrictlyNewer || didRollover) && navigator.onLine) {
          const payload = compressData(rolledSettings);
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
    lastSnapshotEventRef.current = Date.now();
    const fromCache = !!snapshot?.metadata?.fromCache;
    const hasPendingWrites = !!snapshot?.metadata?.hasPendingWrites;
    if (fromCache && !hasPendingWrites && navigator.onLine && (hasServerAuthoritativeRef.current.employees || employeesRef.current.length > 0)) {
      return;
    }
    const rawItems = snapshot.docs
      .map((d: any) => decodeDocData<Employee>(d.data(), d.id))
      .filter((item: Employee | null): item is Employee => !!item && typeof item.id === 'string');

    if (fromCache && rawItems.length === 0 && employeesRef.current.length > 0) {
      return;
    }
    if (!fromCache) {
      hasServerAuthoritativeRef.current.employees = true;
    }

    const withInFlight = mergeInFlightEntities<Employee>(
      rawItems,
      inFlightEmpUpsertsRef.current,
      inFlightEmpDeletesRef.current
    );
    const reconciled = mergePendingEntityQueue<Employee>(
      withInFlight,
      ['employee_batch'],
      'employee_single',
      'employee_delete'
    );
    employeesRef.current = reconciled;
    setEmployees(reconciled);
    localStorage.setItem('cache_employees', JSON.stringify(reconciled));
  }, []);

  const applyServerAttendance = useCallback((snapshot: any) => {
    lastSnapshotEventRef.current = Date.now();
    const fromCache = !!snapshot?.metadata?.fromCache;
    const hasPendingWrites = !!snapshot?.metadata?.hasPendingWrites;
    if (fromCache && !hasPendingWrites && navigator.onLine && (hasServerAuthoritativeRef.current.attendance || attendanceRef.current.length > 0)) {
      return;
    }
    const rawItems = snapshot.docs
      .map((d: any) => decodeDocData<AttendanceRecord>(d.data(), d.id))
      .filter((item: AttendanceRecord | null): item is AttendanceRecord => !!item && typeof item.id === 'string');

    if (fromCache && rawItems.length === 0 && attendanceRef.current.length > 0) {
      return;
    }
    if (!fromCache) {
      hasServerAuthoritativeRef.current.attendance = true;
    }

    const withInFlight = mergeInFlightEntities<AttendanceRecord>(
      rawItems,
      inFlightAttUpsertsRef.current,
      inFlightAttDeletesRef.current
    );
    const reconciled = mergePendingEntityQueue<AttendanceRecord>(
      withInFlight,
      ['attendance_batch', 'attendance_delete', 'attendance_replace'],
      'attendance_record'
    );
    attendanceRef.current = reconciled;
    setAttendance(reconciled);
    localStorage.setItem('cache_attendance', JSON.stringify(reconciled));
  }, []);

  const applyServerPayments = useCallback((snapshot: any) => {
    const fromCache = !!snapshot?.metadata?.fromCache;
    const hasPendingWrites = !!snapshot?.metadata?.hasPendingWrites;
    if (fromCache && !hasPendingWrites && navigator.onLine && (hasServerAuthoritativeRef.current.payments || paymentsRef.current.length > 0)) {
      return;
    }
    const rawItems = snapshot.docs
      .map((d: any) => decodeDocData<Payment>(d.data(), d.id))
      .filter((item: Payment | null): item is Payment => !!item && typeof item.id === 'string');

    if (fromCache && rawItems.length === 0 && paymentsRef.current.length > 0) {
      return;
    }
    if (!fromCache) {
      hasServerAuthoritativeRef.current.payments = true;
    }

    const reconciled = mergePendingEntityQueue<Payment>(rawItems, ['payment_batch']);
    paymentsRef.current = reconciled;
    setPayments(reconciled);
    localStorage.setItem('cache_payments', JSON.stringify(reconciled));
  }, []);

  const applyServerSavedReports = useCallback((snapshot: any) => {
    const fromCache = !!snapshot?.metadata?.fromCache;
    const hasPendingWrites = !!snapshot?.metadata?.hasPendingWrites;
    if (fromCache && !hasPendingWrites && navigator.onLine && (hasServerAuthoritativeRef.current.savedReports || savedReportsRef.current.length > 0)) {
      return;
    }
    const rawItems = snapshot.docs
      .map((d: any) => decodeDocData<SavedReport>(d.data(), d.id))
      .filter((item: SavedReport | null): item is SavedReport => !!item && typeof item.id === 'string');

    if (fromCache && rawItems.length === 0 && savedReportsRef.current.length > 0) {
      return;
    }
    if (!fromCache) {
      hasServerAuthoritativeRef.current.savedReports = true;
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
      }
      // Siempre consultar cambios remotos aunque algún ítem local haya fallado o esté en reintento
      await refreshFromServer();
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
    if (navigator.onLine) {
      if (getPendingSyncCount() > 0) {
        triggerSync();
      } else {
        refreshFromServer();
      }
    }

    const syncCacheFromLocalStorage = (key?: string | null) => {
      if (!key || key === 'asistup_offline_sync_queue') {
        setPendingSyncCount(getPendingSyncCount());
      }
      if (!key || key === 'cache_company') {
        try {
          const val = localStorage.getItem('cache_company');
          if (val) { const parsed = JSON.parse(val); companyRef.current = parsed; setCompany(parsed); }
        } catch {}
      }
      if (!key || key === 'cache_settings') {
        try {
          const val = localStorage.getItem('cache_settings');
          if (val) { const parsed = JSON.parse(val); settingsRef.current = parsed; setSettings(parsed); }
        } catch {}
      }
      if (!key || key === 'cache_employees') {
        try {
          const val = localStorage.getItem('cache_employees');
          if (val) { const parsed = JSON.parse(val); if (Array.isArray(parsed)) { employeesRef.current = parsed; setEmployees(parsed); } }
        } catch {}
      }
      if (!key || key === 'cache_attendance') {
        try {
          const val = localStorage.getItem('cache_attendance');
          if (val) { const parsed = JSON.parse(val); if (Array.isArray(parsed)) { attendanceRef.current = parsed; setAttendance(parsed); } }
        } catch {}
      }
      if (!key || key === 'cache_payments') {
        try {
          const val = localStorage.getItem('cache_payments');
          if (val) { const parsed = JSON.parse(val); if (Array.isArray(parsed)) { paymentsRef.current = parsed; setPayments(parsed); } }
        } catch {}
      }
      if (!key || key === 'cache_saved_reports') {
        try {
          const val = localStorage.getItem('cache_saved_reports');
          if (val) { const parsed = JSON.parse(val); if (Array.isArray(parsed)) { savedReportsRef.current = parsed; setSavedReports(parsed); } }
        } catch {}
      }
    };

    const handleOnline = async () => {
      setIsOnline(true);
      await enableNetwork(db).catch(() => {});
      // Primero enviar cualquier cambio local pendiente antes de escuchar/leer del servidor
      await triggerSync();
      setIsDbConnected(true);
      attachListeners();
      await refreshFromServer();
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
        const snapshotStale = Date.now() - lastSnapshotEventRef.current > 60000;
        if (snapshotStale) {
          enableNetwork(db).catch(() => {});
          attachListeners();
        }
        if (getPendingSyncCount() > 0) {
          triggerSync();
        } else if (snapshotStale || Date.now() - lastServerPullRef.current > 5000) {
          enableNetwork(db).catch(() => {});
          refreshFromServer();
        }
      }
    };

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key) syncCacheFromLocalStorage(e.key);
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('asistup_sync_channel_v1');
        bc.onmessage = (ev) => {
          if (ev?.data?.senderId === TAB_INSTANCE_ID) return;
          const key = ev?.data?.key;
          if (key) syncCacheFromLocalStorage(key);
          else if (ev?.data?.type === 'queue_updated') setPendingSyncCount(getPendingSyncCount());
        };
      }
    } catch {}

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('storage', handleStorageSync);

    // Sincronización periódica y respaldo de salud contra desconexiones silenciosas entre dispositivos (cada 15s)
    const interval = setInterval(() => {
      if (!navigator.onLine) return;
      if (getPendingSyncCount() > 0 && !isSyncingRef.current) {
        triggerSync();
      }
      if (Date.now() - lastServerPullRef.current > 15000 && !isSyncingRef.current) {
        refreshFromServer();
      }
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorageSync);
      if (bc) {
        try { bc.close(); } catch {}
      }
      clearInterval(interval);
    };
  }, [triggerSync, attachListeners, refreshFromServer]);

  const handleUpdateCompany = async (c: CompanyConfig) => {
    companyRef.current = c;
    setCompany(c);
    localStorage.setItem('cache_company', JSON.stringify(c));
    broadcastSyncMessage({ type: 'cache_updated', key: 'cache_company' });
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
    const normalized = buildSafeGlobalSettings(s, s?.activeFiscalYear || new Date().getFullYear());
    settingsRef.current = normalized;
    setSettings(normalized);
    localStorage.setItem('cache_settings', JSON.stringify(normalized));
    broadcastSyncMessage({ type: 'cache_updated', key: 'cache_settings' });
    if (!navigator.onLine) {
      enqueueOfflineAction('settings_config', normalized, 'Actualización de configuración general');
      setPendingSyncCount(getPendingSyncCount());
      return;
    }
    try {
      const payload = compressData(normalized);
      if (!payload) throw new Error('Serialization failed');
      await withWriteTimeout(setDoc(doc(db, "config", "settings"), { payload }));
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Update settings in Firestore failed, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('settings_config', normalized, 'Actualización de configuración general');
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  // Verificar automáticamente transición de año o período al iniciar o cambiar el calendario
  useEffect(() => {
    const checkAnnualRollover = () => {
      const nowYear = new Date().getFullYear();
      const { nextSettings, changed } = rolloverSettingsToYear(settingsRef.current, nowYear);
      if (changed) {
        handleUpdateSettings(nextSettings);
      }
    };
    checkAnnualRollover();
    const timer = window.setInterval(checkAnnualRollover, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleUpdateEmployees = async (emps: Employee[]) => {
    const nowIso = new Date().toISOString();
    const prevMap = new Map<string, Employee>(employeesRef.current.map(e => [e.id, e]));
    const currentIds = new Set<string>(emps.map(e => e.id));
    const deletedIds: string[] = [];
    for (const id of prevMap.keys()) {
      if (!currentIds.has(id)) {
        deletedIds.push(id);
      }
    }

    const stampedChangedIds = new Set<string>();
    const normalizedEmps = emps.map(e => {
      const prev = prevMap.get(e.id);
      if (!prev || JSON.stringify(prev) !== JSON.stringify(e)) {
        stampedChangedIds.add(e.id);
        return { ...e, updatedAt: e.updatedAt || nowIso };
      }
      return e;
    });

    const changedEmps = normalizedEmps.filter(e => stampedChangedIds.has(e.id));

    const inFlightUntil = Date.now() + 15000;
    for (const id of deletedIds) {
      inFlightEmpDeletesRef.current.set(id, inFlightUntil);
      inFlightEmpUpsertsRef.current.delete(id);
    }
    for (const e of changedEmps) {
      inFlightEmpUpsertsRef.current.set(e.id, { item: e, expiresAt: inFlightUntil });
      inFlightEmpDeletesRef.current.delete(e.id);
    }

    employeesRef.current = normalizedEmps;
    setEmployees(normalizedEmps);
    localStorage.setItem('cache_employees', JSON.stringify(normalizedEmps));
    broadcastSyncMessage({ type: 'cache_updated', key: 'cache_employees' });

    if (changedEmps.length === 0 && deletedIds.length === 0) {
      return;
    }

    if (!navigator.onLine) {
      enqueueOfflineAction('employee_batch', { changedEmps, deletedIds }, `Gestión de personal (${changedEmps.length} act., ${deletedIds.length} elim.)`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const ops: BatchWriteOp[] = [];
      for (const id of deletedIds) {
        ops.push({ kind: 'delete', collectionName: 'employees', docId: id });
      }
      for (const e of changedEmps) {
        const payload = compressData(e);
        if (!payload) throw new Error(`Empty payload for employee ${e.id}`);
        ops.push({ kind: 'set', collectionName: 'employees', docId: e.id, data: { payload } });
      }
      await commitFirestoreBatchOps(db, ops, 15000);
      const graceUntil = Date.now() + 4000;
      for (const id of deletedIds) inFlightEmpDeletesRef.current.set(id, graceUntil);
      for (const e of changedEmps) inFlightEmpUpsertsRef.current.set(e.id, { item: e, expiresAt: graceUntil });
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
    broadcastSyncMessage({ type: 'cache_updated', key: 'cache_payments' });

    if (changedPayments.length === 0 && deletedIds.length === 0) {
      return;
    }

    if (!navigator.onLine) {
      enqueueOfflineAction('payment_batch', { changedPayments, deletedIds }, `Registro de nómina y pagos (${changedPayments.length} act., ${deletedIds.length} elim.)`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const ops: BatchWriteOp[] = [];
      for (const id of deletedIds) {
        ops.push({ kind: 'delete', collectionName: 'payments', docId: id });
      }
      for (const p of changedPayments) {
        const payload = compressData(p);
        if (!payload) throw new Error(`Empty payload for payment ${p.id}`);
        ops.push({ kind: 'set', collectionName: 'payments', docId: p.id, data: { payload } });
      }
      await commitFirestoreBatchOps(db, ops, 15000);
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

    const nowIso = new Date().toISOString();
    const devId = getOrCreateDeviceId();
    const stampedRecs = recs.map(r => ({
      ...r,
      timestamp: r.timestamp || nowIso,
      updatedAt: r.updatedAt || nowIso,
      deviceId: r.deviceId || devId
    }));

    const inFlightUntil = Date.now() + 15000;
    for (const r of stampedRecs) {
      inFlightAttUpsertsRef.current.set(r.id, { item: r, expiresAt: inFlightUntil });
      inFlightAttDeletesRef.current.delete(r.id);
    }

    const prev = attendanceRef.current;
    const recMap = new Map(stampedRecs.map(r => [r.id, r]));
    const updated = prev.map(item => recMap.has(item.id) ? recMap.get(item.id)! : item);
    for (const r of stampedRecs) {
      if (!prev.some(item => item.id === r.id)) {
        updated.push(r);
      }
    }
    attendanceRef.current = updated;
    setAttendance(updated);
    localStorage.setItem('cache_attendance', JSON.stringify(updated));
    broadcastSyncMessage({ type: 'cache_updated', key: 'cache_attendance' });

    if (!navigator.onLine) {
      enqueueOfflineAction('attendance_batch', stampedRecs, `Lote de asistencia (${stampedRecs.length} registros)`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const ops: BatchWriteOp[] = [];
      for (const r of stampedRecs) {
        const payload = compressData(r);
        if (!payload) throw new Error(`Empty payload for attendance ${r.id}`);
        ops.push({
          kind: 'set',
          collectionName: 'attendance',
          docId: r.id,
          data: { payload, timestamp: r.timestamp || nowIso }
        });
      }
      await commitFirestoreBatchOps(db, ops, 15000);
      const graceUntil = Date.now() + 4000;
      for (const r of stampedRecs) {
        inFlightAttUpsertsRef.current.set(r.id, { item: r, expiresAt: graceUntil });
      }
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Update attendance Firestore sync error, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('attendance_batch', stampedRecs, `Lote de asistencia (${stampedRecs.length} registros)`);
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  const handleRegisterAttendance = async (r: AttendanceRecord) => {
    const nowIso = new Date().toISOString();
    const safeRec: AttendanceRecord = {
      ...r,
      timestamp: r.timestamp || nowIso,
      updatedAt: r.updatedAt || nowIso,
      deviceId: r.deviceId || getOrCreateDeviceId()
    };

    inFlightAttUpsertsRef.current.set(safeRec.id, { item: safeRec, expiresAt: Date.now() + 15000 });
    inFlightAttDeletesRef.current.delete(safeRec.id);

    const updated = [safeRec, ...attendanceRef.current.filter(item => item.id !== safeRec.id)];
    attendanceRef.current = updated;
    setAttendance(updated);
    localStorage.setItem('cache_attendance', JSON.stringify(updated));
    broadcastSyncMessage({ type: 'cache_updated', key: 'cache_attendance' });

    if (!navigator.onLine) {
      enqueueOfflineAction('attendance_record', safeRec, `Marcación de asistencia (${safeRec.type})`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const payload = compressData(safeRec);
      if (!payload) throw new Error('Serialization failed');
      await withWriteTimeout(setDoc(doc(db, "attendance", safeRec.id), { payload, timestamp: safeRec.timestamp }), 10000);
      inFlightAttUpsertsRef.current.set(safeRec.id, { item: safeRec, expiresAt: Date.now() + 4000 });
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
    const inFlightUntil = Date.now() + 15000;
    for (const id of ids) {
      inFlightAttDeletesRef.current.set(id, inFlightUntil);
      inFlightAttUpsertsRef.current.delete(id);
    }

    const updated = attendanceRef.current.filter(item => !idSet.has(item.id));
    attendanceRef.current = updated;
    setAttendance(updated);
    localStorage.setItem('cache_attendance', JSON.stringify(updated));
    broadcastSyncMessage({ type: 'cache_updated', key: 'cache_attendance' });

    if (!navigator.onLine) {
      enqueueOfflineAction('attendance_delete', ids, `Anulación de asistencia (${ids.length} registros)`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const ops: BatchWriteOp[] = ids.map(id => ({ kind: 'delete', collectionName: 'attendance', docId: id }));
      await commitFirestoreBatchOps(db, ops, 15000);
      const graceUntil = Date.now() + 4000;
      for (const id of ids) inFlightAttDeletesRef.current.set(id, graceUntil);
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Delete attendance Firestore sync error, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction('attendance_delete', ids, `Anulación de asistencia (${ids.length} registros)`);
      setPendingSyncCount(getPendingSyncCount());
    }
  };

  /**
   * Reemplazo atómico en una sola transacción (elimina marcaciones anteriores del día e inserta las corregidas/regularizadas)
   * garantizando consistencia total entre todos los dispositivos conectados.
   */
  const handleReplaceAttendance = async (deleteIds: string[], newRecords: AttendanceRecord[]) => {
    const cleanDeleteIds = Array.from(new Set((deleteIds || []).filter(Boolean)));
    const nowIso = new Date().toISOString();
    const devId = getOrCreateDeviceId();
    const cleanNewRecords = (newRecords || [])
      .filter(r => r && r.id)
      .map(r => ({
        ...r,
        timestamp: r.timestamp || nowIso,
        updatedAt: r.updatedAt || nowIso,
        deviceId: r.deviceId || devId
      }));
    if (cleanDeleteIds.length === 0 && cleanNewRecords.length === 0) return;

    const delSet = new Set(cleanDeleteIds);
    const newMap = new Map(cleanNewRecords.map(r => [r.id, r]));
    const inFlightUntil = Date.now() + 15000;
    for (const delId of cleanDeleteIds) {
      if (!newMap.has(delId)) {
        inFlightAttDeletesRef.current.set(delId, inFlightUntil);
        inFlightAttUpsertsRef.current.delete(delId);
      }
    }
    for (const r of cleanNewRecords) {
      inFlightAttUpsertsRef.current.set(r.id, { item: r, expiresAt: inFlightUntil });
      inFlightAttDeletesRef.current.delete(r.id);
    }

    const prev = attendanceRef.current.filter(item => !delSet.has(item.id) && !newMap.has(item.id));
    const updated = [...prev, ...cleanNewRecords];

    attendanceRef.current = updated;
    setAttendance(updated);
    localStorage.setItem('cache_attendance', JSON.stringify(updated));
    broadcastSyncMessage({ type: 'cache_updated', key: 'cache_attendance' });

    if (!navigator.onLine) {
      enqueueOfflineAction(
        'attendance_replace',
        { deleteIds: cleanDeleteIds, upsertRecords: cleanNewRecords },
        `Regularización atómica (${cleanDeleteIds.length} elim., ${cleanNewRecords.length} reg.)`
      );
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const ops: BatchWriteOp[] = [];
      for (const delId of cleanDeleteIds) {
        if (!newMap.has(delId)) {
          ops.push({ kind: 'delete', collectionName: 'attendance', docId: delId });
        }
      }
      for (const r of cleanNewRecords) {
        const payload = compressData(r);
        if (!payload) throw new Error(`Empty payload for attendance ${r.id}`);
        ops.push({
          kind: 'set',
          collectionName: 'attendance',
          docId: r.id,
          data: { payload, timestamp: r.timestamp || nowIso }
        });
      }
      await commitFirestoreBatchOps(db, ops, 15000);
      const graceUntil = Date.now() + 4000;
      for (const delId of cleanDeleteIds) {
        if (!newMap.has(delId)) inFlightAttDeletesRef.current.set(delId, graceUntil);
      }
      for (const r of cleanNewRecords) {
        inFlightAttUpsertsRef.current.set(r.id, { item: r, expiresAt: graceUntil });
      }
      setIsDbConnected(true);
    } catch (e) {
      console.warn("Atomic replace attendance Firestore error, enqueuing offline:", e);
      setIsDbConnected(false);
      enqueueOfflineAction(
        'attendance_replace',
        { deleteIds: cleanDeleteIds, upsertRecords: cleanNewRecords },
        `Regularización atómica (${cleanDeleteIds.length} elim., ${cleanNewRecords.length} reg.)`
      );
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
    broadcastSyncMessage({ type: 'cache_updated', key: 'cache_saved_reports' });

    if (changedReports.length === 0 && deletedIds.length === 0) {
      return;
    }

    if (!navigator.onLine) {
      enqueueOfflineAction('saved_reports_batch', { changedReports, deletedIds }, `Guardado de reportes (${changedReports.length})`);
      setPendingSyncCount(getPendingSyncCount());
      return;
    }

    try {
      const ops: BatchWriteOp[] = [];
      for (const id of deletedIds) {
        ops.push({ kind: 'delete', collectionName: 'saved_reports', docId: id });
      }
      for (const r of changedReports) {
        const payload = compressData(r);
        if (!payload) throw new Error(`Empty payload for report ${r.id}`);
        ops.push({ kind: 'set', collectionName: 'saved_reports', docId: r.id, data: { payload } });
      }
      await commitFirestoreBatchOps(db, ops, 15000);
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
      broadcastSyncMessage({ type: 'cache_updated', key: 'cache_company' });
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
      const mergedSettings = rolloverSettingsToYear(
        buildSafeGlobalSettings(backup.settings, backup.settings.activeFiscalYear || new Date().getFullYear()),
        new Date().getFullYear()
      ).nextSettings;
      settingsRef.current = mergedSettings;
      setSettings(mergedSettings);
      localStorage.setItem('cache_settings', JSON.stringify(mergedSettings));
      broadcastSyncMessage({ type: 'cache_updated', key: 'cache_settings' });
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
      broadcastSyncMessage({ type: 'cache_updated', key: 'cache_employees' });
      if (!navigator.onLine) {
        enqueueOfflineAction('employee_batch', { changedEmps: validEmps, deletedIds: deletedEmpIds }, `Restauración de colaboradores (${validEmps.length})`);
      } else {
        const ops: BatchWriteOp[] = [
          ...deletedEmpIds.map(id => ({ kind: 'delete' as const, collectionName: 'employees', docId: id })),
          ...validEmps.map(e => ({ kind: 'set' as const, collectionName: 'employees', docId: e.id, data: { payload: compressData(e) } }))
        ];
        syncTasks.push(
          commitFirestoreBatchOps(db, ops, 20000).catch(() => {
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
      broadcastSyncMessage({ type: 'cache_updated', key: 'cache_payments' });
      if (!navigator.onLine) {
        enqueueOfflineAction('payment_batch', { changedPayments: validPayments, deletedIds: deletedPayIds }, `Restauración de pagos (${validPayments.length})`);
      } else {
        const ops: BatchWriteOp[] = [
          ...deletedPayIds.map(id => ({ kind: 'delete' as const, collectionName: 'payments', docId: id })),
          ...validPayments.map(p => ({ kind: 'set' as const, collectionName: 'payments', docId: p.id, data: { payload: compressData(p) } }))
        ];
        syncTasks.push(
          commitFirestoreBatchOps(db, ops, 20000).catch(() => {
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
      broadcastSyncMessage({ type: 'cache_updated', key: 'cache_attendance' });
      if (!navigator.onLine) {
        enqueueOfflineAction('attendance_replace', { deleteIds: deletedAttIds, upsertRecords: validAtt }, `Restauración de asistencias (${validAtt.length})`);
      } else {
        const ops: BatchWriteOp[] = [
          ...deletedAttIds.map(id => ({ kind: 'delete' as const, collectionName: 'attendance', docId: id })),
          ...validAtt.map(a => ({ kind: 'set' as const, collectionName: 'attendance', docId: a.id, data: { payload: compressData(a), timestamp: a.timestamp || new Date().toISOString() } }))
        ];
        syncTasks.push(
          commitFirestoreBatchOps(db, ops, 20000).catch(() => {
            anyOfflineOrError = true;
            enqueueOfflineAction('attendance_replace', { deleteIds: deletedAttIds, upsertRecords: validAtt }, `Restauración de asistencias (${validAtt.length})`);
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
      broadcastSyncMessage({ type: 'cache_updated', key: 'cache_saved_reports' });
      if (!navigator.onLine) {
        enqueueOfflineAction('saved_reports_batch', { changedReports: validReps, deletedIds: deletedRepIds }, `Restauración de reportes (${validReps.length})`);
      } else {
        const ops: BatchWriteOp[] = [
          ...deletedRepIds.map(id => ({ kind: 'delete' as const, collectionName: 'saved_reports', docId: id })),
          ...validReps.map(r => ({ kind: 'set' as const, collectionName: 'saved_reports', docId: r.id, data: { payload: compressData(r) } }))
        ];
        syncTasks.push(
          commitFirestoreBatchOps(db, ops, 20000).catch(() => {
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
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl shadow-2xl border text-[11px] font-black uppercase tracking-wider flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-300 max-w-lg no-print ${
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
        <AppViewErrorBoundary onResetView={() => setView('selection')}>
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
        </AppViewErrorBoundary>
      )}

      {view === 'admin' && currentUserRole && appMode === 'full' && (
        <AppViewErrorBoundary onResetView={() => setView('selection')}>
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
            onReplaceAttendance={handleReplaceAttendance}
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
        </AppViewErrorBoundary>
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
