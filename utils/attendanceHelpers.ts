import { AttendanceRecord, EmployeeObservation, GlobalSettings } from '../types.ts';
import { ECUADOR_HOLIDAYS } from '../constants.tsx';

export const toLocalDateStr = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const toLocalDateTimeISO = (d: Date = new Date()): string => {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${toLocalDateStr(d)}T${hh}:${mm}:${ss}`;
};

/**
 * Extrae YYYY-MM-DD respetando fechas locales sin desplazar el día por zona horaria UTC
 * para timestamps locales ("2026-04-02T08:30:00"), mientras convierte ISO UTC ("...Z" o ±HH:MM) a hora local.
 */
export const getLocalDateKey = (timestamp?: string): string => {
  if (!timestamp || typeof timestamp !== 'string') return '';
  const trimmed = timestamp.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(trimmed) && !trimmed.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return toLocalDateStr(d);
  return trimmed.includes('T') ? trimmed.split('T')[0] : (trimmed.includes(' ') ? trimmed.split(' ')[0] : trimmed);
};

export const extractHHMM = (timestamp?: string, defaultFallback: string = '08:30'): string => {
  if (!timestamp || typeof timestamp !== 'string') return defaultFallback;
  const trimmed = timestamp.trim();
  if (/^\d{2}:\d{2}/.test(trimmed)) return trimmed.slice(0, 5);
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(trimmed) && !trimmed.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed.slice(11, 16);
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  if (trimmed.includes('T')) {
    return trimmed.split('T')[1].slice(0, 5);
  }
  return defaultFallback;
};

export const timeStrToMinutes = (hhmm?: string): number => {
  if (!hhmm || !hhmm.includes(':')) return -1;
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
};

/**
 * Parsea YYYY-MM-DD (o ISO string) en hora local mediodía (12:00:00) para evitar desfases de -1 día en UTC-5.
 */
export const parseLocalDate = (dateStr?: string): Date | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim().split('T')[0].split(' ')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && parts.every(n => !isNaN(n))) {
    const [y, m, d] = parts;
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
};

export const getDateParts = (dateStr?: string): { year: number; month: number; day: number } | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim().split('T')[0].split(' ')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
  }
  const d = parseLocalDate(dateStr);
  if (!d) return null;
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
};

export const safeFormatDate = (timestamp?: string): string => {
  if (!timestamp) return 'S/F';
  try {
    const key = getLocalDateKey(timestamp);
    const d = parseLocalDate(key || timestamp);
    if (!d) {
      return timestamp.includes('T') ? timestamp.split('T')[0] : (timestamp.split(' ')[0] || timestamp);
    }
    return d.toLocaleDateString('es-EC', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return timestamp ? (timestamp.includes('T') ? timestamp.split('T')[0] : timestamp) : 'S/F';
  }
};

export const safeFormatDateTime = (timestamp?: string): string => {
  if (!timestamp) return 'S/F';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp;
    return d.toLocaleString('es-EC');
  } catch {
    return timestamp;
  }
};

export const safeFormatTime = (timestamp?: string): string => {
  if (!timestamp) return '--:--';
  try {
    const hhmm = extractHHMM(timestamp, '');
    if (hhmm) return hhmm;
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
};

export const isAuditRequestRecord = (rec?: AttendanceRecord | null): boolean => {
  if (!rec) return false;
  return (rec.justification || '').includes('[AUDITORÍA RETROACTIVA]');
};

export const isHolidayDate = (dateStr: string, customHolidays?: string[]): boolean => {
  if (!dateStr) return false;
  if (Array.isArray(customHolidays) && customHolidays.includes(dateStr)) return true;
  const parts = getDateParts(dateStr);
  if (!parts) return false;
  return ECUADOR_HOLIDAYS.some(h => h.month === parts.month && h.day === parts.day);
};

export const isFullDayPermissionObs = (o?: EmployeeObservation | null): boolean => {
  if (!o) return false;
  const pType = (o.permissionType || '').toUpperCase();
  const r = (o.reason || '').toUpperCase();
  return (
    pType === 'DIA LABORAL ENTERO' ||
    pType === 'ENTERO' ||
    (pType === '' &&
      (r.includes('PERMISO MATERNAL') ||
        r.includes('PERMISO MEDICO') ||
        r.includes('PERMISO PERSONAL') ||
        r.includes('FALTA JUSTIFICADA') ||
        r.includes('DIA LIBRE AUTORIZADO'))) ||
    (typeof o.permissionHours === 'number' && o.permissionHours >= 8)
  );
};

export const isHalfDayPermissionObs = (o?: EmployeeObservation | null): boolean => {
  if (!o) return false;
  const pType = (o.permissionType || '').toUpperCase();
  return (
    pType.includes('MEDIA') ||
    pType === 'MEDIA_AM' ||
    pType === 'MEDIA_PM' ||
    (typeof o.permissionHours === 'number' && o.permissionHours >= 4 && o.permissionHours < 8)
  );
};

export const getSafeSchedule = (settings?: GlobalSettings | null) => ({
  monFri: {
    in1: settings?.schedule?.monFri?.in1 || '08:30',
    out1: settings?.schedule?.monFri?.out1 || '13:00',
    in2: settings?.schedule?.monFri?.in2 || '15:00',
    out2: settings?.schedule?.monFri?.out2 || '18:00',
  },
  sat: {
    in: settings?.schedule?.sat?.in || '08:30',
    out: settings?.schedule?.sat?.out || '13:00',
  },
  halfDayOff: settings?.schedule?.halfDayOff || 'Miércoles tarde',
});

const DEVICE_ID_STORAGE_KEY = 'asistup_device_id';

export const getOrCreateDeviceId = (): string => {
  try {
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return 'dev_unknown';
  }
};

export const generateUniqueRecordId = (prefix: string = 'rec'): string => {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * Parsea de forma segura un timestamp local ("2026-11-16T08:30:00") o ISO UTC ("...Z") a milisegundos epoch.
 */
export const parseRecordEpochMs = (timestamp?: string): number => {
  if (!timestamp || typeof timestamp !== 'string') return 0;
  const trimmed = timestamp.trim();
  if (!trimmed) return 0;
  const localMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch;
    const dt = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss || 0), 0);
    return isNaN(dt.getTime()) ? 0 : dt.getTime();
  }
  const dt = new Date(trimmed);
  return isNaN(dt.getTime()) ? 0 : dt.getTime();
};

/**
 * Normaliza un timestamp al minuto exacto mostrado (segundos = 0, ms = 0) en hora local,
 * garantizando coincidencia exacta entre lo visualizado (HH:MM) y el cálculo de horas diarias y mensuales.
 */
export const truncateTimestampToMinuteMs = (timestamp?: string): number | null => {
  const rawMs = parseRecordEpochMs(timestamp);
  if (!rawMs) return null;
  const d = new Date(rawMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0, 0).getTime();
};

export interface AssignedDaySlots {
  in1Rec: AttendanceRecord | null;
  out1Rec: AttendanceRecord | null;
  in2Rec: AttendanceRecord | null;
  out2Rec: AttendanceRecord | null;
}

/**
 * Ubica las marcaciones físicas de un día en sus 4 casilleros reales (Mañana Ingreso/Salida, Tarde Ingreso/Salida)
 * priorizando el slot explícito (`shiftSlot`) y usando heurística horaria solo como respaldo para registros legados.
 */
export const splitDayRecordsIntoSlots = (
  dayRecs: AttendanceRecord[],
  settings?: GlobalSettings | null,
  isSat: boolean = false,
  isContinuous: boolean = false
): AssignedDaySlots => {
  const sorted = [...(dayRecs || [])].sort(
    (a, b) => parseRecordEpochMs(a.timestamp) - parseRecordEpochMs(b.timestamp)
  );
  const ins = sorted.filter(r => r.type === 'in');
  const outs = sorted.filter(r => r.type === 'out');
  const sched = getSafeSchedule(settings);

  const hasExplicitContinuous =
    isContinuous ||
    sorted.some(r => r.isContinuousShift || r.shiftSlot === 'continuous_in' || r.shiftSlot === 'continuous_out');

  if (hasExplicitContinuous) {
    const explicitIn = ins.find(r => r.shiftSlot === 'continuous_in' || r.shiftSlot === 'morning_in') || ins[0] || null;
    const explicitOut =
      outs.find(r => r.shiftSlot === 'continuous_out') ||
      (outs.length > 0 ? outs[outs.length - 1] : null);
    return {
      in1Rec: explicitIn,
      out1Rec: null,
      in2Rec: null,
      out2Rec: explicitOut,
    };
  }

  let in1Rec: AttendanceRecord | null = ins.find(r => r.shiftSlot === 'morning_in') || null;
  let in2Rec: AttendanceRecord | null = ins.find(r => r.shiftSlot === 'afternoon_in') || null;
  let out1Rec: AttendanceRecord | null = outs.find(r => r.shiftSlot === 'morning_out') || null;
  let out2Rec: AttendanceRecord | null = outs.find(r => r.shiftSlot === 'afternoon_out') || null;

  if (isSat && !in2Rec && !out2Rec) {
    return {
      in1Rec: in1Rec || ins[0] || null,
      out1Rec: out1Rec || outs[0] || null,
      in2Rec: null,
      out2Rec: null,
    };
  }

  // Punto medio entre salida de almuerzo y reingreso tarde para distinguir turno mañana vs turno tarde en registros sin shiftSlot
  const mOut1 = timeStrToMinutes(sched.monFri.out1);
  const mIn2 = timeStrToMinutes(sched.monFri.in2);
  const inCutoff = mOut1 > 0 && mIn2 > mOut1 ? Math.round((mOut1 + mIn2) / 2) : 14 * 60; // default 14:00
  const outCutoff = mIn2 > 0 ? mIn2 + 30 : 15 * 60 + 30; // default ~15:30

  const unassignedIns = ins.filter(r => r.id !== in1Rec?.id && r.id !== in2Rec?.id);
  for (const r of unassignedIns) {
    const mins = timeStrToMinutes(extractHHMM(r.timestamp, sched.monFri.in1));
    if (mins >= inCutoff) {
      if (!in2Rec) in2Rec = r;
      else if (!in1Rec) in1Rec = r;
    } else {
      if (!in1Rec) in1Rec = r;
      else if (!in2Rec) in2Rec = r;
    }
  }

  const unassignedOuts = outs.filter(r => r.id !== out1Rec?.id && r.id !== out2Rec?.id);
  for (const r of unassignedOuts) {
    const mins = timeStrToMinutes(extractHHMM(r.timestamp, sched.monFri.out1));
    if (mins >= outCutoff) {
      if (!out2Rec) out2Rec = r;
      else if (!out1Rec) out1Rec = r;
    } else {
      if (!out1Rec) out1Rec = r;
      else if (!out2Rec) out2Rec = r;
    }
  }

  return { in1Rec, out1Rec, in2Rec, out2Rec };
};

export interface DailyWorkedInterval {
  startMs: number;
  endMs: number;
}

export interface DailyWorkedCalculationResult {
  totalMinutes: number;
  intervals: DailyWorkedInterval[];
  freeBreakMinutesDeducted: number;
  isContinuous: boolean;
  isHalfDay: boolean;
  hasPaidFullDayLeave: boolean;
}

/**
 * Fuente única de cálculo diario de horas e intervalos trabajados usada tanto por Reportes como por Nómina Ecuador.
 * - Solo considera marcaciones `confirmed` (excluyendo auditorías retroactivas).
 * - Evita doble conteo cuando existen marcajes reales en días marcados como Media Jornada.
 * - Alinea cada marca al minuto exacto mostrado (HH:MM) para que la suma diaria y mensual cuadre al minuto.
 */
export const calculateDailyWorkedIntervalsAndMinutes = (
  dayRecs: AttendanceRecord[],
  dayObs: EmployeeObservation[] = [],
  _settings?: GlobalSettings | null,
  dateKey?: string,
  dailyHoursBase: number = 8
): DailyWorkedCalculationResult => {
  const confirmedRecs = [...(dayRecs || [])]
    .filter(r => r && r.status === 'confirmed' && !isAuditRequestRecord(r))
    .sort((a, b) => parseRecordEpochMs(a.timestamp) - parseRecordEpochMs(b.timestamp));

  const fullDayPermObs = (dayObs || []).find(isFullDayPermissionObs);
  const hasHalfDayPerm = (dayObs || []).some(isHalfDayPermissionObs);
  const hasHalfDayRecord = confirmedRecs.some(r => r.type === 'half_day');
  const isHalfDay = hasHalfDayRecord || hasHalfDayPerm;
  const isContinuous = confirmedRecs.some(
    r => r.isContinuousShift || r.shiftSlot === 'continuous_in' || r.shiftSlot === 'continuous_out'
  );

  const intervals: DailyWorkedInterval[] = [];
  let freeBreakMinutesDeducted = 0;

  if (isContinuous) {
    const inRecs = confirmedRecs.filter(r => r.type === 'in');
    const outRecs = confirmedRecs.filter(r => r.type === 'out');
    const firstInMs = inRecs[0] ? truncateTimestampToMinuteMs(inRecs[0].timestamp) : null;
    const lastOutMs = outRecs.length > 0 ? truncateTimestampToMinuteMs(outRecs[outRecs.length - 1].timestamp) : null;

    if (firstInMs !== null && lastOutMs !== null && lastOutMs > firstInMs) {
      intervals.push({ startMs: firstInMs, endMs: lastOutMs });
      const rawMins = Math.round((lastOutMs - firstInMs) / 60000);
      const configuredBreak = confirmedRecs.find(r => typeof r.freeBreakMinutes === 'number')?.freeBreakMinutes ?? 60;
      freeBreakMinutesDeducted = Math.min(rawMins, Math.max(0, configuredBreak));
      return {
        totalMinutes: Math.max(0, rawMins - freeBreakMinutesDeducted),
        intervals,
        freeBreakMinutesDeducted,
        isContinuous: true,
        isHalfDay,
        hasPaidFullDayLeave: false,
      };
    }
  } else {
    let lastInMs: number | null = null;
    for (const r of confirmedRecs) {
      const ms = truncateTimestampToMinuteMs(r.timestamp);
      if (ms === null) continue;
      if (r.type === 'in') {
        lastInMs = ms;
      } else if (r.type === 'out' && lastInMs !== null) {
        if (ms > lastInMs) {
          intervals.push({ startMs: lastInMs, endMs: ms });
        }
        lastInMs = null;
      }
    }
  }

  let totalMinutes = intervals.reduce(
    (acc, iv) => acc + Math.max(0, Math.round((iv.endMs - iv.startMs) / 60000)),
    0
  );

  // Solo acreditar 4h automáticas en Media Jornada si NO hubo marcaciones de ingreso/salida emparejadas
  if (totalMinutes === 0 && isHalfDay) {
    const halfMins = Math.round((dailyHoursBase / 2) * 60);
    totalMinutes = halfMins;
    const parts = getDateParts(dateKey);
    if (parts) {
      const startMs = new Date(parts.year, parts.month, parts.day, 8, 30, 0, 0).getTime();
      intervals.push({ startMs, endMs: startMs + halfMins * 60000 });
    }
    return {
      totalMinutes,
      intervals,
      freeBreakMinutesDeducted: 0,
      isContinuous: false,
      isHalfDay: true,
      hasPaidFullDayLeave: false,
    };
  }

  // Permiso de día completo con goce de remuneración (cuando lo autorizó administración) y sin marcajes físicos
  const hasPaidFullDayLeave = totalMinutes === 0 && !!fullDayPermObs?.isPaidLeave;
  if (hasPaidFullDayLeave) {
    const fullMins = Math.round(dailyHoursBase * 60);
    totalMinutes = fullMins;
  }

  return {
    totalMinutes,
    intervals,
    freeBreakMinutesDeducted: 0,
    isContinuous,
    isHalfDay,
    hasPaidFullDayLeave,
  };
};

export const safeJsonStringify = (obj: any, space?: number): string => {
  const cache = new Set<any>();
  return JSON.stringify(
    obj,
    (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return undefined;
        cache.add(value);
      }
      return value;
    },
    space
  );
};
