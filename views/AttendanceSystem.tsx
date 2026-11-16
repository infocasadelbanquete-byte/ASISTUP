
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Employee, AttendanceRecord, AttendanceShiftSlot, GlobalSettings } from '../types.ts';
import Clock from '../components/Clock.tsx';
import Modal from '../components/Modal.tsx';
import ConfirmationModal from '../components/ConfirmationModal.tsx';
import RetroactiveAttendanceModal, { RetroactiveMissingSlot } from '../components/RetroactiveAttendanceModal.tsx';
import MandatoryUpdateModal from '../components/MandatoryUpdateModal.tsx';
import {
  toLocalDateStr,
  toLocalDateTimeISO,
  getLocalDateKey,
  extractHHMM,
  getDateParts,
  isHolidayDate,
  isFullDayPermissionObs,
  isHalfDayPermissionObs,
  isAuditRequestRecord,
  getSafeSchedule,
  splitDayRecordsIntoSlots,
  safeFormatDateTime,
  getOrCreateDeviceId,
  generateUniqueRecordId,
  parseRecordEpochMs,
} from '../utils/attendanceHelpers.ts';

const APP_ICON_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%233b82f6;'/%3E%3Cstop offset='100%25' style='stop-color:%231e3a8a;'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='none' stroke='url(%23g)' stroke-width='6' stroke-dasharray='15 5'/%3E%3Ccircle cx='50' cy='50' r='32' fill='none' stroke='url(%23g)' stroke-width='5' stroke-dasharray='10 4' opacity='0.7'/%3E%3Ccircle cx='50' cy='50' r='18' fill='none' stroke='url(%23g)' stroke-width='4' opacity='0.4'/%3E%3Ccircle cx='50' cy='50' r='6' fill='%233b82f6'/%3E%3C/svg%3E";

interface AttendanceSystemProps {
  employees: Employee[];
  attendance: AttendanceRecord[];
  onRegister: (record: AttendanceRecord) => void;
  onUpdateAttendance?: (records: AttendanceRecord[]) => void;
  onDeleteAttendance?: (ids: string[]) => void;
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
  onUpdateAttendance,
  onDeleteAttendance,
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

  useEffect(() => {
    if (!currentEmp) return;
    const latest = employees.find(e => e.id === currentEmp.id);
    if (latest && latest !== currentEmp) {
      setCurrentEmp(latest);
    }
  }, [employees, currentEmp]);
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
  const [retroactiveInitialMode, setRetroactiveInitialMode] = useState<'selection' | 'regularize' | 'review'>('selection');
  const [isPersuasivePendingModalOpen, setIsPersuasivePendingModalOpen] = useState(false);

