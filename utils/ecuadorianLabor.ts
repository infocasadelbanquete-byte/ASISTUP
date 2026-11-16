import { AttendanceRecord, Employee, GlobalSettings, SettlementRubrics, TerminationReason, YearlyLaborNormative } from '../types.ts';
import { DEFAULT_SYSTEM_UPDATE } from '../constants.tsx';
import {
  calculateDailyWorkedIntervalsAndMinutes,
  getDateParts,
  getLocalDateKey,
  getSafeSchedule,
  isAuditRequestRecord,
  isFullDayPermissionObs,
  timeStrToMinutes,
  toLocalDateStr
} from './attendanceHelpers.ts';

export interface ResolvedGlobalSettings extends GlobalSettings {
  activeFiscalYear: number;
  monthlyHoursBase: number;
  monthlyDaysBase: number;
  dailyHoursBase: number;
  weeklyHoursBase: number;
  supplementaryRate: number;
  extraordinaryRate: number;
  maxDailySuppHours: number;
  maxWeeklySuppHours: number;
}

/**
 * Registro histórico y vigente de la normativa laboral ecuatoriana por año fiscal
 * (Código del Trabajo y Acuerdos Ministeriales del Ministerio del Trabajo - SBU).
 */
export const ECUADOR_NORMATIVE_BY_YEAR: Record<number, YearlyLaborNormative> = {
  2024: {
    year: 2024,
    sbu: 460.00,
    sbuPrev: 450.00,
    iessRate: 0.0945,
    reserveRate: 0.0833,
    monthlyHoursBase: 240,
    monthlyDaysBase: 30,
    dailyHoursBase: 8,
    weeklyHoursBase: 40,
    supplementaryRate: 0.50,
    extraordinaryRate: 1.00,
    maxDailySuppHours: 4,
    maxWeeklySuppHours: 12,
    sourceNote: 'Normativa Laboral Ecuador 2024 (Acuerdo MDT-2023-175 • SBU $460.00)'
  },
  2025: {
    year: 2025,
    sbu: 470.00,
    sbuPrev: 460.00,
    iessRate: 0.0945,
    reserveRate: 0.0833,
    monthlyHoursBase: 240,
    monthlyDaysBase: 30,
    dailyHoursBase: 8,
    weeklyHoursBase: 40,
    supplementaryRate: 0.50,
    extraordinaryRate: 1.00,
    maxDailySuppHours: 4,
    maxWeeklySuppHours: 12,
    sourceNote: 'Normativa Laboral Ecuador 2025 (Acuerdo MDT-2024-300 • SBU $470.00)'
  },
  2026: {
    year: 2026,
    sbu: 482.00,
    sbuPrev: 470.00,
    iessRate: 0.0945,
    reserveRate: 0.0833,
    monthlyHoursBase: 240,
    monthlyDaysBase: 30,
    dailyHoursBase: 8,
    weeklyHoursBase: 40,
    supplementaryRate: 0.50,
    extraordinaryRate: 1.00,
    maxDailySuppHours: 4,
    maxWeeklySuppHours: 12,
    sourceNote: 'Normativa Laboral Ecuador 2026 (Acuerdo MDT-2025-195 • SBU $482.00)'
  }
};

const safeFiniteNum = (val: unknown, fallback: number): number =>
  typeof val === 'number' && Number.isFinite(val) ? val : fallback;

/**
 * Devuelve la normativa laboral oficial de Ecuador para un año determinado.
 * Si el año es futuro (> 2026) y no tiene decreto predefinido, proyecta la continuidad
 * legal tomando como base el último año oficial o los valores del sistema maestro.
 */
export function getOfficialEcuadorNormativeForYear(
  year: number,
  referenceSettings?: Partial<GlobalSettings> | null
): YearlyLaborNormative {
  const safeYear = Number.isFinite(year) && year >= 2000 ? Math.floor(year) : new Date().getFullYear();
  if (ECUADOR_NORMATIVE_BY_YEAR[safeYear]) {
    return { ...ECUADOR_NORMATIVE_BY_YEAR[safeYear] };
  }

  const knownYears = Object.keys(ECUADOR_NORMATIVE_BY_YEAR).map(Number).sort((a, b) => a - b);
  const latestKnown = ECUADOR_NORMATIVE_BY_YEAR[knownYears[knownYears.length - 1]];
  const refSbu = safeFiniteNum(referenceSettings?.sbu, latestKnown.sbu);
  const refSbuPrev = safeFiniteNum(referenceSettings?.sbuPrev, latestKnown.sbuPrev);

  return {
    year: safeYear,
    sbu: safeYear > latestKnown.year ? refSbu : latestKnown.sbu,
    sbuPrev: safeYear > latestKnown.year ? refSbuPrev : latestKnown.sbuPrev,
    iessRate: safeFiniteNum(referenceSettings?.iessRate, latestKnown.iessRate),
    reserveRate: safeFiniteNum(referenceSettings?.reserveRate, latestKnown.reserveRate),
    monthlyHoursBase: safeFiniteNum(referenceSettings?.monthlyHoursBase, latestKnown.monthlyHoursBase),
    monthlyDaysBase: safeFiniteNum(referenceSettings?.monthlyDaysBase, latestKnown.monthlyDaysBase),
    dailyHoursBase: safeFiniteNum(referenceSettings?.dailyHoursBase, latestKnown.dailyHoursBase),
    weeklyHoursBase: safeFiniteNum(referenceSettings?.weeklyHoursBase, latestKnown.weeklyHoursBase),
    supplementaryRate: safeFiniteNum(referenceSettings?.supplementaryRate, latestKnown.supplementaryRate),
    extraordinaryRate: safeFiniteNum(referenceSettings?.extraordinaryRate, latestKnown.extraordinaryRate),
    maxDailySuppHours: safeFiniteNum(referenceSettings?.maxDailySuppHours, latestKnown.maxDailySuppHours),
    maxWeeklySuppHours: safeFiniteNum(referenceSettings?.maxWeeklySuppHours, latestKnown.maxWeeklySuppHours),
    sourceNote: `Normativa Laboral Vigente ${safeYear} (Código del Trabajo Ecuador)`
  };
}

