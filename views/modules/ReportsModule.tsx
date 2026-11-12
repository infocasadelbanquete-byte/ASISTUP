
import React, { useState, useEffect, useMemo } from 'react';
import { Employee, Payment, AttendanceRecord, CompanyConfig, GlobalSettings, Role, SavedReport } from '../../types.ts';
import Modal from '../../components/Modal.tsx';
import EmployeeFileModal from '../../components/EmployeeFileModal.tsx';
import ConfirmationModal from '../../components/ConfirmationModal.tsx';
import JSZip from 'jszip';

interface ReportsModuleProps {
  employees: Employee[];
  payments: Payment[];
  attendance: AttendanceRecord[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
  role: Role;
  savedReports?: SavedReport[];
  initialSelectedEmployeeId?: string;
  onUpdateAttendance?: (records: AttendanceRecord[]) => void;
  onUpdateEmployees?: (employees: Employee[]) => void;
}

export interface DailyAttendanceSummary {
  dateKey: string;
  dateFormatted: string;
  records: AttendanceRecord[];
  in1: string;
  out1: string;
  in2: string;
  out2: string;
  isHalfDay: boolean;
  isPendingMarking?: boolean;
  totalMinutes: number;
  hoursFormatted: string;
  decimalHours: number;
  hasLate: boolean;
  statusLabel: string;
  justifications: string;
}

const safeFormatTime = (timestamp?: string): string => {
  if (!timestamp) return '--:--';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '--:--';
  }
};

const extract24HourTime = (timestamp?: string, defaultFallback: string = '08:30'): string => {
  if (!timestamp) return defaultFallback;
  try {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
    if (timestamp.includes('T')) {
      const timePart = timestamp.split('T')[1];
      return timePart.substring(0, 5);
    }
    return defaultFallback;
  } catch (e) {
    return defaultFallback;
  }
};

const safeFormatDate = (timestamp?: string): string => {
  if (!timestamp) return 'S/F';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) {
      return timestamp.includes('T') ? timestamp.split('T')[0] : (timestamp.split(' ')[0] || timestamp);
    }
    return d.toLocaleDateString('es-EC', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return timestamp ? (timestamp.includes('T') ? timestamp.split('T')[0] : timestamp) : 'S/F';
  }
};

const safeFormatDateTime = (timestamp?: string): string => {
  if (!timestamp) return 'S/F';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp;
    return d.toLocaleString('es-EC');
  } catch (e) {
    return timestamp;
  }
};