  // Modal de confirmación general
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    type?: 'warning' | 'danger' | 'info';
    onConfirm: () => void;
  } | null>(null);

  // Modal de Jornada de Corrido (1 hora libre automática)
  const [continuousModal, setContinuousModal] = useState<{
    isOpen: boolean;
    endTime: string;
    includeMorningIn: boolean;
    morningInTime: string;
  }>({
    isOpen: false,
    endTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    includeMorningIn: false,
    morningInTime: settings.schedule?.monFri?.in1 || '08:30'
  });

  // Modal para corregir una marcación errónea (fuera de horario habitual o tipo equivocado)
  const [editTodayMarkModal, setEditTodayMarkModal] = useState<{
    isOpen: boolean;
    record: AttendanceRecord | null;
    caseKey: string;
    type: 'in' | 'out';
    time: string;
    isContinuousShift: boolean;
    reason: string;
  }>({
    isOpen: false,
    record: null,
    caseKey: '',
    type: 'in',
    time: '08:30',
    isContinuousShift: false,
    reason: 'CORRECCIÓN POR ERROR FUERA DE HORARIO HABITUAL'
  });

  // Modal para solicitar corrección al Administrador cuando el colaborador ya usó su 1 rectificación del caso
  const [adminCorrectionModal, setAdminCorrectionModal] = useState<{
    isOpen: boolean;
    record: AttendanceRecord | null;
    caseKey: string;
    slotLabel: string;
    requestedType: 'in' | 'out' | 'continuous_out';
    requestedTime: string;
    reason: string;
  }>({
    isOpen: false,
    record: null,
    caseKey: '',
    slotLabel: '',
    requestedType: 'in',
    requestedTime: '08:30',
    reason: ''
  });

  const [regularizeData, setRegularizeData] = useState({
    date: toLocalDateStr(new Date()),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    type: 'in' as 'in' | 'out',
    justification: 'SIN ACCESO AL PANEL',
    otherDetails: ''
  });

  const today = useMemo(() => new Date(), []);
  const todayDateStr = toLocalDateStr(today);
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  const monthBirthdays = useMemo(() => {
    return employees.filter(e => {
      if (!e.birthDate || e.status !== 'active') return false;
      const parts = getDateParts(e.birthDate);
      return parts ? parts.month === currentMonth : false;
    }).sort((a, b) => {
      const dayA = getDateParts(a.birthDate)?.day || 0;
      const dayB = getDateParts(b.birthDate)?.day || 0;
      return dayA - dayB;
    });
  }, [employees, currentMonth]);

  const empTodayRecords = useMemo(() => {
    if (!currentEmp) return [];
    return attendance
      .filter(a => a.employeeId === currentEmp.id && getLocalDateKey(a.timestamp) === todayDateStr && a.status !== 'rejected' && !isAuditRequestRecord(a))
      .sort((a, b) => parseRecordEpochMs(a.timestamp) - parseRecordEpochMs(b.timestamp));
  }, [attendance, currentEmp, todayDateStr]);

  const empTodayConfirmedRecords = useMemo(() => {
    return empTodayRecords.filter(r => r.status === 'confirmed');
  }, [empTodayRecords]);

  const halfDayDoneToday = empTodayConfirmedRecords.some(r => r.type === 'half_day');
  const continuousDoneToday = empTodayConfirmedRecords.some(
    r => r.isContinuousShift || r.shiftSlot === 'continuous_in' || r.shiftSlot === 'continuous_out'
  );
  const todaySlots = useMemo(
    () => splitDayRecordsIntoSlots(empTodayConfirmedRecords, settings, today.getDay() === 6, continuousDoneToday),
    [empTodayConfirmedRecords, settings, today, continuousDoneToday]
  );
  const insCount = empTodayConfirmedRecords.filter(r => r.type === 'in').length;

  const resolveRecordSlotKey = useCallback((rec: AttendanceRecord): AttendanceShiftSlot => {
    if (rec.shiftSlot) return rec.shiftSlot;
    if (rec.type === 'half_day') return 'half_day';
    if (rec.isContinuousShift) return rec.type === 'in' ? 'continuous_in' : 'continuous_out';
    if (todaySlots.in1Rec?.id === rec.id) return 'morning_in';
    if (todaySlots.out1Rec?.id === rec.id) return 'morning_out';
    if (todaySlots.in2Rec?.id === rec.id) return 'afternoon_in';
    if (todaySlots.out2Rec?.id === rec.id) return 'afternoon_out';
    return rec.type === 'in' ? 'morning_in' : 'morning_out';
  }, [todaySlots]);

  const getSlotDisplayLabel = useCallback((slotKey: AttendanceShiftSlot, rec?: AttendanceRecord): string => {
    switch (slotKey) {
      case 'morning_in': return 'Ingreso Mañana';
      case 'morning_out': return 'Salida Mañana';
      case 'afternoon_in': return 'Ingreso Tarde';
      case 'afternoon_out': return 'Salida Tarde';
      case 'continuous_in': return 'Ingreso De Corrido';
      case 'continuous_out': return 'Salida De Corrido (1h Libre)';
      case 'half_day': return 'Solo Media Jornada';
      default:
        return rec?.type === 'in' ? 'Ingreso' : 'Salida';
    }
  }, []);

  const getCaseKeyForRecord = useCallback((rec: AttendanceRecord): string => {
    const dk = getLocalDateKey(rec.timestamp) || todayDateStr;
    return `${dk}:${resolveRecordSlotKey(rec)}`;
  }, [todayDateStr, resolveRecordSlotKey]);

  const getUsedRectificationsForRecord = useCallback((rec: AttendanceRecord): { caseKey: string; usedCount: number } => {
    const caseKey = getCaseKeyForRecord(rec);
    const empCount = currentEmp?.rectifiedCases?.[caseKey] || 0;
    const recCount = rec.rectificationCount || 0;
    return {
      caseKey,
      usedCount: Math.max(empCount, recCount)
    };
  }, [currentEmp, getCaseKeyForRecord]);

  const processRegistration = useCallback((
    type: 'in' | 'out' | 'half_day',
    isLate: boolean,
    shiftLabel: string,
    shiftSlot: AttendanceShiftSlot,
    justification?: string
  ) => {
    if (isProcessing || !currentEmp) return;
    setIsProcessing(true);

    try {
      if (isLate && Notification.permission === "granted") {
        new Notification("ALERTA DE ASISTENCIA", {
          body: `El colaborador ${currentEmp.name} ${currentEmp.surname} ha marcado con más de 15 minutos de retraso.`,
          icon: APP_ICON_SVG
        });
      }

      const nowIso = new Date().toISOString();
      const record: AttendanceRecord = {
        id: generateUniqueRecordId('att'),
        employeeId: currentEmp.id,
        timestamp: toLocalDateTimeISO(new Date()),
        type,
        shiftSlot,
        status: 'confirmed',
        isLate,
        justification,
        updatedAt: nowIso,
        deviceId: getOrCreateDeviceId()
      };

      onRegister(record);

      let msg = `ÉXITO AL REALIZAR EL MARCAJE: ${shiftLabel}`;
      const bParts = currentEmp.birthDate ? getDateParts(currentEmp.birthDate) : null;
      const isTodayBirthday = !!(bParts && bParts.month === currentMonth && bParts.day === currentDay);

      if (isTodayBirthday) {
        msg = `¡FELIZ CUMPLEAÑOS! 🎂🎈 | ${msg}`;
        setIsBirthdaySuccess(true);
      } else {
        setIsBirthdaySuccess(false);
      }

      setSuccessMsg(msg);
      setStatus('success');
      setPin('');

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

  const handleMark = useCallback((type: 'in' | 'out' | 'half_day', shiftLabel: string, shiftSlot: AttendanceShiftSlot) => {
    if (isUpdateRequired && settings.systemUpdate?.isMandatory) {
      setIsUpdateModalOpen(true);
      return;
    }
    if (!currentEmp || isProcessing) return;

    if (type === 'half_day') {
      setConfirmDialog({
        isOpen: true,
        title: 'Confirmar Solo Media Jornada',
        message: '¿Confirma que hoy laborará únicamente Media Jornada? Se acreditará la mitad de la jornada diaria ordinaria salvo que registre salidas manuales.',
        confirmLabel: 'Sí, Registrar Media Jornada',
        type: 'info',
        onConfirm: () => {
          setConfirmDialog(null);
          processRegistration('half_day', false, shiftLabel, 'half_day', 'SOLO MEDIA JORNADA');
        }
      });
      return;
    }

    const now = new Date();
    const day = now.getDay();
    let isCriticalLate = false;
    const safeSched = getSafeSchedule(settings);

    if (type === 'in') {
      if (day >= 1 && day <= 5) {
        const targetHHMM = shiftSlot === 'afternoon_in' ? safeSched.monFri.in2 : safeSched.monFri.in1;
        const [h, m] = targetHHMM.split(':').map(Number);
        const schedTarget = new Date(now);
        schedTarget.setHours(h, m, 0, 0);
        const diffMins = (now.getTime() - schedTarget.getTime()) / (1000 * 60);
        if (diffMins > 15) isCriticalLate = true;
      } else if (day === 6 && shiftSlot === 'morning_in') {
        const [hs, ms] = safeSched.sat.in.split(':').map(Number);
        const schedSatIn = new Date(now);
        schedSatIn.setHours(hs, ms, 0, 0);
        const diffMins = (now.getTime() - schedSatIn.getTime()) / (1000 * 60);
        if (diffMins > 15) isCriticalLate = true;
      }
    }

    processRegistration(type, isCriticalLate, shiftLabel, shiftSlot);
  }, [currentEmp, isProcessing, settings, processRegistration, isUpdateRequired]);

  const handleOpenContinuousShiftModal = () => {
    if (isUpdateRequired && settings.systemUpdate?.isMandatory) {
      setIsUpdateModalOpen(true);
      return;
    }
    const nowHHMM = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    const schedIn1 = new Date().getDay() === 6 ? (settings.schedule?.sat?.in || '08:30') : (settings.schedule?.monFri?.in1 || '08:30');
    setContinuousModal({
      isOpen: true,
      endTime: nowHHMM,
      includeMorningIn: !todaySlots.in1Rec,
      morningInTime: schedIn1
    });
  };

  const handleConfirmContinuousShift = () => {
    if (!currentEmp || isProcessing) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Confirmar Jornada Única De Corrido',
      message: `¿Está seguro de registrar su salida de Jornada de Corrido a las ${continuousModal.endTime}? El sistema asignará automáticamente 1 hora libre dentro de su jornada diaria.`,
      confirmLabel: 'Sí, Registrar Jornada De Corrido',
      type: 'info',
      onConfirm: () => {
        setConfirmDialog(null);
        setIsProcessing(true);
        try {
          const nowIso = new Date().toISOString();
          const deviceId = getOrCreateDeviceId();
          const batchRecs: AttendanceRecord[] = [];

          if (continuousModal.includeMorningIn && !todaySlots.in1Rec) {
            batchRecs.push({
              id: generateUniqueRecordId('att'),
              employeeId: currentEmp.id,
              timestamp: `${todayDateStr}T${continuousModal.morningInTime}:00`,
              type: 'in',
              shiftSlot: 'continuous_in',
              status: 'confirmed',
              isLate: false,
              isContinuousShift: true,
              justification: 'INGRESO JORNADA DE CORRIDO',
              updatedAt: nowIso,
              deviceId
            });
          }

          batchRecs.push({
            id: generateUniqueRecordId('att'),
            employeeId: currentEmp.id,
            timestamp: `${todayDateStr}T${continuousModal.endTime}:00`,
            type: 'out',
            shiftSlot: 'continuous_out',
            status: 'confirmed',
            isLate: false,
            isContinuousShift: true,
            freeBreakMinutes: 60,
            justification: 'JORNADA ÚNICA DE CORRIDO (1 HORA LIBRE ASIGNADA AUTOMÁTICAMENTE)',
            updatedAt: nowIso,
            deviceId
          });

          if (onUpdateAttendance) {
            onUpdateAttendance(batchRecs);
          } else {
            batchRecs.forEach(r => onRegister(r));
          }

          setContinuousModal(prev => ({ ...prev, isOpen: false }));
          setSuccessMsg(`ÉXITO AL REALIZAR EL MARCAJE: JORNADA DE CORRIDO (${continuousModal.endTime} • 1H LIBRE ASIGNADA)`);
          setStatus('success');
          setPin('');

          setTimeout(() => {
            setStatus('idle');
            setCurrentEmp(null);
            setIsProcessing(false);
          }, 2800);
        } catch (err) {
          setIsProcessing(false);
          setFeedback({ isOpen: true, title: "Fallo", message: "No se pudo registrar la jornada de corrido.", type: "error" });
        }
      }
    });
  };

  const handleOpenSelfRectifyOrAdminRequest = (rec: AttendanceRecord) => {
    const slotKey = resolveRecordSlotKey(rec);
    const slotLabel = getSlotDisplayLabel(slotKey, rec);
    const timeStr = extractHHMM(rec.timestamp);
    const { caseKey, usedCount } = getUsedRectificationsForRecord(rec);

    if (usedCount >= 1) {
      setAdminCorrectionModal({
        isOpen: true,
        record: rec,
        caseKey,
        slotLabel,
        requestedType: rec.isContinuousShift ? 'continuous_out' : (rec.type === 'out' ? 'out' : 'in'),
        requestedTime: timeStr,
        reason: ''
      });
      return;
    }

    setEditTodayMarkModal({
      isOpen: true,
      record: rec,
      caseKey,
      type: rec.type === 'in' ? 'in' : 'out',
      time: timeStr,
      isContinuousShift: !!rec.isContinuousShift,
      reason: 'CORRECCIÓN POR ERROR FUERA DE HORARIO HABITUAL'
    });
  };

  const handleSaveCorrectedTodayMark = () => {
    if (!editTodayMarkModal.record || !currentEmp) return;
    const orig = editTodayMarkModal.record;
    const caseKey = editTodayMarkModal.caseKey || getCaseKeyForRecord(orig);
    const { usedCount } = getUsedRectificationsForRecord(orig);
    if (usedCount >= 1) {
      setEditTodayMarkModal(prev => ({ ...prev, isOpen: false, record: null }));
      handleOpenSelfRectifyOrAdminRequest(orig);
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Confirmar Única Rectificación del Caso (1/1)',
      message: `¿Está seguro de rectificar esta marcación a ${editTodayMarkModal.type === 'in' ? 'INGRESO' : (editTodayMarkModal.isContinuousShift ? 'SALIDA DE CORRIDO' : 'SALIDA')} a las ${editTodayMarkModal.time}? Solo dispone de 1 rectificación directa por caso; cambios adicionales requerirán autorización del Administrador.`,
      confirmLabel: 'Sí, Rectificar (Uso Único)',
      type: 'warning',
      onConfirm: () => {
        setConfirmDialog(null);
        const nowIso = new Date().toISOString();
        const datePart = getLocalDateKey(orig.timestamp) || todayDateStr;
        const updatedTimestamp = `${datePart}T${editTodayMarkModal.time}:00`;
        const resolvedSlot: AttendanceShiftSlot =
          editTodayMarkModal.type === 'out' && editTodayMarkModal.isContinuousShift
            ? 'continuous_out'
            : (orig.shiftSlot && orig.shiftSlot !== 'half_day'
                ? (editTodayMarkModal.type === 'in'
                    ? (orig.shiftSlot.startsWith('afternoon') ? 'afternoon_in' : 'morning_in')
                    : (orig.shiftSlot.startsWith('afternoon') ? 'afternoon_out' : 'morning_out'))
                : resolveRecordSlotKey(orig));

        const updatedRecord: AttendanceRecord = {
          ...orig,
          timestamp: updatedTimestamp,
          type: editTodayMarkModal.type,
          shiftSlot: resolvedSlot,
          isContinuousShift: editTodayMarkModal.type === 'out' ? editTodayMarkModal.isContinuousShift : false,
          freeBreakMinutes: editTodayMarkModal.type === 'out' && editTodayMarkModal.isContinuousShift ? 60 : undefined,
          isLate: false,
          rectificationCount: 1,
          rectifiedAt: nowIso,
          rectifiedReason: editTodayMarkModal.reason,
          justification: `[RECTIFICACIÓN 1/1]: ${editTodayMarkModal.reason}`,
          updatedAt: nowIso,
          deviceId: getOrCreateDeviceId()
        };

        if (onUpdateAttendance) {
          onUpdateAttendance([updatedRecord]);
        } else {
          onRegister(updatedRecord);
        }

        const nextCases = { ...(currentEmp.rectifiedCases || {}), [caseKey]: 1 };
        const updatedEmps = employees.map(e =>
          e.id === currentEmp.id ? { ...e, rectifiedCases: nextCases, updatedAt: nowIso } : e
        );
        onUpdateEmployees(updatedEmps);

        setEditTodayMarkModal(prev => ({ ...prev, isOpen: false, record: null }));
        setFeedback({
          isOpen: true,
          title: 'Marcación Rectificada (1/1)',
          message: `La marcación fue actualizada a las ${editTodayMarkModal.time}. Si necesita un nuevo ajuste en este mismo turno, deberá solicitar corrección administrativa.`,
          type: 'success'
        });
      }
    });
  };

  const handleAnnulTodayMark = (rec: AttendanceRecord) => {
    if (!currentEmp) return;
    const slotKey = resolveRecordSlotKey(rec);
    const label = getSlotDisplayLabel(slotKey, rec);
    const timeStr = extractHHMM(rec.timestamp);
    const { caseKey, usedCount } = getUsedRectificationsForRecord(rec);

    if (usedCount >= 1) {
      handleOpenSelfRectifyOrAdminRequest(rec);
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Anular Marcación por Error (Uso Único 1/1)',
      message: `¿Está seguro de anular la marcación de ${label} (${timeStr})? Utilizará su única rectificación disponible para este caso; luego podrá volver a marcar una sola vez o solicitar corrección administrativa si persiste algún error.`,
      confirmLabel: 'Sí, Anular Marcación',
      type: 'danger',
      onConfirm: () => {
        setConfirmDialog(null);
        const nowIso = new Date().toISOString();
        if (onDeleteAttendance) {
          onDeleteAttendance([rec.id]);
        } else if (onUpdateAttendance) {
          onUpdateAttendance([{
            ...rec,
            status: 'rejected',
            rectificationCount: 1,
            rectifiedAt: nowIso,
            updatedAt: nowIso,
            deviceId: getOrCreateDeviceId(),
            justification: 'ANULADA POR ERROR DE MARCACIÓN (1/1)'
          }]);
        }

        const nextCases = { ...(currentEmp.rectifiedCases || {}), [caseKey]: 1 };
        const updatedEmps = employees.map(e =>
          e.id === currentEmp.id ? { ...e, rectifiedCases: nextCases, updatedAt: nowIso } : e
        );
        onUpdateEmployees(updatedEmps);

        setFeedback({
          isOpen: true,
          title: 'Marcación Anulada (1/1 usado)',
          message: `Se anuló la marcación de ${label} (${timeStr}). El botón del turno quedó habilitado para su marcación correcta.`,
          type: 'info'
        });
      }
    });
  };

  const handleSubmitAdminCorrectionRequest = () => {
    if (!currentEmp || !adminCorrectionModal.record) return;
    if (!adminCorrectionModal.reason.trim()) {
      setFeedback({
        isOpen: true,
        title: 'Detalle Requerido',
        message: 'Por favor describa brevemente el motivo por el cual solicita la corrección al Administrador.',
        type: 'error'
      });
      return;
    }

    const orig = adminCorrectionModal.record;
    const nowIso = new Date().toISOString();
    const datePart = getLocalDateKey(orig.timestamp) || todayDateStr;
    const isContOut = adminCorrectionModal.requestedType === 'continuous_out';
    const mappedType: 'in' | 'out' = adminCorrectionModal.requestedType === 'in' ? 'in' : 'out';

    const requestRecord: AttendanceRecord = {
      id: generateUniqueRecordId('att'),
      employeeId: currentEmp.id,
      timestamp: `${datePart}T${adminCorrectionModal.requestedTime}:00`,
      type: mappedType,
      shiftSlot: isContOut ? 'continuous_out' : resolveRecordSlotKey(orig),
      isContinuousShift: isContOut,
      freeBreakMinutes: isContOut ? 60 : undefined,
      status: 'pending_approval',
      isForgotten: true,
      isAdminCorrectionRequest: true,
      justification: `[SOLICITUD CORRECCIÓN ADMIN - ${adminCorrectionModal.slotLabel}]: ${adminCorrectionModal.reason.trim().toUpperCase()}`,
      updatedAt: nowIso,
      deviceId: getOrCreateDeviceId()
    };

    onRegister(requestRecord);

    const newObs = {
      date: nowIso,
      text: `SOLICITUD CORRECCIÓN ADMINISTRATIVA (${adminCorrectionModal.slotLabel} • ${datePart} ${adminCorrectionModal.requestedTime}): ${adminCorrectionModal.reason.trim().toUpperCase()}`
    };
    const updatedEmps = employees.map(e =>
      e.id === currentEmp.id
        ? { ...e, observations: [newObs, ...(e.observations || [])], updatedAt: nowIso }
        : e
    );
    onUpdateEmployees(updatedEmps);

    if (Notification.permission === 'granted') {
      try {
        new Notification('SOLICITUD DE CORRECCIÓN ADMINISTRATIVA', {
          body: `${currentEmp.surname} ${currentEmp.name} solicita corrección administrativa en ${adminCorrectionModal.slotLabel}.`,
          icon: APP_ICON_SVG
        });
      } catch {}
    }

    setAdminCorrectionModal(prev => ({ ...prev, isOpen: false, record: null, reason: '' }));
    setFeedback({
      isOpen: true,
      title: 'Solicitud Enviada al Administrador',
      message: 'Ya utilizó su rectificación directa (1/1) para este caso. Su solicitud de corrección administrativa fue remitida al panel de Administración para validación.',
      type: 'info'
    });
  };

  const handleRegularize = () => {
    if (!currentEmp || isProcessing) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Confirmar Solicitud de Regularización',
      message: `¿Está seguro de enviar la regularización de ${regularizeData.type === 'in' ? 'INGRESO' : 'SALIDA'} del ${regularizeData.date} a las ${regularizeData.time} para autorización del Administrador?`,
      confirmLabel: 'Sí, Enviar Solicitud',
      type: 'info',
      onConfirm: () => {
        setConfirmDialog(null);
        setIsProcessing(true);
        try {
          const fullTimestamp = `${regularizeData.date}T${regularizeData.time}:00`;
          const finalJustification = regularizeData.justification === 'OTRO (DETALLAR)'
            ? `OTRO: ${regularizeData.otherDetails.toUpperCase()}`
            : regularizeData.justification;
          const nowIso = new Date().toISOString();

          const record: AttendanceRecord = {
            id: generateUniqueRecordId('att'),
            employeeId: currentEmp.id,
            timestamp: fullTimestamp,
            type: regularizeData.type,
            status: 'pending_approval',
            justification: finalJustification,
            isForgotten: true,
            updatedAt: nowIso,
            deviceId: getOrCreateDeviceId()
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
      }
    });
  };

  const handlePinChange = () => {
    if (!currentEmp || newPin.length !== 6 || newPin === currentEmp.pin) {
      setFeedback({ isOpen: true, title: "Error de PIN", message: "Ingrese un PIN nuevo de 6 dígitos diferente al actual.", type: "error" });
      return;
    }
    const updatedEmp: Employee = { ...currentEmp, pin: newPin, pinChanged: true, pinNeedsReset: false, pinResetRequested: false };
    const updated = employees.map(e => e.id === currentEmp.id ? updatedEmp : e);
    onUpdateEmployees(updated);
    setCurrentEmp(updatedEmp);
    setFeedback({ isOpen: true, title: "PIN Actualizado", message: "Su clave de acceso ha sido cambiada. Ahora puede marcar su asistencia.", type: "success" });
    checkRetroactiveMarkingsForEmp(updatedEmp);
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
    const empStartStr = emp.startDate ? getLocalDateKey(emp.startDate) : `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const empTermStr = emp.terminationDate ? getLocalDateKey(emp.terminationDate) : '';
    const safeSched = getSafeSchedule(settings);

    // Revisar todos los días del mes en curso hasta ayer
    for (let day = 1; day < currentDay; day++) {
      const targetDate = new Date(currentYear, currentMonth, day, 12, 0, 0);
      const dateStr = toLocalDateStr(targetDate);
      if (empStartStr && dateStr < empStartStr) continue;
      if (empTermStr && dateStr > empTermStr) continue;

      const dayOfWeek = targetDate.getDay();
      if (dayOfWeek === 0) continue; // Domingo no laborable
      if (isHolidayDate(dateStr, settings.holidays)) continue;

      // 1. Vacaciones aprobadas
      const isApprovedVacation = (emp.vacations || []).some(
        v => dateStr >= v.startDate && dateStr <= v.endDate
      );
      if (isApprovedVacation) continue;

      // 2. Días u horas de permiso o libres en la bitácora administrativa
      const dayObs = (emp.observations || []).filter(o => o.date && o.date.startsWith(dateStr));
      if (dayObs.some(isFullDayPermissionObs)) continue;

      const hasHalfDayPermission = dayObs.some(isHalfDayPermissionObs);

      const dayRecords = attendance.filter(
        a => a.employeeId === emp.id && getLocalDateKey(a.timestamp) === dateStr && a.status !== 'rejected' && !isAuditRequestRecord(a)
      );
      const hasHalfDay = dayRecords.some(a => a.type === 'half_day') || hasHalfDayPermission;
      if (hasHalfDay) continue;

      const ins = dayRecords.filter(a => a.type === 'in');
      const outs = dayRecords.filter(a => a.type === 'out');
      const isContinuousCompleted = dayRecords.some(a => a.isContinuousShift) && ins.length >= 1 && outs.length >= 1;
      if (isContinuousCompleted) continue;

      const dayName = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'short' }).format(targetDate);
      const capDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      const slots = splitDayRecordsIntoSlots(dayRecords, settings, dayOfWeek === 6, false);

      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        if (!slots.in1Rec) {
          missing.push({
            id: `missing-${dateStr}-in1`,
            date: dateStr,
            dateFormatted: capDay,
            shiftLabel: 'Jornada Mañana - Ingreso',
            type: 'in',
            suggestedTime: safeSched.monFri.in1,
            selectedTime: safeSched.monFri.in1,
            justification: 'OLVIDO INVOLUNTARIO'
          });
        }
        if (!slots.out1Rec) {
          missing.push({
            id: `missing-${dateStr}-out1`,
            date: dateStr,
            dateFormatted: capDay,
            shiftLabel: 'Jornada Mañana - Salida',
            type: 'out',
            suggestedTime: safeSched.monFri.out1,
            selectedTime: safeSched.monFri.out1,
            justification: 'OLVIDO INVOLUNTARIO'
          });
        }
        if (!slots.in2Rec) {
          missing.push({
            id: `missing-${dateStr}-in2`,
            date: dateStr,
            dateFormatted: capDay,
            shiftLabel: 'Jornada Tarde - Ingreso',
            type: 'in',
            suggestedTime: safeSched.monFri.in2,
            selectedTime: safeSched.monFri.in2,
            justification: 'OLVIDO INVOLUNTARIO'
          });
        }
        if (!slots.out2Rec) {
          missing.push({
            id: `missing-${dateStr}-out2`,
            date: dateStr,
            dateFormatted: capDay,
            shiftLabel: 'Jornada Tarde - Salida',
            type: 'out',
            suggestedTime: safeSched.monFri.out2,
            selectedTime: safeSched.monFri.out2,
            justification: 'OLVIDO INVOLUNTARIO'
          });
        }
      } else if (dayOfWeek === 6) {
        if (!slots.in1Rec) {
          missing.push({
            id: `missing-${dateStr}-sat-in`,
            date: dateStr,
            dateFormatted: capDay,
            shiftLabel: 'Sábado - Ingreso',
            type: 'in',
            suggestedTime: safeSched.sat.in,
            selectedTime: safeSched.sat.in,
            justification: 'OLVIDO INVOLUNTARIO'
          });
        }
        if (!slots.out1Rec) {
          missing.push({
            id: `missing-${dateStr}-sat-out`,
            date: dateStr,
            dateFormatted: capDay,
            shiftLabel: 'Sábado - Salida',
            type: 'out',
            suggestedTime: safeSched.sat.out,
            selectedTime: safeSched.sat.out,
            justification: 'OLVIDO INVOLUNTARIO'
          });
        }
      }
    }

    const hasActiveAuditRequest = attendance.some(
      a => a.employeeId === emp.id && a.status === 'pending_approval' && isAuditRequestRecord(a)
    );
    setPendingMissingSlots(missing);
    if (missing.length > 0 && !hasActiveAuditRequest) {
      setIsPersuasivePendingModalOpen(true);
    } else {
      setIsPersuasivePendingModalOpen(false);
    }
  }, [attendance, settings]);

  const handleBatchRegisterRetroactive = (newRecords: AttendanceRecord[]) => {
    if (onUpdateAttendance) {
      onUpdateAttendance(newRecords);
    } else {
      newRecords.forEach(r => onRegister(r));
    }
    setPendingMissingSlots([]);
    setIsRetroactiveModalOpen(false);
    setIsPersuasivePendingModalOpen(false);

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
    const updatedEmp: Employee = {
      ...currentEmp,
      regularizationApprovedNotice: currentEmp.regularizationApprovedNotice
        ? { ...currentEmp.regularizationApprovedNotice, seen: true }
        : undefined
    };
    const updated = employees.map(e => e.id === currentEmp.id ? updatedEmp : e);
    onUpdateEmployees(updated);
    setCurrentEmp(updatedEmp);
    setIsRegularizationNoticeModalOpen(false);
    if (!updatedEmp.pinChanged || updatedEmp.pinNeedsReset) {
      setStatus('change_pin');
    } else {
      checkRetroactiveMarkingsForEmp(updatedEmp);
      setStatus('confirm');
    }
  };

  const handleRequestAdminReviewRetroactive = (reason: string, details: string, slots: RetroactiveMissingSlot[]) => {
    if (!currentEmp) return;
    const nowIso = new Date().toISOString();

    const reviewRecord: AttendanceRecord = {
      id: generateUniqueRecordId('att'),
      employeeId: currentEmp.id,
      timestamp: nowIso,
      type: 'in',
      status: 'pending_approval',
      isForgotten: true,
      justification: `[AUDITORÍA RETROACTIVA]: ${reason} - ${details} (${slots.length} marcaciones)`,
      updatedAt: nowIso,
      deviceId: getOrCreateDeviceId()
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
    setIsPersuasivePendingModalOpen(false);
    setFeedback({
      isOpen: true,
      title: "Solicitud Enviada a Administración",
      message: "Tu requerimiento ha sido remitido a Gerencia y RRHH para auditoría y resolución formal. Puedes continuar realizando tu marcado habitual.",
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
                  {monthBirthdays.slice(0, 3).map(e => {
                    const bParts = getDateParts(e.birthDate);
                    return (
                      <div key={e.id} className="bg-white px-3 py-1 rounded-full shadow-sm border border-yellow-100 flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-700 uppercase">{e.name} {e.surname}</span>
                        <span className="text-[7px] font-bold text-yellow-600 bg-yellow-50 px-1.5 rounded-full">{bParts?.day || 1}/{currentMonth + 1}</span>
                      </div>
                    );
                  })}
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

        {status === 'confirm' && currentEmp && (() => {
          const safeSched = getSafeSchedule(settings);
          const isSat = today.getDay() === 6;
          const morningInLocked = !!todaySlots.in1Rec || halfDayDoneToday || continuousDoneToday || isProcessing;
          const morningOutLocked = !!todaySlots.out1Rec || halfDayDoneToday || continuousDoneToday || isProcessing;
          const afternoonInLocked = !!todaySlots.in2Rec || halfDayDoneToday || continuousDoneToday || isProcessing;
          const afternoonOutLocked = !!todaySlots.out2Rec || halfDayDoneToday || continuousDoneToday || isProcessing;
          const continuousLocked = halfDayDoneToday || continuousDoneToday || !!todaySlots.out1Rec || !!todaySlots.out2Rec || isProcessing;
          const halfDayLocked = halfDayDoneToday || continuousDoneToday || isProcessing;

          return (
            <div className="text-center w-full animate-in zoom-in space-y-5">
              {/* Cabecera del Colaborador + Salida Segura */}
              <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-2xl flex items-center justify-center text-xl font-black text-blue-700 uppercase border-2 border-white shadow-md shrink-0 overflow-hidden">
                    {currentEmp.photo ? <img src={currentEmp.photo} className="w-full h-full object-cover" /> : <span>{(currentEmp.name || 'C')[0]}</span>}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base md:text-lg font-[950] text-slate-900 uppercase tracking-tight leading-tight truncate">
                      {currentEmp.name} {currentEmp.surname}
                    </h2>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate">
                      {currentEmp.role}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStatus('idle');
                    setPin('');
                    setCurrentEmp(null);
                  }}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl font-black text-[9px] uppercase tracking-wider shrink-0 cursor-pointer transition-all active:scale-95"
                >
                  ← Salir
                </button>
              </div>

              {pendingMissingSlots.length > 0 && (
                <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl shadow-sm text-left space-y-2">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl shrink-0">⚠️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black text-amber-900 uppercase">
                        {pendingMissingSlots.length} Marcaciones Pendientes en el Mes
                      </p>
                      <p className="text-[9px] font-bold text-slate-700 uppercase mt-0.5 leading-snug">
                        Su panel de hoy está habilitado normalmente. Puede regularizar jornadas pasadas aquí:
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRetroactiveInitialMode('selection');
                      setIsPersuasivePendingModalOpen(true);
                    }}
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-[9px] uppercase tracking-wider rounded-xl shadow transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>✍️</span> Ver Opciones de Regularización
                  </button>
                </div>
              )}

              {/* JORNADA MATUTINA (MAÑANA) */}
              <section className="p-3.5 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-2.5 text-left">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🌅</span> Jornada Matutina (Mañana)
                  </p>
                  <span className="text-[9px] font-mono font-bold text-emerald-700">
                    {isSat ? `${safeSched.sat.in} - ${safeSched.sat.out}` : `${safeSched.monFri.in1} - ${safeSched.monFri.out1}`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={morningInLocked}
                    onClick={() => handleMark('in', 'INGRESO JORNADA MATUTINA', 'morning_in')}
                    className={`min-h-[54px] py-3 px-3 rounded-xl font-black text-[11px] uppercase shadow-md active:scale-95 transition-all border-b-4 flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      morningInLocked
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed shadow-none'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-800'
                    }`}
                  >
                    <span>Ingreso Mañana</span>
                    {todaySlots.in1Rec && (
                      <span className="text-[9px] font-mono text-emerald-700 font-black">
                        ✓ {extractHHMM(todaySlots.in1Rec.timestamp)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={morningOutLocked}
                    onClick={() => handleMark('out', 'SALIDA JORNADA MATUTINA', 'morning_out')}
                    className={`min-h-[54px] py-3 px-3 rounded-xl font-black text-[11px] uppercase shadow-md active:scale-95 transition-all border-b-4 flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      morningOutLocked
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed shadow-none'
                        : 'bg-orange-600 hover:bg-orange-700 text-white border-orange-800'
                    }`}
                  >
                    <span>Salida Mañana</span>
                    {todaySlots.out1Rec && (
                      <span className="text-[9px] font-mono text-orange-700 font-black">
                        ✓ {extractHHMM(todaySlots.out1Rec.timestamp)}
                      </span>
                    )}
                  </button>
                </div>
              </section>

              {/* JORNADA VESPERTINA (TARDE) */}
              <section className="p-3.5 bg-cyan-50/50 border border-cyan-200/80 rounded-2xl space-y-2.5 text-left">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black text-cyan-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🌇</span> Jornada Vespertina (Tarde)
                  </p>
                  <span className="text-[9px] font-mono font-bold text-cyan-700">
                    {safeSched.monFri.in2} - {safeSched.monFri.out2}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={afternoonInLocked}
                    onClick={() => handleMark('in', 'INGRESO JORNADA VESPERTINA', 'afternoon_in')}
                    className={`min-h-[54px] py-3 px-3 rounded-xl font-black text-[11px] uppercase shadow-md active:scale-95 transition-all border-b-4 flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      afternoonInLocked
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed shadow-none'
                        : 'bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-800'
                    }`}
                  >
                    <span>Ingreso Tarde</span>
                    {todaySlots.in2Rec && (
                      <span className="text-[9px] font-mono text-cyan-700 font-black">
                        ✓ {extractHHMM(todaySlots.in2Rec.timestamp)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={afternoonOutLocked}
                    onClick={() => handleMark('out', 'SALIDA JORNADA VESPERTINA', 'afternoon_out')}
                    className={`min-h-[54px] py-3 px-3 rounded-xl font-black text-[11px] uppercase shadow-md active:scale-95 transition-all border-b-4 flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      afternoonOutLocked
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed shadow-none'
                        : 'bg-rose-600 hover:bg-rose-700 text-white border-rose-800'
                    }`}
                  >
                    <span>Salida Tarde</span>
                    {todaySlots.out2Rec && (
                      <span className="text-[9px] font-mono text-rose-700 font-black">
                        ✓ {extractHHMM(todaySlots.out2Rec.timestamp)}
                      </span>
                    )}
                  </button>
                </div>
              </section>

              {/* OPCIONES ESPECIALES: DE CORRIDO / MEDIA JORNADA / REGULARIZAR */}
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={continuousLocked}
                    onClick={handleOpenContinuousShiftModal}
                    className={`min-h-[50px] py-3 px-3 rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all border-b-4 flex items-center justify-center gap-2 cursor-pointer ${
                      continuousLocked
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed shadow-none'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-800'
                    }`}
                  >
                    <span>⏱️</span>
                    <span>Jornada De Corrido (1h Libre)</span>
                  </button>
                  <button
                    type="button"
                    disabled={halfDayLocked}
                    onClick={() => handleMark('half_day', 'REGISTRO SOLO MEDIA JORNADA', 'half_day')}
                    className={`min-h-[50px] py-3 px-3 rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all border-b-4 flex items-center justify-center gap-2 cursor-pointer ${
                      halfDayLocked
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed shadow-none'
                        : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-700'
                    }`}
                  >
                    <span>📅</span>
                    <span>Solo Media Jornada</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setStatus('regularize_form')}
                  className="w-full min-h-[44px] py-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl uppercase text-[9px] tracking-widest shadow-md flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <span>💡</span> Regularizar Marcación Olvidada
                </button>
              </div>

              {/* MARCACIONES DE HOY CON LÍMITE DE 1 RECTIFICACIÓN POR CASO */}
              {empTodayRecords.length > 0 && (
                <div className="pt-4 border-t border-slate-200 text-left space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                      Marcaciones de Hoy ({empTodayRecords.length})
                    </p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">
                      1 rectificación directa por caso
                    </p>
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto custom-scroll pr-1">
                    {empTodayRecords.map(rec => {
                      const timeStr = extractHHMM(rec.timestamp);
                      const slotKey = resolveRecordSlotKey(rec);
                      const slotLabel = getSlotDisplayLabel(slotKey, rec);
                      const { usedCount } = getUsedRectificationsForRecord(rec);
                      const limitReached = usedCount >= 1;

                      return (
                        <div key={rec.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                rec.type === 'in'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : rec.isContinuousShift
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : rec.type === 'half_day'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {slotLabel}
                              </span>
                              <span className="font-mono font-black text-xs text-slate-900 tabular-nums">{timeStr}</span>
                              {rec.status === 'pending_approval' && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[7px] font-black uppercase">
                                  Pendiente Admin
                                </span>
                              )}
                              {rec.isLate && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[7px] font-black uppercase">
                                  Atraso
                                </span>
                              )}
                              {limitReached && (
                                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[7px] font-black uppercase">
                                  Rectif. 1/1 Usada
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {rec.status === 'pending_approval' ? (
                              <span className="text-[8px] font-black text-blue-700 uppercase">En revisión</span>
                            ) : !limitReached ? (
                              <>
                                {rec.type !== 'half_day' && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSelfRectifyOrAdminRequest(rec)}
                                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[8px] font-black uppercase cursor-pointer active:scale-95"
                                    title="Rectificar hora o tipo (1 vez disponible por caso)"
                                  >
                                    ✏️ Rectificar (1/1)
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleAnnulTodayMark(rec)}
                                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-[8px] font-black uppercase cursor-pointer active:scale-95"
                                  title="Anular marcación por error (usa tu rectificación única)"
                                >
                                  🗑️ Anular (1/1)
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenSelfRectifyOrAdminRequest(rec)}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[8px] font-black uppercase cursor-pointer active:scale-95"
                                title="Ya utilizó su rectificación directa; solicitar corrección al Administrador"
                              >
                                🛡️ Solicitar Corrección al Admin
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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
          initialMode={retroactiveInitialMode}
          onBatchRegister={handleBatchRegisterRetroactive}
          onRequestAdminReview={handleRequestAdminReviewRetroactive}
          onProceedToToday={() => setIsRetroactiveModalOpen(false)}
        />
      )}

      {/* MODAL PERSUASIVO DE MARCACIONES PENDIENTES - NO BLOQUEA EL PANEL */}
      {currentEmp && pendingMissingSlots.length > 0 && (
        <Modal
          isOpen={isPersuasivePendingModalOpen}
          onClose={() => setIsPersuasivePendingModalOpen(false)}
          title="MARCACIONES PENDIENTES DE REGULARIZACIÓN"
          type="warning"
          maxWidth="max-w-xl"
        >
          <div className="text-center p-3 sm:p-5 space-y-5 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 border-2 border-amber-300 flex items-center justify-center text-3xl mx-auto shadow-inner">
              ⚠️
            </div>

            <div className="space-y-1.5">
              <span className="px-3 py-0.5 bg-amber-500 text-white font-black text-[8px] uppercase rounded-full">
                Control Institucional de Asistencia
              </span>
              <h3 className="text-base sm:text-lg font-[950] text-slate-900 uppercase">
                {currentEmp.name} {currentEmp.surname}
              </h3>
              <p className="text-xs text-slate-600 font-bold uppercase leading-relaxed">
                Se registran <span className="text-amber-800 font-black">{pendingMissingSlots.length} marcaciones pendientes</span> dentro del mes en curso. Para mantener al día su cómputo de horas de nómina y puntualidad, le invitamos a ponerse al día regularizando su horario personalmente o solicitar asistencia al administrador.
              </p>
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <p className="text-[10px] font-black text-emerald-800 uppercase">
                  ✓ Su panel de marcación de hoy está habilitado y no se bloqueará. Puede continuar marcando normalmente.
                </p>
              </div>
            </div>

            {/* Listado de fechas pendientes */}
            <div className="max-h-44 overflow-y-auto space-y-1.5 p-2.5 bg-slate-50 rounded-2xl border border-slate-200 text-left custom-scroll">
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider px-1">Jornadas pendientes detectadas:</p>
              {pendingMissingSlots.map(slot => (
                <div key={slot.id} className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-[9px] font-black uppercase">
                  <span className="text-slate-800 font-bold">{slot.dateFormatted} ({slot.date})</span>
                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">{slot.shiftLabel}</span>
                  <span className="text-slate-400 font-mono">{slot.suggestedTime}</span>
                </div>
              ))}
            </div>

            {/* Acciones */}
            <div className="space-y-2 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRetroactiveInitialMode('regularize');
                    setIsPersuasivePendingModalOpen(false);
                    setIsRetroactiveModalOpen(true);
                  }}
                  className="py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase rounded-xl shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>✍️</span> Regularizar Personalmente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      title: 'Solicitar Asistencia al Administrador',
                      message: `¿Está seguro de enviar una solicitud al Administrador para regularizar las ${pendingMissingSlots.length} marcaciones pendientes detectadas?`,
                      confirmLabel: 'Sí, Solicitar Asistencia',
                      type: 'info',
                      onConfirm: () => {
                        setConfirmDialog(null);
                        setIsPersuasivePendingModalOpen(false);
                        handleRequestAdminReviewRetroactive(
                          'AUDITORÍA DE HORARIOS',
                          'SOLICITUD DE ASISTENCIA Y AUDITORÍA AL ADMINISTRADOR',
                          pendingMissingSlots
                        );
                      }
                    });
                  }}
                  className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase rounded-xl shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>📨</span> Solicitar Asistencia al Admin
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsPersuasivePendingModalOpen(false)}
                className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>⏱️</span> Continuar al Marcado Habitual
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL PARA REGISTRAR JORNADA ÚNICA DE CORRIDO */}
      {currentEmp && (
        <Modal
          isOpen={continuousModal.isOpen}
          onClose={() => setContinuousModal(prev => ({ ...prev, isOpen: false }))}
          title="JORNADA ÚNICA DE CORRIDO (1 HORA LIBRE)"
          maxWidth="max-w-md"
        >
          <div className="p-3 sm:p-4 space-y-5 text-slate-900">
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-1.5 text-left">
              <div className="flex items-center gap-2 text-indigo-900 font-black text-xs uppercase">
                <span>⏱️</span> Trabajo Continuo Sin Salida a Mediodía
              </div>
              <p className="text-[10px] font-bold text-indigo-700 uppercase leading-relaxed">
                Al trabajar de corrido sin registrar salida de descanso al mediodía, el sistema asignará automáticamente <span className="text-indigo-950 font-black">1 hora libre</span> en el cómputo de su jornada diaria.
              </p>
            </div>

            {insCount === 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-left">
                <label className="flex items-center gap-2 text-[9px] font-black text-amber-900 uppercase cursor-pointer">
                  <input
                    type="checkbox"
                    checked={continuousModal.includeMorningIn}
                    onChange={e => setContinuousModal(prev => ({ ...prev, includeMorningIn: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  Registrar también hora de ingreso inicial
                </label>
                {continuousModal.includeMorningIn && (
                  <input
                    type="time"
                    value={continuousModal.morningInTime}
                    onChange={e => setContinuousModal(prev => ({ ...prev, morningInTime: e.target.value }))}
                    className="w-full p-2.5 bg-white border-2 border-amber-300 rounded-xl text-sm font-black font-mono text-center outline-none focus:border-indigo-500"
                  />
                )}
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                Hora de Finalización de Jornada Diaria
              </label>
              <input
                type="time"
                value={continuousModal.endTime}
                onChange={e => setContinuousModal(prev => ({ ...prev, endTime: e.target.value }))}
                className="w-full p-4 bg-slate-50 border-2 border-indigo-300 rounded-2xl text-xl font-black font-mono text-center text-slate-900 focus:border-indigo-600 outline-none"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setContinuousModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-xl uppercase text-[10px] tracking-wider cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmContinuousShift}
                className="flex-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl uppercase text-[10px] tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                Confirmar Jornada De Corrido
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL PARA CORREGIR MARCACIÓN ERRÓNEA DEL COLABORADOR */}
      {editTodayMarkModal.isOpen && editTodayMarkModal.record && (
        <Modal
          isOpen={editTodayMarkModal.isOpen}
          onClose={() => setEditTodayMarkModal(prev => ({ ...prev, isOpen: false, record: null }))}
          title="CORREGIR MARCACIÓN REALIZADA POR ERROR"
          maxWidth="max-w-md"
        >
          <div className="p-3 sm:p-4 space-y-4 text-slate-900 text-left">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl">
              <p className="text-[10px] font-black text-blue-900 uppercase">
                Corrección de Ingreso o Salida Fuera de Horario
              </p>
              <p className="text-[9px] font-bold text-blue-700 uppercase mt-0.5">
                Ajuste el tipo y la hora real de su marcación de hoy.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400">Tipo de Marcación</label>
                <select
                  value={editTodayMarkModal.isContinuousShift ? 'continuous_out' : editTodayMarkModal.type}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'continuous_out') {
                      setEditTodayMarkModal(prev => ({ ...prev, type: 'out', isContinuousShift: true }));
                    } else {
                      setEditTodayMarkModal(prev => ({ ...prev, type: val as 'in' | 'out', isContinuousShift: false }));
                    }
                  }}
                  className="w-full p-3 border-2 rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-500 bg-white"
                >
                  <option value="in">Ingreso</option>
                  <option value="out">Salida</option>
                  <option value="continuous_out">Salida De Corrido (1h Libre)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400">Hora Correcta</label>
                <input
                  type="time"
                  value={editTodayMarkModal.time}
                  onChange={e => setEditTodayMarkModal(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full p-3 border-2 rounded-xl text-sm font-black font-mono text-center outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-slate-400">Motivo de Corrección</label>
              <select
                value={editTodayMarkModal.reason}
                onChange={e => setEditTodayMarkModal(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full p-3 border-2 rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-500 bg-white"
              >
                <option value="CORRECCIÓN POR ERROR FUERA DE HORARIO HABITUAL">CORRECCIÓN POR ERROR FUERA DE HORARIO HABITUAL</option>
                <option value="ERROR AL SELECCIONAR INGRESO / SALIDA">ERROR AL SELECCIONAR INGRESO / SALIDA</option>
                <option value="CAMBIO A JORNADA DE CORRIDO">CAMBIO A JORNADA DE CORRIDO</option>
              </select>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditTodayMarkModal(prev => ({ ...prev, isOpen: false, record: null }))}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCorrectedTodayMark}
                className="flex-2 py-3 bg-blue-700 hover:bg-blue-800 text-white font-black rounded-xl uppercase text-[10px] shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                Guardar Corrección
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL PARA SOLICITAR CORRECCIÓN AL ADMINISTRADOR (LÍMITE 1/1 YA USADO) */}
      {adminCorrectionModal.isOpen && adminCorrectionModal.record && (
        <Modal
          isOpen={adminCorrectionModal.isOpen}
          onClose={() => setAdminCorrectionModal(prev => ({ ...prev, isOpen: false, record: null }))}
          title="SOLICITAR CORRECCIÓN ADMINISTRATIVA"
          maxWidth="max-w-md"
        >
          <div className="p-3 sm:p-4 space-y-4 text-slate-900 text-left">
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-1">
              <p className="text-[10px] font-black text-indigo-900 uppercase">
                Límite de Rectificación Directa (1/1) Alcanzado
              </p>
              <p className="text-[9px] font-bold text-indigo-700 uppercase leading-relaxed">
                Ya realizaste 1 rectificación en <span className="font-black text-indigo-950">{adminCorrectionModal.slotLabel}</span>. Envía tu solicitud al Administrador para que realice el ajuste oficial.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400">Tipo Solicitado</label>
                <select
                  value={adminCorrectionModal.requestedType}
                  onChange={e => setAdminCorrectionModal(prev => ({ ...prev, requestedType: e.target.value as 'in' | 'out' | 'continuous_out' }))}
                  className="w-full p-3 border-2 rounded-xl text-[10px] font-black uppercase outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="in">Ingreso</option>
                  <option value="out">Salida</option>
                  <option value="continuous_out">Salida De Corrido</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400">Hora Correcta Solicitada</label>
                <input
                  type="time"
                  value={adminCorrectionModal.requestedTime}
                  onChange={e => setAdminCorrectionModal(prev => ({ ...prev, requestedTime: e.target.value }))}
                  className="w-full p-3 border-2 rounded-xl text-sm font-black font-mono text-center outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-slate-400">Motivo para Administración</label>
              <textarea
                rows={3}
                value={adminCorrectionModal.reason}
                onChange={e => setAdminCorrectionModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="EJ: MARQUÉ EQUIVOCADAMENTE NUEVAMENTE LA HORA DE SALIDA..."
                className="w-full p-3 border-2 rounded-xl text-[10px] font-bold uppercase outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setAdminCorrectionModal(prev => ({ ...prev, isOpen: false, record: null }))}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitAdminCorrectionRequest}
                className="flex-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl uppercase text-[10px] shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                Enviar Solicitud al Admin
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDialog && (
        <ConfirmationModal
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          type={confirmDialog.type}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
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
                  Fecha de Validación: {safeFormatDateTime(currentEmp.regularizationApprovedNotice.approvedAt)}
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