export function snapshotYearNormative(settings: GlobalSettings, year: number): YearlyLaborNormative {
  const resolved = resolveEffectiveSettingsForYear(settings, year);
  return {
    year,
    sbu: resolved.sbu,
    sbuPrev: resolved.sbuPrev,
    iessRate: resolved.iessRate,
    reserveRate: resolved.reserveRate,
    monthlyHoursBase: resolved.monthlyHoursBase,
    monthlyDaysBase: resolved.monthlyDaysBase,
    dailyHoursBase: resolved.dailyHoursBase,
    weeklyHoursBase: resolved.weeklyHoursBase,
    supplementaryRate: resolved.supplementaryRate,
    extraordinaryRate: resolved.extraordinaryRate,
    maxDailySuppHours: resolved.maxDailySuppHours,
    maxWeeklySuppHours: resolved.maxWeeklySuppHours,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Normaliza un objeto parcial de GlobalSettings completando todos los campos de ajustes maestros.
 */
export function buildSafeGlobalSettings(
  s?: Partial<GlobalSettings> | null,
  currentYear: number = new Date().getFullYear()
): ResolvedGlobalSettings {
  const activeFiscalYear = safeFiniteNum(s?.activeFiscalYear, currentYear);
  const official = getOfficialEcuadorNormativeForYear(activeFiscalYear);

  const normalizedOverrides: Record<string, YearlyLaborNormative> = {};
  if (s?.yearlyOverrides && typeof s.yearlyOverrides === 'object') {
    for (const [yKey, val] of Object.entries(s.yearlyOverrides)) {
      if (val && typeof val === 'object') {
        const yNum = Number(val.year || yKey) || activeFiscalYear;
        const baseY = getOfficialEcuadorNormativeForYear(yNum);
        normalizedOverrides[yKey] = {
          year: yNum,
          sbu: safeFiniteNum(val.sbu, baseY.sbu),
          sbuPrev: safeFiniteNum(val.sbuPrev, baseY.sbuPrev),
          iessRate: safeFiniteNum(val.iessRate, baseY.iessRate),
          reserveRate: safeFiniteNum(val.reserveRate, baseY.reserveRate),
          monthlyHoursBase: safeFiniteNum(val.monthlyHoursBase, baseY.monthlyHoursBase),
          monthlyDaysBase: safeFiniteNum(val.monthlyDaysBase, baseY.monthlyDaysBase),
          dailyHoursBase: safeFiniteNum(val.dailyHoursBase, baseY.dailyHoursBase),
          weeklyHoursBase: safeFiniteNum(val.weeklyHoursBase, baseY.weeklyHoursBase),
          supplementaryRate: safeFiniteNum(val.supplementaryRate, baseY.supplementaryRate),
          extraordinaryRate: safeFiniteNum(val.extraordinaryRate, baseY.extraordinaryRate),
          maxDailySuppHours: safeFiniteNum(val.maxDailySuppHours, baseY.maxDailySuppHours),
          maxWeeklySuppHours: safeFiniteNum(val.maxWeeklySuppHours, baseY.maxWeeklySuppHours),
          sourceNote: val.sourceNote || baseY.sourceNote,
          updatedAt: val.updatedAt
        };
      }
    }
  }

  return {
    sbu: safeFiniteNum(s?.sbu, official.sbu),
    sbuPrev: safeFiniteNum(s?.sbuPrev, official.sbuPrev),
    iessRate: safeFiniteNum(s?.iessRate, official.iessRate),
    reserveRate: safeFiniteNum(s?.reserveRate, official.reserveRate),
    activeFiscalYear,
    monthlyHoursBase: Math.max(1, safeFiniteNum(s?.monthlyHoursBase, official.monthlyHoursBase)),
    monthlyDaysBase: Math.max(1, safeFiniteNum(s?.monthlyDaysBase, official.monthlyDaysBase)),
    dailyHoursBase: Math.max(1, safeFiniteNum(s?.dailyHoursBase, official.dailyHoursBase)),
    weeklyHoursBase: Math.max(1, safeFiniteNum(s?.weeklyHoursBase, official.weeklyHoursBase)),
    supplementaryRate: Math.max(0, safeFiniteNum(s?.supplementaryRate, official.supplementaryRate)),
    extraordinaryRate: Math.max(0, safeFiniteNum(s?.extraordinaryRate, official.extraordinaryRate)),
    maxDailySuppHours: Math.max(0, safeFiniteNum(s?.maxDailySuppHours, official.maxDailySuppHours)),
    maxWeeklySuppHours: Math.max(0, safeFiniteNum(s?.maxWeeklySuppHours, official.maxWeeklySuppHours)),
    lastAutoRolloverYear: s?.lastAutoRolloverYear,
    lastAutoRolloverAt: s?.lastAutoRolloverAt,
    yearlyOverrides: normalizedOverrides,
    holidays: Array.isArray(s?.holidays)
      ? s!.holidays.filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
      : [],
    schedule: {
      monFri: {
        in1: s?.schedule?.monFri?.in1 || '08:30',
        out1: s?.schedule?.monFri?.out1 || '13:00',
        in2: s?.schedule?.monFri?.in2 || '15:00',
        out2: s?.schedule?.monFri?.out2 || '18:00',
      },
      sat: {
        in: s?.schedule?.sat?.in || '08:30',
        out: s?.schedule?.sat?.out || '13:00',
      },
      halfDayOff: s?.schedule?.halfDayOff || 'Miércoles tarde',
    },
    systemUpdate: {
      ...DEFAULT_SYSTEM_UPDATE,
      ...(s?.systemUpdate || {}),
      changelog: Array.isArray(s?.systemUpdate?.changelog)
        ? s!.systemUpdate!.changelog
        : DEFAULT_SYSTEM_UPDATE.changelog,
    },
  };
}

/**
 * Resuelve los parámetros efectivos de Ajustes del Sistema Maestro para un año o período específico:
 * - Si el año consultado coincide con el período fiscal activo en Ajustes Maestros, aplica los valores activos en vivo.
 * - Si existe una configuración guardada específica en `yearlyOverrides[año]`, aplica esa configuración editable del año.
 * - Caso contrario aplica la normativa laboral oficial vigente para ese año manteniendo horarios y feriados maestros.
 */
export function resolveEffectiveSettingsForYear(
  settings: GlobalSettings | null | undefined,
  targetYear: number = new Date().getFullYear()
): ResolvedGlobalSettings {
  const safeBase = buildSafeGlobalSettings(settings, targetYear);
  const yearKey = String(targetYear);
  const activeYear = safeBase.activeFiscalYear;

  if (targetYear === activeYear) {
    return safeBase;
  }

  const override = safeBase.yearlyOverrides?.[yearKey];
  if (override) {
    return {
      ...safeBase,
      activeFiscalYear: targetYear,
      sbu: safeFiniteNum(override.sbu, safeBase.sbu),
      sbuPrev: safeFiniteNum(override.sbuPrev, safeBase.sbuPrev),
      iessRate: safeFiniteNum(override.iessRate, safeBase.iessRate),
      reserveRate: safeFiniteNum(override.reserveRate, safeBase.reserveRate),
      monthlyHoursBase: Math.max(1, safeFiniteNum(override.monthlyHoursBase, safeBase.monthlyHoursBase)),
      monthlyDaysBase: Math.max(1, safeFiniteNum(override.monthlyDaysBase, safeBase.monthlyDaysBase)),
      dailyHoursBase: Math.max(1, safeFiniteNum(override.dailyHoursBase, safeBase.dailyHoursBase)),
      weeklyHoursBase: Math.max(1, safeFiniteNum(override.weeklyHoursBase, safeBase.weeklyHoursBase)),
      supplementaryRate: Math.max(0, safeFiniteNum(override.supplementaryRate, safeBase.supplementaryRate)),
      extraordinaryRate: Math.max(0, safeFiniteNum(override.extraordinaryRate, safeBase.extraordinaryRate)),
      maxDailySuppHours: Math.max(0, safeFiniteNum(override.maxDailySuppHours, safeBase.maxDailySuppHours)),
      maxWeeklySuppHours: Math.max(0, safeFiniteNum(override.maxWeeklySuppHours, safeBase.maxWeeklySuppHours)),
    };
  }

  const official = getOfficialEcuadorNormativeForYear(targetYear, safeBase);
  return {
    ...safeBase,
    activeFiscalYear: targetYear,
    sbu: official.sbu,
    sbuPrev: official.sbuPrev,
    iessRate: official.iessRate,
    reserveRate: official.reserveRate,
    monthlyHoursBase: official.monthlyHoursBase,
    monthlyDaysBase: official.monthlyDaysBase,
    dailyHoursBase: official.dailyHoursBase,
    weeklyHoursBase: official.weeklyHoursBase,
    supplementaryRate: official.supplementaryRate,
    extraordinaryRate: official.extraordinaryRate,
    maxDailySuppHours: official.maxDailySuppHours,
    maxWeeklySuppHours: official.maxWeeklySuppHours,
  };
}

/**
 * Actualiza automáticamente los Ajustes del Sistema Maestro al iniciar un nuevo año o período fiscal:
 * - Resguarda los parámetros del año saliente en `yearlyOverrides` para no alterar históricos.
 * - Transiciona `sbuPrev` al SBU del año anterior.
 * - Aplica la normativa vigente del nuevo año (o la pre-configuración en `yearlyOverrides[nuevoAño]`).
 */
export function rolloverSettingsToYear(
  settings: GlobalSettings | null | undefined,
  currentYear: number = new Date().getFullYear()
): { nextSettings: ResolvedGlobalSettings; changed: boolean } {
  const safeCurrent = buildSafeGlobalSettings(settings, settings?.activeFiscalYear || currentYear);
  const currentActiveYear = safeCurrent.activeFiscalYear;

  // Caso de transición a un nuevo año calendario
  if (currentYear > currentActiveYear) {
    const updatedOverrides: Record<string, YearlyLaborNormative> = {
      ...(safeCurrent.yearlyOverrides || {}),
      [String(currentActiveYear)]: {
        year: currentActiveYear,
        sbu: safeCurrent.sbu,
        sbuPrev: safeCurrent.sbuPrev,
        iessRate: safeCurrent.iessRate,
        reserveRate: safeCurrent.reserveRate,
        monthlyHoursBase: safeCurrent.monthlyHoursBase,
        monthlyDaysBase: safeCurrent.monthlyDaysBase,
        dailyHoursBase: safeCurrent.dailyHoursBase,
        weeklyHoursBase: safeCurrent.weeklyHoursBase,
        supplementaryRate: safeCurrent.supplementaryRate,
        extraordinaryRate: safeCurrent.extraordinaryRate,
        maxDailySuppHours: safeCurrent.maxDailySuppHours,
        maxWeeklySuppHours: safeCurrent.maxWeeklySuppHours,
        updatedAt: new Date().toISOString()
      }
    };

    const preconfiguredNext = updatedOverrides[String(currentYear)];
    const officialNext = ECUADOR_NORMATIVE_BY_YEAR[currentYear];

    const nextSbu = preconfiguredNext?.sbu ?? officialNext?.sbu ?? safeCurrent.sbu;
    const nextSbuPrev = preconfiguredNext?.sbuPrev ?? safeCurrent.sbu;
    const nextIessRate = preconfiguredNext?.iessRate ?? officialNext?.iessRate ?? safeCurrent.iessRate;
    const nextReserveRate = preconfiguredNext?.reserveRate ?? officialNext?.reserveRate ?? safeCurrent.reserveRate;
    const nextMonthlyHours = preconfiguredNext?.monthlyHoursBase ?? officialNext?.monthlyHoursBase ?? safeCurrent.monthlyHoursBase;
    const nextMonthlyDays = preconfiguredNext?.monthlyDaysBase ?? officialNext?.monthlyDaysBase ?? safeCurrent.monthlyDaysBase;
    const nextDailyHours = preconfiguredNext?.dailyHoursBase ?? officialNext?.dailyHoursBase ?? safeCurrent.dailyHoursBase;
    const nextWeeklyHours = preconfiguredNext?.weeklyHoursBase ?? officialNext?.weeklyHoursBase ?? safeCurrent.weeklyHoursBase;
    const nextSuppRate = preconfiguredNext?.supplementaryRate ?? officialNext?.supplementaryRate ?? safeCurrent.supplementaryRate;
    const nextExtraRate = preconfiguredNext?.extraordinaryRate ?? officialNext?.extraordinaryRate ?? safeCurrent.extraordinaryRate;
    const nextMaxDailySupp = preconfiguredNext?.maxDailySuppHours ?? officialNext?.maxDailySuppHours ?? safeCurrent.maxDailySuppHours;
    const nextMaxWeeklySupp = preconfiguredNext?.maxWeeklySuppHours ?? officialNext?.maxWeeklySuppHours ?? safeCurrent.maxWeeklySuppHours;

    updatedOverrides[String(currentYear)] = {
      year: currentYear,
      sbu: nextSbu,
      sbuPrev: nextSbuPrev,
      iessRate: nextIessRate,
      reserveRate: nextReserveRate,
      monthlyHoursBase: nextMonthlyHours,
      monthlyDaysBase: nextMonthlyDays,
      dailyHoursBase: nextDailyHours,
      weeklyHoursBase: nextWeeklyHours,
      supplementaryRate: nextSuppRate,
      extraordinaryRate: nextExtraRate,
      maxDailySuppHours: nextMaxDailySupp,
      maxWeeklySuppHours: nextMaxWeeklySupp,
      sourceNote: preconfiguredNext?.sourceNote || officialNext?.sourceNote || `Cambio automático período ${currentYear}`,
      updatedAt: new Date().toISOString()
    };

    return {
      changed: true,
      nextSettings: {
        ...safeCurrent,
        activeFiscalYear: currentYear,
        sbu: nextSbu,
        sbuPrev: nextSbuPrev,
        iessRate: nextIessRate,
        reserveRate: nextReserveRate,
        monthlyHoursBase: nextMonthlyHours,
        monthlyDaysBase: nextMonthlyDays,
        dailyHoursBase: nextDailyHours,
        weeklyHoursBase: nextWeeklyHours,
        supplementaryRate: nextSuppRate,
        extraordinaryRate: nextExtraRate,
        maxDailySuppHours: nextMaxDailySupp,
        maxWeeklySuppHours: nextMaxWeeklySupp,
        lastAutoRolloverYear: currentYear,
        lastAutoRolloverAt: new Date().toISOString(),
        yearlyOverrides: updatedOverrides
      }
    };
  }

  // Migración inicial de configuraciones antiguas que aún no tenían campos de período fiscal
  const needsInitialization =
    settings?.activeFiscalYear === undefined ||
    settings?.monthlyHoursBase === undefined ||
    settings?.dailyHoursBase === undefined ||
    (currentYear === 2026 && safeCurrent.sbu === 482 && safeCurrent.sbuPrev === 460);

  if (needsInitialization) {
    const correctedPrev = currentYear === 2026 && safeCurrent.sbu === 482 && safeCurrent.sbuPrev === 460
      ? 470.00
      : safeCurrent.sbuPrev;
    const nextOverrides: Record<string, YearlyLaborNormative> = {
      ...(safeCurrent.yearlyOverrides || {}),
      [String(currentActiveYear)]: {
        year: currentActiveYear,
        sbu: safeCurrent.sbu,
        sbuPrev: correctedPrev,
        iessRate: safeCurrent.iessRate,
        reserveRate: safeCurrent.reserveRate,
        monthlyHoursBase: safeCurrent.monthlyHoursBase,
        monthlyDaysBase: safeCurrent.monthlyDaysBase,
        dailyHoursBase: safeCurrent.dailyHoursBase,
        weeklyHoursBase: safeCurrent.weeklyHoursBase,
        supplementaryRate: safeCurrent.supplementaryRate,
        extraordinaryRate: safeCurrent.extraordinaryRate,
        maxDailySuppHours: safeCurrent.maxDailySuppHours,
        maxWeeklySuppHours: safeCurrent.maxWeeklySuppHours,
        updatedAt: new Date().toISOString()
      }
    };
    return {
      changed: true,
      nextSettings: {
        ...safeCurrent,
        sbuPrev: correctedPrev,
        yearlyOverrides: nextOverrides
      }
    };
  }

  return { changed: false, nextSettings: safeCurrent };
}

/**
 * Convierte un número monetario a su representación en letras en español (Estilo oficial de finiquito y roles en Ecuador)
 */
export function numberToSpanishWords(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return "CERO CON 00/100 DÓLARES";
  
  const absAmount = Math.abs(amount);
  const integerPart = Math.floor(absAmount);
  const cents = Math.round((absAmount - integerPart) * 100);
  const centsStr = cents.toString().padStart(2, '0');

  if (integerPart === 0) {
    return `CERO CON ${centsStr}/100 DÓLARES`;
  }

  const units = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const teens = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
  const tens = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const hundreds = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

  function convertGroup(n: number): string {
    let output = "";
    if (n === 100) return "CIEN";
    if (n > 99) {
      output += hundreds[Math.floor(n / 100)] + " ";
      n %= 100;
    }
    if (n >= 10 && n <= 19) {
      output += teens[n - 10] + " ";
    } else if (n >= 20 && n <= 29) {
      if (n === 20) output += "VEINTE ";
      else output += "VEINTI" + units[n - 20] + " ";
    } else if (n >= 30) {
      const ten = Math.floor(n / 10);
      const unit = n % 10;
      output += tens[ten] + (unit > 0 ? " Y " + units[unit] : "") + " ";
    } else if (n > 0) {
      output += units[n] + " ";
    }
    return output.trim();
  }

  let words = "";

  const millions = Math.floor(integerPart / 1000000);
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  const remainder = integerPart % 1000;

  if (millions > 0) {
    if (millions === 1) words += "UN MILLÓN ";
    else words += convertGroup(millions) + " MILLONES ";
  }

  if (thousands > 0) {
    if (thousands === 1) words += "MIL ";
    else words += convertGroup(thousands) + " MIL ";
  }

  if (remainder > 0) {
    words += convertGroup(remainder) + " ";
  }

  const prefix = amount < 0 ? "MENOS " : "";
  return `${prefix}${words.trim()} CON ${centsStr}/100 DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA`;
}

/**
 * Calcula el tiempo exacto de servicio entre dos fechas (años, meses, días y años completos)
 */
export function calculateTenure(startDateStr: string, endDateStr: string) {
  if (!startDateStr || !endDateStr) {
    return { years: 0, months: 0, days: 0, totalDays: 0, completedYears: 0, decimalYears: 0 };
  }

  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');

  if (end < start) {
    return { years: 0, months: 0, days: 0, totalDays: 0, completedYears: 0, decimalYears: 0 };
  }

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate() + 1; // inclusivo

  if (days < 0) {
    months -= 1;
    // Días en el mes previo al final
    const prevMonthLastDay = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const completedYears = Math.max(0, years);
  const decimalYears = totalDays / 365.25;

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
    totalDays,
    completedYears,
    decimalYears
  };
}

/**
 * Calcula el número de días comprendidos entre la fecha de inicio y fin de vacaciones (ambas inclusive)
 */
export function calculateVacationDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');
  if (end < start) return 0;
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Calcula los rubros legales de liquidación conforme al Código del Trabajo del Ecuador
 * utilizando los parámetros vigentes de Ajustes del Sistema Maestro para el año de liquidación.
 */
export function calculateEcuadorianSettlement(
  employee: Employee,
  terminationDateStr: string,
  reason: TerminationReason | string,
  settings: GlobalSettings,
  pendingAdvances: number = 0,
  region: 'sierra' | 'costa' = 'sierra'
): SettlementRubrics {
  const startDateStr = employee.startDate || terminationDateStr;
  const termDate = new Date(terminationDateStr + 'T00:00:00');
  const targetYear = !isNaN(termDate.getTime()) ? termDate.getFullYear() : new Date().getFullYear();
  const effSettings = resolveEffectiveSettingsForYear(settings, targetYear);

  const sbu = effSettings.sbu;
  const monthlyDaysBase = effSettings.monthlyDaysBase;
  const yearlyDaysBase = monthlyDaysBase * 12;
  const reserveRate = effSettings.reserveRate;
  const iessRate = effSettings.iessRate;
  const salary = Number(employee.salary) || sbu;

  const tenure = calculateTenure(startDateStr, terminationDateStr);
  const termDay = termDate.getDate();

  // 1. Sueldo Proporcional del mes de salida (base días comerciales configurados en Ajustes Maestros)
  const workedDaysInMonth = Math.min(monthlyDaysBase, termDay);
  const proportionalSalary = Number(((salary / monthlyDaysBase) * workedDaysInMonth).toFixed(2));

  // 2. Décimo Tercer Sueldo Proporcional (Ciclo: 1 Dic año anterior a 30 Nov año en curso)
  const prevYear = termDate.getMonth() === 11 ? termDate.getFullYear() : termDate.getFullYear() - 1;
  const thirteenthCycleStart = new Date(prevYear, 11, 1); // 1 de Dic
  const empStart = new Date(startDateStr + 'T00:00:00');
  const effective13thStart = empStart > thirteenthCycleStart ? empStart : thirteenthCycleStart;
  
  let thirteenthDays = 0;
  if (termDate >= effective13thStart) {
    const diff = Math.abs(termDate.getTime() - effective13thStart.getTime());
    thirteenthDays = Math.min(yearlyDaysBase, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  let thirteenthSalary = 0;
  if (employee.overSalaryType === 'monthly') {
    thirteenthSalary = Number(((salary / 12) * (workedDaysInMonth / monthlyDaysBase)).toFixed(2));
  } else {
    thirteenthSalary = Number(((salary / yearlyDaysBase) * thirteenthDays).toFixed(2));
  }

  // 3. Décimo Cuarto Sueldo Proporcional (Art. 113) con SBU de Ajustes Maestros
  let fourteenthCycleStart: Date;
  if (region === 'sierra') {
    const cycleYear = termDate.getMonth() >= 7 ? termDate.getFullYear() : termDate.getFullYear() - 1;
    fourteenthCycleStart = new Date(cycleYear, 7, 1); // 1 de Agosto
  } else {
    const cycleYear = termDate.getMonth() >= 2 ? termDate.getFullYear() : termDate.getFullYear() - 1;
    fourteenthCycleStart = new Date(cycleYear, 2, 1); // 1 de Marzo
  }

  const effective14thStart = empStart > fourteenthCycleStart ? empStart : fourteenthCycleStart;
  let fourteenthDays = 0;
  if (termDate >= effective14thStart) {
    const diff = Math.abs(termDate.getTime() - effective14thStart.getTime());
    fourteenthDays = Math.min(yearlyDaysBase, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  let fourteenthSalary = 0;
  if (employee.overSalaryType === 'monthly') {
    fourteenthSalary = Number(((sbu / 12) * (workedDaysInMonth / monthlyDaysBase)).toFixed(2));
  } else {
    fourteenthSalary = Number(((sbu / yearlyDaysBase) * fourteenthDays).toFixed(2));
  }

  // 4. Vacaciones no gozadas / proporcionales (Art. 69 y 71: 15 días anuales)
  const anniversaryThisYear = new Date(termDate.getFullYear(), empStart.getMonth(), empStart.getDate());
  let lastAnniversary = anniversaryThisYear <= termDate 
    ? anniversaryThisYear 
    : new Date(termDate.getFullYear() - 1, empStart.getMonth(), empStart.getDate());
  
  if (lastAnniversary < empStart) lastAnniversary = empStart;

  const rawAccruedDays = Math.min(yearlyDaysBase, Math.ceil(Math.abs(termDate.getTime() - lastAnniversary.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const vacationAccruedDays = Number(((15 / yearlyDaysBase) * rawAccruedDays).toFixed(2));
  
  const vacationEnjoyedDays = Number(
    (employee.vacations || []).reduce((acc, v) => acc + (Number(v.days) || 0), 0).toFixed(2)
  );

  const vacationPendingDays = Number(Math.max(0, vacationAccruedDays - vacationEnjoyedDays).toFixed(2));
  const vacationAmount = Number(((salary / monthlyDaysBase) * vacationPendingDays).toFixed(2));

  // 5. Bonificación por Desahucio (Art. 185)
  const completedYears = tenure.completedYears;
  const isVoluntary = reason === TerminationReason.VOLUNTARY;
  const isLayoff = reason === TerminationReason.LAYOFF || reason === TerminationReason.UNILATERAL;
  const isMutual = reason === TerminationReason.MUTUAL_AGREEMENT || reason === TerminationReason.BILATERAL;
  
  const appliesDesahucio = isVoluntary || isLayoff || isMutual;
  const desahucioAmount = (appliesDesahucio && completedYears >= 1)
    ? Number(((salary * 0.25) * completedYears).toFixed(2))
    : 0;

  // 6. Indemnización por Despido Intempestivo (Art. 188 Código del Trabajo)
  let layoffIndemnity = 0;
  if (isLayoff) {
    if (tenure.decimalYears <= 3) {
      layoffIndemnity = Number((salary * 3).toFixed(2));
    } else {
      const yearsOrFraction = Math.min(25, Math.ceil(tenure.decimalYears));
      layoffIndemnity = Number((salary * yearsOrFraction).toFixed(2));
    }
  }

  // 7. Fondos de Reserva Proporcionales (Art. 196) usando tasa de Ajustes Maestros
  let reserveFunds = 0;
  if (employee.reserveFundType === 'accumulate' && tenure.decimalYears >= 1) {
    reserveFunds = Number(((salary * reserveRate / monthlyDaysBase) * workedDaysInMonth).toFixed(2));
  }

  // 8. Deducciones (Aporte Personal al IESS desde Ajustes Maestros)
  const iessContribution = employee.isAffiliated ? Number((proportionalSalary * iessRate).toFixed(2)) : 0;
  const advancesDiscount = Number(Number(pendingAdvances || 0).toFixed(2));

  // 9. Totales
  const totalEarnings = Number((
    proportionalSalary +
    thirteenthSalary +
    fourteenthSalary +
    vacationAmount +
    desahucioAmount +
    layoffIndemnity +
    reserveFunds
  ).toFixed(2));

  const totalDeductions = Number((iessContribution + advancesDiscount).toFixed(2));
  const netPayable = Number((Math.max(0, totalEarnings - totalDeductions)).toFixed(2));

  return {
    workedDaysInMonth,
    proportionalSalary,
    thirteenthSalary,
    thirteenthDays,
    fourteenthSalary,
    fourteenthDays,
    fourteenthRegion: region,
    vacationAmount,
    vacationPendingDays,
    vacationAccruedDays,
    vacationEnjoyedDays,
    desahucioAmount,
    yearsOfService: Number(tenure.decimalYears.toFixed(2)),
    completedYears,
    layoffIndemnity,
    reserveFunds,
    otherBonuses: 0,
    otherBonusesReason: '',
    iessContribution,
    advancesDiscount,
    otherDiscounts: 0,
    otherDiscountsReason: '',
    totalEarnings,
    totalDeductions,
    netPayable
  };
}

/**
 * Calcula el Domingo de Pascua gregoriano para un año dado (algoritmo de Meeus/Jones/Butcher)
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day, 12, 0, 0);
}

/**
 * Feriados nacionales obligatorios y no recuperables en Ecuador conforme al Art. 65
 * del Código del Trabajo, Ley de Feriados y Calendario Oficial vigente 2026 (incluye traslados y decretos).
 */
const ECUADOR_OFFICIAL_HOLIDAYS_2026 = new Set<string>([
  '2026-01-01', // Año Nuevo
  '2026-01-02', // Puente Decreto Ejecutivo 249
  '2026-02-16', // Lunes de Carnaval
  '2026-02-17', // Martes de Carnaval
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajo
  '2026-05-24', // Batalla del Pichincha (fecha cívica)
  '2026-05-25', // Batalla del Pichincha (traslado obligatorio lunes 25 de mayo)
  '2026-08-10', // Primer Grito de Independencia
  '2026-10-09', // Independencia de Guayaquil (traslado)
  '2026-11-02', // Día de los Difuntos
  '2026-11-03', // Independencia de Cuenca
  '2026-11-20', // Suspensión de jornada Decreto Ejecutivo 507
  '2026-12-25', // Navidad
]);

export function isEcuadorMandatoryHoliday(dateKey: string, customHolidays?: string[]): boolean {
  if (!dateKey) return false;
  if (Array.isArray(customHolidays) && customHolidays.includes(dateKey)) return true;

  const parts = getDateParts(dateKey);
  if (!parts) return false;

  if (parts.year === 2026) {
    return ECUADOR_OFFICIAL_HOLIDAYS_2026.has(dateKey);
  }

  // Feriados nacionales fijos Art. 65 Código del Trabajo Ecuador
  const fixedMonthDays = new Set([
    '01-01', // Año Nuevo
    '05-01', // Día del Trabajo
    '05-24', // Batalla del Pichincha
    '08-10', // Primer Grito de Independencia
    '10-09', // Independencia de Guayaquil
    '11-02', // Día de los Difuntos
    '11-03', // Independencia de Cuenca
    '12-25', // Navidad
  ]);
  const mmdd = `${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  if (fixedMonthDays.has(mmdd)) return true;

  // Feriados móviles: Carnaval (lun/mar antes de Miércoles de Ceniza) y Viernes Santo
  const easter = getEasterSunday(parts.year);
  const addDays = (base: Date, delta: number) => {
    const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta, 12, 0, 0);
    return toLocalDateStr(dt);
  };
  const movableHolidays = new Set([
    addDays(easter, -48), // Lunes de Carnaval
    addDays(easter, -47), // Martes de Carnaval
    addDays(easter, -2),  // Viernes Santo
  ]);
  return movableHolidays.has(dateKey);
}

/**
 * Divide un intervalo [startMs, endMs] en milisegundos dentro de la franja nocturna profunda (00:00 - 06:00, Art. 55 num. 2: 100%)
 * y la franja diurna/nocturna hasta medianoche (06:00 - 24:00).
 */
function splitIntervalDayAndNight00to06(startMs: number, endMs: number): { night00to06Ms: number; day06to24Ms: number } {
  if (endMs <= startMs) return { night00to06Ms: 0, day06to24Ms: 0 };
  let night00to06Ms = 0;
  let day06to24Ms = 0;

  const startDt = new Date(startMs);
  let cursorDay = new Date(startDt.getFullYear(), startDt.getMonth(), startDt.getDate(), 0, 0, 0, 0);

  while (cursorDay.getTime() < endMs) {
    const dayStartMs = cursorDay.getTime();
    const sixAmMs = new Date(cursorDay.getFullYear(), cursorDay.getMonth(), cursorDay.getDate(), 6, 0, 0, 0).getTime();
    const nextDayStartMs = new Date(cursorDay.getFullYear(), cursorDay.getMonth(), cursorDay.getDate() + 1, 0, 0, 0, 0).getTime();

    const nightOverlap = Math.max(0, Math.min(endMs, sixAmMs) - Math.max(startMs, dayStartMs));
    const dayOverlap = Math.max(0, Math.min(endMs, nextDayStartMs) - Math.max(startMs, sixAmMs));

    night00to06Ms += nightOverlap;
    day06to24Ms += dayOverlap;

    cursorDay = new Date(cursorDay.getFullYear(), cursorDay.getMonth(), cursorDay.getDate() + 1, 0, 0, 0, 0);
  }

  return { night00to06Ms, day06to24Ms };
}

export interface MonthlyEcuadorPayrollBreakdown {
  registeredDatesCount: number;
  totalPhysicalHoursDecimal: number;
  ordinaryHoursDecimal: number;
  ordinaryDaysDecimal: number;
  autoHours50: number;
  autoHours100: number;
  exceedsArt55Limit: boolean;
}

/**
 * Calcula las horas ordinarias, suplementarias (50% - Art. 55 num. 2) y extraordinarias (100% - Art. 55 num. 2 y 4)
 * según la normativa laboral vigente en Ecuador (2026):
 * - Jornada ordinaria máxima: 8h diarias / 40h semanales.
 * - Horas suplementarias (50%): excedente sobre jornada ordinaria en días hábiles entre 06h00 y 24h00 (tope legal ref. 4h/día y 12h/semana).
 * - Horas extraordinarias / nocturnas (100%): domingos, feriados nacionales/institucionales obligatorios, horario de 00h00 a 06h00,
 *   y sábados sin jornada ordinaria pactada o en exceso de las 40h semanales / jornada sabatina.
 */
export function calculateEcuadorianMonthlyAttendancePayroll(
  emp: Employee,
  attendance: AttendanceRecord[],
  monthIndex: number,
  year: number,
  settings: GlobalSettings
): MonthlyEcuadorPayrollBreakdown {
  const effSettings = resolveEffectiveSettingsForYear(settings, year);
  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const scanStart = new Date(year, monthIndex, 1 - 6, 0, 0, 0, 0);
  const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  const groupedByDate = new Map<string, AttendanceRecord[]>();
  (attendance || []).forEach(a => {
    if (!a || a.employeeId !== emp.id || a.status !== 'confirmed' || isAuditRequestRecord(a)) return;
    const dateKey = getLocalDateKey(a.timestamp);
    if (!dateKey) return;
    const parts = getDateParts(dateKey);
    if (!parts) return;
    const dt = new Date(parts.year, parts.month, parts.day, 12, 0, 0, 0);
    if (dt < scanStart || dt > monthEnd) return;
    if (!groupedByDate.has(dateKey)) groupedByDate.set(dateKey, []);
    groupedByDate.get(dateKey)!.push(a);
  });

  // Incluir también fechas justificadas con permiso remunerado (`isPaidLeave === true`) aunque tengan 0 marcaciones físicas
  (emp.observations || []).forEach(obs => {
    if (!obs?.date || !obs.isPaidLeave || !isFullDayPermissionObs(obs)) return;
    const dateKey = getLocalDateKey(obs.date);
    if (!dateKey) return;
    const parts = getDateParts(dateKey);
    if (!parts) return;
    const dt = new Date(parts.year, parts.month, parts.day, 12, 0, 0, 0);
    if (dt < scanStart || dt > monthEnd) return;
    if (!groupedByDate.has(dateKey)) groupedByDate.set(dateKey, []);
  });

  const sched = getSafeSchedule(effSettings);
  const dailyHoursBase = effSettings.dailyHoursBase;
  const weeklyHoursBase = effSettings.weeklyHoursBase;
  const maxDailySuppHours = effSettings.maxDailySuppHours;
  const maxWeeklySuppHours = effSettings.maxWeeklySuppHours;

  const satInMins = timeStrToMinutes(sched.sat.in);
  const satOutMins = timeStrToMinutes(sched.sat.out);
  const satShiftMaxMs = satInMins >= 0 && satOutMins > satInMins
    ? Math.min(satOutMins - satInMins, dailyHoursBase * 60) * 60000
    : 0;

  const DAILY_ORDINARY_MS = dailyHoursBase * 3600000;
  const WEEKLY_ORDINARY_MS = weeklyHoursBase * 3600000;
  const DAILY_SUPP_LIMIT_MS = maxDailySuppHours * 3600000;
  const WEEKLY_SUPP_LIMIT_MS = maxWeeklySuppHours * 3600000;

  const weeklyOrdinaryMs = new Map<string, number>();
  const weeklySupp50Ms = new Map<string, number>();

  let monthPhysicalMs = 0;
  let monthOrdinaryMs = 0;
  let monthSupp50Ms = 0;
  let monthExtra100Ms = 0;
  let exceedsArt55Limit = false;
  const targetMonthDates = new Set<string>();

  const sortedDateKeys = Array.from(groupedByDate.keys()).sort((a, b) => a.localeCompare(b));

  for (const dateKey of sortedDateKeys) {
    const parts = getDateParts(dateKey);
    if (!parts) continue;
    const dayDate = new Date(parts.year, parts.month, parts.day, 12, 0, 0, 0);
    const isTargetMonth = parts.month === monthIndex && parts.year === year && dayDate >= monthStart && dayDate <= monthEnd;

    const dow = dayDate.getDay(); // 0=Dom, 6=Sáb
    const offsetToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(parts.year, parts.month, parts.day + offsetToMonday, 12, 0, 0, 0);
    const weekKey = toLocalDateStr(monday);

    const isHoliday = isEcuadorMandatoryHoliday(dateKey, effSettings.holidays);
    const isSunday = dow === 0;
    const isSaturday = dow === 6;

    const dayRecs = groupedByDate.get(dateKey) || [];
    const dayObs = (emp.observations || []).filter(o => o.date && o.date.startsWith(dateKey));
    const dailyCalc = calculateDailyWorkedIntervalsAndMinutes(
      dayRecs,
      dayObs,
      effSettings,
      dateKey,
      dailyHoursBase
    );

    if (isTargetMonth && (dayRecs.length > 0 || dailyCalc.hasPaidFullDayLeave)) {
      targetMonthDates.add(dateKey);
    }

    let dayNight00to06Ms = 0;
    let day06to24Ms = 0;

    if (dailyCalc.hasPaidFullDayLeave) {
      day06to24Ms = dailyCalc.totalMinutes * 60000;
    } else if (dailyCalc.isContinuous && dailyCalc.intervals.length > 0) {
      const iv = dailyCalc.intervals[0];
      const split = splitIntervalDayAndNight00to06(iv.startMs, iv.endMs);
      const freeBreakMs = dailyCalc.freeBreakMinutesDeducted * 60000;
      const deductFromDay = Math.min(split.day06to24Ms, freeBreakMs);
      const remBreak = freeBreakMs - deductFromDay;
      day06to24Ms = Math.max(0, split.day06to24Ms - deductFromDay);
      dayNight00to06Ms = Math.max(0, split.night00to06Ms - remBreak);
    } else {
      for (const iv of dailyCalc.intervals) {
        const split = splitIntervalDayAndNight00to06(iv.startMs, iv.endMs);
        dayNight00to06Ms += split.night00to06Ms;
        day06to24Ms += split.day06to24Ms;
      }
    }

    const totalDayPhysicalMs = dayNight00to06Ms + day06to24Ms;
    const prevWeekOrdMs = weeklyOrdinaryMs.get(weekKey) || 0;
    const remWeekOrdMs = Math.max(0, WEEKLY_ORDINARY_MS - prevWeekOrdMs);

    let dayOrdMs = 0;
    let daySupp50Ms = 0;
    let dayExtra100Ms = 0;

    if (dailyCalc.hasPaidFullDayLeave) {
      dayOrdMs = Math.min(totalDayPhysicalMs, DAILY_ORDINARY_MS, remWeekOrdMs);
    } else if (isHoliday || isSunday) {
      dayExtra100Ms = totalDayPhysicalMs;
    } else if (isSaturday) {
      dayExtra100Ms += dayNight00to06Ms;
      if (satShiftMaxMs > 0) {
        dayOrdMs = Math.min(day06to24Ms, satShiftMaxMs, remWeekOrdMs);
        dayExtra100Ms += Math.max(0, day06to24Ms - dayOrdMs);
      } else {
        dayExtra100Ms += day06to24Ms;
      }
    } else {
      dayExtra100Ms += dayNight00to06Ms;
      dayOrdMs = Math.min(day06to24Ms, DAILY_ORDINARY_MS, remWeekOrdMs);
      daySupp50Ms = Math.max(0, day06to24Ms - dayOrdMs);
    }

    weeklyOrdinaryMs.set(weekKey, prevWeekOrdMs + dayOrdMs);
    const nextWeekSupp50 = (weeklySupp50Ms.get(weekKey) || 0) + daySupp50Ms;
    weeklySupp50Ms.set(weekKey, nextWeekSupp50);

    if (isTargetMonth) {
      monthPhysicalMs += totalDayPhysicalMs;
      monthOrdinaryMs += dayOrdMs;
      monthSupp50Ms += daySupp50Ms;
      monthExtra100Ms += dayExtra100Ms;
      if (daySupp50Ms > DAILY_SUPP_LIMIT_MS || nextWeekSupp50 > WEEKLY_SUPP_LIMIT_MS) {
        exceedsArt55Limit = true;
      }
    }
  }

  return {
    registeredDatesCount: targetMonthDates.size,
    totalPhysicalHoursDecimal: monthPhysicalMs / 3600000,
    ordinaryHoursDecimal: monthOrdinaryMs / 3600000,
    ordinaryDaysDecimal: (monthOrdinaryMs / 3600000) / dailyHoursBase,
    autoHours50: monthSupp50Ms / 3600000,
    autoHours100: monthExtra100Ms / 3600000,
    exceedsArt55Limit
  };
}

