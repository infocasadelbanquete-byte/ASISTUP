
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Employee, AttendanceRecord, GlobalSettings } from '../types.ts';
import Clock from '../components/Clock.tsx';
import Modal from '../components/Modal.tsx';
import RetroactiveAttendanceModal, { RetroactiveMissingSlot } from '../components/RetroactiveAttendanceModal.tsx';
import MandatoryUpdateModal from '../components/MandatoryUpdateModal.tsx';

const APP_ICON_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%233b82f6;'/%3E%3Cstop offset='100%25' style='stop-color:%231e3a8a;'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='none' stroke='url(%23g)' stroke-width='6' stroke-dasharray='15 5'/%3E%3Ccircle cx='50' cy='50' r='32' fill='none' stroke='url(%23g)' stroke-width='5' stroke-dasharray='10 4' opacity='0.7'/%3E%3Ccircle cx='50' cy='50' r='18' fill='none' stroke='url(%23g)' stroke-width='4' opacity='0.4'/%3E%3Ccircle cx='50' cy='50' r='6' fill='%233b82f6'/%3E%3C/svg%3E";

interface AttendanceSystemProps {
  employees: Employee[];
  attendance: AttendanceRecord[];
  onRegister: (record: AttendanceRecord) => void;
  onBack: () => void;
  onUpdateEmployees: (employees: Employee[]) => void;
  settings: GlobalSettings;
  isOnline?: boolean;
  pendingSyncCount?: number;
  onSyncNow?: () => Promise<void>;
  isSyncing?: boolean;
}

