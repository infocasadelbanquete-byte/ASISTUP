
import React, { useState, useMemo, useEffect } from 'react';
import { Role, CompanyConfig, Employee, AttendanceRecord, Payment, GlobalSettings, NotificationMessage, SavedReport, SystemBackupData } from '../types.ts';
import Sidebar from '../components/Sidebar.tsx';
import CompanyModule from './modules/CompanyModule.tsx';
import EmployeeModule from './modules/EmployeeModule.tsx';
import PayrollModule from './modules/PayrollModule.tsx';
import PaymentsModule from './modules/PaymentsModule.tsx';
import SettingsModule from './modules/SettingsModule.tsx';
import ReportsModule from './modules/ReportsModule.tsx';
import AiAssistant from './modules/AiAssistant.tsx';
import NotificationsModule from './modules/NotificationsModule.tsx';
import Modal from '../components/Modal.tsx';
import ConfirmationModal from '../components/ConfirmationModal.tsx';
import { DAILY_QUOTES, ACTIVE_BREAKS, ECUADOR_HOLIDAYS } from '../constants.tsx';

interface AdminDashboardProps {
  role: Role;
  isDbConnected?: boolean;
  isOnline?: boolean;
  pendingSyncCount?: number;
  onSyncNow?: () => Promise<void>;
  isSyncing?: boolean;
  onLogout: () => void;
  company: CompanyConfig | null;
  onUpdateCompany: (config: CompanyConfig) => void;
  employees: Employee[];
  onUpdateEmployees: (employees: Employee[]) => void;
  attendance: AttendanceRecord[];
  onUpdateAttendance?: (records: AttendanceRecord[]) => void;
  onDeleteAttendance?: (ids: string[]) => void;
  payments: Payment[];
  onUpdatePayments: (payments: Payment[]) => void;
  savedReports: SavedReport[];
  onUpdateSavedReports: (reports: SavedReport[]) => void;
  settings: GlobalSettings;
  onUpdateSettings: (settings: GlobalSettings) => void;
  onRestoreBackup?: (backup: SystemBackupData) => Promise<{ syncedOnline: boolean }>;
  onUpdateAppMode: (mode: 'full' | 'attendance') => void;
  appMode: 'full' | 'attendance';
}

const APP_ICON_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%233b82f6;'/%3E%3Cstop offset='100%25' style='stop-color:%231e3a8a;'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='none' stroke='url(%23g)' stroke-width='6' stroke-dasharray='15 5'/%3E%3Ccircle cx='50' cy='50' r='32' fill='none' stroke='url(%23g)' stroke-width='5' stroke-dasharray='10 4' opacity='0.7'/%3E%3Ccircle cx='50' cy='50' r='18' fill='none' stroke='url(%23g)' stroke-width='4' opacity='0.4'/%3E%3Ccircle cx='50' cy='50' r='6' fill='%233b82f6'/%3E%3C/svg%3E";

