import React, { useState, useEffect, useMemo } from 'react';
import { Employee, GlobalSettings, SettlementRecord, SettlementRubrics, TerminationReason, CompanyConfig, Payment } from '../types.ts';
import { calculateTenure, calculateEcuadorianSettlement, numberToSpanishWords } from '../utils/ecuadorianLabor.ts';

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  company: CompanyConfig | null;
  settings: GlobalSettings;
  payments: Payment[];
  onConfirmSettlement: (employee: Employee, settlement: SettlementRecord, payment: Payment) => void;
  existingSettlement?: SettlementRecord;
  readOnly?: boolean;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({
  isOpen,
  onClose,
  employee,
  company,
  settings,
  payments,
  onConfirmSettlement,
  existingSettlement,
  readOnly = false
}) => {
  const [phase, setPhase] = useState<'preliminary' | 'definitive'>(
    existingSettlement || readOnly || employee.status === 'terminated' ? 'definitive' : 'preliminary'
  );

  const [terminationDate, setTerminationDate] = useState<string>(
    existingSettlement?.terminationDate || employee.terminationDate || new Date().toISOString().split('T')[0]
  );

  const [reason, setReason] = useState<TerminationReason | string>(
    existingSettlement?.reason || employee.terminationReason || TerminationReason.VOLUNTARY
  );

  const [region, setRegion] = useState<'sierra' | 'costa'>(
    existingSettlement?.rubrics.fourteenthRegion || 'sierra'
  );

  const [notes, setNotes] = useState<string>(
    existingSettlement?.notes || employee.terminationDetails || ''
  );

  // Calcular anticipos pendientes acumulados
  const calculatedPendingAdvances = useMemo(() => {
    return payments
      .filter(p => p.employeeId === employee.id && (p.type === 'Advance' || p.type === 'Loan' || p.type === 'Emergency') && p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payments, employee.id]);

  // Rubros editables de la Preliquidación
  const [rubrics, setRubrics] = useState<SettlementRubrics>(() => {
    if (existingSettlement) {
      return existingSettlement.rubrics;
    }
    return calculateEcuadorianSettlement(
      employee,
      terminationDate,
      reason,
      settings,
      calculatedPendingAdvances,
      region
    );
  });

  // Antigüedad calculada en tiempo real
  const tenure = useMemo(() => {
    return calculateTenure(employee.startDate, terminationDate);
  }, [employee.startDate, terminationDate]);

  // Reiniciar estado si cambia de empleado o abre modal
  useEffect(() => {
    if (isOpen) {
      if (existingSettlement) {
        setRubrics(existingSettlement.rubrics);
        setTerminationDate(existingSettlement.terminationDate);
        setReason(existingSettlement.reason);
        setRegion(existingSettlement.rubrics.fourteenthRegion);
        setNotes(existingSettlement.notes);
        setPhase('definitive');
      } else {
        const initial = calculateEcuadorianSettlement(
          employee,
          terminationDate,
          reason,
          settings,
          calculatedPendingAdvances,
          region
        );
        setRubrics(initial);
        if (readOnly || employee.status === 'terminated') {
          setPhase('definitive');
        } else {
          setPhase('preliminary');
        }
      }
    }
  }, [isOpen, employee, existingSettlement, readOnly]);

  // Recalcular automáticamente si el usuario cambia de Causal o Fecha en la preliquidación
  const handleRecalculate = (customReason?: string, customDate?: string, customRegion?: 'sierra' | 'costa') => {
    const targetReason = customReason || reason;
    const targetDate = customDate || terminationDate;
    const targetRegion = customRegion || region;

    const recalculated = calculateEcuadorianSettlement(
      employee,
      targetDate,
      targetReason,
      settings,
      rubrics.advancesDiscount || calculatedPendingAdvances,
      targetRegion
    );

    // Mantener bonos y descuentos personalizados si ya fueron ingresados
    setRubrics(prev => ({
      ...recalculated,
      otherBonuses: prev.otherBonuses,
      otherBonusesReason: prev.otherBonusesReason,
      otherDiscounts: prev.otherDiscounts,
      otherDiscountsReason: prev.otherDiscountsReason,
      totalEarnings: Number((recalculated.totalEarnings + (prev.otherBonuses || 0)).toFixed(2)),
      totalDeductions: Number((recalculated.totalDeductions + (prev.otherDiscounts || 0)).toFixed(2)),
      netPayable: Number((Math.max(0, recalculated.totalEarnings + (prev.otherBonuses || 0) - (recalculated.totalDeductions + (prev.otherDiscounts || 0)))).toFixed(2))
    }));
  };

  // Manejo de cambios directos en los inputs de rubros
  const handleRubricChange = (field: keyof SettlementRubrics, value: any) => {
    setRubrics(prev => {
      const updated = { ...prev, [field]: value };
      
      // Recalcular totales en vivo
      const totalEarnings = Number((
        Number(updated.proportionalSalary || 0) +
        Number(updated.thirteenthSalary || 0) +
        Number(updated.fourteenthSalary || 0) +
        Number(updated.vacationAmount || 0) +
        Number(updated.desahucioAmount || 0) +
        Number(updated.layoffIndemnity || 0) +
        Number(updated.reserveFunds || 0) +
        Number(updated.otherBonuses || 0)
      ).toFixed(2));

      const totalDeductions = Number((
        Number(updated.iessContribution || 0) +
        Number(updated.advancesDiscount || 0) +
        Number(updated.otherDiscounts || 0)
      ).toFixed(2));

      const netPayable = Number((Math.max(0, totalEarnings - totalDeductions)).toFixed(2));

      return {
        ...updated,
        totalEarnings,
        totalDeductions,
        netPayable
      };
    });
  };

  // Confirmar y Formalizar la Liquidación
  const handleConfirm = () => {
    const voucherCode = `LIQ-${employee.identification.slice(-4)}-${Date.now().toString().slice(-4)}`;
    const settlementRecord: SettlementRecord = {
      id: existingSettlement?.id || Math.random().toString(36).substr(2, 9),
      employeeId: employee.id,
      employeeName: `${employee.surname} ${employee.name}`,
      employeeCedula: employee.identification,
      employeeRole: employee.role,
      companyName: company?.name || 'EMPRESA INSTITUCIONAL',
      companyRuc: company?.ruc || '1790000000001',
      companyLegalRep: company?.legalRep || 'GERENCIA GENERAL',
      companyAddress: company?.address || 'Ecuador',
      startDate: employee.startDate,
      terminationDate,
      tenureYears: tenure.years,
      tenureMonths: tenure.months,
      tenureDays: tenure.days,
      baseSalary: employee.salary,
      reason,
      notes,
      rubrics,
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
      voucherCode
    };

    // Crear comprobante en pagos contables
    const paymentRecord: Payment = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: employee.id,
      amount: rubrics.netPayable,
      date: terminationDate,
      month: new Intl.DateTimeFormat('es-EC', { month: 'long' }).format(new Date(terminationDate + 'T00:00:00')).toUpperCase(),
      year: new Date(terminationDate + 'T00:00:00').getFullYear().toString(),
      type: 'Settlement',
      method: 'Transferencia',
      concept: `LIQUIDACIÓN DEFINITIVA Y ACTA DE FINIQUITO (${reason})`,
      status: 'paid',
      voucherCode
    };

    const updatedEmployee: Employee = {
      ...employee,
      status: 'terminated',
      terminationDate,
      terminationReason: reason,
      terminationDetails: notes.toUpperCase(),
      settlement: settlementRecord
    };

    onConfirmSettlement(updatedEmployee, settlementRecord, paymentRecord);
    setPhase('definitive');
  };

  const netWords = useMemo(() => {
    return numberToSpanishWords(rubrics.netPayable);
  }, [rubrics.netPayable]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto print:static print:p-0 print:m-0 print:bg-transparent print:backdrop-blur-none">
      <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 print:shadow-none print:border-none print:w-full print:max-w-none print:overflow-visible print:max-h-none print:rounded-none">
        
        {/* HEADER MODAL */}
        <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-xl shadow-lg">⚖️</span>
              <div>
                <h3 className="text-lg font-[950] uppercase tracking-tight leading-none">
                  Liquidación Laboral Ecuatoriana (2026)
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Código del Trabajo del Ecuador • SBU Vigente: ${settings.sbu?.toFixed(2) || '482.00'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setPhase('preliminary')}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  phase === 'preliminary' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                1. Modificar Valores y Rubros
              </button>
              <button
                type="button"
                onClick={() => setPhase('definitive')}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  phase === 'definitive' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                2. Acta Definitiva (3 Copias A4)
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-lg transition-all cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scroll flex-1 space-y-6">
          
          {/* FASE 1: PRELIQUIDACIÓN GERENCIAL (MODIFICABLE) */}
          {phase === 'preliminary' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Tarjeta Informativa del Trabajador */}
              <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-3xl border border-blue-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white rounded-2xl border-2 border-blue-200 flex items-center justify-center text-2xl font-black text-blue-700 shadow-sm shrink-0">
                    {employee.name[0]}
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 uppercase leading-none">
                      {employee.surname} {employee.name}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                      CI: <span className="font-mono text-slate-800 font-black">{employee.identification}</span> • Cargo: <span className="text-blue-600 font-black">{employee.role}</span>
                    </p>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-1">
                      Ingreso: <span className="text-slate-700">{employee.startDate}</span> • Sueldo Base: <span className="text-emerald-700 font-bold">${employee.salary.toFixed(2)}</span>
                    </p>
                  </div>
                </div>

                <div className="bg-white px-5 py-3 rounded-2xl border border-blue-100 text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiempo de Servicio</p>
                  <p className="text-sm font-black text-slate-900 uppercase">
                    {tenure.years} años, {tenure.months} meses, {tenure.days} días
                  </p>
                  <p className="text-[9px] font-bold text-blue-600 uppercase">
                    ({tenure.completedYears} años completos cumplidos)
                  </p>
                </div>
              </div>

              {/* Parámetros de la Salida */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-200/70">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Fecha de Salida (Corte)</label>
                  <input
                    type="date"
                    value={terminationDate}
                    onChange={e => {
                      setTerminationDate(e.target.value);
                      handleRecalculate(reason, e.target.value, region);
                    }}
                    className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-black uppercase focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Causal Legal de Salida</label>
                  <select
                    value={reason}
                    onChange={e => {
                      const newReason = e.target.value as TerminationReason;
                      setReason(newReason);
                      handleRecalculate(newReason, terminationDate, region);
                    }}
                    className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-black uppercase focus:border-blue-500 outline-none"
                  >
                    {Object.values(TerminationReason).map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Régimen Décimo Cuarto</label>
                  <select
                    value={region}
                    onChange={e => {
                      const newReg = e.target.value as 'sierra' | 'costa';
                      setRegion(newReg);
                      handleRecalculate(reason, terminationDate, newReg);
                    }}
                    className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-black uppercase focus:border-blue-500 outline-none"
                  >
                    <option value="sierra">Sierra / Amazonía (Ago 1 - Jul 31)</option>
                    <option value="costa">Costa / Galápagos (Mar 1 - Feb 28)</option>
                  </select>
                </div>
              </div>

              {/* Rubros Modificables: Tabla Detallada */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* COLUMNA 1: HABERES (INGRESOS) */}
                <div className="bg-white p-6 rounded-3xl border-2 border-emerald-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-3 border-emerald-100">
                    <h5 className="text-[11px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">
                      <span>💰</span> Haberes / Ingresos Proporcionales
                    </h5>
                    <span className="text-[9px] font-black text-slate-400 uppercase">Valores Modificables</span>
                  </div>

                  {/* Sueldo Proporcional */}
                  <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-slate-800 uppercase">Sueldo Proporcional</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Días mes salida:</span>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={rubrics.workedDaysInMonth}
                          onChange={e => {
                            const d = Number(e.target.value) || 0;
                            const newVal = Number(((employee.salary / 30) * d).toFixed(2));
                            handleRubricChange('workedDaysInMonth', d);
                            handleRubricChange('proportionalSalary', newVal);
                          }}
                          className="w-14 p-1 bg-white border rounded text-center text-xs font-black"
                        />
                      </div>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        step="0.01"
                        value={rubrics.proportionalSalary}
                        onChange={e => handleRubricChange('proportionalSalary', Number(e.target.value) || 0)}
                        className="w-full p-2 bg-white border-2 border-emerald-200 rounded-xl text-right font-black text-sm text-emerald-700"
                      />
                    </div>
                  </div>

                  {/* Décimo Tercer Sueldo */}
                  <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-slate-800 uppercase">Décimo Tercer Sueldo (Art. 111)</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                        {employee.overSalaryType === 'monthly' ? 'Mensualizado (Proporcional mes)' : `Acumulado (${rubrics.thirteenthDays} días devengados)`}
                      </p>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        step="0.01"
                        value={rubrics.thirteenthSalary}
                        onChange={e => handleRubricChange('thirteenthSalary', Number(e.target.value) || 0)}
                        className="w-full p-2 bg-white border-2 border-emerald-200 rounded-xl text-right font-black text-sm text-emerald-700"
                      />
                    </div>
                  </div>

                  {/* Décimo Cuarto Sueldo */}
                  <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-slate-800 uppercase">Décimo Cuarto Sueldo (Art. 113)</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                        {employee.overSalaryType === 'monthly' ? 'Mensualizado (Proporcional mes)' : `Bono Escolar (${rubrics.fourteenthDays} días devengados)`}
                      </p>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        step="0.01"
                        value={rubrics.fourteenthSalary}
                        onChange={e => handleRubricChange('fourteenthSalary', Number(e.target.value) || 0)}
                        className="w-full p-2 bg-white border-2 border-emerald-200 rounded-xl text-right font-black text-sm text-emerald-700"
                      />
                    </div>
                  </div>

                  {/* Vacaciones no gozadas */}
                  <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-slate-800 uppercase">Vacaciones no Gozadas (Arts. 69, 71)</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                        {rubrics.vacationEnjoyedDays !== undefined && rubrics.vacationEnjoyedDays > 0 ? (
                          <span className="text-blue-600 font-bold">
                            Devengados: {rubrics.vacationAccruedDays || rubrics.vacationPendingDays}d • Gozados: {rubrics.vacationEnjoyedDays}d • Pendientes: {rubrics.vacationPendingDays} días
                          </span>
                        ) : (
                          `Equivalente a ${rubrics.vacationPendingDays} días devengados pendientes`
                        )}
                      </p>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        step="0.01"
                        value={rubrics.vacationAmount}
                        onChange={e => handleRubricChange('vacationAmount', Number(e.target.value) || 0)}
                        className="w-full p-2 bg-white border-2 border-emerald-200 rounded-xl text-right font-black text-sm text-emerald-700"
                      />
                    </div>
                  </div>

                  {/* Desahucio Art. 185 */}
                  <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-slate-800 uppercase">Bonif. Desahucio (Art. 185)</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                        25% sueldo por año completo ({rubrics.completedYears} años)
                      </p>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        step="0.01"
                        value={rubrics.desahucioAmount}
                        onChange={e => handleRubricChange('desahucioAmount', Number(e.target.value) || 0)}
                        className="w-full p-2 bg-white border-2 border-emerald-200 rounded-xl text-right font-black text-sm text-emerald-700"
                      />
                    </div>
                  </div>

                  {/* Despido Intempestivo Art. 188 */}
                  <div className={`p-3 rounded-2xl flex items-center justify-between gap-3 transition-all ${
                    rubrics.layoffIndemnity > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                  }`}>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-slate-800 uppercase">Indem. Despido Intempestivo (Art. 188)</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                        {reason === TerminationReason.LAYOFF || reason === TerminationReason.UNILATERAL 
                          ? 'Aplica por terminación involuntaria' 
                          : 'No aplica en renuncia o mutuo acuerdo'}
                      </p>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        step="0.01"
                        value={rubrics.layoffIndemnity}
                        onChange={e => handleRubricChange('layoffIndemnity', Number(e.target.value) || 0)}
                        className="w-full p-2 bg-white border-2 border-amber-200 rounded-xl text-right font-black text-sm text-amber-800"
                      />
                    </div>
                  </div>

                  {/* Fondos de Reserva */}
                  {rubrics.reserveFunds > 0 && (
                    <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-800 uppercase">Fondos de Reserva (Art. 196)</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Proporcional acumulado (8.33%)</p>
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          step="0.01"
                          value={rubrics.reserveFunds}
                          onChange={e => handleRubricChange('reserveFunds', Number(e.target.value) || 0)}
                          className="w-full p-2 bg-white border-2 border-emerald-200 rounded-xl text-right font-black text-sm text-emerald-700"
                        />
                      </div>
                    </div>
                  )}

                  {/* Otros Haberes Adicionales */}
                  <div className="p-3 bg-slate-50 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black text-slate-800 uppercase">Otros Haberes / Bonificación Especial</p>
                      <div className="w-32">
                        <input
                          type="number"
                          step="0.01"
                          value={rubrics.otherBonuses}
                          onChange={e => handleRubricChange('otherBonuses', Number(e.target.value) || 0)}
                          className="w-full p-2 bg-white border-2 border-emerald-200 rounded-xl text-right font-black text-sm text-emerald-700"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="CONCEPTO DEL HABER ADICIONAL (OPCIONAL)"
                      value={rubrics.otherBonusesReason}
                      onChange={e => handleRubricChange('otherBonusesReason', e.target.value.toUpperCase())}
                      className="w-full p-2 bg-white border rounded-lg text-[9px] font-bold uppercase outline-none"
                    />
                  </div>

                  {/* Total Haberes */}
                  <div className="p-4 bg-emerald-50 rounded-2xl flex justify-between items-center border border-emerald-200">
                    <span className="text-xs font-[950] text-emerald-900 uppercase">Total Haberes</span>
                    <span className="text-lg font-[950] text-emerald-800">${rubrics.totalEarnings.toFixed(2)}</span>
                  </div>
                </div>

                {/* COLUMNA 2: DEDUCCIONES (DESCUENTOS) */}
                <div className="bg-white p-6 rounded-3xl border-2 border-red-100 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-3 border-red-100">
                      <h5 className="text-[11px] font-black text-red-800 uppercase tracking-widest flex items-center gap-2">
                        <span>📉</span> Descuentos / Deducciones
                      </h5>
                      <span className="text-[9px] font-black text-slate-400 uppercase">Valores Modificables</span>
                    </div>

                    {/* Aporte Personal IESS (9.45%) */}
                    <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-800 uppercase">Aporte Personal IESS (9.45%)</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                          Aplica sobre sueldo proporcional devengado
                        </p>
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          step="0.01"
                          value={rubrics.iessContribution}
                          onChange={e => handleRubricChange('iessContribution', Number(e.target.value) || 0)}
                          className="w-full p-2 bg-white border-2 border-red-200 rounded-xl text-right font-black text-sm text-red-700"
                        />
                      </div>
                    </div>

                    {/* Anticipos y Préstamos pendientes */}
                    <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-800 uppercase">Anticipos / Préstamos Pendientes</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                          Saldo registrado en módulo financiero
                        </p>
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          step="0.01"
                          value={rubrics.advancesDiscount}
                          onChange={e => handleRubricChange('advancesDiscount', Number(e.target.value) || 0)}
                          className="w-full p-2 bg-white border-2 border-red-200 rounded-xl text-right font-black text-sm text-red-700"
                        />
                      </div>
                    </div>

                    {/* Otras Retenciones */}
                    <div className="p-3 bg-slate-50 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black text-slate-800 uppercase">Otras Deducciones / Descuentos</p>
                        <div className="w-32">
                          <input
                            type="number"
                            step="0.01"
                            value={rubrics.otherDiscounts}
                            onChange={e => handleRubricChange('otherDiscounts', Number(e.target.value) || 0)}
                            className="w-full p-2 bg-white border-2 border-red-200 rounded-xl text-right font-black text-sm text-red-700"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="DETALLE DE LA RETENCIÓN (UNIFORME, HERRAMIENTAS, ETC.)"
                        value={rubrics.otherDiscountsReason}
                        onChange={e => handleRubricChange('otherDiscountsReason', e.target.value.toUpperCase())}
                        className="w-full p-2 bg-white border rounded-lg text-[9px] font-bold uppercase outline-none"
                      />
                    </div>

                    {/* Total Deducciones */}
                    <div className="p-4 bg-red-50 rounded-2xl flex justify-between items-center border border-red-200">
                      <span className="text-xs font-[950] text-red-900 uppercase">Total Descuentos</span>
                      <span className="text-lg font-[950] text-red-800">-${rubrics.totalDeductions.toFixed(2)}</span>
                    </div>

                    {/* Observaciones Gerenciales */}
                    <div className="space-y-1 pt-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                        Observaciones y Notas para el Expediente
                      </label>
                      <textarea
                        rows={3}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="OBSERVACIONES O DETALLES GERENCIALES ACORDADOS EN LA LIQUIDACIÓN..."
                        className="w-full p-3 bg-slate-50 border-2 rounded-xl text-xs font-bold uppercase focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Resumen Final Neto */}
                  <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-2 shadow-xl mt-4">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                      Valor Líquido a Pagar (Finiquito)
                    </p>
                    <p className="text-3xl font-[950] tracking-tight">
                      ${rubrics.netPayable.toFixed(2)}
                    </p>
                    <p className="text-[9px] font-bold text-slate-300 uppercase italic leading-tight">
                      {netWords}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botonera de Acción */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => handleRecalculate()}
                  className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl uppercase text-[10px] tracking-wider transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>🔄</span> Restaurar Cálculo Legal Base
                </button>

                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 sm:flex-none px-6 py-3.5 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px] tracking-wider cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="flex-1 sm:flex-none px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{existingSettlement || employee.status === 'terminated' ? '💾' : '✓'}</span> 
                    <span>{existingSettlement || employee.status === 'terminated' ? 'Guardar Modificaciones en Acta Definitiva' : 'Confirmar y Generar Liquidación Definitiva'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FASE 2: LIQUIDACIÓN DEFINITIVA FORMAL (3 COPIAS IMPRIMIBLES) */}
          {phase === 'definitive' && (
            <div className="space-y-8 animate-in fade-in">
              {/* Barra superior de control */}
              <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 no-print shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-md">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-emerald-950 uppercase tracking-tight">
                      Liquidación Formal Definitiva Generada
                    </h4>
                    <p className="text-[10px] font-bold text-emerald-700 uppercase">
                      Documento oficial listo para impresión con 3 copias reglamentarias
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setPhase('preliminary')}
                    className="flex-1 sm:flex-none px-5 py-3 bg-white border-2 border-emerald-400 text-emerald-900 hover:bg-emerald-100 font-black rounded-xl uppercase text-[9px] tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span>✏️</span> Modificar Acta de Finiquito Definitiva
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 sm:flex-none px-8 py-3.5 bg-slate-900 hover:bg-blue-700 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>🖨️</span> Imprimir 3 Copias Oficiales
                  </button>
                </div>
              </div>

              {/* DOCUMENTO OFICIAL FORMAL (3 EJEMPLARES DETALLADOS PARA HOJA A4) */}
              <div id="settlement-print-document" className="space-y-12 print:space-y-0 text-slate-900 flex flex-col items-center">
                {[
                  { title: "COPIA 1: EJEMPLAR DE GERENCIA / DIRECCIÓN GENERAL", color: "border-blue-600", tag: "GERENCIA", type: 'gerencia' },
                  { title: "COPIA 2: EJEMPLAR DE ARCHIVO / TALENTO HUMANO", color: "border-slate-800", tag: "ARCHIVO / RRHH", type: 'archivo' },
                  { title: "COPIA 3: EJEMPLAR DEL COLABORADOR / EX-EMPLEADO", color: "border-emerald-600", tag: "EMPLEADO", type: 'empleado' }
                ].map((copy, index) => (
                  <div
                    key={index}
                    className={`a4-sheet bg-white p-6 sm:p-10 md:p-12 border-2 ${copy.color} shadow-2xl print:shadow-none print:border-none print:p-0 print:m-0 ${index < 2 ? 'print:break-after-page' : 'no-break-after'}`}
                  >
                    {/* Encabezado Institucional */}
                    <div className="border-b-2 border-slate-900 pb-4 mb-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h1 className="text-xl md:text-2xl font-[950] tracking-tight uppercase text-slate-900 leading-none">
                            {company?.name || 'EMPRESA INSTITUCIONAL S.A.'}
                          </h1>
                          <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                            RUC: {company?.ruc || '1790000000001'} • Rep. Legal: {company?.legalRep || 'Gerencia General'}
                          </p>
                          <p className="text-[9px] font-medium text-slate-400 uppercase">
                            {company?.address || 'Ecuador'} • Tel: {company?.phone || '022000000'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black uppercase rounded-lg tracking-widest">
                            {copy.tag}
                          </span>
                          <p className="text-[9px] font-mono font-bold text-slate-400 mt-2">
                            Fecha: {terminationDate}
                          </p>
                        </div>
                      </div>

                      <div className="text-center mt-6">
                        <h2 className="text-base md:text-lg font-[950] uppercase tracking-wide text-slate-900">
                          ACTA DE FINIQUITO Y LIQUIDACIÓN DEFINITIVA DE HABERES
                        </h2>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                          Conforme a las leyes laborales vigentes de la República del Ecuador (Código del Trabajo)
                        </p>
                      </div>
                    </div>

                    {/* Datos del Trabajador */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 text-[11px] font-bold uppercase space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                          <span className="text-slate-400 text-[9px] block">Colaborador:</span>
                          <span className="text-slate-900 font-black">{employee.surname} {employee.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] block">N° Cédula / RUC:</span>
                          <span className="text-slate-900 font-mono font-black">{employee.identification}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] block">Cargo Desempeñado:</span>
                          <span className="text-blue-700 font-black">{employee.role}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] block">Última Remuneración:</span>
                          <span className="text-emerald-700 font-black">${employee.salary.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-200">
                        <div>
                          <span className="text-slate-400 text-[9px] block">Fecha de Ingreso:</span>
                          <span className="text-slate-800">{employee.startDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] block">Fecha de Salida:</span>
                          <span className="text-slate-800">{terminationDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] block">Tiempo de Servicio:</span>
                          <span className="text-slate-800 font-black">{tenure.years}a, {tenure.months}m, {tenure.days}d</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] block">Causal Legal:</span>
                          <span className="text-slate-900 font-black">{reason}</span>
                        </div>
                      </div>
                    </div>

                    {/* Tabla de Rubros Financieros */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden mb-6 text-xs">
                      <div className="grid grid-cols-2 bg-slate-100 p-3 font-black text-slate-700 uppercase border-b text-[10px]">
                        <span>I. HABERES E INGRESOS PROPORCIONALES</span>
                        <span className="text-right">VALOR ($)</span>
                      </div>
                      <div className="divide-y text-[11px] font-bold uppercase">
                        <div className="p-2.5 px-4 flex justify-between">
                          <span className="text-slate-600">Sueldo Proporcional ({rubrics.workedDaysInMonth} días trabajados)</span>
                          <span className="text-slate-900 font-mono">${rubrics.proportionalSalary.toFixed(2)}</span>
                        </div>
                        <div className="p-2.5 px-4 flex justify-between">
                          <span className="text-slate-600">Décimo Tercer Sueldo Proporcional (Art. 111)</span>
                          <span className="text-slate-900 font-mono">${rubrics.thirteenthSalary.toFixed(2)}</span>
                        </div>
                        <div className="p-2.5 px-4 flex justify-between">
                          <span className="text-slate-600">Décimo Cuarto Sueldo Proporcional (Art. 113)</span>
                          <span className="text-slate-900 font-mono">${rubrics.fourteenthSalary.toFixed(2)}</span>
                        </div>
                        <div className="p-2.5 px-4 flex justify-between">
                          <div>
                            <span className="text-slate-600 block">Vacaciones No Gozadas / Proporcionales (Arts. 69, 71)</span>
                            {rubrics.vacationEnjoyedDays !== undefined && rubrics.vacationEnjoyedDays > 0 ? (
                              <span className="text-[9px] text-blue-700 block font-normal">
                                Devengados: {rubrics.vacationAccruedDays || rubrics.vacationPendingDays}d • Días gozados descontados: {rubrics.vacationEnjoyedDays}d • Saldo liquidado: {rubrics.vacationPendingDays} días
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400 block font-normal">{rubrics.vacationPendingDays} días devengados</span>
                            )}
                          </div>
                          <span className="text-slate-900 font-mono">${rubrics.vacationAmount.toFixed(2)}</span>
                        </div>
                        {rubrics.desahucioAmount > 0 && (
                          <div className="p-2.5 px-4 flex justify-between">
                            <span className="text-slate-600">Bonificación por Desahucio (Art. 185 - {rubrics.completedYears} años)</span>
                            <span className="text-slate-900 font-mono">${rubrics.desahucioAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {rubrics.layoffIndemnity > 0 && (
                          <div className="p-2.5 px-4 flex justify-between bg-amber-50/50">
                            <span className="text-amber-900 font-black">Indemnización por Despido Intempestivo (Art. 188)</span>
                            <span className="text-amber-900 font-mono font-black">${rubrics.layoffIndemnity.toFixed(2)}</span>
                          </div>
                        )}
                        {rubrics.reserveFunds > 0 && (
                          <div className="p-2.5 px-4 flex justify-between">
                            <span className="text-slate-600">Fondos de Reserva Proporcionales (Art. 196)</span>
                            <span className="text-slate-900 font-mono">${rubrics.reserveFunds.toFixed(2)}</span>
                          </div>
                        )}
                        {rubrics.otherBonuses > 0 && (
                          <div className="p-2.5 px-4 flex justify-between">
                            <span className="text-slate-600">Otros Haberes ({rubrics.otherBonusesReason || 'Bonificación Especial'})</span>
                            <span className="text-slate-900 font-mono">${rubrics.otherBonuses.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="p-3 px-4 flex justify-between bg-emerald-50/60 font-black text-emerald-950">
                          <span>SUBTOTAL HABERES</span>
                          <span className="font-mono text-sm">${rubrics.totalEarnings.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 bg-slate-100 p-3 font-black text-slate-700 uppercase border-y text-[10px]">
                        <span>II. DESCUENTOS Y DEDUCCIONES</span>
                        <span className="text-right">VALOR ($)</span>
                      </div>
                      <div className="divide-y text-[11px] font-bold uppercase">
                        <div className="p-2.5 px-4 flex justify-between">
                          <span className="text-slate-600">Aporte Personal IESS (9.45% sobre sueldo proporcional)</span>
                          <span className="text-red-700 font-mono">-${rubrics.iessContribution.toFixed(2)}</span>
                        </div>
                        {rubrics.advancesDiscount > 0 && (
                          <div className="p-2.5 px-4 flex justify-between">
                            <span className="text-slate-600">Anticipos de Sueldo / Préstamos Pendientes</span>
                            <span className="text-red-700 font-mono">-${rubrics.advancesDiscount.toFixed(2)}</span>
                          </div>
                        )}
                        {rubrics.otherDiscounts > 0 && (
                          <div className="p-2.5 px-4 flex justify-between">
                            <span className="text-slate-600">Otras Retenciones ({rubrics.otherDiscountsReason || 'Varios'})</span>
                            <span className="text-red-700 font-mono">-${rubrics.otherDiscounts.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="p-3 px-4 flex justify-between bg-red-50/60 font-black text-red-950">
                          <span>SUBTOTAL DEDUCCIONES</span>
                          <span className="font-mono text-sm">-${rubrics.totalDeductions.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* VALOR LÍQUIDO FINAL */}
                      <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider block">VALOR LÍQUIDO A RECIBIR</span>
                          <span className="text-[10px] font-bold text-slate-300 uppercase italic">SON: {netWords}</span>
                        </div>
                        <span className="text-2xl font-[950] font-mono text-emerald-400 tracking-tight">
                          ${rubrics.netPayable.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Cláusula Legal de Finiquito: Detallada con renuncia y abstención total de reclamos en Copias de Archivo y Empleado */}
                    {(copy.type === 'archivo' || copy.type === 'empleado' || copy.tag.includes('ARCHIVO') || copy.tag.includes('EMPLEADO')) ? (
                      <div className="p-5 bg-amber-50/60 border-2 border-amber-300 rounded-2xl text-[9px] font-medium leading-relaxed text-slate-800 uppercase text-justify mb-8 space-y-2.5">
                        <div className="border-b border-amber-300 pb-1.5 flex justify-between items-center">
                          <strong className="text-amber-950 font-black flex items-center gap-1.5">
                            <span>⚖️</span> CLÁUSULA ESPECIAL DE FINIQUITO, CONFORMIDAD Y ABSTENCIÓN TOTAL DE RECLAMOS:
                          </strong>
                          <span className="text-[8px] font-mono px-2 py-0.5 bg-amber-200/80 rounded text-amber-900 font-black">
                            EJEMPLAR: {copy.tag}
                          </span>
                        </div>
                        <p>
                          El trabajador / ex-empleado <strong>{employee.surname} {employee.name}</strong>, titular de la cédula de ciudadanía N° <strong>{employee.identification}</strong>, declara bajo juramento y libre de toda coacción que ha recibido a su entera, total y completa satisfacción de parte de su ex-empleador, la empresa <strong>{company?.name || 'LA EMPRESA'}</strong> (RUC: {company?.ruc || '1790000000001'}) debidamente representada por su representante legal <strong>{company?.legalRep || 'su Representante Legal'}</strong>, la cantidad neta y definitiva de <strong>${rubrics.netPayable.toFixed(2)} ({netWords})</strong>, mediante la cual se liquidan y extinguen a cabalidad todos y cada uno de los haberes, sueldo proporcional, décimo tercer y décimo cuarto sueldos proporcionales, vacaciones no gozadas devengadas (descontados debidamente los días de vacaciones gozados en el período laboral), bonificación por desahucio, indemnizaciones que correspondieren y cualquier otro beneficio o compensación legal o contractual devenida con ocasión de la relación laboral, hasta la fecha <strong>{terminationDate}</strong> en la que concluye formal y definitivamente su relación laboral con la empresa y su representante legal.
                        </p>
                        <p>
                          Por encontrarse enteramente conforme y plenamente satisfecho con todos los valores recibidos hasta la fecha de conclusión laboral, <strong>EL TRABAJADOR DECLARA EXPRESAMENTE QUE SE ABSTIENE DE MANERA FORMAL, DEFINITIVA, TOTAL E IRREVOCABLE DE FORMULAR RECLAMO ALGUNO PRESENTE O FUTURO ANTE SU EX-EMPLEADOR, ANTE EL REPRESENTANTE LEGAL DE LA EMPRESA Y ANTE LAS AUTORIDADES DE LEY</strong>, sean inspectores del trabajo, directores regionales, jueces de lo laboral, unidades judiciales o ante cualquier otra autoridad administrativa o jurisdiccional de la República del Ecuador, manifestando que no existe valor, saldo ni concepto pendiente por reclamar, otorgando en consecuencia el más amplio, irrevocable, vinculante y solemne finiquito laboral en derecho.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[9px] font-medium leading-relaxed text-slate-600 uppercase text-justify mb-8">
                        <strong>DECLARACIÓN Y ACEPTACIÓN FORMAL (EJEMPLAR GERENCIA):</strong> Las partes intervinientes dejan expresa constancia de que la presente liquidación ha sido elaborada en estricto apego y observancia a los principios y normas del Código del Trabajo de la República del Ecuador. El ex-colaborador declara recibir a entera y completa satisfacción el valor neto estipulado, otorgando al empleador el más amplio y eficaz finiquito de obligaciones laborales dimanantes de la relación individual de trabajo, manifestando no tener reclamo ulterior de índole laboral, civil ni pecuniario que formular.
                      </div>
                    )}

                    {/* Bloque Tripartito de Firmas Reglamentarias */}
                    <div className="grid grid-cols-3 gap-8 pt-8 border-t-2 border-slate-900 text-center">
                      <div className="space-y-1">
                        <div className="h-16 flex items-end justify-center">
                          <div className="w-40 border-b-2 border-slate-800"></div>
                        </div>
                        <p className="text-[10px] font-black text-slate-900 uppercase">REPRESENTANTE LEGAL</p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase">{company?.legalRep || 'GERENCIA GENERAL'}</p>
                        <p className="text-[8px] font-mono text-slate-400">RUC: {company?.ruc || '1790000000001'}</p>
                      </div>

                      <div className="space-y-1">
                        <div className="h-16 flex items-end justify-center">
                          <div className="w-40 border-b-2 border-slate-800"></div>
                        </div>
                        <p className="text-[10px] font-black text-slate-900 uppercase">TALENTO HUMANO</p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase">Revisado y Contabilizado</p>
                        <p className="text-[8px] font-mono text-slate-400">Archivo General</p>
                      </div>

                      <div className="space-y-1">
                        <div className="h-16 flex items-end justify-center">
                          <div className="w-40 border-b-2 border-slate-800"></div>
                        </div>
                        <p className="text-[10px] font-black text-slate-900 uppercase">{employee.surname} {employee.name}</p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase">TRABAJADOR / EX-EMPLEADO</p>
                        <p className="text-[8px] font-mono text-slate-400">CI: {employee.identification}</p>
                        <p className="text-[7px] font-black text-emerald-700 uppercase mt-0.5">RECIBÍ CONFORME</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER MODAL */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center no-print shrink-0">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            AsistUp Legal & Payroll Suite • República del Ecuador
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl uppercase text-[10px] tracking-wider cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettlementModal;