const AttendanceSystem: React.FC<AttendanceSystemProps> = ({
  employees,
  attendance,
  onRegister,
  onBack,
  onUpdateEmployees,
  settings,
  isOnline = true,
  pendingSyncCount = 0,
  onSyncNow,
  isSyncing = false
}) => {
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<'idle' | 'confirm' | 'forgotten_form' | 'success' | 'error' | 'change_pin' | 'regularize_form'>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);
  const [newPin, setNewPin] = useState('');
  const [forgotCi, setForgotCi] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isBirthdaySuccess, setIsBirthdaySuccess] = useState(false);
  const [isRegularizationNoticeModalOpen, setIsRegularizationNoticeModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info'}>({
    isOpen: false, title: '', message: '', type: 'success'
  });

  // Estado de versión y control de actualización obligatoria de terminal
  const [deviceVersion, setDeviceVersion] = useState<string>(() => {
    return localStorage.getItem('asistup_device_version') || 'v3.2.0';
  });

  const isUpdateRequired = useMemo(() => {
    if (!settings.systemUpdate || !settings.systemUpdate.version) return false;
    return deviceVersion !== settings.systemUpdate.version;
  }, [settings.systemUpdate, deviceVersion]);

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [hasDismissedOptionalUpdate, setHasDismissedOptionalUpdate] = useState(false);

  // Al abrir el terminal, persuadir y exigir la actualización obligatoria antes de permitir marcaciones
  useEffect(() => {
    if (isUpdateRequired && (!hasDismissedOptionalUpdate || settings.systemUpdate?.isMandatory)) {
      setIsUpdateModalOpen(true);
    }
  }, [isUpdateRequired, hasDismissedOptionalUpdate, settings.systemUpdate]);

  // Comprobar Service Worker al montar y cada vez que el terminal se enfoca
  useEffect(() => {
    const checkSW = () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg) reg.update().catch(() => {});
        });
      }
    };
    checkSW();
    document.addEventListener('visibilitychange', checkSW);
    return () => document.removeEventListener('visibilitychange', checkSW);
  }, []);

  const handleCheckForUpdates = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      } catch (e) {}
    }
    if (isUpdateRequired) {
      setIsUpdateModalOpen(true);
    } else {
      setFeedback({
        isOpen: true,
        title: "Terminal Actualizada",
        message: `Este dispositivo se encuentra actualizado con la versión oficial más reciente (${deviceVersion}). Todos los parches legales ecuatorianos y de marcaciones están activos.`,
        type: "success"
      });
    }
  };

  // Estados para marcaciones pendientes retroactivas
  const [pendingMissingSlots, setPendingMissingSlots] = useState<RetroactiveMissingSlot[]>([]);
  const [isRetroactiveModalOpen, setIsRetroactiveModalOpen] = useState(false);

  const [regularizeData, setRegularizeData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    type: 'in' as 'in' | 'out',
    justification: 'SIN ACCESO AL PANEL',
    otherDetails: ''
  });

  const today = useMemo(() => new Date(), []);
  const todayDateStr = today.toISOString().split('T')[0];
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  const monthBirthdays = useMemo(() => {
    return employees.filter(e => {
      if (!e.birthDate || e.status !== 'active') return false;
      return new Date(e.birthDate).getMonth() === currentMonth;
    }).sort((a, b) => {
      const dayA = new Date(a.birthDate).getDate();
      const dayB = new Date(b.birthDate).getDate();
      return dayA - dayB;
    });
  }, [employees, currentMonth]);

  const empTodayRecords = useMemo(() => {
    if (!currentEmp) return [];
    return attendance.filter(a => a.employeeId === currentEmp.id && a.timestamp.startsWith(todayDateStr));
  }, [attendance, currentEmp, todayDateStr]);

  const halfDayDoneThisWeek = useMemo(() => {
    if (!currentEmp) return false;
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    return attendance.some(a => {
      const aDate = new Date(a.timestamp);
      return a.employeeId === currentEmp.id && a.type === 'half_day' && aDate >= startOfWeek;
    });
  }, [attendance, currentEmp]);

  const insCount = empTodayRecords.filter(r => r.type === 'in').length;
  const outsCount = empTodayRecords.filter(r => r.type === 'out').length;
  const halfDayDoneToday = empTodayRecords.some(r => r.type === 'half_day');

  const processRegistration = useCallback((type: 'in' | 'out' | 'half_day', isLate: boolean, shiftLabel: string, justification?: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (isLate && Notification.permission === "granted") {
        new Notification("ALERTA DE ASISTENCIA", {
          body: `El colaborador ${currentEmp?.name} ${currentEmp?.surname} ha marcado con más de 15 minutos de retraso.`,
          icon: APP_ICON_SVG
        });
      }

      const record: AttendanceRecord = {
        id: Math.random().toString(36).substr(2, 9),
        employeeId: currentEmp!.id,
        timestamp: new Date().toISOString(),
        type,
        status: 'confirmed',
        isLate,
        justification
      };

      // Registrar inmediatamente para persistencia offline. No esperamos respuesta del servidor.
      onRegister(record);

      let msg = `ÉXITO AL REALIZAR EL MARCAJE: ${shiftLabel}`;
      const bDate = currentEmp?.birthDate ? new Date(currentEmp.birthDate) : null;
      const isTodayBirthday = bDate && (bDate.getMonth() === currentMonth && bDate.getDate() + 1 === currentDay);

      if (isTodayBirthday) {
         msg = `¡FELIZ CUMPLEAÑOS! 🎂🎈 | ${msg}`;
         setIsBirthdaySuccess(true);
      } else {
         setIsBirthdaySuccess(false);
      }

      setSuccessMsg(msg);
      setStatus('success');
      setPin('');

      // Liberar estado de procesamiento después de la marcación exitosa en la UI
      setTimeout(() => {
        setStatus('idle');
        setCurrentEmp(null);
        setIsProcessing(false);
        setIsBirthdaySuccess(false);
      }, isTodayBirthday ? 5000 : 2500);

    } catch (err) {
      console.error("Error al procesar marcación:", err);
      setIsProcessing(false);
      setFeedback({ isOpen: true, title: "Fallo Crítico", message: "No se pudo registrar la asistencia. Intente nuevamente.", type: "error" });
    }
  }, [currentEmp, isProcessing, onRegister, currentMonth, currentDay]);

  const handleMark = useCallback((type: 'in' | 'out' | 'half_day', shiftLabel: string) => {
    if (isUpdateRequired && settings.systemUpdate?.isMandatory) {
      setIsUpdateModalOpen(true);
      return;
    }
    if (!currentEmp || isProcessing) return;

    const now = new Date();
    const day = now.getDay();
    let isCriticalLate = false;

    if (type !== 'half_day') {
      if (day >= 1 && day <= 5) {
        const [h1, m1] = settings.schedule.monFri.in1.split(':').map(Number);
        const schedIn1 = new Date(now); schedIn1.setHours(h1, m1, 0, 0);
        const [h2, m2] = settings.schedule.monFri.in2.split(':').map(Number);
        const schedIn2 = new Date(now); schedIn2.setHours(h2, m2, 0, 0);

        if (type === 'in') {
          const targetSched = (now > schedIn1 && now < schedIn2) ? schedIn2 : schedIn1;
          const diffMins = (now.getTime() - targetSched.getTime()) / (1000 * 60);
          if (diffMins > 15) isCriticalLate = true;
        }
      } else if (day === 6) {
        const [hs, ms] = settings.schedule.sat.in.split(':').map(Number);
        const schedSatIn = new Date(now); schedSatIn.setHours(hs, ms, 0, 0);

        if (type === 'in') {
          const diffMins = (now.getTime() - schedSatIn.getTime()) / (1000 * 60);
          if (diffMins > 15) isCriticalLate = true;
        }
      }
    }

    processRegistration(type, isCriticalLate, shiftLabel);
  }, [currentEmp, isProcessing, settings, processRegistration, isUpdateRequired]);

  const handleRegularize = () => {
    if (!currentEmp || isProcessing) return;
    setIsProcessing(true);

    try {
      const fullTimestamp = `${regularizeData.date}T${regularizeData.time}:00.000Z`;
      const finalJustification = regularizeData.justification === 'OTRO (DETALLAR)'
        ? `OTRO: ${regularizeData.otherDetails.toUpperCase()}`
        : regularizeData.justification;

      const record: AttendanceRecord = {
        id: Math.random().toString(36).substr(2, 9),
        employeeId: currentEmp.id,
        timestamp: fullTimestamp,
        type: regularizeData.type,
        status: 'pending_approval',
        justification: finalJustification,
        isForgotten: true
      };

      onRegister(record);
      const typeLabel = regularizeData.type === 'in' ? 'ENTRADA' : 'SALIDA';
      setSuccessMsg(`ÉXITO AL REALIZAR EL MARCAJE: ${typeLabel} (REGULARIZACIÓN)`);
      setStatus('success');
      setPin('');

      setTimeout(() => {
        setStatus('idle');
        setCurrentEmp(null);
        setIsProcessing(false);
      }, 3000);
    } catch (e) {
      setIsProcessing(false);
    }
  };

  const handlePinChange = () => {
    if (newPin.length !== 6 || newPin === currentEmp?.pin) {
      setFeedback({ isOpen: true, title: "Error de PIN", message: "Ingrese un PIN nuevo de 6 dígitos diferente al actual.", type: "error" });
      return;
    }
    const updated = employees.map(e => e.id === currentEmp?.id ? { ...e, pin: newPin, pinChanged: true, pinNeedsReset: false, pinResetRequested: false } : e);
    onUpdateEmployees(updated);
    setFeedback({ isOpen: true, title: "PIN Actualizado", message: "Su clave de acceso ha sido cambiada. Ahora puede marcar su asistencia.", type: "success" });
    setStatus('confirm');
    setNewPin('');
  };

  const handleRequestPinReset = () => {
    const rawCi = forgotCi.trim();
    const cleanCi = rawCi.replace(/\D/g, '');
    const emp = employees.find(e => {
      if (e.status !== 'active') return false;
      const empCiClean = (e.identification || '').trim().replace(/\D/g, '');
      return e.identification === rawCi || (cleanCi && empCiClean === cleanCi);
    });
    if (emp) {
      const updated = employees.map(e => e.id === emp.id ? { ...e, pinResetRequested: true } : e);
      onUpdateEmployees(updated);
      if (Notification.permission === "granted") {
        new Notification("SOLICITUD DE ACCESO", { body: `El colaborador ${emp.name} ${emp.surname} solicita resetear su PIN de asistencia.`, icon: APP_ICON_SVG });
      }
      setFeedback({ isOpen: true, title: "Solicitud Recibida", message: "Su solicitud ha sido enviada al administrador. RRHH autorizará su nuevo acceso a la brevedad.", type: "info" });
      setStatus('idle');
      setForgotCi('');
    } else {
      setFeedback({ isOpen: true, title: "Error", message: "Identificación no encontrada en el sistema.", type: "error" });
    }
  };

  const checkRetroactiveMarkingsForEmp = useCallback((emp: Employee) => {
    const missing: RetroactiveMissingSlot[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();
    const empStart = emp.startDate ? new Date(emp.startDate + 'T00:00:00') : new Date(currentYear, currentMonth, 1);

    // Revisar todos los días del mes en curso hasta ayer
    for (let day = 1; day < currentDay; day++) {
      const targetDate = new Date(currentYear, currentMonth, day, 12, 0, 0);
      if (targetDate < empStart) continue;

      const dateStr = targetDate.toISOString().split('T')[0];
      const dayOfWeek = targetDate.getDay();
      if (dayOfWeek === 0) continue; // Domingo no laborable
      if ((settings.holidays || []).includes(dateStr)) continue;

      // 1. Vacaciones aprobadas
      const isApprovedVacation = (emp.vacations || []).some(
        v => dateStr >= v.startDate && dateStr <= v.endDate
      );
      if (isApprovedVacation) continue;

      // 2. Días u horas de permiso o libres en la bitácora administrativa
      const dayObs = (emp.observations || []).filter(o => o.date && o.date.startsWith(dateStr));
      const isFullDayPermissionOrFree = dayObs.some(o => {
        const pType = (o.permissionType || '').toUpperCase();
        const r = (o.reason || '').toUpperCase();
        return pType === 'DIA LABORAL ENTERO' || pType === 'ENTERO' ||
          (pType === '' && (r.includes('PERMISO MATERNAL') || r.includes('PERMISO MEDICO') || r.includes('PERMISO PERSONAL') || r.includes('FALTA JUSTIFICADA'))) ||
          (typeof o.permissionHours === 'number' && o.permissionHours >= 8);
      });
      if (isFullDayPermissionOrFree) continue;

      const hasHalfDayPermission = dayObs.some(o => {
        const pType = (o.permissionType || '').toUpperCase();
        return pType.includes('MEDIA') || pType === 'MEDIA_AM' || pType === 'MEDIA_PM' || (typeof o.permissionHours === 'number' && o.permissionHours >= 4);
      });

      const dayRecords = attendance.filter(a => a.employeeId === emp.id && a.timestamp.startsWith(dateStr));
      const hasHalfDay = dayRecords.some(a => a.type === 'half_day') || hasHalfDayPermission;
      if (hasHalfDay) continue;

      const ins = dayRecords.filter(a => a.type === 'in');
      const outs = dayRecords.filter(a => a.type === 'out');

      const dayName = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'short' }).format(targetDate);
      const capDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        if (ins.length < 1) {
          missing.push({
            id: `missing-${dateStr}-in1`,
            date: dateStr,
            dateFormatted: capDay,
            shiftLabel: 'Jornada Mañana - Ingreso',
            type: 'in',
            suggestedTime: settings.schedule?.monFri?.in1 || '08:30',
            selectedTime: settings.schedule?.monFri?.in1 || '08:30',
            justification: 'OLVIDO INVOLUNTARIO'
          });
        }
        if (outs.length < 1) {
          missing.push({
            id: `missing-${dateStr}-out1`,
            date: dateStr,
            dateFormatted: capDay,
            shiftLabel: 'Jornada Mañana - Salida',
            type: 'out',
            suggestedTime: settings.schedule?.monFri?.out1 || '13:00',
            selectedTime: settings.schedule?.monFri?.out1 || '13:00',
            justification: 'OLVIDO INVOLUNTARIO'
          });
        }
        if (ins.length < 2) {
          missing.push({
            id: `missing-${dateStr}-in2`,
            date: dateStr,
            dateFormatted: capDay,
            shiftLabel: 'Jornada Tarde - Ingreso',
            type: 'in',
            suggestedTime: settings.schedule?.monFri?.in2 || '15:00',
            selectedTime: settings.schedule?.monFri?.in2 || '15:00',
            justification: 'OLVIDO INVOLUNTARIO'
          });
        }
        if (outs.length < 2) {
          missing.push({
            id: `missing-${dateStr}-out2`,
            date: dateStr,
            dateFormatted: capDay,
            shiftLabel: 'Jornada Tarde - Salida',
            type: 'out',
            suggestedTime: settings.schedule?.monFri?.out2 || '18:00',
            selectedTime: settings.schedule?.monFri?.out2 || '18:00',
            justification: 'OLVIDO INVOLUNTARIO'
          });
        }
      } else if (dayOfWeek === 6) {
        if (ins.length < 1) {
          missing.push({
            id: `missing-${dateStr}-sat-in`,
            date: dateStr,
            dateFormatted: capDay,
            shiftLabel: 'Sábado - Ingreso',
            type: 'in',
            suggestedTime: settings.schedule?.sat?.in || '08:30',
            selectedTime: settings.schedule?.sat?.in || '08:30',
            justification: 'OLVIDO INVOLUNTARIO'
          });
        }
        if (outs.length < 1) {
          missing.push({
            id: `missing-${dateStr}-sat-out`,
            date: dateStr,
            dateFormatted: capDay,
            shiftLabel: 'Sábado - Salida',
            type: 'out',
            suggestedTime: settings.schedule?.sat?.out || '13:00',
            selectedTime: settings.schedule?.sat?.out || '13:00',
            justification: 'OLVIDO INVOLUNTARIO'
          });
        }
      }
    }

    setPendingMissingSlots(missing);
    if (missing.length > 0) {
      setIsRetroactiveModalOpen(true);
    }
  }, [attendance, settings]);

  const handleBatchRegisterRetroactive = (newRecords: AttendanceRecord[]) => {
    newRecords.forEach(r => onRegister(r));
    setPendingMissingSlots([]);
    setIsRetroactiveModalOpen(false);

    if (currentEmp) {
      const newObs = {
        date: new Date().toISOString(),
        text: `SOLICITUD DE REGULARIZACIÓN DE MARCAJES: ${newRecords.length} marcaciones pendientes enviadas a Administración para registro y validación.`
      };
      const updated = employees.map(e => e.id === currentEmp.id ? {
        ...e,
        observations: [newObs, ...(e.observations || [])]
      } : e);
      onUpdateEmployees(updated);

      if (Notification.permission === "granted") {
        new Notification("SOLICITUD DE REGULARIZACIÓN DE MARCAJES", {
          body: `El colaborador ${currentEmp.name} ${currentEmp.surname} ha solicitado regularizar ${newRecords.length} marcaciones pendientes.`,
          icon: APP_ICON_SVG
        });
      }
    }

    setFeedback({
      isOpen: true,
      title: "Solicitud de Regularización Enviada",
      message: `Se ha remitido su solicitud de regularización de ${newRecords.length} marcaciones pendientes al Administrador. Una vez que la administración apruebe y registre oficialmente la información, recibirá una confirmación en pantalla al ingresar.`,
      type: "info"
    });
  };

  const handleDismissRegularizationNotice = () => {
    if (!currentEmp) return;
    const updated = employees.map(e => e.id === currentEmp.id ? {
      ...e,
      regularizationApprovedNotice: e.regularizationApprovedNotice ? { ...e.regularizationApprovedNotice, seen: true } : undefined
    } : e);
    onUpdateEmployees(updated);
    setIsRegularizationNoticeModalOpen(false);
    checkRetroactiveMarkingsForEmp(currentEmp);
    setStatus('confirm');
  };

  const handleRequestAdminReviewRetroactive = (reason: string, details: string, slots: RetroactiveMissingSlot[]) => {
    if (!currentEmp) return;

    const reviewRecord: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: currentEmp.id,
      timestamp: new Date().toISOString(),
      type: 'in',
      status: 'pending_approval',
      isForgotten: true,
      justification: `[AUDITORÍA RETROACTIVA]: ${reason} - ${details} (${slots.length} marcaciones)`
    };
    onRegister(reviewRecord);

    const newObs = {
      date: new Date().toISOString(),
      text: `SOLICITUD AUDITORÍA MARCACIONES RETROACTIVAS: ${reason} - ${details}`
    };
    const updated = employees.map(e => e.id === currentEmp.id ? {
      ...e,
      observations: [newObs, ...(e.observations || [])]
    } : e);
    onUpdateEmployees(updated);

    if (Notification.permission === "granted") {
      new Notification("SOLICITUD DE AUDITORÍA RETROACTIVA", {
        body: `El colaborador ${currentEmp.name} ${currentEmp.surname} solicita revisión de ${slots.length} marcaciones retroactivas.`,
        icon: APP_ICON_SVG
      });
    }

    setPendingMissingSlots([]);
    setIsRetroactiveModalOpen(false);
    setFeedback({
      isOpen: true,
      title: "Solicitud Enviada a Administración",
      message: "Tu requerimiento ha sido remitido a Gerencia y RRHH para auditoría y resolución formal.",
      type: "info"
    });
  };

  useEffect(() => {
    if (pin.length === 6 && status === 'idle' && !isProcessing) {
      if (isUpdateRequired && settings.systemUpdate?.isMandatory) {
        setIsUpdateModalOpen(true);
        setPin('');
        return;
      }
      const emp = employees.find(e => e.pin === pin && e.status === 'active');
      if (emp) {
        setCurrentEmp(emp);
        if (emp.regularizationApprovedNotice && !emp.regularizationApprovedNotice.seen) {
          setIsRegularizationNoticeModalOpen(true);
        } else if (!emp.pinChanged || emp.pinNeedsReset) {
          setStatus('change_pin');
        } else {
          checkRetroactiveMarkingsForEmp(emp);
          setStatus('confirm');
        }
      } else {
        setStatus('error');
        setTimeout(() => { setStatus('idle'); setPin(''); }, 1500);
      }
    }
  }, [pin, employees, status, isProcessing, checkRetroactiveMarkingsForEmp, isUpdateRequired, settings.systemUpdate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
      if (isProcessing) return;

      if (status === 'idle') {
        if (e.key >= '0' && e.key <= '9') {
          if (isUpdateRequired && settings.systemUpdate?.isMandatory) {
            setIsUpdateModalOpen(true);
            return;
          }
          if (pin.length < 6) setPin(p => p + e.key);
        }
        if (e.key === 'Backspace') setPin(p => p.slice(0, -1));
      } else if (status === 'change_pin') {
        if (e.key >= '0' && e.key <= '9' && newPin.length < 6) setNewPin(p => p + e.key);
        if (e.key === 'Backspace') setNewPin(p => p.slice(0, -1));
        if (e.key === 'Enter') handlePinChange();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [pin, newPin, status, isProcessing, isUpdateRequired, settings.systemUpdate]);

  return (
    <div className="min-h-screen gradient-blue flex flex-col items-center justify-center p-4">
      {status === 'success' && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center fade-in p-6">
           <div className={`p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center text-center animate-in zoom-in max-w-sm ${isBirthdaySuccess ? 'bg-gradient-to-br from-yellow-100 to-white' : 'bg-white'}`}>
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-4 shadow-lg animate-bounce ${isBirthdaySuccess ? 'bg-yellow-400 text-white' : 'bg-emerald-500 text-white'}`}>
                {isBirthdaySuccess ? '🎂' : '✓'}
              </div>
              <h2 className={`font-[950] text-xl uppercase tracking-tighter leading-none ${isBirthdaySuccess ? 'text-yellow-600 animate-pulse' : 'text-slate-900'}`}>{successMsg}</h2>
              {isBirthdaySuccess && <p className="text-xl mt-2 animate-bounce">🎈🎊🎁</p>}
              <p className="text-slate-500 font-bold text-[9px] uppercase tracking-widest mt-2">
                {!isOnline
                  ? '✓ Guardado en este terminal (Modo Offline) • Se sincronizará automáticamente al conectar'
                  : '✓ Registrado y sincronizado con el servidor central'}
              </p>
           </div>
        </div>
      )}

      <div className={`w-full max-w-lg bg-white/95 backdrop-blur-3xl rounded-3xl md:rounded-[3.5rem] shadow-2xl p-6 md:p-12 flex flex-col items-center relative overflow-hidden ${status === 'success' ? 'opacity-0' : 'fade-in'}`}>
        {/* Barra de Estado de Conexión y Sincronización Offline */}
        <div className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-2xl mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${
              !isOnline
                ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse'
                : (pendingSyncCount > 0
                    ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse'
                    : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]')
            }`}></div>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">
              {!isOnline
                ? `Modo Desconectado (Offline)${pendingSyncCount > 0 ? ` • ${pendingSyncCount} pendientes` : ''}`
                : (pendingSyncCount > 0
                    ? `${pendingSyncCount} registro(s) por sincronizar`
                    : 'Terminal en Línea • Sincronizado')}
            </span>
          </div>

          {isOnline && pendingSyncCount > 0 && onSyncNow && (
            <button
              type="button"
              onClick={onSyncNow}
              disabled={isSyncing}
              className="text-[8px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-full shadow-sm transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <span className={isSyncing ? 'animate-spin' : ''}>🔄</span>
              {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          )}
        </div>

        <div className="mb-4 md:mb-6 transform scale-[0.6] sm:scale-[0.8]"><Clock /></div>

        {status === 'idle' && (
          <div className="w-full text-center">
            {monthBirthdays.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-50/50 border border-yellow-100 rounded-2xl animate-in slide-in-from-top-4 duration-1000">
                <p className="text-[8px] font-black text-yellow-600 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                  <span>🎂</span> Celebramos a nuestros cumpleañeros <span>🎈</span>
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {monthBirthdays.slice(0, 3).map(e => (
                    <div key={e.id} className="bg-white px-3 py-1 rounded-full shadow-sm border border-yellow-100 flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-700 uppercase">{e.name} {e.surname}</span>
                      <span className="text-[7px] font-bold text-yellow-600 bg-yellow-50 px-1.5 rounded-full">{new Date(e.birthDate).getDate() + 1}/{currentMonth + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {isUpdateRequired && settings.systemUpdate && (
              <div
                onClick={() => setIsUpdateModalOpen(true)}
                className="mb-6 p-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl shadow-lg border border-amber-300/40 flex items-center justify-between gap-3 text-left cursor-pointer transition-all animate-pulse active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="text-[10px] font-[950] uppercase tracking-tight">
                      Actualización Obligatoria Requerida ({settings.systemUpdate.version})
                    </p>
                    <p className="text-[8px] font-bold text-amber-100 uppercase">
                      Imprescindible antes de marcar • Toca aquí para actualizar
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1.5 bg-white text-amber-700 font-black text-[9px] uppercase tracking-wider rounded-xl shadow-md shrink-0">
                  Actualizar
                </span>
              </div>
            )}

            <h2 className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 md:mb-6">Ingresar PIN de 6 dígitos</h2>
            <div className="flex gap-1.5 md:gap-2 justify-center mb-8 md:mb-10">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`w-8 h-12 md:w-10 md:h-16 border-b-4 flex items-center justify-center text-2xl md:text-4xl font-black transition-all ${pin.length > i ? 'border-blue-600 text-slate-900' : 'border-slate-100'}`}>
                  {pin[i] ? '•' : ''}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-3 max-w-[280px] md:max-w-[340px] mx-auto mb-8 md:mb-10">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map(btn => (
                <button
                  key={btn}
                  type="button"
                  onClick={() => {
                    if (isUpdateRequired && settings.systemUpdate?.isMandatory) {
                      setIsUpdateModalOpen(true);
                      return;
                    }
                    if (btn === 'C') setPin('');
                    else if (btn === '←') setPin(p => p.slice(0, -1));
                    else if (pin.length < 6) setPin(p => p + btn);
                  }}
                  className="h-14 md:h-18 bg-white hover:bg-blue-700 hover:text-white rounded-xl md:rounded-2xl text-xl md:text-2xl font-black border border-slate-200 active:scale-90 transition-all shadow-sm flex items-center justify-center cursor-pointer"
                >
                  {btn}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (isUpdateRequired && settings.systemUpdate?.isMandatory) {
                  setIsUpdateModalOpen(true);
                  return;
                }
                setStatus('forgotten_form');
              }}
              className="w-full py-3 md:py-4 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50 transition-all active:scale-95 cursor-pointer"
            >
              ¿Olvidó su PIN? Solicitar Reseteo
            </button>
          </div>
        )}

        {status === 'forgotten_form' && (
           <div className="text-center w-full space-y-6 animate-in zoom-in">
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Solicitud de Reseteo de Acceso</h2>
              <div className="space-y-4">
                 <input
                   type="text"
                   value={forgotCi}
                   onChange={e => setForgotCi(e.target.value.replace(/\D/g,''))}
                   placeholder="INGRESE SU N° IDENTIFICACIÓN"
                   className="w-full p-4 border-2 rounded-2xl text-center text-lg font-black focus:border-blue-600 outline-none uppercase"
                   autoFocus
                 />
                 <div className="flex gap-3">
                    <button type="button" onClick={() => setStatus('idle')} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-xl uppercase text-[9px] cursor-pointer">Cancelar</button>
                    <button type="button" onClick={handleRequestPinReset} className="flex-1 py-4 bg-blue-700 text-white font-black rounded-xl uppercase text-[9px] shadow-xl cursor-pointer">Solicitar</button>
                 </div>
              </div>
           </div>
        )}

        {status === 'change_pin' && (
          <div className="text-center w-full space-y-6 animate-in zoom-in">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full mx-auto flex items-center justify-center text-4xl mb-4">🔐</div>
            <h2 className="text-[11px] font-[950] text-slate-900 uppercase tracking-[0.2em]">Actualización Obligatoria de PIN</h2>
            <p className="text-[9px] text-slate-400 font-bold uppercase leading-relaxed">Por seguridad, debe establecer una clave personal de 6 dígitos para sus próximos marcajes.</p>

            <div className="flex gap-2 justify-center mb-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`w-8 h-12 border-b-4 flex items-center justify-center text-2xl font-black transition-all ${newPin.length > i ? 'border-blue-600 text-slate-900' : 'border-slate-100'}`}>
                  {newPin[i] ? '•' : ''}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map(btn => (
                <button key={btn} type="button" onClick={() => { if (btn === 'C') setNewPin(''); else if (btn === '←') setNewPin(p => p.slice(0, -1)); else if (newPin.length < 6) setNewPin(p => p + btn); }} className="h-14 bg-white hover:bg-blue-700 hover:text-white rounded-xl text-xl font-black border border-slate-200 active:scale-90 transition-all shadow-sm flex items-center justify-center cursor-pointer">{btn}</button>
              ))}
            </div>

            <button type="button" onClick={handlePinChange} disabled={newPin.length !== 6} className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 disabled:opacity-50 cursor-pointer">Actualizar y Continuar</button>
          </div>
        )}

        {status === 'regularize_form' && (
           <div className="text-center w-full space-y-6 animate-in zoom-in">
              <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl mb-4">
                  <p className="text-[11px] font-black text-blue-700 uppercase tracking-widest leading-relaxed italic">
                    "Tu integridad es el valor más grande de nuestra institución. Si por motivos de acceso no pudiste marcar, regulariza tu jornada con total honestidad. La transparencia nos fortalece."
                  </p>
              </div>
              <div className="space-y-4 text-left">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha Olvidada</label>
                    <input type="date" value={regularizeData.date} onChange={e => setRegularizeData({...regularizeData, date: e.target.value})} className="w-full p-4 border-2 rounded-xl text-xs font-black" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hora Aproximada</label>
                       <input type="time" value={regularizeData.time} onChange={e => setRegularizeData({...regularizeData, time: e.target.value})} className="w-full p-4 border-2 rounded-xl text-xs font-black" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipo</label>
                       <select value={regularizeData.type} onChange={e => setRegularizeData({...regularizeData, type: e.target.value as any})} className="w-full p-4 border-2 rounded-xl text-[10px] font-black uppercase">
                          <option value="in">Ingreso</option>
                          <option value="out">Salida</option>
                       </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Motivo de Justificación</label>
                    <select
                      value={regularizeData.justification}
                      onChange={e => setRegularizeData({...regularizeData, justification: e.target.value})}
                      className="w-full p-4 border-2 rounded-xl text-[10px] font-black uppercase focus:border-blue-500 outline-none"
                    >
                      <option value="SIN ACCESO AL PANEL">SIN ACCESO AL PANEL</option>
                      <option value="OLVIDO">OLVIDO</option>
                      <option value="OTRO (DETALLAR)">OTRO (DETALLAR)</option>
                    </select>
                  </div>
                  {regularizeData.justification === 'OTRO (DETALLAR)' && (
                    <div className="space-y-1 animate-in slide-in-from-top-2">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Detalle del Motivo</label>
                       <input
                         type="text"
                         value={regularizeData.otherDetails}
                         onChange={e => setRegularizeData({...regularizeData, otherDetails: e.target.value})}
                         className="w-full p-4 border-2 rounded-xl text-[10px] font-black uppercase focus:border-blue-500 outline-none"
                         placeholder="DESCRIBA AQUÍ..."
                       />
                    </div>
                  )}
              </div>
              <div className="flex gap-3">
                 <button type="button" onClick={() => setStatus('confirm')} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-xl uppercase text-[9px] cursor-pointer">Volver</button>
                 <button type="button" onClick={handleRegularize} className="flex-1 py-4 bg-blue-700 text-white font-black rounded-xl uppercase text-[9px] shadow-xl active:scale-95 cursor-pointer">Solicitar Autorización</button>
              </div>
           </div>
        )}

        {status === 'confirm' && currentEmp && (
          <div className="text-center w-full animate-in zoom-in">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-100 rounded-2xl md:rounded-[2rem] mx-auto flex items-center justify-center text-3xl md:text-4xl font-black text-blue-700 uppercase border-4 border-white shadow-xl mb-3 md:mb-4 overflow-hidden">
                 {currentEmp.photo ? <img src={currentEmp.photo} className="w-full h-full object-cover" /> : <span>{currentEmp.name[0]}</span>}
            </div>
            <h2 className="text-xl md:text-2xl font-[950] text-slate-900 mb-1 uppercase tracking-tighter leading-none">{currentEmp.name} {currentEmp.surname}</h2>
            <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4 md:mb-6">{currentEmp.role}</p>

            {pendingMissingSlots.length > 0 && (
              <div className="mb-6 p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 rounded-3xl shadow-md text-left animate-in slide-in-from-top-2 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-3xl animate-bounce">⚠️</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-amber-500 text-white font-black text-[8px] uppercase rounded-full">
                        Alerta de Control Institucional
                      </span>
                      <span className="text-[9px] font-black text-amber-900 uppercase">
                        {pendingMissingSlots.length} Marcaciones Pendientes en el Mes
                      </span>
                    </div>
                    <p className="text-[10px] font-[950] text-slate-900 uppercase mt-1 leading-snug">
                      Debes ponerte al día en tus marcaciones retroactivas para continuar con el marcado habitual.
                    </p>
                    <p className="text-[8px] font-bold text-amber-800 uppercase mt-0.5">
                      Elige regularizar tus horas no marcadas u opta por solicitar revisión/auditoría formal al Administrador del sistema.
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-amber-200/80 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRetroactiveModalOpen(true)}
                    className="flex-1 py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>✍️</span> Ponerme al Día / Solicitar Revisión al Admin
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {pendingMissingSlots.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-center">
                  <p className="text-[9px] font-black text-red-700 uppercase tracking-wider">
                    🔒 Marcado habitual bloqueado: Regularice sus marcaciones pendientes del mes para habilitar los botones.
                  </p>
                </div>
              )}

              <section className="space-y-3">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] text-left border-l-2 border-emerald-500 pl-2">Primera Jornada (Mañana)</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" disabled={pendingMissingSlots.length > 0 || insCount >= 1 || halfDayDoneToday || isProcessing} onClick={() => handleMark('in', 'ENTRADA JORNADA MAÑANA')} className={`py-4 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all border-b-4 cursor-pointer ${pendingMissingSlots.length > 0 || insCount >= 1 || halfDayDoneToday || isProcessing ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-emerald-600 text-white border-emerald-800'}`}>Ingreso</button>
                  <button type="button" disabled={pendingMissingSlots.length > 0 || outsCount >= 1 || halfDayDoneToday || isProcessing} onClick={() => handleMark('out', 'SALIDA JORNADA MAÑANA')} className={`py-4 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all border-b-4 cursor-pointer ${pendingMissingSlots.length > 0 || outsCount >= 1 || halfDayDoneToday || isProcessing ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-orange-600 text-white border-orange-800'}`}>Salida</button>
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] text-left border-l-2 border-cyan-500 pl-2">Segunda Jornada (Tarde)</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" disabled={pendingMissingSlots.length > 0 || insCount >= 2 || halfDayDoneToday || isProcessing} onClick={() => handleMark('in', 'ENTRADA JORNADA TARDE')} className={`py-4 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all border-b-4 cursor-pointer ${pendingMissingSlots.length > 0 || insCount >= 2 || halfDayDoneToday || isProcessing ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-cyan-600 text-white border-cyan-800'}`}>Ingreso</button>
                  <button type="button" disabled={pendingMissingSlots.length > 0 || outsCount >= 2 || halfDayDoneToday || isProcessing} onClick={() => handleMark('out', 'SALIDA JORNADA TARDE')} className={`py-4 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all border-b-4 cursor-pointer ${pendingMissingSlots.length > 0 || outsCount >= 2 || halfDayDoneToday || isProcessing ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-pink-600 text-white border-pink-800'}`}>Salida</button>
                </div>
              </section>

              <div className="grid grid-cols-1 gap-3">
                  <button type="button" disabled={pendingMissingSlots.length > 0 || halfDayDoneThisWeek || isProcessing} onClick={() => handleMark('half_day', 'REGISTRO MEDIA JORNADA LIBRE')} className={`w-full py-4 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all border-b-4 flex items-center justify-center gap-2 cursor-pointer ${pendingMissingSlots.length > 0 || halfDayDoneThisWeek || isProcessing ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-amber-500 text-white border-amber-700'}`}><span>📅</span> Media Jornada Libre</button>
                  <button type="button" onClick={() => setStatus('regularize_form')} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[9px] tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 cursor-pointer"><span>💡</span> Regularizar Marcación Olvidada</button>
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center text-red-600 py-6 md:py-10 animate-pulse">
            <div className="text-6xl md:text-7xl mb-4">✕</div>
            <h2 className="text-xl md:text-2xl font-[950] uppercase tracking-tighter">Denegado</h2>
            <p className="text-[9px] md:text-[10px] font-bold uppercase mt-2">PIN Incorrecto</p>
          </div>
        )}
      </div>
      <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 text-center">
        <button type="button" onClick={onBack} className="text-white/40 hover:text-white font-black text-[10px] md:text-[11px] uppercase tracking-[0.3em] transition-all active:scale-95 cursor-pointer">
          Salir del Terminal
        </button>
        <span className="text-white/20 hidden sm:inline">•</span>
        <button
          type="button"
          onClick={handleCheckForUpdates}
          className="text-blue-300/80 hover:text-blue-200 font-bold text-[9px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10"
          title="Comprobar e instalar actualizaciones disponibles"
        >
          <span>🔄</span>
          <span>Terminal {deviceVersion} {isUpdateRequired ? '• ⚠️ Actualización Requerida' : '• ✓ Al Día'}</span>
        </button>
      </div>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
          <div className="text-center space-y-4 md:space-y-6">
              <p className="text-slate-600 font-bold uppercase text-[11px] md:text-[12px] leading-relaxed">{feedback.message}</p>
              <button type="button" onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest cursor-pointer">Aceptar</button>
          </div>
      </Modal>

      {currentEmp && (
        <RetroactiveAttendanceModal
          isOpen={isRetroactiveModalOpen}
          onClose={() => setIsRetroactiveModalOpen(false)}
          employee={currentEmp}
          missingSlots={pendingMissingSlots}
          onBatchRegister={handleBatchRegisterRetroactive}
          onRequestAdminReview={handleRequestAdminReviewRetroactive}
          onProceedToToday={() => setIsRetroactiveModalOpen(false)}
        />
      )}

      {/* MODAL DE CONFIRMACIÓN DE REGULARIZACIÓN EXITOSA PARA EL COLABORADOR */}
      {currentEmp && currentEmp.regularizationApprovedNotice && (
        <Modal
          isOpen={isRegularizationNoticeModalOpen}
          onClose={handleDismissRegularizationNotice}
          title="¡REGULARIZACIÓN APROBADA CON ÉXITO!"
          type="success"
        >
          <div className="text-center p-3 sm:p-5 space-y-5 animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-4xl mx-auto shadow-inner animate-bounce">
              ✓
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-[950] text-slate-900 uppercase">
                Solicitud de Regularización Procesada
              </h3>
              <p className="text-xs text-slate-600 font-bold uppercase leading-relaxed">
                Estimado/a <span className="text-blue-900 font-black">{currentEmp.name} {currentEmp.surname}</span>, el Administrador ha aprobado su solicitud de regularización y ha procedido a registrar oficialmente sus marcaciones pendientes.
              </p>
            </div>

            <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl text-left space-y-1.5">
              <p className="text-[10px] font-black text-emerald-900 uppercase flex items-center gap-1.5">
                <span>⚖️</span> Estado: Regularización Aprobada y Asentada
              </p>
              {currentEmp.regularizationApprovedNotice.approvedAt && (
                <p className="text-[9px] font-bold text-slate-500 uppercase">
                  Fecha de Validación: {new Date(currentEmp.regularizationApprovedNotice.approvedAt).toLocaleString('es-EC')}
                </p>
              )}
              {currentEmp.regularizationApprovedNotice.count && (
                <p className="text-[9px] font-black text-emerald-700 uppercase">
                  Marcaciones Asentadas: {currentEmp.regularizationApprovedNotice.count} registros confirmados
                </p>
              )}
              <p className="text-[10px] font-bold text-emerald-800 italic bg-white/70 p-2.5 rounded-xl border border-emerald-100">
                "{currentEmp.regularizationApprovedNotice.message}"
              </p>
            </div>

            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Su historial laboral está completamente al día. Ya puede continuar con su registro de asistencia habitual.
            </p>

            <button
              type="button"
              onClick={handleDismissRegularizationNotice}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all cursor-pointer"
            >
              Aceptar y Continuar al Marcaje Habitual
            </button>
          </div>
        </Modal>
      )}

      {settings.systemUpdate && (
        <MandatoryUpdateModal
          isOpen={isUpdateModalOpen}
          updateConfig={settings.systemUpdate}
          currentVersion={deviceVersion}
          onUpdateSuccess={() => {
            if (settings.systemUpdate) {
              localStorage.setItem('asistup_device_version', settings.systemUpdate.version);
              setDeviceVersion(settings.systemUpdate.version);
            }
            setIsUpdateModalOpen(false);
          }}
          onBypass={!settings.systemUpdate.isMandatory ? () => {
            setHasDismissedOptionalUpdate(true);
            setIsUpdateModalOpen(false);
          } : undefined}
        />
      )}
    </div>
  );
};

export default AttendanceSystem;
