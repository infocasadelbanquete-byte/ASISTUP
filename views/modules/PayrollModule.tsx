
import React, { useState } from 'react';
import { Employee, Payment, CompanyConfig, GlobalSettings, Role } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface PayrollModuleProps {
  employees: Employee[];
  payments: Payment[];
  onUpdatePayments?: (payments: Payment[]) => void;
  onUpdateEmployees?: (employees: Employee[]) => void;
  attendance: any[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
  role: Role;
}

const PayrollModule: React.FC<PayrollModuleProps> = ({ employees, payments, onUpdatePayments, onUpdateEmployees, attendance = [], company, settings, role }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('es-EC', {month: 'long'}).toUpperCase());
  const [individualPayroll, setIndividualPayroll] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [feedback, setFeedback] = useState({ isOpen: false, title: '', message: '', type: 'success' as any });
  const [showConfirmPayrollEdit, setShowConfirmPayrollEdit] = useState(false);

  // States para ajustes manuales detallados en el rol de todos los rubros
  const [adjustments, setAdjustments] = useState({
    extraHours: 0,
    bonuses: 0,
    vacation: 0,
    incomeConcept: '',
    loans: 0,
    backPay: 0, // Multas/Descuentos
    expenseConcept: '',
    thirteenth: 0,
    fourteenth: 0,
    reserve: 0
  });

  const monthMap: { [key: string]: number } = {
    'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
    'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
  };

  const calculatePayrollData = (emp: Employee, index: number) => {
    const monthIndex = monthMap[selectedMonth] ?? 0;
    const year = 2026;

    let expectedDays = 0;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, monthIndex, d);
      const dayOfWeek = date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 6) expectedDays++;
    }

    const empAttendance = (attendance || []).filter(a => {
      const d = new Date(a.timestamp);
      return a.employeeId === emp.id && 
             d.getMonth() === monthIndex && 
             d.getFullYear() === year && 
             a.status === 'confirmed';
    });

    const attendanceByDate: { [key: string]: { ins: number, half: number } } = {};
    empAttendance.forEach(a => {
      const dateStr = a.timestamp.split('T')[0];
      if (!attendanceByDate[dateStr]) attendanceByDate[dateStr] = { ins: 0, half: 0 };
      if (a.type === 'in') attendanceByDate[dateStr].ins++;
      if (a.type === 'half_day') attendanceByDate[dateStr].half++;
    });

    let workedDays = 0;
    Object.values(attendanceByDate).forEach(day => {
      if (day.ins >= 2) workedDays += 1.0;
      else if (day.ins === 1 || day.half > 0) workedDays += 0.5;
    });

    const justifiedAbsences = (emp.absences || []).filter(a => {
      const d = new Date(a.date);
      return d.getMonth() === monthIndex && d.getFullYear() === year && a.type === 'Falta' && a.justified;
    }).length;
    
    workedDays = Math.min(expectedDays, workedDays + justifiedAbsences);

    const attendanceProportion = expectedDays > 0 ? workedDays / expectedDays : 0;
    const earnedBase = emp.salary * attendanceProportion;

    const monthlyPayments = payments.filter(p => p.employeeId === emp.id && p.month === selectedMonth && p.status === 'paid');
    
    // Rubros de Ingresos
    const bonuses = monthlyPayments.filter(p => p.type === 'Bonus').reduce((sum, p) => sum + p.amount, 0);
    const extraHours = monthlyPayments.filter(p => p.type === 'ExtraHours').reduce((sum, p) => sum + p.amount, 0);
    const vacation = monthlyPayments.filter(p => p.type === 'Vacation').reduce((sum, p) => sum + p.amount, 0);
    
    // Beneficios Sociales (Cálculo base + ajustes manuales guardados como pagos)
    const adj13 = monthlyPayments.filter(p => p.type === 'Thirteenth').reduce((sum, p) => sum + p.amount, 0);
    const adj14 = monthlyPayments.filter(p => p.type === 'Fourteenth').reduce((sum, p) => sum + p.amount, 0);
    const adjRes = monthlyPayments.filter(p => p.type === 'Salary' && p.concept.includes('RESERVA')).reduce((sum, p) => sum + p.amount, 0);

    const isMonthly = emp.overSalaryType === 'monthly';
    const isAffiliated = emp.isAffiliated;
    
    const taxableIncome = earnedBase + extraHours + bonuses;

    const monthly13th = ((isAffiliated && isMonthly) ? (taxableIncome) / 12 : 0) + adj13;
    const monthly14th = ((isAffiliated && isMonthly) ? (settings.sbu / 12) * attendanceProportion : 0) + adj14;
    const reserveFund = ((isAffiliated && isMonthly) ? (taxableIncome * settings.reserveRate) : 0) + adjRes;
    
    const totalOverSalaries = monthly13th + monthly14th + reserveFund;
    const totalIncomes = earnedBase + totalOverSalaries + bonuses + extraHours + vacation;

    // Deducciones
    const iessContribution = isAffiliated ? (taxableIncome * settings.iessRate) : 0;
    const loans = monthlyPayments.filter(p => p.type === 'Loan' || p.type === 'Emergency').reduce((sum, p) => sum + p.amount, 0);
    const backPay = monthlyPayments.filter(p => p.type === 'BackPay').reduce((sum, p) => sum + p.amount, 0);
    
    const totalExpenses = iessContribution + loans + backPay;
    const netToReceive = totalIncomes - totalExpenses;

    return { 
      baseSalary: earnedBase,
      reserveFund, bonuses, extraHours, vacation,
      monthly13th, monthly14th, totalOverSalaries,
      iessContribution, loans, backPay,
      totalIncomes, totalExpenses, netToReceive,
      workedDays,
      expectedDays
    };
  };

  const handleUpdatePayrollValues = () => {
    if (!editingEmployee || !onUpdateEmployees) return;
    
    // Actualizar datos base del empleado (Sueldo, Afiliación, etc.)
    const updatedEmployees = employees.map(e => e.id === editingEmployee.id ? editingEmployee : e);
    onUpdateEmployees(updatedEmployees);

    // Generar registros de pagos de ajuste para este mes
    if (onUpdatePayments) {
      const newPayments: Payment[] = [];
      const commonData = {
        employeeId: editingEmployee.id,
        date: new Date().toISOString(),
        month: selectedMonth,
        year: "2026",
        method: 'Efectivo' as const,
        status: 'paid' as const
      };

      if (adjustments.extraHours !== 0) newPayments.push({ ...commonData, id: Math.random().toString(36).substr(2, 12), amount: adjustments.extraHours, type: 'ExtraHours', concept: 'AJUSTE HORAS EXTRAS' });
      if (adjustments.bonuses !== 0) newPayments.push({ ...commonData, id: Math.random().toString(36).substr(2, 12), amount: adjustments.bonuses, type: 'Bonus', concept: adjustments.incomeConcept || 'BONO ADICIONAL' });
      if (adjustments.vacation !== 0) newPayments.push({ ...commonData, id: Math.random().toString(36).substr(2, 12), amount: adjustments.vacation, type: 'Vacation', concept: 'AJUSTE VACACIONES' });
      if (adjustments.thirteenth !== 0) newPayments.push({ ...commonData, id: Math.random().toString(36).substr(2, 12), amount: adjustments.thirteenth, type: 'Thirteenth', concept: 'AJUSTE DÉCIMO TERCERO' });
      if (adjustments.fourteenth !== 0) newPayments.push({ ...commonData, id: Math.random().toString(36).substr(2, 12), amount: adjustments.fourteenth, type: 'Fourteenth', concept: 'AJUSTE DÉCIMO CUARTO' });
      if (adjustments.reserve !== 0) newPayments.push({ ...commonData, id: Math.random().toString(36).substr(2, 12), amount: adjustments.reserve, type: 'Salary', concept: 'AJUSTE FONDOS RESERVA' });
      if (adjustments.loans !== 0) newPayments.push({ ...commonData, id: Math.random().toString(36).substr(2, 12), amount: Math.abs(adjustments.loans), type: 'Loan', concept: 'AJUSTE PRÉSTAMO/ANTICIPO' });
      if (adjustments.backPay !== 0) newPayments.push({ ...commonData, id: Math.random().toString(36).substr(2, 12), amount: Math.abs(adjustments.backPay), type: 'BackPay', concept: adjustments.expenseConcept || 'AJUSTE MULTA/DESCUENTO' });

      if (newPayments.length > 0) {
        onUpdatePayments([...payments, ...newPayments]);
      }
    }
    
    setEditingEmployee(null);
    setShowConfirmPayrollEdit(false);
    setAdjustments({ extraHours: 0, bonuses: 0, vacation: 0, incomeConcept: '', loans: 0, backPay: 0, expenseConcept: '', thirteenth: 0, fourteenth: 0, reserve: 0 });
    setFeedback({ isOpen: true, title: "Sincronizado", message: "Todos los detalles del rol han sido modificados y actualizados correctamente.", type: 'success' });
  };

  const filteredEmployees = employees.filter(e => {
    const searchStr = `${e.name} ${e.surname} ${e.identification} ${e.role}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 md:space-y-8 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl md:rounded-[2rem] shadow-sm border border-slate-100 no-print gap-6">
        <div className="w-full">
          <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase text-center md:text-left">Gestión de Nómina Detallada</h2>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
             <select className="w-full sm:w-auto p-2.5 border rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-500" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                {['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}
             </select>
             <input type="text" placeholder="Filtrar por nombre, CI..." className="w-full sm:w-auto flex-1 p-2.5 border rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <button onClick={() => window.print()} className="flex-1 px-4 py-3.5 bg-slate-900 text-white font-black rounded-xl uppercase text-[8px] tracking-widest shadow active:scale-95 transition-all">Imprimir Reporte</button>
        </div>
      </div>

      <div className="bg-white p-4 md:p-8 rounded-3xl md:rounded-[2.5rem] shadow-sm border overflow-hidden">
        <div className="table-responsive overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px] print:min-w-0 print:table-auto">
            <thead className="bg-slate-900 text-white text-[7px] font-black uppercase tracking-widest">
              <tr>
                <th className="p-3">Empleado / CI</th>
                <th className="p-3 text-center">Días</th>
                <th className="p-3 text-center">Sueldo Ganado</th>
                <th className="p-3 text-center">Extras/Bonos</th>
                <th className="p-3 text-center">13ero Mens.</th>
                <th className="p-3 text-center">14to Mens.</th>
                <th className="p-3 text-center">Reserva</th>
                <th className="p-3 text-center">Tot. Ingresos</th>
                <th className="p-3 text-center">IESS 9.45%</th>
                <th className="p-3 text-center">Prést/Ant/Multas</th>
                <th className="p-3 text-center">Tot. Egresos</th>
                <th className="p-3 text-center bg-blue-800 text-white font-black">Neto Recibir</th>
                <th className="p-3 text-center no-print">Acción</th>
              </tr>
            </thead>
            <tbody className="text-[8px] md:text-[9px] uppercase font-bold text-slate-700 divide-y">
              {filteredEmployees.filter(e => e.status === 'active').map((emp, idx) => {
                const d = calculatePayrollData(emp, idx);
                return (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 whitespace-nowrap">
                       <p className="font-black text-slate-900">{emp.surname} {emp.name}</p>
                       <p className="text-[7px] text-slate-400">{emp.identification}</p>
                    </td>
                    <td className="p-3 text-center font-black text-blue-600">{d.workedDays}</td>
                    <td className="p-3 text-center">${d.baseSalary.toFixed(2)}</td>
                    <td className="p-3 text-center text-blue-600">${(d.extraHours+d.bonuses+d.vacation).toFixed(2)}</td>
                    <td className="p-3 text-center text-emerald-600">${d.monthly13th.toFixed(2)}</td>
                    <td className="p-3 text-center text-emerald-600">${d.monthly14th.toFixed(2)}</td>
                    <td className="p-3 text-center text-emerald-600">${d.reserveFund.toFixed(2)}</td>
                    <td className="p-3 text-center font-black bg-emerald-50/20">${d.totalIncomes.toFixed(2)}</td>
                    <td className="p-3 text-center text-red-500">${d.iessContribution.toFixed(2)}</td>
                    <td className="p-3 text-center text-red-500">${(d.loans + d.backPay).toFixed(2)}</td>
                    <td className="p-3 text-center font-black text-red-700 bg-red-50/20">${d.totalExpenses.toFixed(2)}</td>
                    <td className="p-3 text-center font-[950] text-blue-700 bg-blue-50/30">${d.netToReceive.toFixed(2)}</td>
                    <td className="p-3 text-center no-print space-x-1">
                       <button onClick={() => { setEditingEmployee(emp); setAdjustments({ extraHours: 0, bonuses: 0, vacation: 0, incomeConcept: '', loans: 0, backPay: 0, expenseConcept: '', thirteenth: 0, fourteenth: 0, reserve: 0 }); }} className="px-2 py-1 bg-slate-900 text-white rounded-lg text-[7px] font-black uppercase active:scale-95 shadow-sm">Modificar</button>
                       <button onClick={() => setIndividualPayroll(emp)} className="px-2 py-1 bg-blue-700 text-white rounded-lg text-[7px] font-black uppercase active:scale-95 shadow-md">Detalle</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Modificar TODOS los Detalles del Rol */}
      <Modal isOpen={!!editingEmployee} onClose={() => setEditingEmployee(null)} title="Edición Integral de Nómina Mensual">
        {editingEmployee && (
          <div className="space-y-6">
            <section className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border">
               <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sueldo Base ($)</label>
                  <input type="number" step="0.01" className="w-full border-2 p-3 rounded-xl text-lg font-black focus:border-blue-500 outline-none" value={editingEmployee.salary} onChange={e => setEditingEmployee({...editingEmployee, salary: Number(e.target.value)})} />
               </div>
               <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aporte IESS</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border h-[52px]">
                    <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={editingEmployee.isAffiliated} onChange={e => setEditingEmployee({...editingEmployee, isAffiliated: e.target.checked})} />
                    <span className="text-[10px] font-black text-slate-700 uppercase">Habilitar Aporte</span>
                  </div>
               </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-emerald-600 uppercase border-b pb-1">Ajustes de Ingresos ($)</h4>
                  <div className="space-y-3">
                     <div><label className="text-[8px] font-black text-slate-400 uppercase">Horas Extras</label><input type="number" step="0.01" className="w-full border p-2 rounded-lg text-xs font-bold" value={adjustments.extraHours} onChange={e => setAdjustments({...adjustments, extraHours: Number(e.target.value)})} /></div>
                     <div><label className="text-[8px] font-black text-slate-400 uppercase">Bono Adicional / Concepto</label><div className="flex gap-2"><input type="number" step="0.01" className="w-24 border p-2 rounded-lg text-xs font-bold" value={adjustments.bonuses} onChange={e => setAdjustments({...adjustments, bonuses: Number(e.target.value)})} /><input type="text" placeholder="Concepto..." className="flex-1 border p-2 rounded-lg text-[9px] uppercase font-bold" value={adjustments.incomeConcept} onChange={e => setAdjustments({...adjustments, incomeConcept: e.target.value})} /></div></div>
                     <div><label className="text-[8px] font-black text-slate-400 uppercase">Vacaciones Pagadas</label><input type="number" step="0.01" className="w-full border p-2 rounded-lg text-xs font-bold" value={adjustments.vacation} onChange={e => setAdjustments({...adjustments, vacation: Number(e.target.value)})} /></div>
                     <div className="grid grid-cols-3 gap-2">
                        <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">13ero Adj.</label><input type="number" step="0.01" className="w-full border p-2 rounded-lg text-xs font-bold" value={adjustments.thirteenth} onChange={e => setAdjustments({...adjustments, thirteenth: Number(e.target.value)})} /></div>
                        <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">14to Adj.</label><input type="number" step="0.01" className="w-full border p-2 rounded-lg text-xs font-bold" value={adjustments.fourteenth} onChange={e => setAdjustments({...adjustments, fourteenth: Number(e.target.value)})} /></div>
                        <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Reserva Adj.</label><input type="number" step="0.01" className="w-full border p-2 rounded-lg text-xs font-bold" value={adjustments.reserve} onChange={e => setAdjustments({...adjustments, reserve: Number(e.target.value)})} /></div>
                     </div>
                  </div>
               </div>
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-red-600 uppercase border-b pb-1">Ajustes de Egresos ($)</h4>
                  <div className="space-y-3">
                     <div><label className="text-[8px] font-black text-slate-400 uppercase">Préstamos / Anticipos</label><input type="number" step="0.01" className="w-full border p-2 rounded-lg text-xs font-bold" value={adjustments.loans} onChange={e => setAdjustments({...adjustments, loans: Number(e.target.value)})} /></div>
                     <div><label className="text-[8px] font-black text-slate-400 uppercase">Multas / Descuentos / Concepto</label><div className="flex gap-2"><input type="number" step="0.01" className="w-24 border p-2 rounded-lg text-xs font-bold" value={adjustments.backPay} onChange={e => setAdjustments({...adjustments, backPay: Number(e.target.value)})} /><input type="text" placeholder="Concepto..." className="flex-1 border p-2 rounded-lg text-[9px] uppercase font-bold" value={adjustments.expenseConcept} onChange={e => setAdjustments({...adjustments, expenseConcept: e.target.value})} /></div></div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                     <p className="text-[8px] font-black text-red-700 uppercase leading-relaxed">Nota: Los descuentos se ingresan como valores positivos y el sistema los restará automáticamente del total.</p>
                  </div>
               </div>
            </div>

            <div className="pt-4 border-t">
              <button onClick={() => setShowConfirmPayrollEdit(true)} className="w-full py-4 bg-blue-700 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Finalizar y Guardar Modificaciones</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Advertencia de Modificación Crítica */}
      <Modal isOpen={showConfirmPayrollEdit} onClose={() => setShowConfirmPayrollEdit(false)} title="Confirmar Alteración de Nómina" type="warning" maxWidth="max-w-sm">
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-3xl mx-auto animate-pulse">⚠️</div>
          <p className="text-xs font-black text-yellow-700 uppercase italic leading-relaxed">Advertencia: Acción de Auditoría</p>
          <p className="text-[11px] text-slate-600 font-bold leading-relaxed">¿Está seguro de modificar los detalles de este rol de pagos? Los cambios afectarán permanentemente el neto a recibir del colaborador para el período {selectedMonth}.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowConfirmPayrollEdit(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-xl uppercase text-[9px]">Cancelar</button>
            <button onClick={handleUpdatePayrollValues} className="flex-1 py-4 bg-blue-600 text-white font-black rounded-xl uppercase text-[9px] shadow-lg active:scale-95 transition-all">Confirmar Cambios</button>
          </div>
        </div>
      </Modal>

      {/* Modal de Rol Individual */}
      <Modal isOpen={!!individualPayroll} onClose={() => setIndividualPayroll(null)} title="Rol de Pagos Individual">
        {individualPayroll && (() => {
           const d = calculatePayrollData(individualPayroll, 0);
           return (
             <div className="space-y-6 bg-white p-2" id="individual-role-print">
               <div className="flex justify-between items-start border-b-2 pb-6">
                  <div><h3 className="text-xl md:text-2xl font-[950] text-slate-900 uppercase tracking-tighter italic leading-none">{company?.name || 'EMPRESA INSTITUCIONAL'}</h3><p className="text-[10px] font-bold text-slate-400 uppercase mt-2">RUC: {company?.ruc || '0000000000001'}</p></div>
                  <div className="text-right"><p className="text-[10px] font-black uppercase bg-slate-900 text-white px-4 py-2 rounded-xl">ROLES DE PAGOS 2026</p></div>
               </div>
               <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase">
                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-slate-400 font-black text-[8px]">Empleado / Cargo</p><p className="text-slate-900 font-[950]">{individualPayroll.surname} {individualPayroll.name}</p><p className="text-blue-600 text-[8px]">{individualPayroll.role}</p></div>
                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-100 text-right"><p className="text-slate-400 font-black text-[8px]">Identificación / Período</p><p className="text-slate-900">{individualPayroll.identification}</p><p className="text-slate-500 text-[8px]">{selectedMonth} 2026</p></div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                     <h4 className="text-[10px] font-black uppercase text-emerald-600 border-b pb-1">Ingresos y Beneficios</h4>
                     <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between"><span>Sueldo Ganado ({d.workedDays} días)</span><span>${d.baseSalary.toFixed(2)}</span></div>
                        <div className="flex justify-between text-blue-600"><span>Horas Extras / Bonos / Vac.</span><span>${(d.extraHours+d.bonuses+d.vacation).toFixed(2)}</span></div>
                        <div className="flex justify-between text-emerald-600"><span>Décimo Tercero Mensual</span><span>${d.monthly13th.toFixed(2)}</span></div>
                        <div className="flex justify-between text-emerald-600"><span>Décimo Cuarto Mensual</span><span>${d.monthly14th.toFixed(2)}</span></div>
                        <div className="flex justify-between text-emerald-600"><span>Fondos de Reserva</span><span>${d.reserveFund.toFixed(2)}</span></div>
                        <div className="flex justify-between font-[950] pt-2 border-t mt-2 text-slate-900"><span>Total Ingresos</span><span>${d.totalIncomes.toFixed(2)}</span></div>
                     </div>
                  </div>
                  <div className="space-y-3">
                     <h4 className="text-[10px] font-black uppercase text-red-600 border-b pb-1">Deducciones y Egresos</h4>
                     <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between"><span>Aporte Personal IESS (9.45%)</span><span>${d.iessContribution.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Préstamos / Anticipos / Multas</span><span>${(d.loans + d.backPay).toFixed(2)}</span></div>
                        <div className="flex justify-between font-[950] pt-2 border-t mt-2 text-slate-900"><span>Total Egresos</span><span>${d.totalExpenses.toFixed(2)}</span></div>
                     </div>
                  </div>
               </div>

               <div className="bg-slate-900 p-6 rounded-3xl text-white flex justify-between items-center shadow-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Neto a Recibir</p>
                  <p className="text-4xl font-[950] tracking-tighter leading-none">${d.netToReceive.toFixed(2)}</p>
               </div>
               
               <button onClick={() => window.print()} className="w-full py-4 bg-slate-100 text-slate-900 font-black rounded-xl uppercase text-[10px] no-print">Imprimir Rol Individual</button>
             </div>
           );
        })()}
      </Modal>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
          <div className="text-center p-4">
              <p className="text-slate-600 font-bold uppercase text-[11px] leading-relaxed mb-6">{feedback.message}</p>
              <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] shadow-lg active:scale-95 transition-all">Aceptar</button>
          </div>
      </Modal>
    </div>
  );
};

export default PayrollModule;