const getLocalDateKey = (ts?: string): string => {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  role, isDbConnected, isOnline = true, pendingSyncCount = 0, onSyncNow, isSyncing = false, onLogout, company, onUpdateCompany, employees, onUpdateEmployees, attendance, onUpdateAttendance, onDeleteAttendance, payments, onUpdatePayments, savedReports, onUpdateSavedReports, settings, onUpdateSettings, onRestoreBackup, onUpdateAppMode, appMode 
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'company' | 'employees' | 'payroll' | 'payments' | 'settings' | 'reports' | 'ai' | 'notifications'>('dashboard');
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  } | null>(null);

  const requestConfirmation = (config: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }) => {
    setConfirmAction({
      isOpen: true,
      title: config.title,
      message: config.message,
      confirmLabel: config.confirmLabel,
      cancelLabel: config.cancelLabel,
      type: config.type,
      onConfirm: () => {
        setConfirmAction(null);
        config.onConfirm();
      }
    });
  };

  const [selectedReportEmployeeId, setSelectedReportEmployeeId] = useState<string>('');
  const [regularizationTrigger, setRegularizationTrigger] = useState<number>(0);
  const [regularizeFeedback, setRegularizeFeedback] = useState<{
    isOpen: boolean;
    employeeName: string;
    employeeId: string;
    count: number;
    message: string;
  } | null>(null);

  const [resetPinModal, setResetPinModal] = useState<{
    isOpen: boolean;
    employeeName: string;
    newPin: string;
  }>({
    isOpen: false,
    employeeName: '',
    newPin: ''
  });
  
  const today = useMemo(() => new Date(), []);
  const todayDateStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const addNotification = (id: string, title: string, message: string, type: 'info' | 'alert' | 'critical') => {
    if (dismissedNotificationIds.has(id)) return;
    setNotifications(prev => {
      if (prev.some(n => n.id === id)) return prev;
      return [{ id, title, message, timestamp: new Date().toISOString(), type, isRead: false, isProcessed: false }, ...prev];
    });
  };

  const pinResetRequests = useMemo(() => {
    return employees.filter(e => e.pinResetRequested && e.status === 'active');
  }, [employees]);

  // Sincronización y Notificación en tiempo real de Solicitudes de Reseteo de PIN
  useEffect(() => {
    const pinResetEmps = employees.filter(e => e.pinResetRequested && e.status === 'active');
    
    setNotifications(prev => {
      let updated = [...prev];
      let hasChanges = false;

      pinResetEmps.forEach(emp => {
        const notifId = `pin-reset-${emp.id}`;
        const existing = updated.find(n => n.id === notifId);
        
        if (!existing) {
          hasChanges = true;
          updated = [{
            id: notifId,
            title: `Solicitud de Reseteo de PIN: ${emp.surname} ${emp.name}`,
            message: `El colaborador ${emp.name} ${emp.surname} (CI: ${emp.identification}) solicita restablecer su PIN de asistencia desde el panel de marcaciones.`,
            timestamp: new Date().toISOString(),
            type: 'critical',
            isRead: false,
            isProcessed: false
          }, ...updated];

          // Sonido de alerta
          try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const audioCtx = new AudioCtx();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.type = 'sine';
              osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
              osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);
              gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.35);
            }
          } catch (e) {
            // Ignorar bloqueo de audio sin gesto
          }

          // Notificación del sistema operativo / navegador
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("SOLICITUD DE RESETEO DE PIN", {
                body: `El colaborador ${emp.surname} ${emp.name} (CI: ${emp.identification}) solicita resetear su PIN de marcación.`,
                icon: APP_ICON_SVG
              });
            } catch (err) {
              console.warn("Desktop notification error:", err);
            }
          }
        } else if (existing.isProcessed) {
          hasChanges = true;
          updated = updated.map(n => n.id === notifId ? { ...n, isProcessed: false, isRead: false, timestamp: new Date().toISOString() } : n);
        }
      });

      // Si la solicitud de reseteo ya fue atendida
      updated = updated.map(n => {
        if (n.id.startsWith('pin-reset-')) {
          const empId = n.id.replace('pin-reset-', '');
          const emp = employees.find(e => e.id === empId);
          if (emp && !emp.pinResetRequested && !n.isProcessed) {
            hasChanges = true;
            return { ...n, isProcessed: true, isRead: true };
          }
        }
        return n;
      });

      return hasChanges ? updated : prev;
    });
  }, [employees]);

  const handleApprovePinReset = (emp: Employee) => {
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    const updated = employees.map(e => e.id === emp.id ? {
      ...e,
      pin: newPin,
      pinChanged: false,
      pinNeedsReset: true,
      pinResetRequested: false
    } : e);
    onUpdateEmployees(updated);
    setNotifications(prev => prev.map(n => n.id === `pin-reset-${emp.id}` ? { ...n, isProcessed: true, isRead: true } : n));
    setResetPinModal({
      isOpen: true,
      employeeName: `${emp.surname} ${emp.name}`,
      newPin
    });
  };

  const handleRejectPinReset = (empId: string) => {
    const updated = employees.map(e => e.id === empId ? {
      ...e,
      pinResetRequested: false
    } : e);
    onUpdateEmployees(updated);
    setNotifications(prev => prev.filter(n => n.id !== `pin-reset-${empId}`));
  };
  
  useEffect(() => {
    if (currentYear < 2026 || (currentYear === 2026 && currentMonth < 1)) return;
    const activeEmployees = employees.filter(e => e.status === 'active');
    const markedTodayIds = new Set((attendance || []).filter(a => a.timestamp.includes(todayDateStr)).map(a => a.employeeId));
    const missingAttendanceCount = activeEmployees.filter(e => !markedTodayIds.has(e.id)).length;
    if (missingAttendanceCount > 0 && activeTab === 'dashboard') {
      addNotification(`missing-attendance-${todayDateStr}`, "Marcaciones Pendientes", `Hoy faltan ${missingAttendanceCount} registros de ingreso por completar.`, 'alert');
    }
  }, [employees, attendance, todayDateStr, activeTab, dismissedNotificationIds, currentMonth, currentYear]);

  // Cálculos para Calendario y Proximidad
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [currentMonth, currentYear]);

  const monthHolidays = useMemo(() => {
    const standard = ECUADOR_HOLIDAYS.filter(h => h.month === currentMonth).map(h => ({ day: h.day, name: h.name }));
    const custom = (settings.holidays || [])
      .filter(dateStr => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .map(dateStr => ({
        day: new Date(dateStr + 'T00:00:00').getDate(),
        name: "Feriado Institucional"
      }));
    return [...standard, ...custom].sort((a, b) => a.day - b.day);
  }, [currentMonth, currentYear, settings.holidays]);

  const monthBirthdays = useMemo(() => {
    return employees.filter(e => {
      if (!e.birthDate || e.status !== 'active') return false;
      return new Date(e.birthDate).getMonth() === currentMonth;
    }).sort((a, b) => {
      const dayA = new Date(a.birthDate).getDate() + 1;
      const dayB = new Date(b.birthDate).getDate() + 1;
      return dayA - dayB;
    });
  }, [employees, currentMonth]);

  const pendingApprovals = useMemo(() => {
    return (attendance || []).filter(a => a.status === 'pending_approval').sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [attendance]);

  const handleProcessApproval = (id: string, newStatus: 'confirmed' | 'rejected', customTimestamp?: string) => {
    if (!onUpdateAttendance) return;
    const targetRecord = attendance.find(a => a.id === id);
    if (!targetRecord) return;

    const validatedAt = new Date().toISOString();
    const updatedRecord: AttendanceRecord = {
      ...targetRecord,
      status: newStatus,
      validatedAt,
      timestamp: customTimestamp || targetRecord.timestamp
    };

    onUpdateAttendance([updatedRecord]);

    if (newStatus === 'confirmed') {
      const emp = employees.find(e => e.id === targetRecord.employeeId);
      if (emp) {
        const obsDate = new Date(updatedRecord.timestamp).toLocaleDateString('es-EC');
        const shiftType = updatedRecord.type === 'in' ? 'Ingreso' : 'Salida';
        const newObs = {
          date: validatedAt,
          text: `REGULARIZACIÓN APROBADA POR ADMINISTRACIÓN: Marcación de ${shiftType} (${obsDate}) validada y asentada oficialmente.`
        };

        const updatedEmployees = employees.map(e => e.id === emp.id ? {
          ...e,
          observations: [newObs, ...(e.observations || [])],
          regularizationApprovedNotice: {
            id: Math.random().toString(36).substr(2, 9),
            approvedAt: validatedAt,
            message: `El Administrador ha aprobado su solicitud de regularización (${shiftType} - ${obsDate}) y ha sido registrada oficialmente en el sistema.`,
            count: 1,
            seen: false
          }
        } : e);

        onUpdateEmployees(updatedEmployees);

        setRegularizeFeedback({
          isOpen: true,
          employeeName: `${emp.surname || ''} ${emp.name || ''}`,
          employeeId: emp.id,
          count: 1,
          message: `La marcación de ${shiftType} (${obsDate}) ha sido validada y asentada oficialmente en el sistema. Se ha notificado con éxito al colaborador para su próximo ingreso.`
        });
      }
    } else {
      const emp = employees.find(e => e.id === targetRecord.employeeId);
      setRegularizeFeedback({
        isOpen: true,
        employeeName: `${emp?.surname || ''} ${emp?.name || ''}`,
        employeeId: emp?.id || '',
        count: 1,
        message: `La solicitud de regularización ha sido descartada / rechazada formalmente.`
      });
    }
  };

  const handleApproveAllForEmployee = (employeeId: string) => {
    if (!onUpdateAttendance) return;
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    const empPending = pendingApprovals.filter(a => a.employeeId === employeeId);
    if (empPending.length === 0) return;

    const validatedAt = new Date().toISOString();
    const updatedRecords: AttendanceRecord[] = empPending.map(r => ({
      ...r,
      status: 'confirmed' as const,
      validatedAt
    }));

    onUpdateAttendance(updatedRecords);

    const newObs = {
      date: validatedAt,
      text: `REGULARIZACIÓN COMPLETA APROBADA POR ADMINISTRACIÓN: Se registraron y validaron formalmente ${empPending.length} marcaciones pendientes.`
    };

    const updatedEmployees = employees.map(e => e.id === employeeId ? {
      ...e,
      observations: [newObs, ...(e.observations || [])],
      regularizationApprovedNotice: {
        id: Math.random().toString(36).substr(2, 9),
        approvedAt: validatedAt,
        message: `El Administrador ha aprobado su solicitud de regularización de marcajes pendientes. Se asentaron satisfactoriamente ${empPending.length} marcaciones en el sistema oficial.`,
        count: empPending.length,
        seen: false
      }
    } : e);

    onUpdateEmployees(updatedEmployees);

    setRegularizeFeedback({
      isOpen: true,
      employeeName: `${emp.surname || ''} ${emp.name || ''}`,
      employeeId: emp.id,
      count: empPending.length,
      message: `Se han validado y asentado formalmente las ${empPending.length} marcaciones pendientes en el sistema oficial. Se ha notificado con éxito al colaborador para su próximo ingreso.`
    });
  };

  const todayMarkings = useMemo(() => {
    const activeEmpMap = new Map<string, Employee>(
      employees.filter(e => e && e.status === 'active').map(e => [e.id, e])
    );
    return (attendance || [])
      .filter(a => {
        if (!a || !a.id || !a.employeeId) return false;
        if (a.status !== 'confirmed') return false;
        if (a.type !== 'in' && a.type !== 'out' && a.type !== 'half_day') return false;
        if ((a.justification || '').includes('[AUDITORÍA RETROACTIVA]')) return false;
        if (!activeEmpMap.has(a.employeeId)) return false;
        const d = new Date(a.timestamp);
        if (isNaN(d.getTime())) return false;
        return getLocalDateKey(a.timestamp) === todayDateStr;
      })
      .sort((a, b) => {
        const empA = activeEmpMap.get(a.employeeId)!;
        const empB = activeEmpMap.get(b.employeeId)!;
        const nameA = `${empA.surname || ''} ${empA.name || ''}`.trim().toLowerCase();
        const nameB = `${empB.surname || ''} ${empB.name || ''}`.trim().toLowerCase();
        const nameCmp = nameA.localeCompare(nameB, 'es');
        if (nameCmp !== 0) return nameCmp;
        if (a.employeeId !== b.employeeId) return a.employeeId.localeCompare(b.employeeId);
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
  }, [attendance, todayDateStr, employees]);

  const employeeAlertsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const activeNotifications = notifications.filter(n => !n.isProcessed);
    const activeEmployees = employees.filter(e => e && e.status === 'active');

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const currentDayNum = today.getDate();

    activeEmployees.forEach(emp => {
      const reasons: string[] = [];

      if (emp.pinResetRequested) {
        reasons.push('Reseteo de PIN pendiente');
      }

      if (pendingApprovals.some(p => p.employeeId === emp.id)) {
        reasons.push('Solicitud de regularización pendiente');
      }

      const fullNameUpper = `${emp.surname || ''} ${emp.name || ''}`.trim().toUpperCase();
      const reverseNameUpper = `${emp.name || ''} ${emp.surname || ''}`.trim().toUpperCase();
      const hasEmpNotif = activeNotifications.some(n => {
        if (n.id === `pin-reset-${emp.id}`) return true;
        const haystack = `${n.title || ''} ${n.message || ''}`.toUpperCase();
        return (
          (emp.identification && haystack.includes(emp.identification.toUpperCase())) ||
          (fullNameUpper.length > 2 && haystack.includes(fullNameUpper)) ||
          (reverseNameUpper.length > 2 && haystack.includes(reverseNameUpper))
        );
      });
      if (hasEmpNotif) {
        reasons.push('Notificación activa');
      }

      // Verificar días laborables pasados del mes actual con marcaciones faltantes o incompletas
      let hasMissingMonthMark = false;
      const startDay = Math.max(1, currentDayNum - 14);
      for (let d = startDay; d < currentDayNum; d++) {
        const targetDate = new Date(currentYear, currentMonth, d);
        const dayOfWeek = targetDate.getDay();
        if (dayOfWeek === 0) continue; // Domingo

        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if ((settings.holidays || []).includes(dateStr)) continue;
        if (ECUADOR_HOLIDAYS.some(h => h.month === currentMonth && h.day === d)) continue;
        if ((emp.vacations || []).some(v => dateStr >= v.startDate && dateStr <= v.endDate)) continue;

        const dayObs = (emp.observations || []).filter(o => o.date && o.date.startsWith(dateStr));
        const isFullDayPerm = dayObs.some(o => {
          const pType = (o.permissionType || '').toUpperCase();
          const r = (o.reason || '').toUpperCase();
          return (
            pType === 'DIA LABORAL ENTERO' ||
            pType === 'ENTERO' ||
            (pType === '' && (r.includes('PERMISO MATERNAL') || r.includes('PERMISO MEDICO') || r.includes('PERMISO PERSONAL') || r.includes('FALTA JUSTIFICADA'))) ||
            (typeof o.permissionHours === 'number' && o.permissionHours >= 8)
          );
        });
        if (isFullDayPerm) continue;

        const hasHalfDayPerm = dayObs.some(o => {
          const pType = (o.permissionType || '').toUpperCase();
          return pType.includes('MEDIA') || pType === 'MEDIA_AM' || pType === 'MEDIA_PM' || (typeof o.permissionHours === 'number' && o.permissionHours >= 4);
        });

        const dayRecs = (attendance || []).filter(
          a => a.employeeId === emp.id && getLocalDateKey(a.timestamp) === dateStr && a.status !== 'rejected' && !(a.justification || '').includes('[AUDITORÍA RETROACTIVA]')
        );
        if (dayRecs.some(a => a.type === 'half_day') || hasHalfDayPerm) continue;

        const insCount = dayRecs.filter(a => a.type === 'in').length;
        const outsCount = dayRecs.filter(a => a.type === 'out').length;
        const isContDone = dayRecs.some(a => a.isContinuousShift) && insCount >= 1 && outsCount >= 1;
        if (isContDone) continue;

        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          if (insCount < 2 || outsCount < 2) {
            hasMissingMonthMark = true;
            break;
          }
        } else if (dayOfWeek === 6) {
          if (insCount < 1 || outsCount < 1) {
            hasMissingMonthMark = true;
            break;
          }
        }
      }
      if (hasMissingMonthMark) {
        reasons.push('Marcación pendiente en el mes');
      }

      if (reasons.length > 0) {
        map.set(emp.id, reasons);
      }
    });

    return map;
  }, [employees, notifications, pendingApprovals, attendance, today, currentMonth, currentYear, settings.holidays]);

  const handlePurgeData = async () => {
    if (role !== Role.SUPER_ADMIN) return;
    onUpdateEmployees([]);
    onUpdatePayments([]);
  };

  const relaxingImages = [
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=2070",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=2071",
    "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=2070",
    "https://images.unsplash.com/photo-1541450805268-4822a3a774ce?auto=format&fit=crop&q=80&w=2070"
  ];

  return (
    <div className="flex h-screen bg-[#fcfdfe] overflow-hidden flex-col md:flex-row">
      <Sidebar role={role} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={onLogout} companyName={company?.name} unreadCount={notifications.filter(n => !n.isRead).length} />
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-8 scroll-smooth custom-scroll">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 no-print pt-14 md:pt-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
            <h1 className="text-3xl md:text-4xl font-[950] text-slate-900 tracking-tight uppercase leading-none italic">Management Hub</h1>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-100 rounded-full shadow-sm w-fit">
                 <div className={`w-3 h-3 rounded-full ${
                   !isOnline 
                     ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse' 
                     : (pendingSyncCount > 0 
                         ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse' 
                         : (isDbConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'))
                 }`}></div>
                 <span className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-600">
                   {!isOnline 
                     ? `Modo Desconectado (Offline)${pendingSyncCount > 0 ? ` • ${pendingSyncCount} pendientes` : ''}` 
                     : (pendingSyncCount > 0 
                         ? `${pendingSyncCount} pendientes por sincronizar` 
                         : (isDbConnected ? 'Sincronizado en Línea' : 'Reconectando...'))}
                 </span>
              </div>

              {isOnline && pendingSyncCount > 0 && onSyncNow && (
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-black text-[11px] uppercase tracking-wider shadow-sm flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <span className={isSyncing ? 'animate-spin' : ''}>🔄</span>
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="animate-in fade-in duration-500 pb-20 md:pb-0">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* MENSAJE INSPIRACIONAL REDUCIDO */}
              <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-6 md:p-8 text-white shadow-xl min-h-[160px] flex items-center bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.7)), url(${relaxingImages[Math.floor(today.getDate() % 4)]})` }}>
                  <div className="relative z-10 w-full">
                    <p className="text-blue-400 font-black text-[10px] md:text-[12px] uppercase tracking-[0.5em] mb-4">Estrategia & Visión Diaria</p>
                    <h2 className="text-xl md:text-3xl font-[900] leading-tight tracking-tighter italic max-w-4xl">"{DAILY_QUOTES[Math.floor(today.getDate() % DAILY_QUOTES.length)]}"</h2>
                  </div>
              </div>

              {/* SOLICITUDES DE RESETEO DE PIN */}
              {pinResetRequests.length > 0 && (
                <div className="bg-white p-8 md:p-10 rounded-[3.5rem] border-4 border-amber-300 shadow-xl bg-gradient-to-br from-amber-50/60 to-white">
                   <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20 animate-pulse">🔑</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest leading-none">Solicitudes de Reseteo de PIN</h3>
                            <span className="px-2.5 py-0.5 bg-amber-500 text-white text-[8px] font-black uppercase rounded-full animate-bounce">{pinResetRequests.length} PENDIENTE{pinResetRequests.length > 1 ? 'S' : ''}</span>
                          </div>
                          <p className="text-[10px] font-black text-amber-600 uppercase mt-1">Colaboradores que solicitaron restablecer su acceso desde el terminal</p>
                        </div>
                      </div>
                   </div>
                   <div className="space-y-4">
                      {pinResetRequests.map(emp => (
                        <div key={emp.id} className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-white rounded-[2rem] border-2 border-amber-200/70 shadow-sm hover:shadow-md transition-all">
                           <div className="flex items-center gap-4 flex-1">
                              <div className="w-14 h-14 bg-amber-100 rounded-2xl border-2 border-amber-200 flex items-center justify-center overflow-hidden shrink-0">
                                 {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : <span className="font-black text-amber-700 text-lg">{emp.name[0]}</span>}
                              </div>
                              <div>
                                 <p className="text-sm font-black text-slate-900 uppercase">{emp.surname} {emp.name}</p>
                                 <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">CI: <span className="font-mono text-slate-700 font-black">{emp.identification}</span> • Cargo: <span className="text-blue-600 font-black">{emp.role}</span></p>
                                 <p className="text-[9px] font-black text-amber-600 mt-1 flex items-center gap-1.5">
                                   <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                                   Solicitud activa desde el panel de asistencia
                                 </p>
                              </div>
                           </div>
                           <div className="flex gap-3 w-full md:w-auto">
                              <button 
                                onClick={() => requestConfirmation({
                                  title: 'Descartar Solicitud de PIN',
                                  message: `¿Está seguro de descartar la solicitud de reseteo de PIN para ${emp.surname} ${emp.name}?`,
                                  confirmLabel: 'Sí, Descartar',
                                  cancelLabel: 'Cancelar',
                                  type: 'danger',
                                  onConfirm: () => handleRejectPinReset(emp.id)
                                })} 
                                className="flex-1 md:flex-none px-6 py-3.5 bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 border border-slate-200 font-black rounded-xl uppercase text-[9px] tracking-widest transition-all cursor-pointer"
                              >
                                Descartar
                              </button>
                              <button 
                                onClick={() => requestConfirmation({
                                  title: 'Generar Clave Temporal',
                                  message: `¿Desea emitir un nuevo PIN provisional de marcación para ${emp.surname} ${emp.name}? El colaborador deberá actualizar su clave obligatoriamente en su siguiente ingreso.`,
                                  confirmLabel: 'Sí, Generar PIN',
                                  cancelLabel: 'Cancelar',
                                  type: 'warning',
                                  onConfirm: () => handleApprovePinReset(emp)
                                })} 
                                className="flex-1 md:flex-none px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl uppercase text-[9px] tracking-widest shadow-lg shadow-amber-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <span>✨</span> Generar Nuevo PIN
                              </button>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              )}

              {/* AUTORIZACIONES PENDIENTES */}
              {(role === Role.SUPER_ADMIN || role === Role.PARTIAL_ADMIN) && pendingApprovals.length > 0 && (
                <div className="bg-white p-8 md:p-10 rounded-[3.5rem] border-4 border-blue-100 shadow-xl">
                   <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl">⚖️</div>
                      <div>
                        <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest leading-none mb-1">Autorizaciones Pendientes</h3>
                        <p className="text-[10px] font-black text-blue-500 uppercase">Solicitudes de Regularización por Procesar ({pendingApprovals.length})</p>
                      </div>
                   </div>
                   <div className="space-y-4">
                      {Array.from(new Set(pendingApprovals.map(r => r.employeeId))).map(empId => {
                        const emp = employees.find(e => e.id === empId);
                        const empPending = pendingApprovals.filter(r => r.employeeId === empId);
                        if (empPending.length <= 1) return null;
                        return (
                          <div key={`batch-${empId}`} className="p-4 bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 border border-blue-800 shadow-lg">
                            <div className="text-left flex items-center gap-3">
                              <span className="text-2xl">📋</span>
                              <div>
                                <span className="text-[8px] font-black uppercase text-blue-300 tracking-wider">Regularización de Marcajes Pendientes</span>
                                <p className="text-xs font-black uppercase">{emp?.surname} {emp?.name} tiene {empPending.length} solicitudes pendientes</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedReportEmployeeId(empId);
                                  setRegularizationTrigger(Date.now());
                                  setActiveTab('reports');
                                }}
                                className="w-full sm:w-auto px-4 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <span>✍️</span> Abrir Panel de Asistencia ({empPending.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => requestConfirmation({
                                  title: 'Aceptar Regularización de Horario',
                                  message: `¿Desea aceptar la solicitud de regularización de ${emp?.surname || ''} ${emp?.name || ''} y abrir su panel de asistencia con las fechas y horarios por regularizar?`,
                                  confirmLabel: 'Sí, Aceptar y Abrir Panel',
                                  cancelLabel: 'Cancelar',
                                  type: 'info',
                                  onConfirm: () => {
                                    setSelectedReportEmployeeId(empId);
                                    setRegularizationTrigger(Date.now());
                                    setActiveTab('reports');
                                  }
                                })}
                                className="w-full sm:w-auto px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                              >
                                <span>✓</span> Aceptar y Regularizar Horario
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {pendingApprovals.map(req => {
                        const emp = employees.find(e => e.id === req.employeeId);
                        const isRetroAudit = (req.justification || '').includes('[AUDITORÍA RETROACTIVA]');
                        return (
                          <div key={req.id} className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-slate-50 rounded-[2rem] border border-blue-50">
                             <div className="flex items-center gap-4 flex-1">
                                <div className="w-12 h-12 bg-white rounded-2xl border flex items-center justify-center overflow-hidden shrink-0">
                                   {emp?.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : <span className="font-black">{emp?.name[0]}</span>}
                                </div>
                                <div>
                                   <p className="text-xs font-black text-slate-900 uppercase">{emp?.surname} {emp?.name}</p>
                                   <p className="text-[9px] font-bold text-slate-400 uppercase">{isRetroAudit ? 'Solicitud de Regularización Retroactiva' : (req.type === 'in' ? 'Ingreso' : 'Salida')} • {new Date(req.timestamp).toLocaleString('es-EC')}</p>
                                   <p className="text-[9px] font-black text-blue-600 mt-1 italic">"{req.justification}"</p>
                                </div>
                             </div>
                             <div className="flex flex-wrap gap-2">
                                <button 
                                  onClick={() => requestConfirmation({
                                    title: 'Rechazar Regularización',
                                    message: `¿Desea rechazar la regularización de esta marcación para ${emp?.surname || ''} ${emp?.name || ''}?`,
                                    confirmLabel: 'Sí, Rechazar',
                                    cancelLabel: 'Cancelar',
                                    type: 'danger',
                                    onConfirm: () => handleProcessApproval(req.id, 'rejected')
                                  })} 
                                  className="px-4 py-2.5 bg-white text-red-500 border-2 border-red-100 font-black rounded-xl uppercase text-[9px] hover:bg-red-50 transition-all cursor-pointer"
                                >
                                  Rechazar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (emp) {
                                      setSelectedReportEmployeeId(emp.id);
                                      setRegularizationTrigger(Date.now());
                                      setActiveTab('reports');
                                    }
                                  }}
                                  className="px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-black rounded-xl uppercase text-[9px] border border-blue-200 transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <span>✍️</span> Abrir Panel de Asistencia
                                </button>
                                <button 
                                  onClick={() => requestConfirmation({
                                    title: 'Aceptar Regularización de Colaborador',
                                    message: `¿Desea aceptar la solicitud de ${emp?.surname || ''} ${emp?.name || ''} y abrir su panel de asistencia con las fechas y horarios por regularizar?`,
                                    confirmLabel: 'Sí, Aceptar y Abrir Panel',
                                    cancelLabel: 'Cancelar',
                                    type: 'info',
                                    onConfirm: () => {
                                      if (emp) {
                                        setSelectedReportEmployeeId(emp.id);
                                        setRegularizationTrigger(Date.now());
                                        setActiveTab('reports');
                                      } else {
                                        handleProcessApproval(req.id, 'confirmed');
                                      }
                                    }
                                  })} 
                                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl uppercase text-[9px] shadow-lg active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  <span>✓</span> Aceptar y Regularizar
                                </button>
                             </div>
                          </div>
                        );
                      })}
                   </div>
                </div>
              )}

              {/* MONITOREO DE JORNADA DIARIA REDUCIDO */}
              <div className="bg-white p-6 md:p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                      <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-widest leading-none mb-2">Monitoreo de Jornada Diaria</h3>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Actividad Confirmada • {today.toLocaleDateString('es-EC', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto custom-scroll pr-2">
                    {todayMarkings.length === 0 ? (
                      <div className="col-span-full py-12 flex flex-col items-center justify-center opacity-40">
                         <span className="text-4xl mb-3">⌛</span>
                         <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Esperando marcaciones...</p>
                      </div>
                    ) : (
                      todayMarkings.map((mark) => {
                        const emp = employees.find(e => e.id === mark.employeeId);
                        if (!emp) return null;
                        const empMarksToday = todayMarkings.filter(a => a.employeeId === mark.employeeId);
                        const empAlerts = employeeAlertsMap.get(emp.id) || [];
                        const hasAlert = empAlerts.length > 0;
                        let specificLabel = ""; let labelColor = "";
                        if (mark.type === 'half_day') { specificLabel = "Media Jornada"; labelColor = "bg-amber-500 text-white"; }
                        else if (mark.type === 'in') { const inIndex = empMarksToday.filter(m => m.type === 'in').findIndex(m => m.id === mark.id); specificLabel = inIndex === 0 ? "In Mañana" : "In Tarde"; labelColor = inIndex === 0 ? "bg-emerald-600 text-white" : "bg-cyan-600 text-white"; }
                        else if (mark.type === 'out') {
                          if (mark.isContinuousShift) {
                            specificLabel = "Out De Corrido";
                            labelColor = "bg-indigo-600 text-white";
                          } else {
                            const outIndex = empMarksToday.filter(m => m.type === 'out').findIndex(m => m.id === mark.id);
                            specificLabel = outIndex === 0 ? "Out M. Día" : "Out Fin";
                            labelColor = outIndex === 0 ? "bg-orange-600 text-white" : "bg-pink-600 text-white";
                          }
                        }

                        return (
                          <div
                            key={mark.id}
                            title={hasAlert ? empAlerts.join(' • ') : undefined}
                            className={`flex items-center gap-3 p-3 rounded-2xl border transition-all hover:shadow-md group ${
                              hasAlert
                                ? 'bg-amber-50/75 border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.35)] hover:bg-amber-50'
                                : 'bg-slate-50/50 border-slate-100 hover:bg-white'
                            }`}
                          >
                             <div className={`relative w-8 h-8 bg-white rounded-xl border flex items-center justify-center overflow-hidden shrink-0 ${hasAlert ? 'border-amber-400' : ''}`}>
                                {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : <span className="text-[10px] font-black uppercase text-slate-300">{emp.name[0]}</span>}
                             </div>
                             <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1 min-w-0">
                                   {hasAlert && (
                                     <span className="relative flex h-2 w-2 shrink-0" title={empAlerts.join(' • ')}>
                                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-85"></span>
                                       <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                     </span>
                                   )}
                                   <p className="text-[10px] font-black text-slate-900 uppercase leading-none truncate">{emp.surname} {emp.name}</p>
                                   {hasAlert && (
                                     <span
                                       title={empAlerts.join(' • ')}
                                       className="text-[6px] font-black uppercase bg-amber-500 text-white px-1.5 py-0.5 rounded-full animate-pulse shadow-sm shrink-0"
                                     >
                                       ⚠️ Alerta
                                     </span>
                                   )}
                                </div>
                                <div className="flex flex-wrap items-center gap-1">
                                   <span className={`text-[6px] font-black uppercase px-1.5 py-0.5 rounded-full ${labelColor}`}>{specificLabel}</span>
                                   {mark.isLate && <span className="text-[6px] font-black uppercase bg-red-100 text-red-600 px-1 py-0.5 rounded-full animate-pulse">Retraso</span>}
                                   {mark.isForgotten && <span className="text-[6px] font-black uppercase bg-blue-100 text-blue-600 px-1 py-0.5 rounded-full">Reg.</span>}
                                </div>
                             </div>
                             <div className="text-right shrink-0">
                                <p className="text-[11px] font-black text-slate-900 tabular-nums leading-none">{new Date(mark.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                             </div>
                          </div>
                        );
                      })
                    )}
                 </div>
              </div>

              {/* CALENDARIO CORPORATIVO Y AGENDA RESTAURADOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col min-h-[450px]">
                   <div className="flex justify-between items-center mb-8">
                      <div>
                        <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-widest leading-none mb-2">Calendario Corporativo</h3>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(today)}</p>
                      </div>
                      <div className="flex gap-4">
                         <span className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> Feriado</span>
                         <span className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Cumple</span>
                      </div>
                   </div>
                   <div className="grid grid-cols-7 gap-2 text-center flex-1 items-center">
                      {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                        <div key={`${d}-${i}`} className="text-[11px] font-black text-slate-300 uppercase py-2">{d}</div>
                      ))}
                      {calendarDays.map((day, i) => {
                        const isHoliday = day && monthHolidays.some(h => h.day === day);
                        const isBirthday = day && monthBirthdays.some(e => new Date(e.birthDate).getDate() + 1 === day);
                        const isToday = day === today.getDate();
                        
                        return (
                          <div key={i} className={`
                            relative aspect-square flex items-center justify-center text-[12px] font-black rounded-2xl transition-all
                            ${!day ? 'opacity-0' : 'hover:bg-slate-50 cursor-pointer'}
                            ${isToday ? 'bg-slate-900 text-white shadow-lg scale-110 z-10' : 'text-slate-600'}
                            ${isHoliday ? 'text-blue-600 bg-blue-50/50' : ''}
                            ${isBirthday ? 'text-emerald-600 bg-emerald-50/50' : ''}
                          `}>
                            {day}
                            {(isHoliday || isBirthday) && <div className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full ${isHoliday ? 'bg-blue-600' : 'bg-emerald-600'}`}></div>}
                          </div>
                        );
                      })}
                   </div>
                </div>

                <div className="bg-slate-50 p-8 md:p-10 rounded-[3rem] border border-slate-100 flex flex-col min-h-[450px]">
                   <h3 className="text-[13px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-200 pb-4 mb-6">Agenda de Novedades (Proximidad)</h3>
                   <div className="space-y-3 overflow-y-auto custom-scroll flex-1 pr-2">
                      {monthHolidays.map((h, i) => (
                         <div key={i} className="flex gap-4 items-center bg-white p-4 rounded-2xl border border-slate-200/50 shadow-sm">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl">📅</div>
                            <div>
                               <p className="text-[11px] font-black text-slate-900 uppercase leading-none">{h.name}</p>
                               <p className="text-[9px] font-black text-blue-500 uppercase mt-2">Día {h.day}</p>
                            </div>
                         </div>
                      ))}
                      {monthBirthdays.map((e, i) => (
                         <div key={i} className="flex gap-4 items-center bg-white p-4 rounded-2xl border border-slate-200/50 shadow-sm">
                            <div className="w-10 h-10 rounded-xl overflow-hidden border bg-slate-100 flex items-center justify-center text-[12px] font-black uppercase">
                               {e.photo ? <img src={e.photo} className="w-full h-full object-cover" /> : <span className="text-slate-400">{e.name[0]}</span>}
                            </div>
                            <div>
                               <p className="text-[11px] font-black text-slate-900 uppercase leading-none">{e.surname} {e.name}</p>
                               <p className="text-[9px] font-black text-emerald-500 uppercase mt-2">Cumpleaños • Día {new Date(e.birthDate).getDate() + 1}</p>
                            </div>
                         </div>
                      ))}
                      {monthHolidays.length === 0 && monthBirthdays.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center py-16 opacity-30">
                          <span className="text-4xl mb-4">🍃</span>
                          <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">Sin eventos próximos</p>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'notifications' && <NotificationsModule notifications={notifications} onToggleRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? {...n, isRead: !n.isRead} : n))} onToggleProcessed={(id) => setNotifications(prev => prev.map(n => n.id === id ? {...n, isProcessed: !n.isProcessed} : n))} onClearAll={() => { setNotifications([]); }} />}
          {activeTab === 'company' && <CompanyModule company={company} onUpdate={onUpdateCompany} role={role} />}
          {activeTab === 'employees' && <EmployeeModule employees={employees} onUpdate={onUpdateEmployees} role={role} attendance={attendance} payments={payments} company={company} onUpdatePayments={onUpdatePayments} settings={settings} />}
          {activeTab === 'payroll' && <PayrollModule employees={employees} payments={payments} onUpdatePayments={onUpdatePayments} onUpdateEmployees={onUpdateEmployees} attendance={attendance} company={company} settings={settings} role={role} onSaveReport={(report) => onUpdateSavedReports([...savedReports, report])} />}
          {activeTab === 'payments' && <PaymentsModule employees={employees} payments={payments} onUpdate={onUpdatePayments} role={role} company={company} />}
          {activeTab === 'reports' && (
            <ReportsModule 
              employees={employees} 
              payments={payments} 
              attendance={attendance} 
              company={company} 
              settings={settings} 
              role={role} 
              savedReports={savedReports} 
              initialSelectedEmployeeId={selectedReportEmployeeId}
              initialOpenRegularizationTrigger={regularizationTrigger}
              onUpdateAttendance={onUpdateAttendance}
              onDeleteAttendance={onDeleteAttendance}
              onUpdateEmployees={onUpdateEmployees}
            />
          )}
          {activeTab === 'ai' && <AiAssistant employees={employees} attendance={attendance} payments={payments} role={role} />}
          {activeTab === 'settings' && (
            <SettingsModule
              settings={settings}
              onUpdate={onUpdateSettings}
              role={role}
              onPurge={handlePurgeData}
              onRestoreBackup={onRestoreBackup}
              allData={{ company, employees, attendance, payments, settings, savedReports }}
            />
          )}
        </div>
      </main>

      <Modal 
        isOpen={resetPinModal.isOpen} 
        onClose={() => setResetPinModal({ ...resetPinModal, isOpen: false })} 
        title="Nuevo PIN Generado" 
        type="success"
        maxWidth="max-w-md"
      >
        <div className="text-center p-4 space-y-6">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
            🔑
          </div>
          <div>
            <h4 className="text-base font-black text-slate-900 uppercase">Clave Temporal Asignada</h4>
            <p className="text-[11px] font-bold text-slate-500 uppercase mt-1">Colaborador: <span className="text-slate-900 font-black">{resetPinModal.employeeName}</span></p>
          </div>
          <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-xl border-2 border-amber-400">
            <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">PIN Temporal de Marcación</p>
            <p className="text-4xl font-mono font-[950] tracking-[0.3em]">{resetPinModal.newPin}</p>
          </div>
          <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase">
            Comunique este PIN de 6 dígitos al colaborador. Al ingresarlo en el panel de asistencia, el sistema le solicitará obligatoriamente registrar su nueva clave definitiva.
          </p>
          <button 
            type="button"
            onClick={() => setResetPinModal({ ...resetPinModal, isOpen: false })} 
            className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg active:scale-95 cursor-pointer"
          >
            Entendido y Notificado
          </button>
        </div>
      </Modal>

      {regularizeFeedback && (
        <Modal
          isOpen={regularizeFeedback.isOpen}
          onClose={() => setRegularizeFeedback(null)}
          title="REGULARIZACIÓN PROCESADA CON ÉXITO"
          type="success"
          maxWidth="max-w-lg"
        >
          <div className="text-center p-4 space-y-5 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
              ✓
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900 uppercase">Solicitud Aceptada y Procesada</h4>
              <p className="text-[11px] font-bold text-slate-500 uppercase mt-1">
                Colaborador: <span className="text-slate-900 font-black">{regularizeFeedback.employeeName}</span>
              </p>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-left">
              <p className="text-[10px] font-bold text-emerald-900 uppercase leading-relaxed">
                {regularizeFeedback.message}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRegularizeFeedback(null)}
                className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl uppercase text-[10px] tracking-wider transition-all cursor-pointer"
              >
                Permanecer en Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  const empId = regularizeFeedback.employeeId;
                  setRegularizeFeedback(null);
                  if (empId) {
                    setSelectedReportEmployeeId(empId);
                    setActiveTab('reports');
                  }
                }}
                className="flex-1 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl uppercase text-[10px] tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>📊</span> Ver Reporte Individual
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmAction && (
        <ConfirmationModal
          isOpen={confirmAction.isOpen}
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          cancelLabel={confirmAction.cancelLabel}
          type={confirmAction.type}
          onConfirm={() => {
            const action = confirmAction.onConfirm;
            setConfirmAction(null);
            if (action) action();
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
