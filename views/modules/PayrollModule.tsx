import React, { useState } from 'react';
import { Employee, Payment, CompanyConfig, GlobalSettings, Role } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface PayrollModuleProps {
  employees: Employee[];
  payments: Payment[];
  attendance: any[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
  role: Role;
}

const PayrollModule: React.FC<PayrollModuleProps> = ({ employees, payments, attendance = [], company, settings, role }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('es-EC', {month: 'long'}).toUpperCase());
  const [individualPayroll, setIndividualPayroll] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
    const bonuses = monthlyPayments.filter(p => p.type === 'Bonus').reduce((sum, p) => sum + p.amount, 0);
    const extraHours = monthlyPayments.filter(p => p.type === 'ExtraHours').reduce((sum, p) => sum + p.amount, 0);
    const vacation = monthlyPayments.filter(p => p.type === 'Vacation').reduce((sum, p) => sum + p.amount, 0);
    
    const isMonthly = emp.overSalaryType === 'monthly';
    const isAffiliated = emp.isAffiliated;
    
    const taxableIncome = earnedBase + extraHours + bonuses;

    const monthly13th = (isAffiliated && isMonthly) ? (taxableIncome) / 12 : 0;
    const monthly14th = (isAffiliated && isMonthly) ? (settings.sbu / 12) * attendanceProportion : 0;
    const reserveFund = (isAffiliated && isMonthly) ? (taxableIncome * settings.reserveRate) : 0;
    
    const totalOverSalaries = monthly13th + monthly14th + reserveFund;
    const totalIncomes = earnedBase + totalOverSalaries + bonuses + extraHours + vacation;

    const iessContribution = isAffiliated ? (taxableIncome * settings.iessRate) : 0;
    const loans = monthlyPayments.filter(p => p.type === 'Loan' || p.type === 'Emergency').reduce((sum, p) => sum + p.amount, 0);
    
    const totalExpenses = iessContribution + loans;
    const netToReceive = totalIncomes - totalExpenses;
    const voucherCode = `PN-${(index + 1).toString().padStart(8, '0')}`;

    return { 
      baseSalary: earnedBase,
      reserveFund, bonuses, extraHours, vacation,
      monthly13th, monthly14th, totalOverSalaries,
      iessContribution, loans,
      totalIncomes, totalExpenses, netToReceive,
      voucherCode,
      workedDays,
      expectedDays
    };
  };

  const exportGeneralExcel = () => {
    let csv = "\uFEFF";
    csv += "Colaborador,Identificación,Días Trabajados,Sueldo Ganado,Extras/Bonos,13ero Mensual,14to Mensual,Reserva,Total Ingresos,IESS 9.45%,Préstamos/Ant.,Total Egresos,Neto Recibir\n";
    employees.filter(e => e.status === 'active').forEach((emp, idx) => {
      const d = calculatePayrollData(emp, idx);
      csv += `"${emp.surname} ${emp.name}","${emp.identification}",${d.workedDays},${d.baseSalary.toFixed(2)},${(d.extraHours+d.bonuses).toFixed(2)},${d.monthly13th.toFixed(2)},${d.monthly14th.toFixed(2)},${d.reserveFund.toFixed(2)},${d.totalIncomes.toFixed(2)},${d.iessContribution.toFixed(2)},${d.loans.toFixed(2)},${d.totalExpenses.toFixed(2)},${d.netToReceive.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ROL_GENERAL_${selectedMonth}_2026.csv`;
    link.click();
  };

  const filteredEmployees = employees.filter(e => {
    const searchStr = `${e.name} ${e.surname} ${e.identification} ${e.role}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 md:space-y-8 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl md:rounded-[2rem] shadow-sm border border-slate-100 no-print gap-6">
        <div className="w-full">
          <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase text-center md:text-left">Nómina General Detallada</h2>
          <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">Sincronización de Ingresos y Egresos del Período</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
             <select className="w-full sm:w-auto p-2.5 border rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-500" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                {['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}
             </select>
             <input type="text" placeholder="Filtrar por nombre, CI..." className="w-full sm:w-auto flex-1 p-2.5 border rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <button onClick={exportGeneralExcel} className="flex-1 px-4 py-3.5 bg-emerald-600 text-white font-black rounded-xl uppercase text-[8px] tracking-widest shadow active:scale-95 transition-all">Excel General</button>
           <button onClick={() => window.print()} className="flex-1 px-4 py-3.5 bg-slate-900 text-white font-black rounded-xl uppercase text-[8px] tracking-widest shadow active:scale-95 transition-all">Imprimir Reporte</button>
        </div>
      </div>

      <div className="bg-white p-4 md:p-8 rounded-3xl md:rounded-[2.5rem] shadow-sm border overflow-hidden" id="general-payroll-printable">
        <div className="hidden print:block text-center border-b-2 border-slate-900 pb-6 mb-8">
           <h1 className="text-2xl font-[950] text-slate-900 uppercase italic leading-none">{company?.name || 'ASIST UP - HR ENTERPRISE'}</h1>
           <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-2">Rol de Pagos General - {selectedMonth} 2026</p>
           <div className="grid grid-cols-2 gap-4 mt-4 max-w-xl mx-auto text-[10px] font-bold uppercase text-slate-700">
             <p className="text-left border-l-4 border-slate-900 pl-3">RUC: {company?.ruc || '0000000000001'}</p>
             <p className="text-right border-r-4 border-slate-900 pr-3">Representante: {company?.legalRep || 'ADMINISTRACIÓN'}</p>
           </div>
           <p className="text-[7px] text-slate-400 mt-3 uppercase font-bold italic text-right">Generado el: {new Date().toLocaleString()}</p>
        </div>

        <div className="table-responsive overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px] print:min-w-0 print:table-auto">
            <thead className="bg-slate-900 text-white text-[7px] font-black uppercase tracking-widest">
              <tr className="print:border-b-2 print:border-slate-900">
                <th className="p-3 rounded-tl-xl print:rounded-none">Empleado / CI</th>
                <th className="p-3 text-center">Días</th>
                <th className="p-3 text-center">Sueldo Ganado</th>
                <th className="p-3 text-center">Extras/Bonos</th>
                <th className="p-3 text-center">13ero Mens.</th>
                <th className="p-3 text-center">14to Mens.</th>
                <th className="p-3 text-center">Reserva</th>
                <th className="p-3 text-center">Tot. Ingresos</th>
                <th className="p-3 text-center">IESS 9.45%</th>
                <th className="p-3 text-center">Prést/Ant.</th>
                <th className="p-3 text-center">Tot. Egresos</th>
                <th className="p-3 text-center bg-blue-800 print:bg-slate-100 print:text-slate-900 rounded-tr-xl print:rounded-none">Neto Recibir</th>
                <th className="p-3 text-center no-print">Acción</th>
              </tr>
            </thead>
            <tbody className="text-[8px] md:text-[9px] uppercase font-bold text-slate-700 divide-y print:divide-slate-200">
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
                    <td className="p-3 text-center text-blue-600">${(d.extraHours+d.bonuses).toFixed(2)}</td>
                    <td className="p-3 text-center text-emerald-600">${d.monthly13th.toFixed(2)}</td>
                    <td className="p-3 text-center text-emerald-600">${d.monthly14th.toFixed(2)}</td>
                    <td className="p-3 text-center text-emerald-600">${d.reserveFund.toFixed(2)}</td>
                    <td className="p-3 text-center font-black bg-emerald-50/20">${d.totalIncomes.toFixed(2)}</td>
                    <td className="p-3 text-center text-red-500">${d.iessContribution.toFixed(2)}</td>
                    <td className="p-3 text-center text-red-500">${d.loans.toFixed(2)}</td>
                    <td className="p-3 text-center font-black text-red-700 bg-red-50/20">${d.totalExpenses.toFixed(2)}</td>
                    <td className="p-3 text-center font-[950] text-blue-700 bg-blue-50/30 print:bg-transparent">${d.netToReceive.toFixed(2)}</td>
                    <td className="p-3 text-center no-print">
                       <button onClick={() => setIndividualPayroll(emp)} className="px-2 py-1 bg-blue-700 text-white rounded-lg text-[7px] font-black uppercase active:scale-95 shadow-md">Detalle</button>
                    </td>
                  </tr>
                );
              })}
              {filteredEmployees.length === 0 && (
                <tr><td colSpan={13} className="p-10 text-center text-slate-300 font-black uppercase">Sin registros detallados</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="hidden print:grid grid-cols-3 gap-10 mt-24 pt-10 border-t-2 border-slate-100">
           <div className="text-center">
              <div className="border-t border-slate-900 pt-2 text-[9px] font-black uppercase">Firma Autorizada RRHH</div>
           </div>
           <div className="text-center">
              <div className="border-t border-slate-900 pt-2 text-[9px] font-black uppercase">Contabilidad / Finanzas</div>
           </div>
           <div className="text-center">
              <div className="border-t border-slate-900 pt-2 text-[9px] font-black uppercase">Sello Institucional</div>
           </div>
        </div>
      </div>

      <Modal isOpen={!!individualPayroll} onClose={() => setIndividualPayroll(null)} title="Rol de Pagos Individual">
        {individualPayroll && (() => {
           const d = calculatePayrollData(individualPayroll, 0);
           return (
             <div className="space-y-6 bg-white" id="individual-role-print">
               <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 pb-6 gap-4">
                  <div><h3 className="text-xl md:text-2xl font-[950] text-slate-900 uppercase tracking-tighter italic leading-none">{company?.name || 'EMPRESA INSTITUCIONAL'}</h3><p className="text-[10px] font-bold text-slate-400 uppercase mt-2">RUC: {company?.ruc || '0000000000001'}</p></div>
                  <div className="text-right w-full sm:w-auto"><p className="text-[10px] font-black uppercase bg-slate-900 text-white px-4 py-2 rounded-xl">ROLES DE PAGOS 2026</p></div>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px] font-bold uppercase">
                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-slate-400 font-black text-[8px]">Empleado / Cargo</p><p className="text-slate-900 font-[950]">{individualPayroll.surname} {individualPayroll.name}</p><p className="text-blue-600 text-[8px]">{individualPayroll.role}</p></div>
                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-100 sm:text-right"><p className="text-slate-400 font-black text-[8px]">Identificación / Días Trab.</p><p className="text-slate-900">{individualPayroll.identification} | {d.workedDays} de {d.expectedDays} días</p><p className="text-slate-500 text-[8px]">{selectedMonth} 2026</p></div>
               </div>

               <div className="hidden print:grid grid-cols-2 gap-4 text-[10px] font-bold uppercase text-slate-700 border-b pb-4 mb-4">
                  <p className="text-left">RUC: {company?.ruc}</p>
                  <p className="text-right">Representante Legal: {company?.legalRep}</p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                     <h4 className="text-[10px] font-black uppercase text-emerald-600 border-b pb-1">Ingresos y Beneficios</h4>
                     <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between"><span>Sueldo Proporcional Ganado</span><span>${d.baseSalary.toFixed(2)}</span></div>
                        <div className="flex justify-between text-blue-600"><span>Horas Extras / Bonos</span><span>${(d.extraHours+d.bonuses).toFixed(2)}</span></div>
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
                        <div className="flex justify-between"><span>Préstamos / Anticipos / Varios</span><span>${d.loans.toFixed(2)}</span></div>
                        <div className="flex justify-between font-[950] pt-2 border-t mt-2 text-slate-900"><span>Total Egresos</span><span>${d.totalExpenses.toFixed(2)}</span></div>
                     </div>
                  </div>
               </div>

               <div className="hidden print:grid grid-cols-2 gap-10 mt-14 pt-10">
                 <div className="text-center">
                    <div className="border-t-2 border-slate-900 pt-3 text-[10px] font-black uppercase">Recibí Conforme (Colaborador)</div>
                    <p className="text-[7px] text-slate-400 mt-1 uppercase font-bold">Identificación: {individualPayroll.identification}</p>
                 </div>
                 <div className="text-center">
                    <div className="border-t-2 border-slate-900 pt-3 text-[10px] font-black uppercase">Firma Autorizada RRHH</div>
                 </div>
               </div>

               <div className="bg-slate-900 p-6 md:p-8 rounded-3xl text-white flex justify-between items-center shadow-xl print:shadow-none print:text-slate-900 print:bg-slate-100 print:border-2">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Líquido Neto a Recibir</p>
                  <p className="text-4xl md:text-5xl font-[950] tracking-tighter leading-none">${d.netToReceive.toFixed(2)}</p>
               </div>
               <div className="flex flex-col sm:flex-row gap-3 no-print pt-6">
                  <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-lg">Imprimir Rol Individual</button>
               </div>
             </div>
           );
        })()}
      </Modal>
    </div>
  );
};

export default PayrollModule;