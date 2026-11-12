import { Employee, GlobalSettings, SettlementRubrics, TerminationReason } from '../types.ts';

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
 * Calcula los rubros legales de liquidación conforme al Código del Trabajo del Ecuador (vigente 2026)
 */
export function calculateEcuadorianSettlement(
  employee: Employee,
  terminationDateStr: string,
  reason: TerminationReason | string,
  settings: GlobalSettings,
  pendingAdvances: number = 0,
  region: 'sierra' | 'costa' = 'sierra'
): SettlementRubrics {
  const sbu = settings.sbu || 482.00;
  const salary = Number(employee.salary) || sbu;
  const startDateStr = employee.startDate || terminationDateStr;

  const tenure = calculateTenure(startDateStr, terminationDateStr);
  const termDate = new Date(terminationDateStr + 'T00:00:00');
  const termDay = termDate.getDate();

  // 1. Sueldo Proporcional del mes de salida (base 30 días comerciales)
  const workedDaysInMonth = Math.min(30, termDay);
  const proportionalSalary = Number(((salary / 30) * workedDaysInMonth).toFixed(2));

  // 2. Décimo Tercer Sueldo Proporcional (Ciclo: 1 Dic año anterior a 30 Nov año en curso)
  // Calculamos los días devengados desde el 1 de Diciembre del año anterior a la fecha de salida
  const prevYear = termDate.getMonth() === 11 ? termDate.getFullYear() : termDate.getFullYear() - 1;
  const thirteenthCycleStart = new Date(prevYear, 11, 1); // 1 de Dic
  const empStart = new Date(startDateStr + 'T00:00:00');
  const effective13thStart = empStart > thirteenthCycleStart ? empStart : thirteenthCycleStart;

  let thirteenthDays = 0;
  if (termDate >= effective13thStart) {
    const diff = Math.abs(termDate.getTime() - effective13thStart.getTime());
    thirteenthDays = Math.min(360, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  let thirteenthSalary = 0;
  if (employee.overSalaryType === 'monthly') {
    // Si mensualizaba, ya cobró los meses previos en el rol regular; solo le corresponde el proporcional del mes en curso
    thirteenthSalary = Number(((salary / 12) * (workedDaysInMonth / 30)).toFixed(2));
  } else {
    // Si acumulaba, se liquidan todos los días devengados del ciclo (1/12 de sueldo por 360 días)
    thirteenthSalary = Number(((salary / 360) * thirteenthDays).toFixed(2));
  }

  // 3. Décimo Cuarto Sueldo Proporcional (Art. 113)
  // Sierra/Oriente: 1 de Agosto a 31 de Julio. Costa/Galápagos: 1 de Marzo a 28/29 de Febrero.
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
    fourteenthDays = Math.min(360, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  let fourteenthSalary = 0;
  if (employee.overSalaryType === 'monthly') {
    fourteenthSalary = Number(((sbu / 12) * (workedDaysInMonth / 30)).toFixed(2));
  } else {
    fourteenthSalary = Number(((sbu / 360) * fourteenthDays).toFixed(2));
  }

  // 4. Vacaciones no gozadas / proporcionales (Art. 69 y 71: 15 días anuales, 1/24 ava parte)
  // Calculamos los días del año de servicio en curso devengados
  const anniversaryThisYear = new Date(termDate.getFullYear(), empStart.getMonth(), empStart.getDate());
  let lastAnniversary = anniversaryThisYear <= termDate
    ? anniversaryThisYear
    : new Date(termDate.getFullYear() - 1, empStart.getMonth(), empStart.getDate());

  if (lastAnniversary < empStart) lastAnniversary = empStart;

  const rawAccruedDays = Math.min(360, Math.ceil(Math.abs(termDate.getTime() - lastAnniversary.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const vacationAccruedDays = Number(((15 / 360) * rawAccruedDays).toFixed(2));

  // Días de vacaciones gozados del empleado registrados en el formulario administrativo
  const vacationEnjoyedDays = Number(
    (employee.vacations || []).reduce((acc, v) => acc + (Number(v.days) || 0), 0).toFixed(2)
  );

  // Días netos pendientes de liquidar (días devengados menos días ya gozados)
  const vacationPendingDays = Number(Math.max(0, vacationAccruedDays - vacationEnjoyedDays).toFixed(2));

  // Liquidación pecuniaria de vacaciones: valor proporcional sobre días efectivamente pendientes
  const vacationAmount = Number(((salary / 30) * vacationPendingDays).toFixed(2));

  // 5. Bonificación por Desahucio (Art. 185)
  // 25% de la última remuneración mensual por cada año completo de servicio
  const completedYears = tenure.completedYears;
  const isVoluntary = reason === TerminationReason.VOLUNTARY;
  const isLayoff = reason === TerminationReason.LAYOFF || reason === TerminationReason.UNILATERAL;
  const isMutual = reason === TerminationReason.MUTUAL_AGREEMENT || reason === TerminationReason.BILATERAL;

  // El desahucio se paga en renuncia, despido intempestivo, mutuo acuerdo o conclusión de plazo
  const appliesDesahucio = isVoluntary || isLayoff || isMutual;
  const desahucioAmount = (appliesDesahucio && completedYears >= 1)
    ? Number(((salary * 0.25) * completedYears).toFixed(2))
    : 0;

  // 6. Indemnización por Despido Intempestivo (Art. 188 Código del Trabajo)
  let layoffIndemnity = 0;
  if (isLayoff) {
    if (tenure.decimalYears <= 3) {
      // Hasta 3 años de servicio: 3 meses de la última remuneración
      layoffIndemnity = Number((salary * 3).toFixed(2));
    } else {
      // Más de 3 años: 1 mes de remuneración por cada año de servicio o fracción de año, máx 25
      const yearsOrFraction = Math.min(25, Math.ceil(tenure.decimalYears));
      layoffIndemnity = Number((salary * yearsOrFraction).toFixed(2));
    }
  }

  // 7. Fondos de Reserva Proporcionales (Art. 196)
  // Si acumulaba fondos y tiene más de 1 año de antigüedad
  let reserveFunds = 0;
  if (employee.reserveFundType === 'accumulate' && tenure.decimalYears >= 1) {
    reserveFunds = Number(((salary * 0.0833 / 30) * workedDaysInMonth).toFixed(2));
  }

  // 8. Deducciones
  // Aporte Personal al IESS (9.45%) solo grava sueldo proporcional devengado
  const iessRate = settings.iessRate || 0.0945;
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