const ReportsModule: React.FC<ReportsModuleProps> = ({
  employees,
  payments = [],
  attendance = [],
  company,
  settings,
  role,
  savedReports = [],
  initialSelectedEmployeeId,
  onUpdateAttendance,
  onUpdateEmployees
}) => {
  const [reportType, setReportType] = useState<'attendance' | 'payments' | 'history' | 'master' | 'employees' | 'payroll' | 'novedades' | 'bajas' | 'saved_payroll'>('attendance');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [isZipping, setIsZipping] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [feedback, setFeedback] = useState({ isOpen: false, title: '', message: '', type: 'success' as any });

  const [selectedEmpForFicha, setSelectedEmpForFicha] = useState<Employee | null>(null);
  const [selectedEmployeeIdForAttendance, setSelectedEmployeeIdForAttendance] = useState<string>(initialSelectedEmployeeId || '');

  useEffect(() => {
    if (initialSelectedEmployeeId) {
      setSelectedEmployeeIdForAttendance(initialSelectedEmployeeId);
      setReportType('attendance');
    }
  }, [initialSelectedEmployeeId]);

  // Estado para la corrección o regularización directa de marcaciones del reporte
  const [editDayModal, setEditDayModal] = useState<{
    isOpen: boolean;
    dateKey: string;
    dateFormatted: string;
    isHalfDay: boolean;
    isFullDayLeave: boolean;
    leaveReason: string;
    in1Enabled: boolean;
    in1Time: string;
    in1Late: boolean;
    out1Enabled: boolean;
    out1Time: string;
    in2Enabled: boolean;
    in2Time: string;
    in2Late: boolean;
    out2Enabled: boolean;
    out2Time: string;
    justification: string;
    observationNote: string;
    isPendingOriginal: boolean;
  }>({
    isOpen: false,
    dateKey: '',
    dateFormatted: '',
    isHalfDay: false,
    isFullDayLeave: false,
    leaveReason: 'PERMISO PERSONAL AUTORIZADO',
    in1Enabled: true,
    in1Time: '08:30',
    in1Late: false,
    out1Enabled: true,
    out1Time: '13:00',
    in2Enabled: true,
    in2Time: '15:00',
    in2Late: false,
    out2Enabled: true,
    out2Time: '18:00',
    justification: 'REGULARIZACIÓN ADMINISTRATIVA DE FECHA PENDIENTE',
    observationNote: '',
    isPendingOriginal: false
  });

  // Modal de confirmación genérico para acciones de reportes
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    type?: 'warning' | 'danger' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const requestConfirmation = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'warning' | 'danger' | 'info' = 'warning',
    confirmText: string = 'Sí, Confirmar Acción'
  ) => {
    setConfirmAction({
      isOpen: true,
      title,
      message,
      type,
      confirmText,
      onConfirm: () => {
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      }
    });
  };

  // Efecto para disparar la impresión una vez que el estado de reporte ha cambiado y el DOM está listo
  useEffect(() => {
    if (isPrinting) {
      const timer = setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isPrinting]);

  const getCSVData = (type: string) => {
    let csv = "\uFEFF";
    const filterFn = (timestamp: string) => {
      if (!startDate && !endDate) return true;
      const date = new Date(timestamp);
      const start = startDate ? new Date(startDate + 'T00:00:00') : null;
      const end = endDate ? new Date(endDate + 'T23:59:59') : null;
      if (start && date < start) return false;
      if (end && date > end) return false;
      return true;
    };

    if (type === 'employees' || type === 'history') {
      csv += "ID,COLABORADOR,CARGO,INGRESO,AFILIACION IESS,FONDOS RESERVA,DECIMOS,SUELDO,STATUS\n";
      employees.filter(e => filterFn(e.startDate)).forEach(e => {
        csv += `"${e.identification}","${e.surname} ${e.name}","${e.role}","${e.startDate}","${e.isAffiliated ? 'SI' : 'NO'}","${e.reserveFundType || 'N/A'}","${e.overSalaryType}","${e.salary.toFixed(2)}","${e.status}"\n`;
      });
    } else if (type === 'payroll' || type === 'payments') {
      csv += "VOUCHER,FECHA,BENEFICIARIO,CONCEPTO,METODO,MONTO,STATUS\n";
      payments.filter(p => filterFn(p.date)).forEach(p => {
        const emp = employees.find(e => e.id === p.employeeId);
        csv += `"${p.voucherCode}","${new Date(p.date).toLocaleDateString()}","${emp?.surname} ${emp?.name}","${p.type}","${p.method}","${p.amount.toFixed(2)}","${p.status}"\n`;
      });
    } else if (type === 'attendance') {
      csv += "sep=;\r\n";
      csv += "FECHA Y HORA;COLABORADOR;IDENTIFICACION;CARGO;TIPO MARCACION;ESTADO;PUNTUALIDAD;OBSERVACION / JUSTIFICACION\r\n";
      // Ordenamiento obligatorio para Excel: Empleado y luego Cronológico
      const sortedForExcel = [...attendance].filter(a => filterFn(a.timestamp)).sort((a, b) => {
        const empA = employees.find(e => e.id === a.employeeId);
        const empB = employees.find(e => e.id === b.employeeId);
        const nameA = `${empA?.surname || ''} ${empA?.name || ''}`.toLowerCase();
        const nameB = `${empB?.surname || ''} ${empB?.name || ''}`.toLowerCase();
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return a.timestamp.localeCompare(b.timestamp);
      });

      sortedForExcel.forEach(a => {
        const emp = employees.find(e => e.id === a.employeeId);
        let statusTexto = a.status === 'confirmed' ? "CONFIRMADO" : (a.status === 'pending_approval' ? "PENDIENTE APROBACIÓN" : "RECHAZADO");
        let tipoTexto = a.type === 'in' ? "INGRESO" : (a.type === 'out' ? "SALIDA" : "MEDIA JORNADA LIBRE");
        let puntualidad = a.isLate ? "CON ATRASO" : "PUNTUAL";
        csv += `"${safeFormatDateTime(a.timestamp)}";"${emp?.surname || ''} ${emp?.name || ''}";"${emp?.identification || ''}";"${emp?.role || 'General'}";"${tipoTexto}";"${statusTexto}";"${puntualidad}";"${(a.justification || '').replace(/"/g, '""')}"\r\n`;
      });
    } else if (type === 'novedades') {
      csv += "FECHA REGISTRO,COLABORADOR,EVENTO ADMINISTRATIVO\n";
      employees.flatMap(e => e.observations?.map(obs => ({ emp: e, obs })) || [])
        .filter(item => filterFn(item.obs.date))
        .forEach(item => {
          csv += `"${new Date(item.obs.date).toLocaleString()}","${item.emp.surname} ${item.emp.name}","${item.obs.text}"\n`;
        });
    } else if (type === 'bajas') {
      csv += "COLABORADOR,IDENTIFICACION,SALIDA,MOTIVO LEGAL,DETALLES FINALES\n";
      employees.filter(e => e.status === 'terminated' && filterFn(e.terminationDate || '')).forEach(e => {
        csv += `"${e.surname} ${e.name}","${e.identification}","${e.terminationDate}","${e.terminationReason}","${e.terminationDetails}"\n`;
      });
    }
    return csv;
  };

  const handleDownloadMasterZip = () => {
    requestConfirmation(
      "Descargar Archivo Maestro ZIP",
      "¿Está seguro de consolidar y descargar el paquete completo del Archivo Maestro en formato ZIP con todos los censos de personal, nóminas y asistencias?",
      async () => {
        setIsZipping(true);
        try {
          const zip = new JSZip();
          const folder = zip.folder(`ARCHIVO_MAESTRO_ASISTUP_${new Date().getFullYear()}`);
          folder?.file("1_CENSO_PERSONAL_MAESTRO.csv", getCSVData('employees'));
          folder?.file("2_REGISTRO_PAGOS_NOMINA.csv", getCSVData('payroll'));
          folder?.file("3_BITACORA_ASISTENCIA.csv", getCSVData('attendance'));
          folder?.file("4_HISTORIAL_NOVEDADES.csv", getCSVData('novedades'));
          folder?.file("5_EXPEDIENTES_DESVINCULADOS.csv", getCSVData('bajas'));

          const blob = await zip.generateAsync({ type: "blob" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `CONSOLIDADO_MASTER_ASISTUP_${new Date().toISOString().split('T')[0]}.zip`;
          link.click();
          setFeedback({ isOpen: true, title: "Éxito Corporativo", message: "Contenedor ZIP generado correctamente.", type: "success" });
        } catch (e) {
          setFeedback({ isOpen: true, title: "Fallo Crítico", message: "No se pudo consolidar el paquete comprimido.", type: "error" });
        } finally {
          setIsZipping(false);
        }
      },
      'info',
      'Descargar ZIP'
    );
  };

  const generateReportExcel = (type: string) => {
    requestConfirmation(
      "Descargar Reporte en Excel",
      `¿Está seguro de descargar el reporte de ${type.toUpperCase()} en formato Excel?`,
      () => {
        const csv = getCSVData(type);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `REPORTE_${type.toUpperCase()}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
      },
      'info',
      'Descargar Excel'
    );
  };

  const generateReportPDF = (type: any) => {
    requestConfirmation(
      "Generar Reporte Oficial PDF",
      `¿Está seguro de generar e imprimir el reporte oficial de ${type.toUpperCase()} en formato PDF para A4?`,
      () => {
        if (reportType === 'master') {
          setSearchTerm('');
          setStartDate('');
          setEndDate('');
        }
        setReportType(type);
        setIsPrinting(true);
      },
      'info',
      'Generar PDF'
    );
  };

  const selectedEmpForAttendance = employees.find(e => e.id === selectedEmployeeIdForAttendance);

  const filterByDate = (timestamp?: string) => {
    if (!startDate && !endDate) return true;
    if (!timestamp) return false;
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return true;
    const start = startDate ? new Date(startDate + 'T00:00:00') : null;
    const end = endDate ? new Date(endDate + 'T23:59:59') : null;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  };

  const individualAttendanceRecords = (attendance || []).filter(a => {
    if (!a || !selectedEmployeeIdForAttendance) return false;
    if (a.employeeId !== selectedEmployeeIdForAttendance) return false;
    return filterByDate(a.timestamp);
  }).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

  // Agrupación de registros por día y detección de fechas con marcaciones pendientes
  const individualDailyRecords: DailyAttendanceSummary[] = useMemo(() => {
    if (!selectedEmpForAttendance) return [];

    // 1. Agrupar registros físicos existentes por fecha
    const grouped: { [dateStr: string]: AttendanceRecord[] } = {};
    (individualAttendanceRecords || []).forEach(rec => {
      if (!rec) return;
      const ts = rec.timestamp || '';
      const dateKey = ts.includes('T') ? ts.split('T')[0] : (ts.includes(' ') ? ts.split(' ')[0] : (ts || 'SIN_FECHA'));
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(rec);
    });

    // 2. Determinar el rango de fechas que abarca el reporte
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();
    const todayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

    let rangeStart = startDate;
    let rangeEnd = endDate;

    if (!rangeStart) {
      const currentMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      rangeStart = currentMonthStart;
    }
    if (!rangeEnd) {
      rangeEnd = todayStr;
    }

    const existingDateKeys = Object.keys(grouped);
    if (existingDateKeys.length > 0) {
      const sortedExisting = [...existingDateKeys].sort();
      if (!startDate && sortedExisting[0] < rangeStart) {
        rangeStart = sortedExisting[0];
      }
      if (!endDate && sortedExisting[sortedExisting.length - 1] > rangeEnd) {
        rangeEnd = sortedExisting[sortedExisting.length - 1];
      }
    }

    // 3. Generar todas las fechas calendario dentro del rango para identificar días laborables sin marcaje o incompletos
    const allDateSet = new Set<string>(existingDateKeys);

    try {
      const cur = new Date(rangeStart + 'T12:00:00');
      const end = new Date(rangeEnd + 'T12:00:00');
      const maxToday = new Date(todayStr + 'T12:00:00');

      while (cur <= end && cur <= maxToday) {
        const dStr = cur.toISOString().split('T')[0];
        const dayOfWeek = cur.getDay(); // 0 = Domingo

        const empStart = selectedEmpForAttendance.startDate ? selectedEmpForAttendance.startDate : null;
        const empTerm = selectedEmpForAttendance.terminationDate ? selectedEmpForAttendance.terminationDate : null;

        const isBeforeStart = empStart && dStr < empStart;
        const isAfterTerm = empTerm && dStr > empTerm;
        const isSunday = dayOfWeek === 0;
        const isHoliday = (settings.holidays || []).includes(dStr);
        const isApprovedVacation = (selectedEmpForAttendance.vacations || []).some(
          v => dStr >= v.startDate && dStr <= v.endDate
        );

        // Excluir días con permisos o libres registrados en la bitácora administrativa
        const dayObs = (selectedEmpForAttendance.observations || []).filter(o => o.date && o.date.startsWith(dStr));
        const isFullDayPermissionOrFree = dayObs.some(o => {
          const pType = (o.permissionType || '').toUpperCase();
          const r = (o.reason || '').toUpperCase();
          return pType === 'DIA LABORAL ENTERO' || pType === 'ENTERO' ||
            (pType === '' && (r.includes('PERMISO MATERNAL') || r.includes('PERMISO MEDICO') || r.includes('PERMISO PERSONAL') || r.includes('FALTA JUSTIFICADA'))) ||
            (typeof o.permissionHours === 'number' && o.permissionHours >= 8);
        });

        if (!isBeforeStart && !isAfterTerm && !isSunday && !isHoliday && !isApprovedVacation && !isFullDayPermissionOrFree) {
          allDateSet.add(dStr);
        }

        cur.setDate(cur.getDate() + 1);
      }
    } catch (e) {
      console.error("Error al calcular rango de fechas:", e);
    }

    const allDays = Array.from(allDateSet).sort((a, b) => a.localeCompare(b));

    return allDays.map(dateKey => {
      const dayRecs = (grouped[dateKey] || []).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
      const sampleTs = dayRecs[0]?.timestamp || `${dateKey}T12:00:00`;
      const dateFormatted = safeFormatDate(sampleTs);

      // Revisar si existe permiso o día libre en la bitácora para esta fecha
      const dayObs = (selectedEmpForAttendance.observations || []).filter(o => o.date && o.date.startsWith(dateKey));
      const fullDayPermObs = dayObs.find(o => {
        const pType = (o.permissionType || '').toUpperCase();
        const r = (o.reason || '').toUpperCase();
        return pType === 'DIA LABORAL ENTERO' || pType === 'ENTERO' ||
          (pType === '' && (r.includes('PERMISO MATERNAL') || r.includes('PERMISO MEDICO') || r.includes('PERMISO PERSONAL') || r.includes('FALTA JUSTIFICADA'))) ||
          (typeof o.permissionHours === 'number' && o.permissionHours >= 8);
      });

      const halfDayPermObs = dayObs.find(o => {
        const pType = (o.permissionType || '').toUpperCase();
        return pType.includes('MEDIA') || pType === 'MEDIA_AM' || pType === 'MEDIA_PM' || (typeof o.permissionHours === 'number' && o.permissionHours >= 4);
      });

      // Si no hay registros físicos en este día laborable
      if (dayRecs.length === 0) {
        if (fullDayPermObs) {
          return {
            dateKey,
            dateFormatted,
            records: [],
            in1: '--:--',
            out1: '--:--',
            in2: '--:--',
            out2: '--:--',
            isHalfDay: false,
            isPendingMarking: false,
            totalMinutes: 0,
            hoursFormatted: '0h 00m',
            decimalHours: 0,
            hasLate: false,
            statusLabel: 'PERMISO AUTORIZADO',
            justifications: `PERMISO AUTORIZADO • ${fullDayPermObs.reason || 'Día Libre Justificado'}`
          };
        }

        const novedad = dayObs[0];
        const obsText = novedad ? `BITÁCORA: ${novedad.reason || 'NOVEDAD'} - ${novedad.observation || novedad.text || ''}` : 'SIN REGISTRO DE MARCAJE';

        return {
          dateKey,
          dateFormatted,
          records: [],
          in1: '--:--',
          out1: '--:--',
          in2: '--:--',
          out2: '--:--',
          isHalfDay: false,
          isPendingMarking: true,
          totalMinutes: 0,
          hoursFormatted: '0h 00m',
          decimalHours: 0,
          hasLate: false,
          statusLabel: 'FECHA PENDIENTE',
          justifications: `⚠️ FECHA PENDIENTE DE MARCAJE (${obsText})`
        };
      }

      // Si existen registros físicos para esta fecha
      const inRecords = dayRecs.filter(r => r.type === 'in');
      const outRecords = dayRecs.filter(r => r.type === 'out');
      const isHalfDay = dayRecs.some(r => r.type === 'half_day') || !!halfDayPermObs;

      const in1 = inRecords[0] ? safeFormatTime(inRecords[0].timestamp) : '--:--';
      const out1 = outRecords[0] ? safeFormatTime(outRecords[0].timestamp) : '--:--';
      const in2 = inRecords[1] ? safeFormatTime(inRecords[1].timestamp) : '--:--';
      const out2 = outRecords[1] ? safeFormatTime(outRecords[1].timestamp) : (outRecords.length > 2 ? safeFormatTime(outRecords[outRecords.length - 1].timestamp) : '--:--');

      // Cálculo de horas trabajadas en el día
      let totalMinutes = 0;
      if (isHalfDay) {
        totalMinutes += 240; // 4 horas para media jornada
      }

      let lastIn: Date | null = null;
      dayRecs.forEach(r => {
        if (!r.timestamp) return;
        const d = new Date(r.timestamp);
        if (isNaN(d.getTime())) return;

        if (r.type === 'in') {
          lastIn = d;
        } else if (r.type === 'out' && lastIn) {
          const diffMs = d.getTime() - lastIn.getTime();
          if (diffMs > 0) {
            totalMinutes += Math.round(diffMs / (1000 * 60));
          }
          lastIn = null;
        }
      });

      const hoursInt = Math.floor(totalMinutes / 60);
      const minutesRem = totalMinutes % 60;
      const hoursFormatted = `${hoursInt}h ${minutesRem.toString().padStart(2, '0')}m`;
      const decimalHours = +(totalMinutes / 60).toFixed(2);

      const hasLate = dayRecs.some(r => r.isLate);
      const allConfirmed = dayRecs.every(r => r.status === 'confirmed');
      const hasPendingApproval = dayRecs.some(r => r.status === 'pending_approval');
      const justifications = dayRecs.map(r => r.justification).filter(Boolean).join(' | ');

      // Determinar si hay marcaje incompleto (sin tomar en consideración horas o días de permiso o libres)
      const dateObj = new Date(dateKey + 'T12:00:00');
      const dayOfWeek = isNaN(dateObj.getTime()) ? 1 : dateObj.getDay();
      const isSaturday = dayOfWeek === 6;

      let isIncomplete = false;
      if (!isHalfDay && !fullDayPermObs) {
        if (isSaturday) {
          isIncomplete = inRecords.length === 0 || outRecords.length === 0;
        } else {
          // Lunes a Viernes
          isIncomplete = inRecords.length === 0 || outRecords.length === 0 || inRecords.length < 2 || outRecords.length < 2;
        }
      }

      const isPendingMarking = !fullDayPermObs && (hasPendingApproval || isIncomplete);

      let statusLabel = 'CONFIRMADO';
      if (fullDayPermObs) {
        statusLabel = 'PERMISO AUTORIZADO';
      } else if (isIncomplete) {
        statusLabel = 'MARCAJE INCOMPLETO';
      } else if (hasPendingApproval) {
        statusLabel = 'PENDIENTE APROBACIÓN';
      } else if (!allConfirmed) {
        statusLabel = 'RECHAZADO';
      }

      let finalJustifications = justifications;
      if (isHalfDay) {
        finalJustifications = justifications ? `MEDIA JORNADA • ${justifications}` : 'MEDIA JORNADA LIBRE';
      } else if (isIncomplete) {
        finalJustifications = justifications
          ? `⚠️ MARCAJE INCOMPLETO • ${justifications}`
          : `⚠️ MARCAJE INCOMPLETO (Faltan marcajes de entrada o salida)`;
      } else if (!finalJustifications) {
        finalJustifications = 'Jornada Ordinaria Completa';
      }

      return {
        dateKey,
        dateFormatted,
        records: dayRecs,
        in1,
        out1,
        in2,
        out2,
        isHalfDay,
        isPendingMarking,
        totalMinutes,
        hoursFormatted,
        decimalHours,
        hasLate,
        statusLabel,
        justifications: finalJustifications
      };
    });
  }, [selectedEmpForAttendance, individualAttendanceRecords, startDate, endDate, settings]);

  // Total acumulado de horas trabajadas para el reporte individual
  const totalAccumulatedMinutes: number = useMemo(() => {
    return individualDailyRecords.reduce((acc: number, d: DailyAttendanceSummary) => acc + (d.totalMinutes || 0), 0);
  }, [individualDailyRecords]);

  const totalAccumulatedHoursFormatted = useMemo(() => {
    const h = Math.floor(totalAccumulatedMinutes / 60);
    const m = totalAccumulatedMinutes % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }, [totalAccumulatedMinutes]);

  const individualStats = useMemo(() => {
    const pendingDays = individualDailyRecords.filter(d => d.isPendingMarking).length;
    const registeredDays = individualDailyRecords.filter(d => d.records.length > 0).length;

    return {
      total: individualAttendanceRecords.length,
      confirmed: individualAttendanceRecords.filter(a => a.status === 'confirmed').length,
      lates: individualAttendanceRecords.filter(a => a.isLate).length,
      justified: individualAttendanceRecords.filter(a => a.justification).length,
      totalWorkedHoursFormatted: totalAccumulatedHoursFormatted,
      totalDaysWorked: registeredDays,
      pendingDays: pendingDays
    };
  }, [individualAttendanceRecords, totalAccumulatedHoursFormatted, individualDailyRecords]);

  const filteredEmployeesForSelect = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const term = searchTerm.toLowerCase();
    return employees.filter(emp =>
      `${emp.surname || ''} ${emp.name || ''} ${emp.identification || ''}`.toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);

  const handleOpenEditModal = (day: DailyAttendanceSummary) => {
    const inRecords = (day.records || []).filter(r => r.type === 'in');
    const outRecords = (day.records || []).filter(r => r.type === 'out');

    const schedIn1 = settings?.schedule?.monFri?.in1 || '08:30';
    const schedOut1 = settings?.schedule?.monFri?.out1 || '13:00';
    const schedIn2 = settings?.schedule?.monFri?.in2 || '15:00';
    const schedOut2 = settings?.schedule?.monFri?.out2 || '18:00';

    const in1Time = inRecords[0] ? extract24HourTime(inRecords[0].timestamp, schedIn1) : (day.in1 !== '--:--' ? day.in1 : schedIn1);
    const out1Time = outRecords[0] ? extract24HourTime(outRecords[0].timestamp, schedOut1) : (day.out1 !== '--:--' ? day.out1 : schedOut1);
    const in2Time = inRecords[1] ? extract24HourTime(inRecords[1].timestamp, schedIn2) : (day.in2 !== '--:--' ? day.in2 : schedIn2);
    const out2Time = outRecords[1] ? extract24HourTime(outRecords[1].timestamp, schedOut2) : (day.out2 !== '--:--' ? day.out2 : schedOut2);

    const hasRecords = (day.records || []).length > 0;
    const isPending = !!day.isPendingMarking;
    const isFullDayLeave = day.statusLabel === 'PERMISO AUTORIZADO';

    setEditDayModal({
      isOpen: true,
      dateKey: day.dateKey,
      dateFormatted: day.dateFormatted,
      isHalfDay: day.isHalfDay,
      isFullDayLeave: isFullDayLeave,
      leaveReason: isFullDayLeave ? (day.justifications || 'PERMISO PERSONAL AUTORIZADO') : 'PERMISO PERSONAL AUTORIZADO',
      in1Enabled: !isFullDayLeave && (hasRecords ? day.in1 !== '--:--' : true),
      in1Time,
      in1Late: inRecords[0]?.isLate || false,
      out1Enabled: !isFullDayLeave && (hasRecords ? day.out1 !== '--:--' : true),
      out1Time,
      in2Enabled: !isFullDayLeave && !day.isHalfDay && (hasRecords ? day.in2 !== '--:--' : true),
      in2Time,
      in2Late: inRecords[1]?.isLate || false,
      out2Enabled: !isFullDayLeave && !day.isHalfDay && (hasRecords ? day.out2 !== '--:--' : true),
      out2Time,
      justification: isPending ? 'REGULARIZACIÓN ADMINISTRATIVA DE FECHA PENDIENTE' : 'CORRECCIÓN ADMINISTRATIVA DE HORARIO',
      observationNote: day.justifications && !day.justifications.includes('Jornada Ordinaria') ? day.justifications : '',
      isPendingOriginal: isPending
    });
  };

  const handleSaveEditDay = () => {
    if (!selectedEmpForAttendance) return;
    if (!onUpdateAttendance) {
      setFeedback({
        isOpen: true,
        title: "Operación no disponible",
        message: "No se encuentra disponible la función de actualización de asistencia.",
        type: "error"
      });
      return;
    }

    const { dateKey, dateFormatted, isHalfDay, isFullDayLeave, leaveReason, in1Enabled, in1Time, in1Late, out1Enabled, out1Time, in2Enabled, in2Time, in2Late, out2Enabled, out2Time, justification, observationNote } = editDayModal;

    if (!isFullDayLeave && !in1Enabled && !out1Enabled && !in2Enabled && !out2Enabled) {
      setFeedback({
        isOpen: true,
        title: "Atención Requerida",
        message: "Debe habilitar al menos una marcación (ingreso o salida) o marcar la jornada como permiso/día libre.",
        type: "error"
      });
      return;
    }

    requestConfirmation(
      "Guardar y Actualizar Marcaciones",
      `¿Está seguro de guardar y regularizar las marcaciones del día ${dateFormatted} (${dateKey}) para el colaborador ${selectedEmpForAttendance.surname} ${selectedEmpForAttendance.name}? Los cambios se aplicarán inmediatamente en la base de datos y se actualizará el reporte.`,
      () => {
        const empId = selectedEmpForAttendance.id;

        // 1. Filtrar los registros existentes de este día para el colaborador
        const otherAttendance = (attendance || []).filter(a => {
          if (!a) return false;
          if (a.employeeId !== empId) return true;
          const ts = a.timestamp || '';
          return !ts.startsWith(dateKey);
        });

        const newRecords: AttendanceRecord[] = [];
        const finalJustif = justification.trim() || 'REGULARIZACIÓN ADMINISTRATIVA';

        if (!isFullDayLeave) {
          if (isHalfDay) {
            // Media jornada
            if (in1Enabled && in1Time) {
              newRecords.push({
                id: Math.random().toString(36).substr(2, 9),
                employeeId: empId,
                timestamp: `${dateKey}T${in1Time}:00`,
                type: 'in',
                status: 'confirmed',
                isLate: in1Late,
                justification: finalJustif
              });
            }
            if (out1Enabled && out1Time) {
              newRecords.push({
                id: Math.random().toString(36).substr(2, 9),
                employeeId: empId,
                timestamp: `${dateKey}T${out1Time}:00`,
                type: 'out',
                status: 'confirmed',
                isLate: false,
                justification: finalJustif
              });
            }
            // Registro marcador de media jornada
            newRecords.push({
              id: Math.random().toString(36).substr(2, 9),
              employeeId: empId,
              timestamp: `${dateKey}T12:00:00`,
              type: 'half_day',
              status: 'confirmed',
              isLate: false,
              justification: `MEDIA JORNADA • ${finalJustif}`
            });
          } else {
            // Jornada completa
            if (in1Enabled && in1Time) {
              newRecords.push({
                id: Math.random().toString(36).substr(2, 9),
                employeeId: empId,
                timestamp: `${dateKey}T${in1Time}:00`,
                type: 'in',
                status: 'confirmed',
                isLate: in1Late,
                justification: finalJustif
              });
            }
            if (out1Enabled && out1Time) {
              newRecords.push({
                id: Math.random().toString(36).substr(2, 9),
                employeeId: empId,
                timestamp: `${dateKey}T${out1Time}:00`,
                type: 'out',
                status: 'confirmed',
                isLate: false,
                justification: finalJustif
              });
            }
            if (in2Enabled && in2Time) {
              newRecords.push({
                id: Math.random().toString(36).substr(2, 9),
                employeeId: empId,
                timestamp: `${dateKey}T${in2Time}:00`,
                type: 'in',
                status: 'confirmed',
                isLate: in2Late,
                justification: finalJustif
              });
            }
            if (out2Enabled && out2Time) {
              newRecords.push({
                id: Math.random().toString(36).substr(2, 9),
                employeeId: empId,
                timestamp: `${dateKey}T${out2Time}:00`,
                type: 'out',
                status: 'confirmed',
                isLate: false,
                justification: finalJustif
              });
            }
          }
        }

        // 2. Persistir marcaciones actualizadas
        const updatedAttendance = [...otherAttendance, ...newRecords];
        onUpdateAttendance(updatedAttendance);

        // 3. Si se registró permiso de día entero o una observación adicional, actualizar expediente del empleado
        if (onUpdateEmployees && (isFullDayLeave || observationNote.trim())) {
          const obsReason = isFullDayLeave ? leaveReason : finalJustif;
          const obsDetails = observationNote.trim() || (isFullDayLeave ? 'Día de permiso justificado por administración' : 'Modificación de marcajes en reporte');

          const newObservation = {
            date: `${dateKey}T12:00:00`,
            text: `[REGULARIZACIÓN / MODIFICACIÓN REPORTE]: ${obsReason} - ${obsDetails}`,
            reason: obsReason,
            permissionType: isFullDayLeave ? 'DIA LABORAL ENTERO' : (isHalfDay ? 'MEDIA JORNADA' : undefined),
            observation: obsDetails
          };

          const updatedEmployees = employees.map(e => {
            if (e.id !== empId) return e;
            const existingObs = e.observations || [];
            const filteredObs = existingObs.filter(o => !(o.date && o.date.startsWith(dateKey) && o.text && o.text.includes('REGULARIZACIÓN')));
            return {
              ...e,
              observations: [newObservation, ...filteredObs],
              regularizationApprovedNotice: {
                id: `reg_app_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                seen: false,
                approvedAt: new Date().toISOString(),
                count: newRecords.length,
                message: `La administración ha corregido y regularizado sus marcaciones de la fecha ${dateFormatted}.`
              }
            };
          });

          onUpdateEmployees(updatedEmployees);
        }

        setEditDayModal(prev => ({ ...prev, isOpen: false }));
        setFeedback({
          isOpen: true,
          title: "Marcaciones Guardadas y Reporte Actualizado",
          message: `Se han guardado las correcciones del día ${dateFormatted}. El reporte individual de asistencia ha sido recalculado en pantalla con el nuevo cómputo de horas laboradas.`,
          type: "success"
        });
      },
      'warning',
      'Sí, Guardar y Actualizar'
    );
  };

  const generateIndividualAttendanceExcel = (targetEmp?: any) => {
    const emp = (targetEmp && targetEmp.id) ? targetEmp : selectedEmpForAttendance;
    if (!emp) return;
    requestConfirmation(
      "Descargar Asistencia Individual en Excel",
      `¿Está seguro de descargar el registro oficial de asistencia y cómputo de horas de ${emp.surname || ''} ${emp.name || ''} en formato Excel?`,
      () => {
        let csv = "\uFEFF";
        csv += "sep=;\r\n";
        csv += `================================================================================================================================\r\n`;
        csv += `"REPORTE OFICIAL INDIVIDUAL DE ASISTENCIA, CONTROL BIOMÉTRICO Y REGISTRO DE HORAS LABORADAS"\r\n`;
        csv += `"SISTEMA DE GESTIÓN Y AUDITORÍA DE TALENTO HUMANO - ASIST UP"\r\n`;
        csv += `================================================================================================================================\r\n\r\n`;

        csv += `"1. DATOS INSTITUCIONALES";"";"2. INFORMACIÓN DEL COLABORADOR";"";"3. PARÁMETROS DEL REPORTE"\r\n`;
        csv += `"Razón Social / Empresa:";"${(company?.name || 'EMPRESA INSTITUCIONAL').replace(/"/g, '""')}";"Apellidos y Nombres:";"${(emp.surname || '').replace(/"/g, '""')} ${(emp.name || '').replace(/"/g, '""')}";"Período Evaluado:";"${startDate || 'HISTÓRICO'} AL ${endDate || 'ACTUALIDAD'}"\r\n`;
        csv += `"R.U.C. Institucional:";"${company?.ruc || '1790000000001'}";"Cédula / Identificación:";"${emp.identification || ''}";"Fecha de Emisión:";"${new Date().toLocaleString('es-EC')}"\r\n`;
        csv += `"Dirección:";"${(company?.address || 'QUITO, ECUADOR').replace(/"/g, '""')}";"Cargo / Función:";"${(emp.role || 'General').replace(/"/g, '""')}";"Modalidad Contractual:";"${emp.isFixed ? 'Trabajador Fijo' : 'Trabajador Temporal'}"\r\n`;
        csv += `"Representante Legal:";"${(company?.legalRep || 'Gerencia General').replace(/"/g, '""')}";"Departamento / Origen:";"${(emp.origin || 'Operaciones').replace(/"/g, '""')}";"Estado Laboral:";"${emp.status === 'active' ? 'ACTIVO' : 'DESVINCULADO'}"\r\n\r\n`;

        csv += `"4. CÓMPUTO GLOBAL Y ESTADÍSTICAS DEL PERÍODO"\r\n`;
        csv += `"TOTAL HORAS TRABAJADAS";"JORNADAS REGISTRADAS";"FECHAS CON MARCAJES PENDIENTES";"MARCAJES PUNTUALES";"ATRASOS REGISTRADOS";"TOTAL MARCACIONES FÍSICAS"\r\n`;
        csv += `"${totalAccumulatedHoursFormatted}";"${individualStats.totalDaysWorked} días cumplidos";"${individualStats.pendingDays} fechas pendientes";"${individualStats.confirmed} puntuales";"${individualStats.lates} atrasos";"${individualStats.total} marcaciones"\r\n\r\n`;

        csv += `"5. DETALLE DIARIO CRONOLÓGICO DE MARCACIONES Y NOVEDADES"\r\n`;
        csv += `"N°";"FECHA (AAAA-MM-DD)";"DÍA DE LA SEMANA";"MODALIDAD JORNADA";"INGRESO 1 (MAÑANA)";"SALIDA 1 (ALMUERZO)";"INGRESO 2 (TARDE)";"SALIDA 2 (FINAL)";"TOTAL HORAS LABORADAS";"ESTADO PUNTUALIDAD";"ESTADO REGISTRO";"OBSERVACIONES / REGULARIZACIONES ADMINISTRATIVAS"\r\n`;

        individualDailyRecords.forEach((d, idx) => {
          const dateObj = new Date(d.dateKey + 'T12:00:00');
          const diaSemana = isNaN(dateObj.getTime()) ? '' : ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'][dateObj.getDay()];
          const tipoJornada = d.isHalfDay ? 'MEDIA JORNADA' : (d.statusLabel === 'PERMISO AUTORIZADO' ? 'PERMISO AUTORIZADO' : 'JORNADA COMPLETA');
          const puntualidad = d.isPendingMarking ? 'PENDIENTE' : (d.hasLate ? 'CON ATRASO' : (d.records.length > 0 ? 'PUNTUAL' : 'NO APLICA'));
          const justif = (d.justifications || '').replace(/"/g, '""');

          csv += `"${idx + 1}";"${d.dateKey}";"${diaSemana}";"${tipoJornada}";"${d.in1}";"${d.out1}";"${d.in2}";"${d.out2}";"${d.hoursFormatted}";"${puntualidad}";"${d.statusLabel}";"${justif}"\r\n`;
        });

        csv += `\r\n`;
        csv += `"";"TOTAL GENERAL ACUMULADO:";"";"";"";"";"";"SUMATORIA TOTAL:";"${totalAccumulatedHoursFormatted}";"";"${individualStats.totalDaysWorked} Jornadas Registradas";"${individualStats.pendingDays > 0 ? `${individualStats.pendingDays} Fechas Pendientes de Marcaje` : 'Marcaciones al Día'}"\r\n\r\n`;

        csv += `"6. CONSTANCIA INSTITUCIONAL Y RESPONSABILIDAD LABORAL"\r\n`;
        csv += `"El presente registro constituye documento oficial de control de asistencia y cómputo de horas laboradas, elaborado en estricto cumplimiento a la normativa del Código del Trabajo de la República del Ecuador."\r\n\r\n`;

        csv += `"";"FIRMA DEL COLABORADOR";"";"";"CONTROL DE TALENTO HUMANO";"";"";"REPRESENTANTE LEGAL"\r\n`;
        csv += `"";"${(emp.surname || '').replace(/"/g, '""')} ${(emp.name || '').replace(/"/g, '""')}";"";"";"Departamento de Personal";"";"";"${(company?.legalRep || 'Gerencia General').replace(/"/g, '""')}"\r\n`;
        csv += `"";"C.I.: ${emp.identification || ''}";"";"";"ASIST UP Management Suite";"";"";"R.U.C.: ${company?.ruc || ''}"\r\n`;

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const safeSurname = (emp.surname || 'COLABORADOR').replace(/\s+/g, '_');
        const safeName = (emp.name || '').replace(/\s+/g, '_');
        link.download = `REPORTE_ASISTENCIA_${safeSurname}_${safeName}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
      },
      'info',
      'Descargar Excel'
    );
  };

  const handlePrintIndividualAttendance = (targetEmp?: any) => {
    const emp = (targetEmp && targetEmp.id) ? targetEmp : selectedEmpForAttendance;
    if (!emp) return;
    requestConfirmation(
      "Imprimir Registro Individual de Asistencia (A4 Horizontal)",
      `¿Está seguro de generar e imprimir el registro oficial de asistencia en orientación horizontal (A4) para ${emp.surname || ''} ${emp.name || ''}?`,
      () => {
        setIsPrinting(true);
      },
      'info',
      'Imprimir Asistencia'
    );
  };

  const attendanceToDisplay = (attendance || []).filter(a => {
    if (!a) return false;
    const emp = employees.find(e => e.id === a.employeeId);
    const matchesSearch = `${emp?.surname || ''} ${emp?.name || ''} ${emp?.identification || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && filterByDate(a.timestamp);
  }).sort((a, b) => {
    const empA = employees.find(e => e.id === a.employeeId);
    const empB = employees.find(e => e.id === b.employeeId);
    const nameA = `${empA?.surname || ''} ${empA?.name || ''}`.toLowerCase();
    const nameB = `${empB?.surname || ''} ${empB?.name || ''}`.toLowerCase();

    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return (a.timestamp || '').localeCompare(b.timestamp || '');
  });

  const paymentsToDisplay = payments.filter(p => {
    const emp = employees.find(e => e.id === p.employeeId);
    const matchesSearch = `${emp?.surname} ${emp?.name} ${p.voucherCode}`.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && filterByDate(p.date);
  }).sort((a,b) => b.date.localeCompare(a.date));

  const historyToDisplay = employees.filter(e => {
    const searchStr = `${e.name} ${e.surname} ${e.identification} ${e.status}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
    return matchesSearch && (reportType === 'bajas' ? filterByDate(e.terminationDate || '') : filterByDate(e.startDate));
  }).sort((a,b) => b.startDate.localeCompare(a.startDate));

  const translateAttendanceStatus = (record: AttendanceRecord) => {
    let base = "";
    if (record.type === 'in') base = record.status === 'confirmed' ? "INGRESO APROBADO" : record.status === 'pending_approval' ? "INGRESO PENDIENTE" : "INGRESO RECHAZADO";
    else if (record.type === 'out') base = record.status === 'confirmed' ? "SALIDA APROBADA" : record.status === 'pending_approval' ? "SALIDA PENDIENTE" : "SALIDA RECHAZADA";
    else if (record.type === 'half_day') base = "MEDIA JORNADA LIBRE";

    return (
      <span className="flex flex-col items-end">
        <span>{base}</span>
        {record.isLate && <span className="text-[8px] font-black lowercase opacity-60">(atraso)</span>}
      </span>
    );
  };

  const renderTableRows = () => {
    switch (reportType) {
      case 'saved_payroll':
        return savedReports
          .filter(r => {
            const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesMonth = !filterMonth || r.month === filterMonth;
            // Si el reporte no tiene año (reportes antiguos), lo mostramos si el filtro de año está vacío
            const matchesYear = !filterYear || r.year === filterYear || (!r.year && filterYear === '');
            return matchesSearch && matchesMonth && matchesYear;
          })
          .sort((a, b) => b.date.localeCompare(a.date)).map(r => (
          <tr key={r.id}>
            <td className="p-5">
              <p className="text-slate-900 font-black">{r.name}</p>
              <p className="text-[9px] text-slate-400">{new Date(r.date).toLocaleString()}</p>
            </td>
            <td className="p-5">Nómina Generada</td>
            <td className="p-5 text-right">
              <button
                onClick={() => {
                  const blob = new Blob([r.content], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(blob);
                  link.download = `${r.name}.csv`;
                  link.click();
                }}
                className="px-4 py-2 bg-emerald-600 text-white text-[9px] font-black rounded-lg uppercase shadow-md active:scale-95"
              >
                Descargar
              </button>
            </td>
          </tr>
        ));
      case 'attendance':
        return attendanceToDisplay.map(a => {
          const emp = employees.find(e => e.id === a.employeeId);
          return (
            <tr key={a.id} className="hover:bg-blue-50/20 transition-colors">
              <td className="p-5">{safeFormatDateTime(a.timestamp)}</td>
              <td className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <span>{emp?.surname || ''} {emp?.name || ''}</span>
                  {emp && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmployeeIdForAttendance(emp.id);
                        setReportType('attendance');
                      }}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[8px] font-black rounded-lg uppercase transition-all shadow-sm no-print cursor-pointer shrink-0"
                      title="Ver e imprimir registro individual de asistencia"
                    >
                      🕒 Asistencia Indiv.
                    </button>
                  )}
                </div>
              </td>
              <td className="p-5 text-right font-black">{translateAttendanceStatus(a)}</td>
            </tr>
          );
        });
      case 'payments':
      case 'payroll':
        return paymentsToDisplay.map(p => (
          <tr key={p.id}>
            <td className="p-5"><p className="text-blue-600">{p.voucherCode}</p><p className="text-[9px] text-slate-400">{safeFormatDate(p.date)}</p></td>
            <td className="p-5">{employees.find(e => e.id === p.employeeId)?.surname || ''}</td>
            <td className="p-5 text-right font-[950] text-emerald-700">${p.amount.toFixed(2)}</td>
          </tr>
        ));
      case 'history':
      case 'employees':
        return historyToDisplay.map(e => (
          <tr key={e.id} className="hover:bg-blue-50/20 transition-colors">
            <td className="p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-slate-900 font-black">{e.surname} {e.name}</p>
                  <p className="text-[9px] text-slate-400">CI: {e.identification}</p>
                </div>
                <div className="flex items-center gap-1.5 no-print">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmployeeIdForAttendance(e.id);
                      setReportType('attendance');
                    }}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[8px] font-black rounded-lg uppercase transition-all shadow-sm border border-blue-200 cursor-pointer flex items-center gap-1 shrink-0"
                    title="Ver Asistencia Individual del Colaborador"
                  >
                    <span>🕒</span>
                    <span>Asistencia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEmpForFicha(e)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[8px] font-black rounded-lg uppercase transition-all shadow-sm border border-indigo-200 cursor-pointer flex items-center gap-1 shrink-0"
                    title="Visualizar e Imprimir Ficha Individual A4"
                  >
                    <span>📋</span>
                    <span>Ficha A4</span>
                  </button>
                </div>
              </div>
            </td>
            <td className="p-5">{e.role}</td>
            <td className={`p-5 text-right font-[950] ${e.status === 'active' ? 'text-emerald-600' : 'text-red-500'}`}>{e.status}</td>
          </tr>
        ));
      case 'novedades':
        const novedades = employees.flatMap(e => e.observations?.map(obs => ({ emp: e, obs })) || []).filter(item => filterByDate(item.obs.date));
        return novedades.map((item, idx) => (
          <tr key={idx}>
            <td className="p-5">{new Date(item.obs.date).toLocaleString()}</td>
            <td className="p-5">{item.emp.surname} {item.emp.name}</td>
            <td className="p-5 text-right font-black italic">{item.obs.text}</td>
          </tr>
        ));
      case 'bajas':
        const bajas = employees.filter(e => e.status === 'terminated' && filterByDate(e.terminationDate || ''));
        return bajas.map(e => (
          <tr key={e.id}>
            <td className="p-5">{e.terminationDate}</td>
            <td className="p-5">{e.surname} {e.name}</td>
            <td className="p-5 text-right font-black text-red-600">{e.terminationReason} <span className="text-[9px] opacity-60">({e.terminationDetails})</span></td>
          </tr>
        ));
      default:
        return null;
    }
  };

  const getReportHeaderTitle = () => {
    switch(reportType) {
      case 'saved_payroll': return 'NÓMINAS GUARDADAS (HISTORIAL)';
      case 'employees': return 'CENSO DE PERSONAL MAESTRO';
      case 'payroll': return 'REGISTRO DE PAGOS DE NÓMINA';
      case 'novedades': return 'HISTORIAL DE NOVEDADES ADMINISTRATIVAS';
      case 'bajas': return 'EXPEDIENTES DE DESVINCULACIONES';
      case 'attendance': return 'BITÁCORA DE ASISTENCIA Y PUNTUALIDAD';
      case 'payments': return 'HISTORIAL DE EGRESOS Y PAGOS';
      case 'history': return 'EXPEDIENTES DE PERSONAL ACTIVO';
      default: return `REPORTE DE ${reportType.toUpperCase()}`;
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 fade-in">
      <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border no-print flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="shrink-0">
           <h2 className="text-2xl font-[950] text-slate-900 uppercase italic">Centro de Reportes Maestro</h2>
           <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">Auditoría y Gestión de Datos Corporativos</p>
        </div>
        <div className="flex flex-col gap-4 w-full md:w-auto">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {['attendance', 'payments', 'history', 'saved_payroll', 'master'].map(t => (
              <button key={t} onClick={() => {setReportType(t as any); setSearchTerm(''); setStartDate(''); setEndDate(''); setFilterMonth(''); setFilterYear(new Date().getFullYear().toString());}} className={`whitespace-nowrap px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${reportType === t ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border'}`}>
                {t === 'attendance' ? 'Asistencia' : t === 'payments' ? 'Pagos' : t === 'history' ? 'Historial' : t === 'saved_payroll' ? 'Nóminas Guardadas' : 'Archivo Maestro'}
              </button>
            ))}
          </div>

          {reportType !== 'master' && (
            <div className="flex flex-col gap-2 w-full">
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <input
                  type="text"
                  placeholder="Filtrar por nombre o CI..."
                  className="flex-1 min-w-[200px] p-3 border-2 rounded-xl text-[11px] font-bold uppercase outline-none focus:border-blue-500"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />

                {reportType === 'attendance' && (
                  <div className="flex gap-2 items-center flex-wrap">
                    <div className="flex flex-col gap-1">
                      <label className="text-[7px] font-black uppercase text-slate-400">Colaborador Individual</label>
                      <select
                        className="p-3 border-2 rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-500 bg-white"
                        value={selectedEmployeeIdForAttendance}
                        onChange={e => {
                          setSelectedEmployeeIdForAttendance(e.target.value);
                          setReportType('attendance');
                        }}
                      >
                        <option value="">-- TODOS LOS COLABORADORES ({employees.length}) --</option>
                        {filteredEmployeesForSelect.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.surname} {emp.name} ({emp.identification})
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedEmpForAttendance && (
                      <div className="flex gap-1.5 self-end">
                        <button
                          onClick={() => handlePrintIndividualAttendance()}
                          title="Imprimir Registro Individual A4"
                          className="p-3 bg-slate-900 text-white rounded-xl shadow-md active:scale-95 transition-all text-[10px] font-black uppercase flex items-center gap-1"
                        >
                          <span>🖨️</span> Imprimir A4
                        </button>
                        <button
                          onClick={() => generateIndividualAttendanceExcel()}
                          title="Descargar Excel Individual"
                          className="p-3 bg-emerald-700 text-white rounded-xl shadow-md active:scale-95 transition-all text-[10px] font-black uppercase flex items-center gap-1"
                        >
                          <span>📗</span> Excel
                        </button>
                        <button
                          onClick={() => setSelectedEmployeeIdForAttendance('')}
                          title="Ver todos"
                          className="p-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors text-[10px] font-black uppercase"
                        >
                          ✕ Ver Todos
                        </button>
                      </div>
                    )}
                  </div>
                )}

              {reportType === 'saved_payroll' && (
                <div className="flex gap-2">
                  <select
                    className="p-3 border-2 rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-500"
                    value={filterMonth}
                    onChange={e => setFilterMonth(e.target.value)}
                  >
                    <option value="">TODOS LOS MESES</option>
                    {['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    className="p-3 border-2 rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-500"
                    value={filterYear}
                    onChange={e => setFilterYear(e.target.value)}
                  >
                    <option value="">TODOS LOS AÑOS</option>
                    {['2024', '2025', '2026', '2027'].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              {reportType !== 'saved_payroll' && (
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[7px] font-black uppercase text-slate-400">Desde</label>
                    <input type="date" className="p-3 border-2 rounded-xl text-[10px] font-black uppercase outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[7px] font-black uppercase text-slate-400">Hasta</label>
                    <input type="date" className="p-3 border-2 rounded-xl text-[10px] font-black uppercase outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="flex gap-1 items-end">
                {reportType !== 'saved_payroll' && (
                  <>
                    <button onClick={() => generateReportExcel(reportType)} title="Excel" className="p-3 bg-emerald-600 text-white rounded-xl shadow-md active:scale-95 transition-all text-[10px] font-black uppercase">XLS</button>
                    <button onClick={() => generateReportPDF(reportType)} title="PDF" className="p-3 bg-blue-700 text-white rounded-xl shadow-md active:scale-95 transition-all text-[10px] font-black uppercase">PDF</button>
                  </>
                )}
                <button onClick={() => {setStartDate(''); setEndDate(''); setSearchTerm(''); setFilterMonth(''); setFilterYear(new Date().getFullYear().toString()); setSelectedEmployeeIdForAttendance(''); setReportType('master');}} className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors">✕</button>
              </div>
            </div>

            {/* CHIPS RÁPIDOS DE COINCIDENCIAS CUANDO SE FILTRA UN COLABORADOR */}
            {searchTerm.trim() && filteredEmployeesForSelect.length > 0 && filteredEmployeesForSelect.length <= 6 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 w-full no-print">
                <span className="text-[8px] font-black uppercase text-blue-600">Coincidencias encontradas:</span>
                {filteredEmployeesForSelect.map(emp => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setSelectedEmployeeIdForAttendance(emp.id);
                      setReportType('attendance');
                    }}
                    className={`px-2.5 py-1 text-[9px] font-black rounded-lg uppercase transition-all flex items-center gap-1 cursor-pointer border shadow-xs ${selectedEmployeeIdForAttendance === emp.id ? 'bg-blue-600 text-white border-blue-700' : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200'}`}
                  >
                    <span>👤 {emp.surname} {emp.name}</span>
                    <span className="text-[7px] font-mono opacity-80">({emp.identification})</span>
                    <span className="text-[7px] bg-black/20 px-1 rounded font-bold">Ver Asistencia</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* BANNER INFORMATIVO CUANDO HAY UN COLABORADOR SELECCIONADO EN ASISTENCIA */}
      {reportType === 'attendance' && selectedEmpForAttendance && (
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 rounded-[2rem] p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 no-print">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-3xl font-black border border-white/20">
              🕒
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest bg-blue-500/40 text-blue-200 px-3 py-1 rounded-full border border-blue-400/30">
                Registro Individual de Asistencia
              </span>
              <h3 className="text-xl font-black uppercase mt-1">
                {selectedEmpForAttendance.surname} {selectedEmpForAttendance.name}
              </h3>
              <p className="text-[11px] text-blue-200/80 font-bold uppercase tracking-wider">
                C.I.: {selectedEmpForAttendance.identification} &bull; Cargo: {selectedEmpForAttendance.role || "General"} &bull; Dpto: {selectedEmpForAttendance.origin || "Operaciones"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-center border border-white/10">
              <span className="text-[8px] font-black uppercase text-blue-200 block">Horas Laboradas</span>
              <span className="text-lg font-black text-white">{individualStats.totalWorkedHoursFormatted}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-center border border-white/10">
              <span className="text-[8px] font-black uppercase text-blue-200 block">Días / Marcaciones</span>
              <span className="text-lg font-black">{individualStats.totalDaysWorked}d / {individualStats.total}m</span>
            </div>
            {individualStats.pendingDays > 0 && (
              <div className="bg-amber-500/20 backdrop-blur-md px-4 py-2 rounded-xl text-center border border-amber-400/40">
                <span className="text-[8px] font-black uppercase text-amber-300 block">Fechas Pendientes</span>
                <span className="text-lg font-black text-amber-300">{individualStats.pendingDays}</span>
              </div>
            )}
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-center border border-white/10">
              <span className="text-[8px] font-black uppercase text-emerald-300 block">Puntuales</span>
              <span className="text-lg font-black text-emerald-300">{individualStats.confirmed}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-center border border-white/10">
              <span className="text-[8px] font-black uppercase text-amber-300 block">Atrasos</span>
              <span className="text-lg font-black text-amber-300">{individualStats.lates}</span>
            </div>
            <button
              onClick={() => handlePrintIndividualAttendance()}
              className="px-5 py-3 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg hover:bg-slate-100 active:scale-95 transition-all flex items-center gap-2"
            >
              <span>🖨️</span> Imprimir Registro A4
            </button>
            <button
              onClick={() => generateIndividualAttendanceExcel()}
              className="px-5 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex items-center gap-2"
            >
              <span>📗</span> Excel (.XLS)
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden" id="reports-printable-area">
         {/* CABECERA ESTRICTA PARA IMPRESIÓN */}
         <div className="hidden print:block p-10 border-b-4 border-black text-center space-y-4">
            <div className="flex items-center justify-center gap-6">
               <div className="w-20 h-20 border-2 border-black flex items-center justify-center overflow-hidden">
                  {company?.logo ? <img src={company.logo} className="w-full h-full object-contain" /> : <span className="text-2xl font-black">LOGO</span>}
               </div>
               <div className="text-left">
                  <h1 className="text-3xl font-[950] uppercase italic leading-none">{company?.name || 'EMPRESA INSTITUCIONAL'}</h1>
                  <p className="text-sm font-black uppercase mt-1">RUC: {company?.ruc || '0000000000001'}</p>
                  <p className="text-[10px] font-bold uppercase tracking-tighter">{company?.address || 'QUITO, ECUADOR'}</p>
               </div>
            </div>
            <div className="pt-4 border-t-2 border-black/10">
               <p className="text-[12px] font-[950] uppercase tracking-[0.3em]">
                 {reportType === 'attendance' && selectedEmpForAttendance
                   ? 'REGISTRO INDIVIDUAL OFICIAL DE ASISTENCIA Y PUNTUALIDAD'
                   : getReportHeaderTitle()}
               </p>
               {reportType === 'attendance' && selectedEmpForAttendance && (
                 <div className="mt-2 text-left bg-slate-50 p-4 border border-black/20 grid grid-cols-2 gap-2 text-[10px] font-bold">
                   <p><span className="font-black">COLABORADOR:</span> {selectedEmpForAttendance.surname} {selectedEmpForAttendance.name}</p>
                   <p><span className="font-black">CÉDULA:</span> {selectedEmpForAttendance.identification}</p>
                   <p><span className="font-black">CARGO:</span> {selectedEmpForAttendance.role || "General"}</p>
                   <p><span className="font-black">MODALIDAD:</span> {selectedEmpForAttendance.isFixed ? 'Fijo' : 'Temporal'}</p>
                 </div>
               )}
               {startDate || endDate ? (
                 <p className="text-[10px] font-black uppercase mt-1">Período: {startDate || 'Inicio'} al {endDate || 'Hoy'}</p>
               ) : null}
               {searchTerm && <p className="text-[9px] font-black uppercase italic">Filtro aplicado: "{searchTerm}"</p>}
               <p className="text-[8px] font-bold uppercase opacity-60">Documento Generado el {new Date().toLocaleString()}</p>
            </div>
         </div>

         {reportType === 'master' ? (
           <div className="p-10 md:p-16 space-y-12 no-print text-center">
              <header className="border-b pb-8">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-widest">Gestión de Archivo Maestro</h3>
                <p className="text-[11px] font-black text-blue-600 uppercase mt-2 tracking-widest italic leading-relaxed">Consolidado integral para cumplimiento legal y auditorías externas de talento humano</p>
              </header>

              {/* SECCION ESPECIAL: FICHAS INDIVIDUALES DE PERSONAL (EXPEDIENTE OFICIAL A4) */}
              <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-8 rounded-[2.5rem] shadow-2xl text-left border border-blue-900">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-white/10">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest bg-blue-500/30 text-blue-300 px-3 py-1 rounded-full border border-blue-400/20">
                      Archivo Maestro Oficial
                    </span>
                    <h4 className="text-2xl font-black uppercase tracking-wide mt-2">
                      Fichas Individuales de Personal (A4)
                    </h4>
                    <p className="text-[11px] text-blue-200/80 font-bold uppercase mt-1">
                      Visualice e imprima el expediente y ficha completa de cada colaborador con cédula, contrato, IESS, utilidades (cargas familiares), vacaciones y novedades.
                    </p>
                  </div>
                  <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-3">
                    <select
                      className="p-3.5 bg-white text-slate-900 rounded-xl text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-400 min-w-[280px]"
                      value={selectedEmpForFicha?.id || ''}
                      onChange={e => {
                        const emp = employees.find(x => x.id === e.target.value);
                        if (emp) setSelectedEmpForFicha(emp);
                      }}
                    >
                      <option value="">-- SELECCIONAR COLABORADOR --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.surname} {emp.name} ({emp.identification}) - {emp.role || "General"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-3">
                    Directorio Rápido de Expedientes ({employees.length} Colaboradores Registrados)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-60 overflow-y-auto pr-2">
                    {employees.map(emp => (
                      <button
                        key={emp.id}
                        onClick={() => setSelectedEmpForFicha(emp)}
                        className="p-3 bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl text-left transition-all group flex items-center justify-between"
                      >
                        <div className="truncate pr-2">
                          <p className="text-[10px] font-black uppercase text-white group-hover:text-blue-300 transition-colors truncate">
                            {emp.surname} {emp.name}
                          </p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">
                            CI: {emp.identification} &bull; {emp.isFixed ? 'Fijo' : 'Temporal'}
                          </p>
                        </div>
                        <span className="text-xs group-hover:scale-125 transition-transform">📋</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                 {[
                   { id: 'employees', title: 'Censo Personal', icon: '👥', desc: 'Fichas, cargos y sueldos.' },
                   { id: 'payroll', title: 'Registro Pagos', icon: '💰', desc: 'Nómina, bonos y egresos.' },
                   { id: 'attendance', title: 'Asistencia', icon: '🕒', desc: 'Marcaciones y atrasos.' },
                   { id: 'novedades', title: 'Bitácora Novedades', icon: '📝', desc: 'Incidencias administrativas.' },
                   { id: 'bajas', title: 'Bajas Laborales', icon: '🚪', desc: 'Historial de desvinculaciones.' }
                 ].map(seg => (
                   <div key={seg.id} className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 flex flex-col justify-between hover:border-blue-200 transition-colors">
                      <div className="mb-4 flex items-start gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-inner flex items-center justify-center text-2xl">{seg.icon}</div>
                        <div>
                           <h4 className="text-[11px] font-[950] uppercase text-slate-900 leading-none mb-1">{seg.title}</h4>
                           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter leading-tight">{seg.desc}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => generateReportExcel(seg.id)} className="flex-1 py-2.5 bg-emerald-600 text-white text-[9px] font-black rounded-lg uppercase shadow-md active:scale-95 transition-all">Excel</button>
                        <button onClick={() => generateReportPDF(seg.id as any)} className="flex-1 py-2.5 bg-blue-700 text-white text-[9px] font-black rounded-lg uppercase shadow-md active:scale-95 transition-all">PDF</button>
                      </div>
                   </div>
                 ))}
              </div>
              <div className="pt-10 border-t flex flex-col items-center gap-6">
                 <button
                   onClick={handleDownloadMasterZip}
                   disabled={isZipping}
                   className="w-full max-w-md py-6 bg-slate-900 text-white font-[950] rounded-[2rem] uppercase text-[12px] tracking-[0.4em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4 group"
                 >
                   <span>{isZipping ? '⌛' : '📦'}</span>
                   {isZipping ? 'CONSOLIDANDO DATOS...' : 'Descargar Archivo Maestro .ZIP'}
                 </button>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center italic opacity-60">Este paquete comprimido incluye todos los reportes superiores en formato CSV para respaldo institucional.</p>
              </div>
           </div>
         ) : reportType === 'attendance' && selectedEmpForAttendance ? (
           /* HOJA INDIVIDUAL OFICIAL A4 PARA ASISTENCIA */
           <div className="p-6 md:p-12 space-y-8">
              {/* RESUMEN ESTADÍSTICO EN PANTALLA */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-5 bg-slate-50 rounded-2xl border-2 border-slate-200">
                <div className="text-center">
                  <p className="text-[8px] font-black text-blue-600 uppercase">Total Horas Laboradas</p>
                  <p className="text-2xl font-black text-blue-900">{individualStats.totalWorkedHoursFormatted}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Jornadas Registradas</p>
                  <p className="text-2xl font-black text-slate-900">{individualStats.totalDaysWorked} días</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-black text-amber-600 uppercase">Fechas Pendientes</p>
                  <p className={`text-2xl font-black ${individualStats.pendingDays > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {individualStats.pendingDays}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Puntuales</p>
                  <p className="text-2xl font-black text-emerald-600">{individualStats.confirmed}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Atrasos</p>
                  <p className="text-2xl font-black text-rose-600">{individualStats.lates}</p>
                </div>
              </div>

              {/* TABLA DE DETALLE DIARIO (UNA SOLA LÍNEA/BLOQUE POR DÍA CON SUMATORIA DE HORAS TRABAJADAS) */}
              <div className="table-responsive">
                <table className="w-full text-left border-collapse text-[11px] font-bold uppercase">
                  <thead className="bg-slate-900 text-white text-[9px] font-black tracking-widest uppercase">
                    <tr>
                      <th className="p-3 border">Fecha y Jornada</th>
                      <th className="p-3 border text-center">Ingreso 1</th>
                      <th className="p-3 border text-center">Salida 1</th>
                      <th className="p-3 border text-center">Ingreso 2</th>
                      <th className="p-3 border text-center">Salida 2</th>
                      <th className="p-3 border text-center bg-blue-950 text-blue-200">Horas Trabajadas</th>
                      <th className="p-3 border text-center">Puntualidad / Estado</th>
                      <th className="p-3 border">Novedad / Observación</th>
                      <th className="p-3 border text-center no-print w-28">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 border">
                    {individualDailyRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400 font-bold uppercase italic">
                          No existen marcaciones registradas para este colaborador en el rango seleccionado.
                        </td>
                      </tr>
                    ) : (
                      individualDailyRecords.map(day => (
                        <tr
                          key={day.dateKey}
                          className={`transition-colors ${day.isPendingMarking ? 'bg-amber-50/70 hover:bg-amber-100/60 border-l-4 border-l-amber-500' : 'hover:bg-blue-50/30'}`}
                        >
                          <td className="p-3 border font-black text-slate-900">
                            <div className="flex items-center gap-1.5">
                              {day.isPendingMarking && <span className="text-amber-600 text-xs" title="Marcación pendiente">⚠️</span>}
                              <span>{day.dateFormatted}</span>
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 font-mono">[{day.dateKey}]</span>
                            {day.isHalfDay && (
                              <span className="ml-2 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[7px] font-black">
                                Media Jornada
                              </span>
                            )}
                            {day.isPendingMarking && (
                              <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[7px] font-black tracking-wider">
                                Pendiente
                              </span>
                            )}
                          </td>
                          <td className={`p-3 border text-center font-mono font-bold ${day.in1 === '--:--' ? 'text-slate-400' : 'text-emerald-800 bg-emerald-50/30'}`}>
                            {day.in1}
                          </td>
                          <td className={`p-3 border text-center font-mono font-bold ${day.out1 === '--:--' ? 'text-slate-400' : 'text-orange-800 bg-orange-50/30'}`}>
                            {day.out1}
                          </td>
                          <td className={`p-3 border text-center font-mono font-bold ${day.in2 === '--:--' ? 'text-slate-400' : 'text-cyan-800 bg-cyan-50/30'}`}>
                            {day.in2}
                          </td>
                          <td className={`p-3 border text-center font-mono font-bold ${day.out2 === '--:--' ? 'text-slate-400' : 'text-pink-800 bg-pink-50/30'}`}>
                            {day.out2}
                          </td>
                          <td className="p-3 border text-center font-mono font-[950] text-sm text-blue-900 bg-blue-50/60">
                            {day.hoursFormatted}
                          </td>
                          <td className="p-3 border text-center">
                            {day.isPendingMarking ? (
                              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                                {day.statusLabel}
                              </span>
                            ) : day.hasLate ? (
                              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-amber-100 text-amber-800">
                                Atraso
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-100 text-emerald-800">
                                Puntual
                              </span>
                            )}
                          </td>
                          <td className={`p-3 border text-[9px] ${day.isPendingMarking ? 'text-amber-900 font-bold' : 'text-slate-600'}`}>
                            {day.justifications}
                          </td>
                          <td className="p-2 border text-center no-print">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(day)}
                              className={`w-full py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer whitespace-nowrap ${
                                day.isPendingMarking
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                              title={day.isPendingMarking ? "Regularizar marcaciones pendientes de esta fecha" : "Modificar o corregir marcaciones de esta fecha"}
                            >
                              <span>✏️</span>
                              <span>{day.isPendingMarking ? 'Regularizar' : 'Modificar'}</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {individualDailyRecords.length > 0 && (
                    <tfoot className="bg-slate-100 font-black text-slate-900 text-xs border-t-2 border-black">
                      <tr>
                        <td colSpan={5} className="p-3 border text-right uppercase tracking-wider">
                          Sumatoria Total de Horas Trabajadas:
                        </td>
                        <td className="p-3 border text-center font-mono font-[950] text-blue-950 bg-blue-100">
                          {individualStats.totalWorkedHoursFormatted}
                        </td>
                        <td colSpan={2} className="p-3 border text-[9px] text-slate-500 uppercase tracking-tight">
                          {individualStats.totalDaysWorked} Jornadas Registradas {individualStats.pendingDays > 0 ? `• ⚠️ ${individualStats.pendingDays} Fechas con Marcajes Pendientes` : '• Al día'}
                        </td>
                        <td className="p-3 border no-print"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* BLOQUE DE FIRMAS PARA IMPRESIÓN Y CONSTANCIA */}
              <div className="pt-12 grid grid-cols-3 gap-8 text-center">
                <div className="border-t-2 border-black pt-2">
                  <p className="text-[10px] font-black uppercase">{selectedEmpForAttendance.surname} {selectedEmpForAttendance.name}</p>
                  <p className="text-[8px] font-bold text-slate-600 uppercase">C.I.: {selectedEmpForAttendance.identification}</p>
                  <p className="text-[8px] font-black uppercase text-slate-400 mt-0.5">Colaborador</p>
                </div>
                <div className="border-t-2 border-black pt-2">
                  <p className="text-[10px] font-black uppercase">Talento Humano</p>
                  <p className="text-[8px] font-bold text-slate-600 uppercase">Control de Asistencia</p>
                  <p className="text-[8px] font-black uppercase text-slate-400 mt-0.5">Responsable</p>
                </div>
                <div className="border-t-2 border-black pt-2">
                  <p className="text-[10px] font-black uppercase">{company?.legalRep || 'Gerencia General'}</p>
                  <p className="text-[8px] font-bold text-slate-600 uppercase">Representante Legal</p>
                  <p className="text-[8px] font-black uppercase text-slate-400 mt-0.5">Aprobación Institucional</p>
                </div>
              </div>
           </div>
         ) : (
           <div className="p-4 md:p-10">
              <div className="table-responsive">
                  <table className="w-full text-left print:table-auto border-collapse text-[11px] font-bold uppercase">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 print:bg-white print:text-black">
                        <tr>
                           <th className="p-5 border-b-2">Detalle de Registro</th>
                           <th className="p-5 border-b-2">Colaborador Principal</th>
                           <th className="p-5 border-b-2 text-right">Situación / Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y print:text-black">
                          {renderTableRows()}
                      </tbody>
                  </table>
              </div>
           </div>
         )}
      </div>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
          <div className="text-center p-6 space-y-6">
              <p className="text-slate-700 font-bold uppercase text-[11px] italic leading-relaxed">{feedback.message}</p>
              <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Entendido</button>
          </div>
      </Modal>

      {/* MODAL FICHA INDIVIDUAL DE PERSONAL */}
      <EmployeeFileModal
        isOpen={!!selectedEmpForFicha}
        onClose={() => setSelectedEmpForFicha(null)}
        employee={selectedEmpForFicha}
        company={company}
        attendance={attendance}
        payments={payments}
      />

      {/* ESTILO OBLIGATORIO DE IMPRESIÓN EN ORIENTACIÓN HORIZONTAL (A4 LANDSCAPE) PARA REPORTES */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape !important;
            margin: 8mm 10mm 8mm 10mm !important;
          }
          body, html {
            background: white !important;
            color: black !important;
            width: 100% !important;
            font-size: 8pt !important;
          }
          .no-print {
            display: none !important;
          }
          #reports-printable-area {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            display: block !important;
          }
          #reports-printable-area table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: auto !important;
            font-size: 7.5pt !important;
          }
          #reports-printable-area th,
          #reports-printable-area td {
            border: 0.5pt solid #334155 !important;
            padding: 3pt 4pt !important;
          }
          #reports-printable-area th {
            background-color: #0f172a !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* MODAL PARA CORREGIR O REGULARIZAR MARCACIONES DIRECTAMENTE DESDE EL REPORTE */}
      <Modal
        isOpen={editDayModal.isOpen}
        onClose={() => setEditDayModal(prev => ({ ...prev, isOpen: false }))}
        title={editDayModal.isPendingOriginal ? "Regularizar Marcaciones del Día" : "Modificar Marcaciones Registradas"}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6 p-2 text-slate-900">
          {/* Cabecera del colaborador y fecha */}
          <div className="p-4 bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest text-blue-300">
                {editDayModal.isPendingOriginal ? '⚠️ Regularización de Fecha Pendiente' : '✏️ Modificación de Marcaciones'}
              </span>
              <h4 className="text-base font-black uppercase mt-0.5">
                {selectedEmpForAttendance?.surname} {selectedEmpForAttendance?.name}
              </h4>
              <p className="text-[10px] text-blue-200 font-bold uppercase">
                C.I.: {selectedEmpForAttendance?.identification} &bull; Cargo: {selectedEmpForAttendance?.role || "General"}
              </p>
            </div>
            <div className="text-left sm:text-right bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
              <p className="text-[8px] font-black uppercase text-blue-200">Fecha del Registro</p>
              <p className="text-sm font-black text-white font-mono">{editDayModal.dateKey}</p>
              <p className="text-[8px] font-bold uppercase text-slate-300">{editDayModal.dateFormatted}</p>
            </div>
          </div>

          {/* Opciones de tipo de jornada */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setEditDayModal(prev => ({ ...prev, isFullDayLeave: false, isHalfDay: false, in1Enabled: true, out1Enabled: true, in2Enabled: true, out2Enabled: true }))}
              className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                !editDayModal.isFullDayLeave && !editDayModal.isHalfDay
                  ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <p className="text-[10px] font-black uppercase">Jornada Completa</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">2 Turnos (Mañana y Tarde)</p>
            </button>

            <button
              type="button"
              onClick={() => setEditDayModal(prev => ({ ...prev, isFullDayLeave: false, isHalfDay: true, in1Enabled: true, out1Enabled: true, in2Enabled: false, out2Enabled: false }))}
              className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                !editDayModal.isFullDayLeave && editDayModal.isHalfDay
                  ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <p className="text-[10px] font-black uppercase">Media Jornada</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">1 Turno (4 Horas)</p>
            </button>

            <button
              type="button"
              onClick={() => setEditDayModal(prev => ({ ...prev, isFullDayLeave: true, in1Enabled: false, out1Enabled: false, in2Enabled: false, out2Enabled: false }))}
              className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                editDayModal.isFullDayLeave
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <p className="text-[10px] font-black uppercase">Permiso / Día Libre</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Justificado por Administración</p>
            </button>
          </div>

          {/* Si es día libre justificado */}
          {editDayModal.isFullDayLeave ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-800">
                <span className="text-xl">📋</span>
                <div>
                  <p className="text-[11px] font-black uppercase">Día Justificado como Permiso o Descanso</p>
                  <p className="text-[8px] font-bold uppercase text-emerald-600">No se exigirán marcaciones biométricas en esta fecha.</p>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-500">Motivo del Permiso / Descanso</label>
                <select
                  className="w-full p-2.5 bg-white border rounded-xl text-[10px] font-bold uppercase outline-none focus:border-emerald-500"
                  value={editDayModal.leaveReason}
                  onChange={e => setEditDayModal(prev => ({ ...prev, leaveReason: e.target.value }))}
                >
                  <option value="PERMISO PERSONAL AUTORIZADO">PERMISO PERSONAL AUTORIZADO</option>
                  <option value="PERMISO MEDICO AUTORIZADO">PERMISO MÉDICO AUTORIZADO</option>
                  <option value="PERMISO MATERNAL AUTORIZADO">PERMISO MATERNAL AUTORIZADO</option>
                  <option value="FALTA JUSTIFICADA">FALTA JUSTIFICADA</option>
                  <option value="DIA LIBRE AUTORIZADO">DÍA LIBRE AUTORIZADO</option>
                  <option value="VACACIONES APROBADAS">VACACIONES APROBADAS</option>
                </select>
              </div>
            </div>
          ) : (
            /* Bloques de marcaciones: Turno 1 y Turno 2 */
            <div className="space-y-4">
              {/* Turno 1 (Mañana) */}
              <div className="p-4 bg-slate-50 border rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-[10px] font-black text-slate-800 uppercase flex items-center gap-1.5">
                    <span>🌅</span> Turno 1 (Mañana)
                  </span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">Primer bloque de marcaciones</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Ingreso 1 */}
                  <div className={`p-3 bg-white border-2 rounded-xl transition-all ${editDayModal.in1Enabled ? 'border-emerald-300' : 'border-slate-200 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editDayModal.in1Enabled}
                          onChange={e => setEditDayModal(prev => ({ ...prev, in1Enabled: e.target.checked }))}
                          className="w-4 h-4 text-emerald-600 rounded"
                        />
                        <span className="text-[10px] font-black uppercase text-emerald-800">Ingreso 1</span>
                      </label>
                      {editDayModal.in1Enabled && (
                        <label className="flex items-center gap-1 text-[8px] font-black text-amber-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editDayModal.in1Late}
                            onChange={e => setEditDayModal(prev => ({ ...prev, in1Late: e.target.checked }))}
                            className="w-3.5 h-3.5 text-amber-600 rounded"
                          />
                          Atraso
                        </label>
                      )}
                    </div>
                    <input
                      type="time"
                      disabled={!editDayModal.in1Enabled}
                      value={editDayModal.in1Time}
                      onChange={e => setEditDayModal(prev => ({ ...prev, in1Time: e.target.value }))}
                      className="w-full p-2 border rounded-lg text-sm font-black font-mono text-center outline-none focus:border-blue-500 disabled:bg-slate-100"
                    />
                  </div>

                  {/* Salida 1 */}
                  <div className={`p-3 bg-white border-2 rounded-xl transition-all ${editDayModal.out1Enabled ? 'border-orange-300' : 'border-slate-200 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editDayModal.out1Enabled}
                          onChange={e => setEditDayModal(prev => ({ ...prev, out1Enabled: e.target.checked }))}
                          className="w-4 h-4 text-orange-600 rounded"
                        />
                        <span className="text-[10px] font-black uppercase text-orange-800">
                          {editDayModal.isHalfDay ? 'Salida Jornada' : 'Salida 1 (Almuerzo)'}
                        </span>
                      </label>
                    </div>
                    <input
                      type="time"
                      disabled={!editDayModal.out1Enabled}
                      value={editDayModal.out1Time}
                      onChange={e => setEditDayModal(prev => ({ ...prev, out1Time: e.target.value }))}
                      className="w-full p-2 border rounded-lg text-sm font-black font-mono text-center outline-none focus:border-blue-500 disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Turno 2 (Tarde) - Solo si no es media jornada */}
              {!editDayModal.isHalfDay && (
                <div className="p-4 bg-slate-50 border rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-[10px] font-black text-slate-800 uppercase flex items-center gap-1.5">
                      <span>🌆</span> Turno 2 (Tarde)
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Segundo bloque de marcaciones</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Ingreso 2 */}
                    <div className={`p-3 bg-white border-2 rounded-xl transition-all ${editDayModal.in2Enabled ? 'border-cyan-300' : 'border-slate-200 opacity-60'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editDayModal.in2Enabled}
                            onChange={e => setEditDayModal(prev => ({ ...prev, in2Enabled: e.target.checked }))}
                            className="w-4 h-4 text-cyan-600 rounded"
                          />
                          <span className="text-[10px] font-black uppercase text-cyan-800">Ingreso 2</span>
                        </label>
                        {editDayModal.in2Enabled && (
                          <label className="flex items-center gap-1 text-[8px] font-black text-amber-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editDayModal.in2Late}
                              onChange={e => setEditDayModal(prev => ({ ...prev, in2Late: e.target.checked }))}
                              className="w-3.5 h-3.5 text-amber-600 rounded"
                            />
                            Atraso
                          </label>
                        )}
                      </div>
                      <input
                        type="time"
                        disabled={!editDayModal.in2Enabled}
                        value={editDayModal.in2Time}
                        onChange={e => setEditDayModal(prev => ({ ...prev, in2Time: e.target.value }))}
                        className="w-full p-2 border rounded-lg text-sm font-black font-mono text-center outline-none focus:border-blue-500 disabled:bg-slate-100"
                      />
                    </div>

                    {/* Salida 2 */}
                    <div className={`p-3 bg-white border-2 rounded-xl transition-all ${editDayModal.out2Enabled ? 'border-pink-300' : 'border-slate-200 opacity-60'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editDayModal.out2Enabled}
                            onChange={e => setEditDayModal(prev => ({ ...prev, out2Enabled: e.target.checked }))}
                            className="w-4 h-4 text-pink-600 rounded"
                          />
                          <span className="text-[10px] font-black uppercase text-pink-800">Salida 2 (Final)</span>
                        </label>
                      </div>
                      <input
                        type="time"
                        disabled={!editDayModal.out2Enabled}
                        value={editDayModal.out2Time}
                        onChange={e => setEditDayModal(prev => ({ ...prev, out2Time: e.target.value }))}
                        className="w-full p-2 border rounded-lg text-sm font-black font-mono text-center outline-none focus:border-blue-500 disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Motivo y Observación de la modificación */}
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-slate-400">Concepto / Motivo de la Regularización</label>
              <select
                className="w-full p-3 border-2 rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-500 bg-white"
                value={editDayModal.justification}
                onChange={e => setEditDayModal(prev => ({ ...prev, justification: e.target.value }))}
              >
                <option value="REGULARIZACIÓN ADMINISTRATIVA DE FECHA PENDIENTE">REGULARIZACIÓN ADMINISTRATIVA DE FECHA PENDIENTE</option>
                <option value="CORRECCIÓN ADMINISTRATIVA DE HORARIO">CORRECCIÓN ADMINISTRATIVA DE HORARIO</option>
                <option value="AUTORIZACIÓN DIRECTA POR GERENCIA / RRHH">AUTORIZACIÓN DIRECTA POR GERENCIA / RRHH</option>
                <option value="FALLO TÉCNICO / ENERGÍA EN TERMINAL">FALLO TÉCNICO / ENERGÍA EN TERMINAL</option>
                <option value="OLVIDO DE MARCACIÓN JUSTIFICADO">OLVIDO DE MARCACIÓN JUSTIFICADO</option>
                <option value="TRABAJO FUERA DE OFICINA / GESTIÓN EXTERNA">TRABAJO FUERA DE OFICINA / GESTIÓN EXTERNA</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-slate-400">Observación / Nota de Auditoría (Opcional)</label>
              <textarea
                rows={2}
                placeholder="Ingrese detalles o justificación de soporte para la bitácora administrativa..."
                className="w-full p-3 border-2 rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-500"
                value={editDayModal.observationNote}
                onChange={e => setEditDayModal(prev => ({ ...prev, observationNote: e.target.value }))}
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditDayModal(prev => ({ ...prev, isOpen: false }))}
              className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px] tracking-wider hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveEditDay}
              className="flex-2 py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-black rounded-xl uppercase text-[10px] tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>💾</span>
              <span>Guardar Cambios y Actualizar Reporte</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL DE CONFIRMACIÓN DE ACCIONES */}
      <ConfirmationModal
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        message={confirmAction.message}
        confirmText={confirmAction.confirmText}
        type={confirmAction.type}
        onConfirm={confirmAction.onConfirm}
        onCancel={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default ReportsModule;
