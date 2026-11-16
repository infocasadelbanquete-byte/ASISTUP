import React, { useState, useMemo } from 'react';
import {
  Employee,
  Payment,
  CompanyConfig,
  GlobalSettings,
  Role,
  SavedReport,
  AttendanceRecord,
  PayrollMonthlyAdjustment
} from '../../types.ts';
import Modal from '../../components/Modal.tsx';
import { calculateEcuadorianMonthlyAttendancePayroll, resolveEffectiveSettingsForYear } from '../../utils/ecuadorianLabor.ts';

interface PayrollModuleProps {
  employees: Employee[];
  payments: Payment[];
  onUpdatePayments: (payments: Payment[]) => void;
  onUpdateEmployees?: (employees: Employee[]) => void;
  attendance: AttendanceRecord[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
  role: Role;
  onSaveReport?: (report: SavedReport) => void;
}

type PayrollTab = 'fixed' | 'temporary';

interface GridEditEntry {
  workedDays?: number;
  workedHours?: number;
  valueAdjustment?: number;
  hours50?: number;
  hours100?: number;
  otherIncomes?: number;
  fines?: number;
  advances?: number;
  otherDiscounts?: number;
  adjustmentNotes?: string;
}

const MONTH_NAMES_ES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const MONTH_MAP: Record<string, number> = {
  'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
  'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
};

const cleanFloat = (val: number, decimals: number = 4): number => {
  if (!Number.isFinite(val)) return 0;
  return Number(val.toFixed(decimals));
};

const formatDecimalAdaptive = (val: number, minDec: number = 2, maxDec: number = 4): string => {
  if (!Number.isFinite(val)) return (0).toFixed(minDec);
  const roundedMax = Number(val.toFixed(maxDec));
  const fixedMax = roundedMax.toFixed(maxDec);
  const [intPart, decPart = ''] = fixedMax.split('.');
  let trimmedDec = decPart.replace(/0+$/, '');
  while (trimmedDec.length < minDec) {
    trimmedDec += '0';
  }
  return trimmedDec ? `${intPart}.${trimmedDec}` : intPart;
};

const formatDaysAndExactHours = (hoursDecimal: number, dailyHoursBase: number = 8): {
  exactHoursFormatted: string;
  daysAndExactHoursLabel: string;
} => {
  const safeHours = Number.isFinite(hoursDecimal) && hoursDecimal > 0 ? hoursDecimal : 0;
  const totalMinutes = Math.round(safeHours * 60);
  const totalH = Math.floor(totalMinutes / 60);
  const totalM = totalMinutes % 60;
  const exactHoursFormatted = `${totalH}h ${String(totalM).padStart(2, '0')}m`;

  const dayMinsBase = Math.max(60, Math.round((dailyHoursBase || 8) * 60));
  const wholeDays = Math.floor(totalMinutes / dayMinsBase);
  const remDayMinutes = totalMinutes % dayMinsBase;
  const remH = Math.floor(remDayMinutes / 60);
  const remM = remDayMinutes % 60;
  const daysAndExactHoursLabel = `${wholeDays}d ${remH}h ${String(remM).padStart(2, '0')}m`;

  return { exactHoursFormatted, daysAndExactHoursLabel };
};

const PayrollModule: React.FC<PayrollModuleProps> = ({
  employees,
  payments,
  onUpdateEmployees,
  attendance = [],
  company,
  settings,
  onSaveReport
}) => {
  const [activePayrollTab, setActivePayrollTab] = useState<PayrollTab>('fixed');
  const [selectedMonth, setSelectedMonth] = useState(() => MONTH_NAMES_ES[new Date().getMonth()] || 'FEBRERO');
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [individualPayroll, setIndividualPayroll] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'info' | 'warning'
  });

  const [gridEdits, setGridEdits] = useState<Record<string, GridEditEntry>>({});

  const periodKey = `${selectedYear}-${selectedMonth}`;
  const selectedYearNum = parseInt(selectedYear, 10) || new Date().getFullYear();

  const effectiveSettings = useMemo(
    () => resolveEffectiveSettingsForYear(settings, selectedYearNum),
    [settings, selectedYearNum]
  );

  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear();
    const maxY = Math.max(2028, currentY + 1, effectiveSettings.activeFiscalYear);
    const years: string[] = [];
    for (let y = 2024; y <= maxY; y++) {
      years.push(String(y));
    }
    return years;
  }, [effectiveSettings.activeFiscalYear]);

  const activeEmployees = useMemo(
    () => (employees || []).filter(e => e.status === 'active'),
    [employees]
  );

  const fixedCount = useMemo(
    () => activeEmployees.filter(e => e.isFixed !== false).length,
    [activeEmployees]
  );

  const temporaryCount = useMemo(
    () => activeEmployees.filter(e => e.isFixed === false).length,
    [activeEmployees]
  );

  const calculatePayrollData = (emp: Employee) => {
    const isTemporary = emp.isFixed === false;
    const monthIndex = MONTH_MAP[selectedMonth] ?? 0;
    const year = selectedYearNum;
    const yearSettings = effectiveSettings;

    // 1. Cálculo exacto conforme normativa laboral Ecuador y Ajustes del Sistema Maestro del año seleccionado
    const ecuadorCalc = calculateEcuadorianMonthlyAttendancePayroll(
      emp,
      attendance || [],
      monthIndex,
      year,
      settings
    );

    const dailyHoursBase = yearSettings.dailyHoursBase;
    const monthlyDaysBase = yearSettings.monthlyDaysBase;
    const monthlyHoursBase = yearSettings.monthlyHoursBase;
    const suppRate = yearSettings.supplementaryRate;
    const extraRate = yearSettings.extraordinaryRate;

    const registeredDatesCount = ecuadorCalc.registeredDatesCount;
    const autoExactHoursDecimal = isTemporary
      ? ecuadorCalc.totalPhysicalHoursDecimal
      : ecuadorCalc.ordinaryHoursDecimal;
    const autoExactDaysDecimal = autoExactHoursDecimal / dailyHoursBase;

    const savedAdj = emp.payrollAdjustments?.[periodKey];
    const edit = gridEdits[emp.id];

    // Resolución de horas exactas y días exactos sin redondeo
    let workedHoursDecimal: number;
    let workedDays: number;

    if (edit?.workedHours !== undefined) {
      workedHoursDecimal = Math.max(0, edit.workedHours);
      workedDays = edit.workedDays !== undefined ? Math.max(0, edit.workedDays) : workedHoursDecimal / dailyHoursBase;
    } else if (edit?.workedDays !== undefined) {
      workedDays = Math.max(0, edit.workedDays);
      workedHoursDecimal = workedDays * dailyHoursBase;
    } else if (savedAdj?.workedHours !== undefined) {
      workedHoursDecimal = Math.max(0, savedAdj.workedHours);
      workedDays = savedAdj.workedDays !== undefined ? Math.max(0, savedAdj.workedDays) : workedHoursDecimal / dailyHoursBase;
    } else if (savedAdj?.workedDays !== undefined) {
      workedDays = Math.max(0, savedAdj.workedDays);
      workedHoursDecimal = workedDays * dailyHoursBase;
    } else {
      workedHoursDecimal = autoExactHoursDecimal;
      workedDays = autoExactDaysDecimal;
    }

    const { exactHoursFormatted, daysAndExactHoursLabel } = formatDaysAndExactHours(workedHoursDecimal, dailyHoursBase);

    // 2. Tasas decimales exactas según Ajustes del Sistema Maestro (Sueldo / horas y días base mensuales)
    const salaryNum = Number(emp.salary) || 0;
    const valuePerDay = salaryNum / monthlyDaysBase;
    const baseHourlyRate = salaryNum / monthlyHoursBase;
    const rate50 = baseHourlyRate * (1 + suppRate);
    const rate100 = baseHourlyRate * (1 + extraRate);

    // 3. Cálculo proporcional exacto por horas/días decimales sin redondeo
    const baseSalaryEarned = workedHoursDecimal * baseHourlyRate;

    // 4. Pagos de tesorería del período (como base cuando no existe ajuste guardado en nómina)
    const monthlyPayments = (payments || []).filter(
      p =>
        p.employeeId === emp.id &&
        p.month === selectedMonth &&
        (!p.year || p.year === selectedYear) &&
        p.status === 'paid'
    );

    const resolveNumberField = (field: keyof Omit<GridEditEntry, 'adjustmentNotes'>, fallback: number): number => {
      if (edit && edit[field] !== undefined && Number.isFinite(edit[field])) {
        return edit[field] as number;
      }
      if (savedAdj && savedAdj[field] !== undefined && Number.isFinite(savedAdj[field])) {
        return savedAdj[field] as number;
      }
      return fallback;
    };

    const valueAdjustment = resolveNumberField('valueAdjustment', 0);
    const fines = Math.max(
      0,
      resolveNumberField(
        'fines',
        monthlyPayments.filter(p => p.type === 'Fine').reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      )
    );
    const advances = Math.max(
      0,
      resolveNumberField(
        'advances',
        monthlyPayments
          .filter(p => p.type === 'Advance' || p.type === 'Loan' || p.type === 'Emergency')
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      )
    );
    const otherDiscounts = Math.max(
      0,
      resolveNumberField(
        'otherDiscounts',
        monthlyPayments.filter(p => p.type === 'BackPay').reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      )
    );

    const adjustmentNotes =
      edit?.adjustmentNotes !== undefined
        ? edit.adjustmentNotes
        : (savedAdj?.adjustmentNotes ?? '');

    // 5. Rubros exclusivos de empleados fijos (extras/temporales excluyen IESS, horas extras, suplementarias, bonificaciones, fondos de reserva y décimos)
    const hours50 = isTemporary ? 0 : Math.max(0, resolveNumberField('hours50', ecuadorCalc.autoHours50));
    const amount50 = isTemporary ? 0 : hours50 * rate50;

    const hours100 = isTemporary ? 0 : Math.max(0, resolveNumberField('hours100', ecuadorCalc.autoHours100));
    const amount100 = isTemporary ? 0 : hours100 * rate100;

    const otherIncomes = isTemporary
      ? 0
      : Math.max(
          0,
          resolveNumberField(
            'otherIncomes',
            monthlyPayments
              .filter(p => p.type === 'Bonus' || p.type === 'Vacation')
              .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
          )
        );

    // Art. 95 C.T.: Horas suplementarias y extraordinarias forman parte de la remuneración gravada (IESS, 13ero, F. Reserva)
    const ordinaryRemuneration = Math.max(0, baseSalaryEarned + valueAdjustment + amount50 + amount100 + otherIncomes);

    const monthly13th = !isTemporary && emp.overSalaryType === 'monthly' ? ordinaryRemuneration / 12 : 0;
    // Art. 113 C.T.: Décimo cuarto sueldo se calcula sobre el SBU vigente en Ajustes del Sistema Maestro para el período
    const activeSbu = yearSettings.sbu;
    const monthly14th = !isTemporary && emp.overSalaryType === 'monthly' ? (activeSbu / 12) * (workedDays / monthlyDaysBase) : 0;

    const reserveRate = yearSettings.reserveRate;
    const reserveFund =
      !isTemporary && emp.isAffiliated && emp.reserveFundType && emp.reserveFundType !== 'none'
        ? ordinaryRemuneration * reserveRate
        : 0;
    const reserveFundPaid = !isTemporary && emp.isAffiliated && emp.reserveFundType === 'monthly' ? reserveFund : 0;

    const iessRate = yearSettings.iessRate;
    const iessContribution = !isTemporary && emp.isAffiliated ? ordinaryRemuneration * iessRate : 0;

    const totalIncomes = isTemporary
      ? baseSalaryEarned + valueAdjustment
      : baseSalaryEarned + valueAdjustment + amount50 + amount100 + monthly13th + monthly14th + reserveFundPaid + otherIncomes;

    const totalExpenses = isTemporary
      ? fines + advances + otherDiscounts
      : iessContribution + fines + advances + otherDiscounts;

    const netToReceive = totalIncomes - totalExpenses;

    const hasSavedAdjustment = !!(
      savedAdj &&
      (savedAdj.workedDays !== undefined ||
        savedAdj.workedHours !== undefined ||
        (savedAdj.valueAdjustment !== undefined && savedAdj.valueAdjustment !== 0) ||
        savedAdj.hours50 !== undefined ||
        savedAdj.hours100 !== undefined ||
        savedAdj.otherIncomes !== undefined ||
        savedAdj.fines !== undefined ||
        savedAdj.advances !== undefined ||
        savedAdj.otherDiscounts !== undefined ||
        (savedAdj.adjustmentNotes && savedAdj.adjustmentNotes.trim().length > 0))
    );

    const hasManualHourOverride = !!(
      savedAdj &&
      (savedAdj.workedDays !== undefined ||
        savedAdj.workedHours !== undefined ||
        savedAdj.hours50 !== undefined ||
        savedAdj.hours100 !== undefined)
    );

    const hasUnsavedEdit = !!(edit && Object.keys(edit).length > 0);

    return {
      isTemporary,
      registeredDatesCount,
      autoExactHoursDecimal,
      autoExactDaysDecimal,
      workedDays,
      workedHoursDecimal,
      exactHoursFormatted,
      daysAndExactHoursLabel,
      valuePerDay,
      baseHourlyRate,
      rate50,
      rate100,
      exceedsArt55Limit: !isTemporary && ecuadorCalc.exceedsArt55Limit,
      baseSalary: baseSalaryEarned,
      valueAdjustment,
      hours50,
      amount50,
      hours100,
      amount100,
      reserveFund,
      reserveFundPaid,
      monthly13th,
      monthly14th,
      otherIncomes,
      iessContribution,
      fines,
      advances,
      otherDiscounts,
      adjustmentNotes,
      totalIncomes,
      totalExpenses,
      netToReceive,
      hasSavedAdjustment,
      hasManualHourOverride,
      hasUnsavedEdit
    };
  };

  const handleGridEdit = (empId: string, field: keyof GridEditEntry, value: number | string) => {
    const dayHours = effectiveSettings.dailyHoursBase || 8;
    setGridEdits(prev => {
      const current = prev[empId] || {};
      const nextEntry: GridEditEntry = { ...current };

      if (field === 'adjustmentNotes') {
        nextEntry.adjustmentNotes = String(value);
      } else {
        const numVal = Number(value);
        const safeNum = Number.isFinite(numVal) ? numVal : 0;
        if (field === 'workedDays') {
          const clampedDays = Math.max(0, safeNum);
          nextEntry.workedDays = clampedDays;
          nextEntry.workedHours = cleanFloat(clampedDays * dayHours, 4);
        } else if (field === 'workedHours') {
          const clampedHours = Math.max(0, safeNum);
          nextEntry.workedHours = clampedHours;
          nextEntry.workedDays = cleanFloat(clampedHours / dayHours, 4);
        } else {
          (nextEntry as any)[field] = safeNum;
        }
      }

      return {
        ...prev,
        [empId]: nextEntry
      };
    });
  };

  const handleResetEmployeeAdjustment = (empId: string) => {
    setGridEdits(prev => {
      const copy = { ...prev };
      delete copy[empId];
      return copy;
    });

    const target = employees.find(e => e.id === empId);
    if (!target || !target.payrollAdjustments?.[periodKey] || !onUpdateEmployees) return;

    const updatedEmployees = employees.map(e => {
      if (e.id !== empId) return e;
      const nextAdjMap = { ...(e.payrollAdjustments || {}) };
      delete nextAdjMap[periodKey];
      return {
        ...e,
        payrollAdjustments: nextAdjMap
      };
    });

    onUpdateEmployees(updatedEmployees);
    setFeedback({
      isOpen: true,
      title: 'Cálculo Restablecido',
      message: `Se restablecieron los valores automáticos de asistencia para ${target.surname} ${target.name} en ${selectedMonth} ${selectedYear}.`,
      type: 'info'
    });
  };

  const buildCsvForTab = (tab: PayrollTab, sourceEmployees: Employee[]) => {
    const tabEmps = sourceEmployees.filter(e =>
      e.status === 'active' && (tab === 'fixed' ? e.isFixed !== false : e.isFixed === false)
    );

    if (tab === 'temporary') {
      let csv =
        '\uFEFFColaborador,Identificación,Fechas Marcadas,Días Trabajados (Decimal),Día y Horas Exactas,Horas Exactas (Decimal),Valor Día Decimal,Valor Hora Decimal,Valor Base Calculado,Ajuste de Valor,Multas,Anticipos,Otros Descuentos,Detalle / Otros Ajustes,Neto a Recibir\n';
      tabEmps.forEach(emp => {
        const d = calculatePayrollData(emp);
        csv += `"${emp.surname} ${emp.name}","${emp.identification}","${d.registeredDatesCount}","${formatDecimalAdaptive(d.workedDays, 2, 4)}","${d.daysAndExactHoursLabel} (${d.exactHoursFormatted})","${formatDecimalAdaptive(d.workedHoursDecimal, 2, 4)}","${d.valuePerDay.toFixed(4)}","${d.baseHourlyRate.toFixed(4)}","${d.baseSalary.toFixed(2)}","${d.valueAdjustment.toFixed(2)}","${d.fines.toFixed(2)}","${d.advances.toFixed(2)}","${d.otherDiscounts.toFixed(2)}","${(d.adjustmentNotes || '').replace(/"/g, '""')}","${d.netToReceive.toFixed(2)}"\n`;
      });
      return csv;
    }

    const suppPctLabel = Math.round(effectiveSettings.supplementaryRate * 100);
    const extraPctLabel = Math.round(effectiveSettings.extraordinaryRate * 100);
    const iessPctLabel = (effectiveSettings.iessRate * 100).toFixed(2);
    let csv =
      `\uFEFFColaborador,Identificación,Fechas Marcadas,Días Trabajados (Decimal),Día y Horas Exactas,Horas Exactas (Decimal),Valor Día Decimal,Valor Hora Decimal,Sueldo Base,Ajuste de Valor,Cant. H. ${suppPctLabel}%,Monto H. ${suppPctLabel}%,Cant. H. ${extraPctLabel}%,Monto H. ${extraPctLabel}%,F. Reserva Pagado,13ero,14to,Otros Ing./Bonos,IESS ${iessPctLabel}%,Multas,Anticipos,Otros Desc.,Detalle / Otros Ajustes,Neto a Recibir\n`;
    tabEmps.forEach(emp => {
      const d = calculatePayrollData(emp);
      csv += `"${emp.surname} ${emp.name}","${emp.identification}","${d.registeredDatesCount}","${formatDecimalAdaptive(d.workedDays, 2, 4)}","${d.daysAndExactHoursLabel} (${d.exactHoursFormatted})","${formatDecimalAdaptive(d.workedHoursDecimal, 2, 4)}","${d.valuePerDay.toFixed(4)}","${d.baseHourlyRate.toFixed(4)}","${d.baseSalary.toFixed(2)}","${d.valueAdjustment.toFixed(2)}","${d.hours50}","${d.amount50.toFixed(2)}","${d.hours100}","${d.amount100.toFixed(2)}","${d.reserveFundPaid.toFixed(2)}","${d.monthly13th.toFixed(2)}","${d.monthly14th.toFixed(2)}","${d.otherIncomes.toFixed(2)}","${d.iessContribution.toFixed(2)}","${d.fines.toFixed(2)}","${d.advances.toFixed(2)}","${d.otherDiscounts.toFixed(2)}","${(d.adjustmentNotes || '').replace(/"/g, '""')}","${d.netToReceive.toFixed(2)}"\n`;
    });
    return csv;
  };

  const saveAllChanges = () => {
    const now = new Date().toISOString();
    let updatedCount = 0;

    const updatedEmployees = employees.map(emp => {
      const edit = gridEdits[emp.id];
      const existingSaved = emp.payrollAdjustments?.[periodKey];
      const belongsToActiveTab =
        emp.status === 'active' &&
        (activePayrollTab === 'fixed' ? emp.isFixed !== false : emp.isFixed === false);

      if (!edit && !belongsToActiveTab) {
        return emp;
      }

      // Guardamos explícitamente los ajustes editados (y si no hubo edición previa en este empleado, solo persistimos si fue editado)
      if (!edit) {
        return emp;
      }

      updatedCount += 1;
      const isTemp = emp.isFixed === false;

      const nextAdj: PayrollMonthlyAdjustment = {
        ...(existingSaved || {}),
        periodKey,
        updatedAt: now
      };

      if (edit.workedDays !== undefined) nextAdj.workedDays = edit.workedDays;
      if (edit.workedHours !== undefined) nextAdj.workedHours = edit.workedHours;
      if (edit.valueAdjustment !== undefined) nextAdj.valueAdjustment = edit.valueAdjustment;
      if (edit.fines !== undefined) nextAdj.fines = Math.max(0, edit.fines);
      if (edit.advances !== undefined) nextAdj.advances = Math.max(0, edit.advances);
      if (edit.otherDiscounts !== undefined) nextAdj.otherDiscounts = Math.max(0, edit.otherDiscounts);
      if (edit.adjustmentNotes !== undefined) nextAdj.adjustmentNotes = edit.adjustmentNotes;

      if (!isTemp) {
        if (edit.hours50 !== undefined) nextAdj.hours50 = Math.max(0, edit.hours50);
        if (edit.hours100 !== undefined) nextAdj.hours100 = Math.max(0, edit.hours100);
        if (edit.otherIncomes !== undefined) nextAdj.otherIncomes = Math.max(0, edit.otherIncomes);
      } else {
        delete nextAdj.hours50;
        delete nextAdj.hours100;
        delete nextAdj.otherIncomes;
      }

      return {
        ...emp,
        payrollAdjustments: {
          ...(emp.payrollAdjustments || {}),
          [periodKey]: nextAdj
        }
      };
    });

    if (onUpdateEmployees && updatedCount > 0) {
      onUpdateEmployees(updatedEmployees);
    }

    const csv = buildCsvForTab(activePayrollTab, updatedEmployees);

    if (onSaveReport) {
      const tabPrefix = activePayrollTab === 'fixed' ? 'NOMINA_FIJOS' : 'NOMINA_EXTRAS_TEMPORALES';
      const report: SavedReport = {
        id: Math.random().toString(36).substr(2, 9),
        name: `${tabPrefix}_${selectedMonth}_${selectedYear}_${now.split('T')[0]}`,
        date: now,
        content: csv,
        type: 'payroll',
        month: selectedMonth,
        year: selectedYear
      };
      onSaveReport(report);
    }

    setGridEdits({});
    setFeedback({
      isOpen: true,
      title: 'Éxito al guardar',
      message:
        updatedCount > 0
          ? `Se guardaron y sincronizaron correctamente ${updatedCount} ajuste(s) en la ${activePayrollTab === 'fixed' ? 'Nómina de Empleados Fijos' : 'Nómina de Empleados Extras (Temporales)'}. El respaldo de nómina también fue almacenado en Reportes > Nóminas Guardadas.`
          : `La ${activePayrollTab === 'fixed' ? 'Nómina de Empleados Fijos' : 'Nómina de Empleados Extras (Temporales)'} fue generada y guardada en Reportes > Nóminas Guardadas.`,
      type: 'success'
    });
  };

  const exportGeneralExcel = () => {
    const csv = buildCsvForTab(activePayrollTab, employees);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const suffix = activePayrollTab === 'fixed' ? 'FIJOS' : 'EXTRAS_TEMPORALES';
    link.download = `ROL_GENERAL_${suffix}_${selectedMonth}_${selectedYear}.csv`;
    link.click();
  };

  const tabEmployees = useMemo(() => {
    return activeEmployees.filter(e => {
      const matchesTab = activePayrollTab === 'fixed' ? e.isFixed !== false : e.isFixed === false;
      if (!matchesTab) return false;
      const searchStr = `${e.name} ${e.surname} ${e.identification}`.toLowerCase();
      return searchStr.includes(searchTerm.toLowerCase());
    });
  }, [activeEmployees, activePayrollTab, searchTerm]);

  const unsavedInTabCount = useMemo(
    () => tabEmployees.filter(e => !!gridEdits[e.id] && Object.keys(gridEdits[e.id]).length > 0).length,
    [tabEmployees, gridEdits]
  );

  return (
    <div className="space-y-6 md:space-y-8 fade-in">
      {/* Cabecera y Controles */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border no-print space-y-5">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase leading-none">
              {activePayrollTab === 'fixed'
                ? 'Nómina de Empleados Fijos'
                : 'Nómina de Empleados Extras (Temporales)'}
            </h2>
            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-2">
              {activePayrollTab === 'fixed'
                ? 'Cálculo exacto sin redondeo de días, horas decimales, beneficios de ley y ajustes guardados'
                : 'Cálculo exacto sin redondeo por días, horas trabajadas en decimal y ajustes de valores (Sin IESS, Décimos, F. Reserva, Bonos ni H. Extras)'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full xl:w-auto">
            <select
              className="p-3 border rounded-xl text-[11px] font-black uppercase outline-none focus:border-blue-500 bg-white"
              value={selectedMonth}
              onChange={e => {
                setSelectedMonth(e.target.value);
                setGridEdits({});
              }}
            >
              {MONTH_NAMES_ES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              className="p-3 border rounded-xl text-[11px] font-black uppercase outline-none focus:border-blue-500 bg-white"
              value={selectedYear}
              onChange={e => {
                setSelectedYear(e.target.value);
                setGridEdits({});
              }}
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Filtrar por nombre o CI..."
              className="flex-1 min-w-[180px] p-3 border rounded-xl text-[11px] font-bold uppercase outline-none focus:border-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveAllChanges}
                className="px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl uppercase text-[10px] active:scale-95 shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Guardar Ajustes</span>
                {unsavedInTabCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-amber-400 text-slate-900 rounded-md text-[9px] font-black">
                    {unsavedInTabCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={exportGeneralExcel}
                className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl uppercase text-[10px] active:scale-95 shadow-lg transition-all cursor-pointer"
              >
                Excel
              </button>
            </div>
          </div>
        </div>

        {/* Selector de Nómina: Fijos vs Extras (Temporales) */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActivePayrollTab('fixed')}
            className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-2.5 border-2 cursor-pointer ${
              activePayrollTab === 'fixed'
                ? 'bg-blue-700 text-white border-blue-700 shadow-lg shadow-blue-700/20'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>Nómina Empleados Fijos</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                activePayrollTab === 'fixed' ? 'bg-white text-blue-700' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {fixedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActivePayrollTab('temporary')}
            className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-2.5 border-2 cursor-pointer ${
              activePayrollTab === 'temporary'
                ? 'bg-amber-600 text-white border-amber-600 shadow-lg shadow-amber-600/20'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>Nómina Empleados Extras (Temporales)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                activePayrollTab === 'temporary' ? 'bg-white text-amber-700' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {temporaryCount}
            </span>
          </button>
        </div>

        {/* Parámetros activos de Ajustes del Sistema Maestro para el año seleccionado */}
        <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-black uppercase text-slate-600">
          <span className="text-blue-700">Normativa Maestra {selectedYear}:</span>
          <span>SBU: ${effectiveSettings.sbu.toFixed(2)}</span>
          <span>IESS: {(effectiveSettings.iessRate * 100).toFixed(2)}%</span>
          <span>F. Reserva: {(effectiveSettings.reserveRate * 100).toFixed(2)}%</span>
          <span>Base: {effectiveSettings.monthlyHoursBase}h / {effectiveSettings.monthlyDaysBase}d</span>
          <span>Jornada: {effectiveSettings.dailyHoursBase}h/d ({effectiveSettings.weeklyHoursBase}h/sem)</span>
          <span>Recargos: +{Math.round(effectiveSettings.supplementaryRate * 100)}% / +{Math.round(effectiveSettings.extraordinaryRate * 100)}%</span>
        </div>
      </div>

      {/* Tabla Principal de Nómina (SIEMPRE no-print para evitar sobremontajes al imprimir el Rol Individual) */}
      <div className="bg-white p-4 md:p-6 rounded-[2.5rem] shadow-sm border overflow-hidden no-print">
        {tabEmployees.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              {activePayrollTab === 'fixed'
                ? 'No se encontraron colaboradores fijos activos con el filtro seleccionado.'
                : 'No se encontraron colaboradores extras (temporales) activos con el filtro seleccionado.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive overflow-x-auto custom-scroll">
            <table
              className={`w-full text-left border-collapse ${
                activePayrollTab === 'fixed' ? 'min-w-[2650px]' : 'min-w-[1650px]'
              }`}
            >
              <thead className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                <tr>
                  <th className="p-4 sticky left-0 bg-slate-900 z-20">Colaborador / CI</th>
                  <th className="p-4 text-center">Días (Sin Redondeo)</th>
                  <th className="p-4 text-center">Día y Horas Exactas</th>
                  <th className="p-4 text-center">Horas (Decimal)</th>
                  <th className="p-4 text-center">
                    {activePayrollTab === 'fixed' ? 'Sueldo Base' : 'Valor Base Trab.'}
                  </th>
                  <th className="p-4 text-center bg-slate-800">Ajuste Valor ($)</th>

                  {activePayrollTab === 'fixed' && (
                    <>
                      <th className="p-4 text-center bg-blue-800">Cant. H. {Math.round(effectiveSettings.supplementaryRate * 100)}%</th>
                      <th className="p-4 text-center bg-blue-900">Monto H. {Math.round(effectiveSettings.supplementaryRate * 100)}%</th>
                      <th className="p-4 text-center bg-indigo-800">Cant. H. {Math.round(effectiveSettings.extraordinaryRate * 100)}%</th>
                      <th className="p-4 text-center bg-indigo-900">Monto H. {Math.round(effectiveSettings.extraordinaryRate * 100)}%</th>
                      <th className="p-4 text-center">F. Reserva</th>
                      <th className="p-4 text-center">13ero</th>
                      <th className="p-4 text-center">14to</th>
                      <th className="p-4 text-center">Otros Ing. / Bonos</th>
                      <th className="p-4 text-center">IESS {(effectiveSettings.iessRate * 100).toFixed(2)}%</th>
                    </>
                  )}

                  <th className="p-4 text-center">Multas</th>
                  <th className="p-4 text-center">Anticipos</th>
                  <th className="p-4 text-center">Otros Desc.</th>
                  <th className="p-4 text-center">Otros / Nota Ajuste</th>
                  <th className="p-4 text-center bg-blue-700 text-white sticky right-0 z-20">Neto Recibir</th>
                  <th className="p-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="text-[10px] uppercase font-bold text-slate-700 divide-y">
                {tabEmployees.map(emp => {
                  const d = calculatePayrollData(emp);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 sticky left-0 bg-white shadow-sm z-10 min-w-[210px]">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-900 leading-none">{emp.surname} {emp.name}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="text-[8px] text-slate-400 font-mono">{emp.identification}</span>
                          <span
                            className={`text-[7px] px-1.5 py-0.5 rounded font-black ${
                              d.isTemporary ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {d.isTemporary ? 'EXTRA / TEMP.' : 'FIJO'}
                          </span>
                          {d.hasUnsavedEdit ? (
                            <span className="text-[7px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-black">
                              POR GUARDAR
                            </span>
                          ) : d.hasManualHourOverride ? (
                            <span
                              className="text-[7px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-black"
                              title="Las horas/días tienen un ajuste manual guardado. Use ↺ para volver al cálculo automático desde reportes."
                            >
                              AJUSTE MANUAL
                            </span>
                          ) : d.hasSavedAdjustment ? (
                            <span
                              className="text-[7px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-black"
                              title="Horas calculadas desde reportes de asistencia con ajustes financieros guardados"
                            >
                              SYNC + AJUSTE
                            </span>
                          ) : (
                            <span
                              className="text-[7px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-black"
                              title="Calculado en tiempo real según reportes de asistencia"
                            >
                              SYNC ASISTENCIA
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Días trabajados sin redondeo */}
                      <td className="p-2 text-center min-w-[125px]">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="w-24 p-1.5 border border-slate-200 rounded-lg text-center font-black tabular-nums focus:border-blue-500 outline-none"
                          value={cleanFloat(d.workedDays, 4)}
                          onChange={e => handleGridEdit(emp.id, 'workedDays', e.target.value)}
                          title="Días trabajados en decimal sin redondeo"
                        />
                        <p className="text-[8px] text-slate-400 mt-1 font-mono">
                          {d.registeredDatesCount} fecha(s) • ${d.valuePerDay.toFixed(4)}/d
                        </p>
                      </td>

                      {/* Día y horas exactas */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <p className="font-black text-slate-900 tabular-nums">{d.daysAndExactHoursLabel}</p>
                        <p className="text-[8px] text-blue-600 font-mono mt-0.5">
                          Total: {d.exactHoursFormatted}
                        </p>
                      </td>

                      {/* Horas en decimal */}
                      <td className="p-2 text-center min-w-[130px]">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="w-24 p-1.5 border border-blue-200 bg-blue-50/40 rounded-lg text-center font-black text-blue-800 tabular-nums focus:bg-white focus:border-blue-500 outline-none"
                          value={cleanFloat(d.workedHoursDecimal, 4)}
                          onChange={e => handleGridEdit(emp.id, 'workedHours', e.target.value)}
                          title="Horas exactas trabajadas en valor decimal"
                        />
                        <p className="text-[8px] text-slate-400 mt-1 font-mono">
                          ${d.baseHourlyRate.toFixed(4)}/h
                        </p>
                      </td>

                      {/* Valor Base */}
                      <td className="p-4 text-center font-mono font-black text-slate-800">
                        ${d.baseSalary.toFixed(2)}
                      </td>

                      {/* Ajuste de Valor ($) */}
                      <td className="p-2 text-center bg-slate-50/60">
                        <input
                          type="number"
                          step="0.01"
                          className={`w-20 p-1.5 border rounded-lg text-center font-black tabular-nums outline-none focus:border-blue-500 ${
                            d.valueAdjustment > 0
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : d.valueAdjustment < 0
                              ? 'border-red-300 bg-red-50 text-red-700'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                          value={cleanFloat(d.valueAdjustment, 2)}
                          onChange={e => handleGridEdit(emp.id, 'valueAdjustment', e.target.value)}
                          title="Ajuste directo de valor positivo o negativo ($)"
                        />
                      </td>

                      {/* Columnas exclusivas de Nómina Fijos */}
                      {activePayrollTab === 'fixed' && (
                        <>
                          <td className="p-2 text-center bg-blue-50/30">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              className="w-16 p-1.5 border border-blue-200 rounded-lg text-center font-black text-blue-700 focus:bg-white tabular-nums"
                              value={cleanFloat(d.hours50, 4)}
                              onChange={e => handleGridEdit(emp.id, 'hours50', e.target.value)}
                              title="Horas Suplementarias Art. 55 (50% sobre hora ordinaria, 06h00-24h00)"
                            />
                            <p className="text-[7.5px] text-blue-600 font-mono mt-1">
                              ${d.rate50.toFixed(4)}/h
                            </p>
                            {d.exceedsArt55Limit && (
                              <span className="block text-[7px] text-amber-600 font-black mt-0.5" title="Excede tope referencial Art. 55 (4h/día o 12h/semana)">
                                ⚠ Tope Art.55
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center font-black text-blue-800 bg-blue-50/50 font-mono">
                            ${d.amount50.toFixed(2)}
                          </td>

                          <td className="p-2 text-center bg-indigo-50/30">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              className="w-16 p-1.5 border border-indigo-200 rounded-lg text-center font-black text-indigo-700 focus:bg-white tabular-nums"
                              value={cleanFloat(d.hours100, 4)}
                              onChange={e => handleGridEdit(emp.id, 'hours100', e.target.value)}
                              title="Horas Extraordinarias Art. 55 (100%: domingos, feriados, 00h00-06h00)"
                            />
                            <p className="text-[7.5px] text-indigo-600 font-mono mt-1">
                              ${d.rate100.toFixed(4)}/h
                            </p>
                          </td>
                          <td className="p-4 text-center font-black text-indigo-800 bg-indigo-50/50 font-mono">
                            ${d.amount100.toFixed(2)}
                          </td>

                          <td className="p-4 text-center font-black text-emerald-700 font-mono">
                            ${d.reserveFundPaid.toFixed(2)}
                            {emp.reserveFundType === 'accumulate' && d.reserveFund > 0 && (
                              <span className="block text-[7px] text-slate-400">
                                (Acum: ${d.reserveFund.toFixed(2)})
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center font-mono">${d.monthly13th.toFixed(2)}</td>
                          <td className="p-4 text-center font-mono">${d.monthly14th.toFixed(2)}</td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-20 p-1.5 border border-slate-200 rounded-lg text-center font-black bg-emerald-50 text-emerald-700"
                              value={cleanFloat(d.otherIncomes, 2)}
                              onChange={e => handleGridEdit(emp.id, 'otherIncomes', e.target.value)}
                            />
                          </td>
                          <td className="p-4 text-center text-red-500 font-mono">${d.iessContribution.toFixed(2)}</td>
                        </>
                      )}

                      {/* Descuentos */}
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-16 p-1.5 border border-slate-200 rounded-lg text-center font-black bg-red-50 text-red-600"
                          value={cleanFloat(d.fines, 2)}
                          onChange={e => handleGridEdit(emp.id, 'fines', e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-16 p-1.5 border border-slate-200 rounded-lg text-center font-black bg-orange-50 text-orange-600"
                          value={cleanFloat(d.advances, 2)}
                          onChange={e => handleGridEdit(emp.id, 'advances', e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-16 p-1.5 border border-slate-200 rounded-lg text-center font-black"
                          value={cleanFloat(d.otherDiscounts, 2)}
                          onChange={e => handleGridEdit(emp.id, 'otherDiscounts', e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-center min-w-[160px]">
                        <input
                          type="text"
                          placeholder="Detalle ajuste..."
                          className="w-36 p-1.5 border border-slate-200 rounded-lg text-[9px] font-bold uppercase focus:border-blue-500 outline-none"
                          value={d.adjustmentNotes}
                          onChange={e => handleGridEdit(emp.id, 'adjustmentNotes', e.target.value.toUpperCase())}
                        />
                      </td>

                      <td className="p-4 text-center font-black text-blue-700 bg-blue-50 sticky right-0 z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] font-mono text-xs">
                        ${d.netToReceive.toFixed(2)}
                      </td>

                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setIndividualPayroll(emp)}
                            className="px-2.5 py-2 bg-blue-50 text-blue-700 font-black text-[9px] rounded-lg shadow-sm hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
                            title="Ver e imprimir Rol Individual"
                          >
                            Ver Rol
                          </button>
                          {(d.hasSavedAdjustment || d.hasUnsavedEdit) && (
                            <button
                              type="button"
                              onClick={() => handleResetEmployeeAdjustment(emp.id)}
                              className="px-2 py-2 bg-slate-100 text-slate-600 font-black text-[9px] rounded-lg hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
                              title="Restablecer cálculo automático de asistencia"
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal e Impresión Optimizada de Rol Individual */}
      <Modal
        isOpen={!!individualPayroll}
        onClose={() => setIndividualPayroll(null)}
        title="Rol Individual de Pagos"
        maxWidth="max-w-4xl"
      >
        {individualPayroll && (() => {
          const d = calculatePayrollData(individualPayroll);
          return (
            <>
              <style>{`
                @media print {
                  @page {
                    size: A4 portrait !important;
                    margin: 12mm 14mm 12mm 14mm !important;
                  }
                  #individual-role-print {
                    width: 100% !important;
                    max-width: 100% !important;
                    min-height: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    box-shadow: none !important;
                    border-radius: 0 !important;
                    background: #ffffff !important;
                    color: #0f172a !important;
                    font-size: 9.5pt !important;
                    line-height: 1.4 !important;
                    page-break-after: auto !important;
                    break-after: auto !important;
                    overflow: visible !important;
                  }
                  #individual-role-print img,
                  #individual-role-print svg {
                    display: none !important;
                  }
                  #individual-role-print table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    font-size: 9pt !important;
                  }
                  #individual-role-print th,
                  #individual-role-print td {
                    border: 0.75pt solid #cbd5e1 !important;
                    padding: 5pt 7pt !important;
                  }
                  #individual-role-print .avoid-break {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                  }
                }
              `}</style>

              <div
                id="individual-role-print"
                className="w-full max-w-3xl mx-auto bg-white p-6 sm:p-8 border border-slate-200 rounded-2xl shadow-sm text-slate-900 space-y-6 print:border-0 print:shadow-none print:p-0 print:rounded-none print:max-w-none print:space-y-4"
              >
                {/* Encabezado limpio exclusivamente tipográfico (sin imágenes del sistema) */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b-2 border-slate-900 pb-4 gap-3 avoid-break">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 leading-tight">
                      {company?.name || 'EMPRESA INSTITUCIONAL'}
                    </h3>
                    <p className="text-xs font-bold text-slate-700 mt-1">
                      RUC: {company?.ruc || '0000000000001'}
                    </p>
                    {company?.address && (
                      <p className="text-[10px] font-semibold uppercase text-slate-600 mt-0.5">
                        {company.address}
                      </p>
                    )}
                    {company?.phone && (
                      <p className="text-[10px] font-semibold text-slate-600">
                        Tel: {company.phone}
                      </p>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <p className="text-sm font-black uppercase tracking-wider text-slate-900">
                      ROL INDIVIDUAL DE PAGOS
                    </p>
                    <p className="text-xs font-bold uppercase text-slate-700 mt-0.5">
                      Período: {selectedMonth} / {selectedYear}
                    </p>
                    <p className="text-[10px] font-bold uppercase text-slate-600 mt-0.5">
                      Nómina: {d.isTemporary ? 'Personal Extra (Temporal)' : 'Personal Fijo'}
                    </p>
                  </div>
                </div>

                {/* Datos del Colaborador y Resumen Exacto de Días / Horas */}
                <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/60 print:bg-white avoid-break space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">Colaborador</p>
                      <p className="text-sm font-black uppercase text-slate-900 mt-0.5">
                        {individualPayroll.surname} {individualPayroll.name}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-slate-600 mt-0.5">
                        C.I.: {individualPayroll.identification} &bull; Cargo: {individualPayroll.role}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">Modalidad</p>
                      <p className="text-xs font-black uppercase text-slate-900 mt-0.5">
                        {d.isTemporary ? 'Empleado Extra / Temporal' : 'Empleado Fijo'}
                      </p>
                      <p className="text-[10px] font-bold text-slate-600 mt-0.5">
                        Sueldo Ref.: ${Number(individualPayroll.salary || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px] uppercase">
                    <div>
                      <p className="text-[8.5px] font-bold text-slate-500">Días Trab. (Sin Redondeo)</p>
                      <p className="text-xs font-black text-slate-900 tabular-nums mt-0.5">
                        {formatDecimalAdaptive(d.workedDays, 2, 4)} días
                      </p>
                      <p className="text-[8.5px] text-slate-500">({d.registeredDatesCount} fechas marcadas)</p>
                    </div>
                    <div>
                      <p className="text-[8.5px] font-bold text-slate-500">Día y Horas Exactas</p>
                      <p className="text-xs font-black text-slate-900 tabular-nums mt-0.5">
                        {d.daysAndExactHoursLabel}
                      </p>
                      <p className="text-[8.5px] text-slate-500">Total: {d.exactHoursFormatted}</p>
                    </div>
                    <div>
                      <p className="text-[8.5px] font-bold text-slate-500">Horas en Decimal</p>
                      <p className="text-xs font-black text-slate-900 tabular-nums mt-0.5">
                        {formatDecimalAdaptive(d.workedHoursDecimal, 2, 4)} h
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[8.5px] font-bold text-slate-500">Valor Decimal Día / Hora</p>
                      <p className="text-xs font-black text-slate-900 tabular-nums mt-0.5">
                        ${d.valuePerDay.toFixed(4)}/d
                      </p>
                      <p className="text-[8.5px] text-slate-500">${d.baseHourlyRate.toFixed(4)}/h</p>
                    </div>
                  </div>
                </div>

                {/* Cuadro Comparativo de Haberes y Egresos en Tabla Nítida */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 avoid-break">
                  <div className="border border-slate-300 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 border-b border-slate-300 px-3 py-2">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-900">
                        Haberes (Ingresos)
                      </h4>
                    </div>
                    <table className="w-full text-[10.5px]">
                      <tbody className="divide-y divide-slate-200">
                        <tr>
                          <td className="px-3 py-2 font-semibold text-slate-700">
                            {d.isTemporary ? 'Remuneración por Tiempo Laborado' : 'Sueldo Proporcional Exacto'}
                          </td>
                          <td className="px-3 py-2 text-right font-black tabular-nums">
                            ${d.baseSalary.toFixed(2)}
                          </td>
                        </tr>

                        {d.valueAdjustment !== 0 && (
                          <tr>
                            <td className="px-3 py-2 font-semibold text-slate-700">Ajuste de Valor</td>
                            <td className="px-3 py-2 text-right font-black tabular-nums">
                              ${d.valueAdjustment.toFixed(2)}
                            </td>
                          </tr>
                        )}

                        {!d.isTemporary && (
                          <>
                            <tr>
                              <td className="px-3 py-2 font-semibold text-slate-700">
                                H. Suplementarias {Math.round(effectiveSettings.supplementaryRate * 100)}% ({formatDecimalAdaptive(d.hours50, 1, 4)} h &times; ${d.rate50.toFixed(4)})
                              </td>
                              <td className="px-3 py-2 text-right font-black tabular-nums">
                                ${d.amount50.toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-semibold text-slate-700">
                                H. Extraordinarias {Math.round(effectiveSettings.extraordinaryRate * 100)}% ({formatDecimalAdaptive(d.hours100, 1, 4)} h &times; ${d.rate100.toFixed(4)})
                              </td>
                              <td className="px-3 py-2 text-right font-black tabular-nums">
                                ${d.amount100.toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-semibold text-slate-700">
                                Fondos de Reserva {individualPayroll.reserveFundType === 'accumulate' && d.reserveFund > 0 ? '(Acum. IESS)' : `(${(effectiveSettings.reserveRate * 100).toFixed(2)}%)`}
                              </td>
                              <td className="px-3 py-2 text-right font-black tabular-nums">
                                ${d.reserveFundPaid.toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-semibold text-slate-700">Décimo 13ero / 14to (Mensual)</td>
                              <td className="px-3 py-2 text-right font-black tabular-nums">
                                ${(d.monthly13th + d.monthly14th).toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-semibold text-slate-700">Otros Ingresos / Bonificaciones</td>
                              <td className="px-3 py-2 text-right font-black tabular-nums">
                                ${d.otherIncomes.toFixed(2)}
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-300">
                          <td className="px-3 py-2 font-black uppercase text-[10px]">Total Haberes</td>
                          <td className="px-3 py-2 text-right font-black tabular-nums">
                            ${d.totalIncomes.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="border border-slate-300 rounded-xl overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="bg-slate-100 border-b border-slate-300 px-3 py-2">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-900">
                          Egresos (Descuentos)
                        </h4>
                      </div>
                      <table className="w-full text-[10.5px]">
                        <tbody className="divide-y divide-slate-200">
                          {!d.isTemporary && (
                            <tr>
                              <td className="px-3 py-2 font-semibold text-slate-700">Aporte Personal IESS ({(effectiveSettings.iessRate * 100).toFixed(2)}%)</td>
                              <td className="px-3 py-2 text-right font-black tabular-nums">
                                ${d.iessContribution.toFixed(2)}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td className="px-3 py-2 font-semibold text-slate-700">Anticipos / Préstamos</td>
                            <td className="px-3 py-2 text-right font-black tabular-nums">
                              ${d.advances.toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-semibold text-slate-700">Multas</td>
                            <td className="px-3 py-2 text-right font-black tabular-nums">
                              ${d.fines.toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-semibold text-slate-700">Otros Descuentos</td>
                            <td className="px-3 py-2 text-right font-black tabular-nums">
                              ${d.otherDiscounts.toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 border-t-2 border-slate-300">
                            <td className="px-3 py-2 font-black uppercase text-[10px]">Total Egresos</td>
                            <td className="px-3 py-2 text-right font-black tabular-nums">
                              ${d.totalExpenses.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                {d.adjustmentNotes && d.adjustmentNotes.trim().length > 0 && (
                  <div className="border border-slate-300 rounded-xl px-4 py-2.5 text-[10px] avoid-break">
                    <span className="font-black uppercase text-slate-600 mr-2">Observación / Ajuste:</span>
                    <span className="font-semibold uppercase text-slate-900">{d.adjustmentNotes}</span>
                  </div>
                )}

                {/* Neto a Recibir limpio y legible */}
                <div className="border-2 border-slate-900 rounded-xl px-6 py-4 flex justify-between items-center bg-slate-50 avoid-break">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-900">
                      Líquido a Recibir
                    </p>
                    <p className="text-[9px] font-bold uppercase text-slate-500 mt-0.5">
                      Total Haberes (${d.totalIncomes.toFixed(2)}) &minus; Total Egresos (${d.totalExpenses.toFixed(2)})
                    </p>
                  </div>
                  <p className="text-3xl font-black tracking-tight tabular-nums text-slate-900">
                    ${d.netToReceive.toFixed(2)}
                  </p>
                </div>

                {/* Firmas bien distribuidas */}
                <div className="pt-12 grid grid-cols-2 gap-16 text-center text-[10px] font-black uppercase text-slate-800 avoid-break">
                  <div className="border-t border-slate-900 pt-2">
                    <p>Firma del Colaborador</p>
                    <p className="text-[8.5px] font-bold text-slate-500 mt-0.5">
                      C.I.: {individualPayroll.identification}
                    </p>
                  </div>
                  <div className="border-t border-slate-900 pt-2">
                    <p>Gerencia / Tesorería</p>
                    <p className="text-[8.5px] font-bold text-slate-500 mt-0.5">
                      {company?.name || 'Administración'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 no-print">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl uppercase text-[11px] shadow-lg tracking-widest active:scale-95 transition-all cursor-pointer"
                  >
                    Imprimir Rol Individual
                  </button>
                </div>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* Modal de Retroalimentación */}
      <div className="no-print">
        <Modal
          isOpen={feedback.isOpen}
          onClose={() => setFeedback({ ...feedback, isOpen: false })}
          title={feedback.title}
          type={feedback.type}
        >
          <div className="text-center p-6 space-y-8">
            <p className="text-slate-700 font-black uppercase text-[11px] italic leading-relaxed">
              {feedback.message}
            </p>
            <button
              type="button"
              onClick={() => setFeedback({ ...feedback, isOpen: false })}
              className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest active:scale-95 shadow-lg cursor-pointer"
            >
              Aceptar
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default PayrollModule;
