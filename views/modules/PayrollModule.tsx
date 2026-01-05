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
    let csv = "Colaborador,Sueldo Base,Extras/Bonos,13ero Mens,14to Mens,Reserva,IESS 9.45%,Anticipos,Neto Recibir\n";
    employees.filter(e => e.status === 'active').forEach((emp, idx) => {
      const d = calculatePayrollData(emp, idx);
      csv += `${emp.surname} ${emp.name},${d.baseSalary.toFixed(2)},${(d.extraHours+d.bonuses).toFixed(2)},${d.monthly13th.toFixed(2)},${d.monthly14th.toFixed(2)},${d.reserveFund.toFixed(2)},${d.iessContribution.toFixed(2)},${d.loans.toFixed(2)},${d.netToReceive.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ROL_GENERAL_${selectedMonth}_2026.csv`;
    link.click();
  };

  const exportIndividualExcel = (emp: Employee) => {
    const d = calculatePayrollData(emp, 0);
    let csv = "Detalle,Ingresos,Egresos\n";
    csv += `Sueldo Base,${d.baseSalary.toFixed(2)},0\n`;
    csv += `Extras/Bonos,${(d.extraHours+d.bonuses).toFixed(2)},0\n`;
    csv += `13ero Mensualizado,${d.monthly13th.toFixed(2)},0\n`;
    csv += `14to Mensualizado,${d.monthly14th.toFixed(2)},0\n`;
    csv += `Fondos Reserva,${d.reserveFund.toFixed(2)},0\n`;
    csv += `Aporte IESS 9.45%,0,${d.iessContribution.toFixed(2)}\n`;
    csv += `Préstamos/Anticipos,0,${d.loans.toFixed(2)}\n`;
    csv += `NETO A RECIBIR,${d.netToReceive.toFixed(2)},0\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ROL_INDIVIDUAL_${emp.surname}_${selectedMonth}.csv`;
    link.click();
  };

  const filteredEmployees = employees.filter(e => {
    const searchStr = (e.name + " " + e.surname + " " + e.identification).toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-8 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 no-print gap-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase">Gestión de Nómina 2026</h2>
          <div className="flex gap-3 mt-4">
             <select className="p-2 border rounded-xl text-[10px] font-black uppercase" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                {['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}
             </select>
             <input type="text" placeholder="Buscar..." className="p-2 border rounded-xl text-[10px] font-bold uppercase min-w-[200px]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={exportGeneralExcel} className="px-6 py-3 bg-emerald-600 text-white font-black rounded-xl uppercase text-[9px] tracking-widest shadow-lg active:scale-95 transition-all">Excel General</button>
           <button onClick={() => window.print()} className="px-6 py-3 bg-slate-900 text-white font-black rounded-xl uppercase text-[9px] tracking-widest shadow-lg active:scale-95 transition-all">Imprimir General</button>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] shadow-sm overflow-x-auto border">
        <div className="mb-8 text-center border-b pb-6 print-only">
           <h1 className="text-3xl font-[950] text-slate-900 uppercase tracking-tighter">{company?.name || 'ROL DE PAGOS'}</h1>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Período Fiscal: {selectedMonth} 2026</p>
        </div>
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-900 text-white text-[8px] font-black uppercase">
            <tr>
              <th className="p-4 rounded-tl-2xl">Empleado</th>
              <th className="p-4 text-center">Base</th>
              <th className="p-4 text-center">Extra/Bono</th>
              <th className="p-4 text-center">13ero Mens</th>
              <th className="p-4 text-center">14to Mens</th>
              <th className="p-4 text-center">Fondos Res</th>
              <th className="p-4 text-center">IESS 9.45%</th>
              <th className="p-4 text-center">Descuentos</th>
              <th className="p-4 text-center bg-blue-800 rounded-tr-2xl">Neto a Recibir</th>
              <th className="p-4 text-center no-print">Acción</th>
            </tr>
          </thead>
          <tbody className="text-[9px] uppercase font-bold text-slate-700 divide-y">
            {filteredEmployees.filter(e => e.status === 'active').map((emp, idx) => {
              const d = calculatePayrollData(emp, idx);
              return (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-black text-slate-900">{emp.surname} {emp.name}</td>
                  <td className="p-4 text-center">${d.baseSalary.toFixed(2)}</td>
                  <td className="p-4 text-center text-blue-600">${(d.extraHours + d.bonuses).toFixed(2)}</td>
                  <td className="p-4 text-center text-emerald-600">${d.monthly13th.toFixed(2)}</td>
                  <td className="p-4 text-center text-emerald-600">${d.monthly14th.toFixed(2)}</td>
                  <td className="p-4 text-center text-emerald-600">${d.reserveFund.toFixed(2)}</td>
                  <td className="p-4 text-center text-red-500">${d.iessContribution.toFixed(2)}</td>
                  <td className="p-4 text-center text-red-500">${d.loans.toFixed(2)}</td>
                  <td className="p-4 text-center font-[950] text-blue-700 bg-blue-50/20">${d.netToReceive.toFixed(2)}</td>
                  <td className="p-4 text-center no-print">
                     <button onClick={() => setIndividualPayroll(emp)} className="px-3 py-1 bg-blue-700 text-white rounded-lg text-[7px] font-black uppercase">Individual</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!individualPayroll} onClose={() => setIndividualPayroll(null)} title="Rol de Pagos Individual">
        {individualPayroll && (() => {
           const d = calculatePayrollData(individualPayroll, 0);
           return (
             <div className="p-6 space-y-8 bg-white" id="individual-role-print">
               <div className="flex justify-between items-start border-b-2 pb-6">
                  <div><h3 className="text-2xl font-[950] text-slate-900 uppercase tracking-tighter">{company?.name || 'EMPRESA'}</h3><p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Identificación Tributaria: {company?.ruc || '0000000000001'}</p></div>
                  <div className="text-right"><p className="text-[10px] font-black uppercase bg-slate-900 text-white px-4 py-2 rounded-2xl">ROL INDIVIDUAL</p><p className="text-[9px] font-bold text-slate-500 uppercase mt-2">{selectedMonth} 2026</p></div>
               </div>
               <div className="grid grid-cols-2 gap-8 text-[10px] font-bold uppercase">
                  <div className="space-y-2"><p className="text-slate-400 font-black tracking-widest text-[8px]">Titular del Pago</p><p className="text-slate-900 text-base font-black">{individualPayroll.surname} {individualPayroll.name}</p><p className="text-slate-500">CI: {individualPayroll.identification}</p></div>
                  <div className="space-y-2 text-right"><p className="text-slate-400 font-black tracking-widest text-[8px]">Depósito Bancario</p><p className="text-slate-900">{individualPayroll.bankInfo?.ifi}</p><p className="text-slate-500">{individualPayroll.bankInfo?.account}</p></div>
               </div>
               <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-4">
                     <h4 className="text-[9px] font-black uppercase text-emerald-600 tracking-[0.2em] border-b pb-2">I. Haberes / Ingresos</h4>
                     <div className="space-y-2 text-[10px] font-bold uppercase">
                        <div className="flex justify-between"><span>Sueldo Base</span><span>${d.baseSalary.toFixed(2)}</span></div>
                        <div className="flex justify-between text-blue-600"><span>Variables (Horas Extras/Bonos)</span><span>${(d.extraHours+d.bonuses).toFixed(2)}</span></div>
                        <div className="flex justify-between text-emerald-600"><span>D3ro (Mensualizado)</span><span>${d.monthly13th.toFixed(2)}</span></div>
                        <div className="flex justify-between text-emerald-600"><span>D4to (Mensualizado)</span><span>${d.monthly14th.toFixed(2)}</span></div>
                        <div className="flex justify-between text-emerald-600"><span>Fondos Reserva (Mensualizado)</span><span>${d.reserveFund.toFixed(2)}</span></div>
                        <div className="flex justify-between font-black border-t pt-2 text-slate-900"><span>INGRESOS BRUTOS</span><span>${d.totalIncomes.toFixed(2)}</span></div>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <h4 className="text-[9px] font-black uppercase text-red-600 tracking-[0.2em] border-b pb-2">II. Descuentos / Egresos</h4>
                     <div className="space-y-2 text-[10px] font-bold uppercase">
                        <div className="flex justify-between"><span>IESS Personal (9.45%)</span><span>${d.iessContribution.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Préstamos / Anticipos</span><span>${d.loans.toFixed(2)}</span></div>
                        <div className="flex justify-between font-black border-t pt-2 text-slate-900"><span>TOTAL DESCUENTOS</span><span>${d.totalExpenses.toFixed(2)}</span></div>
                     </div>
                  </div>
               </div>
               <div className="bg-slate-900 p-8 rounded-[2rem] text-white flex justify-between items-center shadow-2xl">
                  <div><p className="text-[8px] font-black uppercase tracking-[0.4em] opacity-60">Neto a Recibir</p></div>
                  <p className="text-4xl font-[950] tracking-tighter">${d.netToReceive.toFixed(2)}</p>
               </div>
               <div className="flex gap-3 no-print">
                  <button onClick={() => exportIndividualExcel(individualPayroll)} className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all">Excel Individual</button>
                  <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all">Imprimir / PDF</button>
               </div>
             </div>
           );
        })()}
      </Modal>
    </div>
  );
};

export default PayrollModule;