
import React, { useState } from 'react';
import { Employee, Payment, CompanyConfig, GlobalSettings, Role } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface PayrollModuleProps {
  employees: Employee[];
  payments: Payment[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
  role: Role;
}

const PayrollModule: React.FC<PayrollModuleProps> = ({ employees, payments, company, settings, role }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('es-EC', {month: 'long'}).toUpperCase());
  const [individualPayroll, setIndividualPayroll] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const calculatePayrollData = (emp: Employee, index: number) => {
    const baseSalary = emp.salary;
    const monthlyPayments = payments.filter(p => p.employeeId === emp.id && p.month === selectedMonth && p.status === 'paid');
    
    const bonuses = monthlyPayments.filter(p => p.type === 'Bonus').reduce((sum, p) => sum + p.amount, 0);
    const extraHours = monthlyPayments.filter(p => p.type === 'ExtraHours').reduce((sum, p) => sum + p.amount, 0);
    const vacation = monthlyPayments.filter(p => p.type === 'Vacation').reduce((sum, p) => sum + p.amount, 0);
    
    const isMonthly = emp.overSalaryType === 'monthly';
    const isAffiliated = emp.isAffiliated;
    
    const monthly13th = (isAffiliated && isMonthly) ? (baseSalary + extraHours + bonuses) / 12 : 0;
    const monthly14th = (isAffiliated && isMonthly) ? settings.sbu / 12 : 0;
    const reserveFund = (isAffiliated && isMonthly) ? ((baseSalary + extraHours) * settings.reserveRate) : 0;
    
    const totalOverSalaries = monthly13th + monthly14th + reserveFund;
    const totalIncomes = baseSalary + totalOverSalaries + bonuses + extraHours + vacation;

    const taxableIncome = baseSalary + extraHours + bonuses;
    const iessContribution = isAffiliated ? (taxableIncome * settings.iessRate) : 0;
    const loans = monthlyPayments.filter(p => p.type === 'Loan' || p.type === 'Emergency').reduce((sum, p) => sum + p.amount, 0);
    
    const totalExpenses = iessContribution + loans;
    const netToReceive = totalIncomes - totalExpenses;
    const voucherCode = `PN-${(index + 1).toString().padStart(8, '0')}`;

    return { 
      baseSalary, reserveFund, bonuses, extraHours, vacation,
      monthly13th, monthly14th, totalOverSalaries,
      iessContribution, loans,
      totalIncomes, totalExpenses, netToReceive,
      voucherCode
    };
  };

  const exportGeneralExcel = () => {
    let csv = "\uFEFF"; // BOM para UTF-8 en Excel
    csv += "Colaborador,Identificación,Sueldo Base,Extra/Bono,13ero Mensual,14to Mensual,Reserva,IESS 9.45%,Préstamos,Total Ingresos,Total Egresos,Neto Recibir\n";
    employees.filter(e => e.status === 'active').forEach((emp, idx) => {
      const d = calculatePayrollData(emp, idx);
      csv += `"${emp.surname} ${emp.name}","${emp.identification}",${d.baseSalary.toFixed(2)},${(d.extraHours+d.bonuses).toFixed(2)},${d.monthly13th.toFixed(2)},${d.monthly14th.toFixed(2)},${d.reserveFund.toFixed(2)},${d.iessContribution.toFixed(2)},${d.loans.toFixed(2)},${d.totalIncomes.toFixed(2)},${d.totalExpenses.toFixed(2)},${d.netToReceive.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ROL_GENERAL_${selectedMonth}_2026.csv`;
    link.click();
  };

  const exportIndividualExcel = (emp: Employee) => {
    const d = calculatePayrollData(emp, 0);
    let csv = "\uFEFFDetalle,Ingresos,Egresos\n";
    csv += `Sueldo Base,${d.baseSalary.toFixed(2)},0\n`;
    csv += `Horas Extras/Bonos,${(d.extraHours+d.bonuses).toFixed(2)},0\n`;
    csv += `Décimo Tercero Mensual,${d.monthly13th.toFixed(2)},0\n`;
    csv += `Décimo Cuarto Mensual,${d.monthly14th.toFixed(2)},0\n`;
    csv += `Fondos de Reserva,${d.reserveFund.toFixed(2)},0\n`;
    csv += `Aporte IESS Personal (9.45%),0,${d.iessContribution.toFixed(2)}\n`;
    csv += `Préstamos/Anticipos/Otros,0,${d.loans.toFixed(2)}\n`;
    csv += `---,---,---\n`;
    csv += `TOTALES,${d.totalIncomes.toFixed(2)},${d.totalExpenses.toFixed(2)}\n`;
    csv += `NETO A RECIBIR,${d.netToReceive.toFixed(2)},0\n`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ROL_INDIVIDUAL_${emp.surname}_${selectedMonth}_2026.csv`;
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
          <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase text-center md:text-left">Nómina Corporativa</h2>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
             <select className="w-full sm:w-auto p-2.5 border rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-500" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                {['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}
             </select>
             <input type="text" placeholder="Filtrar por nombre, CI..." className="w-full sm:w-auto flex-1 p-2.5 border rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <button onClick={exportGeneralExcel} className="flex-1 px-4 py-3.5 bg-emerald-600 text-white font-black rounded-xl uppercase text-[8px] tracking-widest shadow active:scale-95 transition-all">Excel General</button>
           <button onClick={() => window.print()} className="flex-1 px-4 py-3.5 bg-slate-900 text-white font-black rounded-xl uppercase text-[8px] tracking-widest shadow active:scale-95 transition-all">PDF General</button>
        </div>
      </div>

      <div className="bg-white p-4 md:p-10 rounded-3xl md:rounded-[3rem] shadow-sm border overflow-hidden">
        <div className="table-responsive">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest">
              <tr>
                <th className="p-4 rounded-tl-2xl">Empleado</th>
                <th className="p-4 text-center">Sueldo Base</th>
                <th className="p-4 text-center">Extras/Bono</th>
                <th className="p-4 text-center">Beneficios</th>
                <th className="p-4 text-center">IESS/Desc.</th>
                <th className="p-4 text-center bg-blue-800 rounded-tr-2xl">Neto</th>
                <th className="p-4 text-center no-print">Acción</th>
              </tr>
            </thead>
            <tbody className="text-[9px] md:text-[10px] uppercase font-bold text-slate-700 divide-y">
              {filteredEmployees.filter(e => e.status === 'active').map((emp, idx) => {
                const d = calculatePayrollData(emp, idx);
                return (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-black text-slate-900 truncate max-w-[150px]">{emp.surname} {emp.name}</td>
                    <td className="p-4 text-center">${d.baseSalary.toFixed(2)}</td>
                    <td className="p-4 text-center text-blue-600">${(d.extraHours + d.bonuses).toFixed(2)}</td>
                    <td className="p-4 text-center text-emerald-600">${(d.totalOverSalaries).toFixed(2)}</td>
                    <td className="p-4 text-center text-red-500">${d.totalExpenses.toFixed(2)}</td>
                    <td className="p-4 text-center font-[950] text-blue-700 bg-blue-50/20">${d.netToReceive.toFixed(2)}</td>
                    <td className="p-4 text-center no-print">
                       <button onClick={() => setIndividualPayroll(emp)} className="px-3 py-1.5 bg-blue-700 text-white rounded-lg text-[7px] font-black uppercase active:scale-95 transition-all shadow-md">Rol Individual</button>
                    </td>
                  </tr>
                );
              })}
              {filteredEmployees.length === 0 && (
                <tr><td colSpan={7} className="p-10 text-center text-slate-300 font-black uppercase">Sin resultados filtrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!individualPayroll} onClose={() => setIndividualPayroll(null)} title="Rol de Pagos Individual">
        {individualPayroll && (() => {
           const d = calculatePayrollData(individualPayroll, 0);
           return (
             <div className="space-y-6 bg-white" id="individual-role-print">
               <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 pb-6 gap-4">
                  <div><h3 className="text-xl md:text-2xl font-[950] text-slate-900 uppercase tracking-tighter italic">{company?.name || 'EMPRESA'}</h3><p className="text-[9px] font-bold text-slate-400 uppercase mt-1">RUC: {company?.ruc || '0000000000001'}</p></div>
                  <div className="text-right w-full sm:w-auto"><p className="text-[9px] font-black uppercase bg-slate-900 text-white px-4 py-2 rounded-xl">COMPROBANTE DE ROL</p></div>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px] font-bold uppercase">
                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl"><p className="text-slate-400 font-black text-[8px]">Empleado</p><p className="text-slate-900 font-[950]">{individualPayroll.surname} {individualPayroll.name}</p></div>
                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl sm:text-right"><p className="text-slate-400 font-black text-[8px]">Identificación / Período</p><p className="text-slate-900">{individualPayroll.identification} | {selectedMonth} 2026</p></div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                     <h4 className="text-[9px] font-black uppercase text-emerald-600 border-b pb-1">Ingresos Gravables y Beneficios</h4>
                     <div className="space-y-1.5 text-[10px]">
                        <div className="flex justify-between"><span>Sueldo Base Mensual</span><span>${d.baseSalary.toFixed(2)}</span></div>
                        <div className="flex justify-between text-blue-600"><span>Horas Extras y Bonificaciones</span><span>${(d.extraHours+d.bonuses).toFixed(2)}</span></div>
                        <div className="flex justify-between text-emerald-600"><span>Décimo Tercero (Mensualizado)</span><span>${d.monthly13th.toFixed(2)}</span></div>
                        <div className="flex justify-between text-emerald-600"><span>Décimo Cuarto (Mensualizado)</span><span>${d.monthly14th.toFixed(2)}</span></div>
                        <div className="flex justify-between text-emerald-600"><span>Fondos de Reserva</span><span>${d.reserveFund.toFixed(2)}</span></div>
                     </div>
                  </div>
                  <div className="space-y-3">
                     <h4 className="text-[9px] font-black uppercase text-red-600 border-b pb-1">Egresos y Retenciones</h4>
                     <div className="space-y-1.5 text-[10px]">
                        <div className="flex justify-between"><span>Aporte Personal IESS (9.45%)</span><span>${d.iessContribution.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Préstamos / Anticipos</span><span>${d.loans.toFixed(2)}</span></div>
                        <div className="flex justify-between font-black pt-1 border-t mt-2"><span>Total Egresos</span><span>${d.totalExpenses.toFixed(2)}</span></div>
                     </div>
                  </div>
               </div>
               <div className="bg-slate-900 p-6 md:p-8 rounded-3xl text-white flex justify-between items-center shadow-xl">
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Líquido a Recibir</p>
                  <p className="text-3xl md:text-4xl font-[950] tracking-tighter">${d.netToReceive.toFixed(2)}</p>
               </div>
               <div className="flex flex-col sm:flex-row gap-3 no-print">
                  <button onClick={() => exportIndividualExcel(individualPayroll)} className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-xl uppercase text-[9px] tracking-widest active:scale-95 transition-all shadow-lg">Excel Individual</button>
                  <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[9px] tracking-widest active:scale-95 transition-all shadow-lg">Descargar PDF</button>
               </div>
             </div>
           );
        })()}
      </Modal>
    </div>
  );
};

export default PayrollModule;
