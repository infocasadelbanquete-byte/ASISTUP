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
    const backPay = monthlyPayments.filter(p => p.type === 'BackPay').reduce((sum, p) => sum + p.amount, 0);
    
    // Sobre Sueldos Mensualizados
    const isMonthly = emp.overSalaryType === 'monthly';
    const monthly13th = isMonthly ? (baseSalary + extraHours + bonuses) / 12 : 0;
    const monthly14th = isMonthly ? settings.sbu / 12 : 0;
    const reserveFund = (emp.isAffiliated && (isMonthly || emp.overSalaryType === 'monthly')) ? ((baseSalary + extraHours) * settings.reserveRate) : 0;
    
    const totalOverSalaries = monthly13th + monthly14th + reserveFund;
    
    const totalIncomes = baseSalary + totalOverSalaries + bonuses + extraHours + vacation + backPay;

    const taxableIncome = baseSalary + extraHours + bonuses;
    const iessContribution = emp.isAffiliated ? (taxableIncome * settings.iessRate) : 0;
    const loans = monthlyPayments.filter(p => p.type === 'Loan' || p.type === 'Emergency').reduce((sum, p) => sum + p.amount, 0);
    
    const totalExpenses = iessContribution + loans;

    const voucherCode = `PN-${(index + 1).toString().padStart(8, '0')}`;

    return { 
      baseSalary, reserveFund, bonuses, extraHours, vacation, backPay,
      monthly13th, monthly14th, totalOverSalaries,
      iessContribution, loans,
      totalIncomes, totalExpenses, netToReceive: totalIncomes - totalExpenses,
      voucherCode
    };
  };

  const filteredEmployees = employees.filter(e => {
    const searchStr = (e.name + " " + e.surname + " " + e.identification).toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  const exportGeneralExcel = () => {
    const headers = "Identificación,Empleado,Sueldo Base,H. Extras,Sobre Sueldos Mens.,Ingresos (+),Egresos (-),Neto a Recibir\n";
    const rows = filteredEmployees.map((emp, idx) => {
      const d = calculatePayrollData(emp, idx);
      return `${emp.identification},${emp.surname} ${emp.name},${d.baseSalary.toFixed(2)},${d.extraHours.toFixed(2)},${d.totalOverSalaries.toFixed(2)},${d.totalIncomes.toFixed(2)},${d.totalExpenses.toFixed(2)},${d.netToReceive.toFixed(2)}`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Nomina_${selectedMonth}_2026.csv`;
    link.click();
  };

  const exportIndividualExcel = (emp: Employee) => {
    const empIdx = employees.findIndex(e => e.id === emp.id);
    const d = calculatePayrollData(emp, empIdx);
    
    let csv = `ROL INDIVIDUAL DE PAGOS - ${company?.name || 'ASIST UP'}\n`;
    csv += `Periodo: ${selectedMonth} 2026\n`;
    csv += `Voucher: ${d.voucherCode}\n\n`;
    csv += `Empleado: ${emp.surname} ${emp.name}\n`;
    csv += `Identificación: ${emp.identification}\n`;
    csv += `Cargo: ${emp.role}\n\n`;
    csv += `INGRESOS,VALOR,EGRESOS,VALOR\n`;
    csv += `Sueldo Base,${d.baseSalary.toFixed(2)},Aporte IESS (9.45%),${d.iessContribution.toFixed(2)}\n`;
    csv += `Horas Extras,${d.extraHours.toFixed(2)},Préstamos/Anticipos,${d.loans.toFixed(2)}\n`;
    csv += `Bonificaciones,${d.bonuses.toFixed(2)},,\n`;
    csv += `Saldos Atrasados,${d.backPay.toFixed(2)},,\n`;
    csv += `X Tercero (Mensual),${d.monthly13th.toFixed(2)},,\n`;
    csv += `X Cuarto (Mensual),${d.monthly14th.toFixed(2)},,\n`;
    csv += `Fondos Reserva,${d.reserveFund.toFixed(2)},,\n`;
    csv += `TOTAL INGRESOS,${d.totalIncomes.toFixed(2)},TOTAL EGRESOS,${d.totalExpenses.toFixed(2)}\n\n`;
    csv += `NETO A RECIBIR,${d.netToReceive.toFixed(2)}\n`;
    csv += `Método de Pago,${emp.bankInfo?.ifi === 'NO APLICA' ? 'EFECTIVO' : emp.bankInfo?.ifi}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Rol_${emp.surname}_${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="space-y-8 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 no-print gap-6">
        <div className="w-full md:w-auto">
          <h2 className="text-2xl font-[950] text-slate-900 uppercase tracking-tighter">Liquidación de Nómina Analítica</h2>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mt-4">
             <div className="flex items-center gap-3">
                <p className="text-[10px] font-black text-slate-400 uppercase">Periodo Fiscal:</p>
                <select className="p-2 border rounded-lg text-[10px] font-black uppercase" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                    {['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
             </div>
             <input 
               type="text" 
               placeholder="Buscar empleado o CI..." 
               className="p-2 border rounded-xl text-[10px] font-bold uppercase min-w-[200px]" 
               value={searchTerm} 
               onChange={e => setSearchTerm(e.target.value)}
             />
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
           <button onClick={exportGeneralExcel} className="flex-1 md:flex-none px-6 py-4 bg-emerald-50 text-emerald-600 font-black rounded-2xl border border-emerald-100 uppercase text-[9px] tracking-widest">Exportar Excel</button>
           <button onClick={() => window.print()} className="flex-1 md:flex-none px-6 py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-[9px] tracking-widest shadow-lg">Imprimir Todo</button>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] shadow-sm overflow-x-auto border">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-900 text-white text-[9px] font-black uppercase">
            <tr>
              <th className="p-4 rounded-tl-2xl">Identificación</th>
              <th className="p-4">Colaborador</th>
              <th className="p-4">Base</th>
              <th className="p-4">H. Extras</th>
              <th className="p-4">Sobre Sueldos Mens.</th>
              <th className="p-4">Total Ingresos (+)</th>
              <th className="p-4">Total Egresos (-)</th>
              <th className="p-4">Neto Recibir</th>
              <th className="p-4 no-print text-center rounded-tr-2xl">Acción</th>
            </tr>
          </thead>
          <tbody className="text-[10px] uppercase font-bold text-slate-700">
            {filteredEmployees.filter(e => e.status === 'active').map((emp, idx) => {
              const d = calculatePayrollData(emp, idx);
              return (
                <tr key={emp.id} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-mono font-black text-blue-600">{emp.identification}</td>
                  <td className="p-4 font-black text-slate-900">{emp.surname} {emp.name}</td>
                  <td className="p-4">${d.baseSalary.toFixed(2)}</td>
                  <td className="p-4 text-blue-600 font-black">${d.extraHours.toFixed(2)}</td>
                  <td className="p-4 text-amber-600 font-black">${d.totalOverSalaries.toFixed(2)}</td>
                  <td className="p-4 text-emerald-600 font-bold">+${d.totalIncomes.toFixed(2)}</td>
                  <td className="p-4 text-red-600">-${d.totalExpenses.toFixed(2)}</td>
                  <td className="p-4 font-[950] text-blue-700 text-xs shadow-inner bg-blue-50/20">${d.netToReceive.toFixed(2)}</td>
                  <td className="p-4 no-print text-center">
                     <button onClick={() => setIndividualPayroll(emp)} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-black hover:bg-blue-600 hover:text-white transition-all text-[9px] uppercase tracking-widest">Ver Detalle</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!individualPayroll} onClose={() => setIndividualPayroll(null)} title="Rol Individual de Pagos">
        {individualPayroll && (() => {
          const empIdx = employees.findIndex(e => e.id === individualPayroll.id);
          const d = calculatePayrollData(individualPayroll, empIdx);
          return (
            <div className="p-4 space-y-8 print:p-0">
               <header className="text-center border-b-2 border-slate-900 pb-6">
                  <h3 className="text-2xl font-[950] tracking-tighter uppercase leading-none">{company?.name || 'ASIST UP CORPORATE'}</h3>
                  <div className="flex justify-between items-center mt-4">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">COMPROBANTE ANALÍTICO - {selectedMonth}</p>
                     <p className="text-[11px] font-[900] text-blue-600 font-mono tracking-widest">{d.voucherCode}</p>
                  </div>
               </header>
               
               <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-[10px] font-black uppercase">
                  <div>
                     <p className="text-slate-400 mb-0.5">Beneficiario</p>
                     <p className="text-slate-900">{individualPayroll.surname} {individualPayroll.name}</p>
                     <p className="text-slate-500 font-bold">{individualPayroll.identification}</p>
                  </div>
                  <div className="text-right">
                     <p className="text-slate-400 mb-0.5">Cargo / Rol</p>
                     <p className="text-slate-900">{individualPayroll.role}</p>
                     <p className="text-blue-600 italic">Fecha: {new Date().toLocaleDateString()}</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-8 border-t border-b py-6">
                  <div className="space-y-4">
                     <h4 className="text-[9px] font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-50 pb-2">I. Ingresos y Extras</h4>
                     <div className="space-y-2 text-[10px] font-bold">
                        <div className="flex justify-between"><span>Sueldo Base</span> <span>${d.baseSalary.toFixed(2)}</span></div>
                        <div className="flex justify-between font-black text-blue-600"><span>Horas Extras/Supl.</span> <span>${d.extraHours.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Bonificaciones</span> <span>${d.bonuses.toFixed(2)}</span></div>
                        <div className="flex justify-between text-amber-600"><span>Saldos Atrasados</span> <span>${d.backPay.toFixed(2)}</span></div>
                        {individualPayroll.overSalaryType === 'monthly' && (
                          <>
                            <div className="flex justify-between text-amber-700"><span>X Tercero (Mensual)</span> <span>${d.monthly13th.toFixed(2)}</span></div>
                            <div className="flex justify-between text-amber-700"><span>X Cuarto (Mensual)</span> <span>${d.monthly14th.toFixed(2)}</span></div>
                          </>
                        )}
                        <div className="flex justify-between"><span>Fondos Reserva</span> <span>${d.reserveFund.toFixed(2)}</span></div>
                        <div className="flex justify-between pt-2 border-t font-black text-emerald-600 text-xs"><span>TOTAL INGRESOS</span> <span>${d.totalIncomes.toFixed(2)}</span></div>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <h4 className="text-[9px] font-black text-red-600 uppercase tracking-widest border-b border-red-50 pb-2">II. Egresos</h4>
                     <div className="space-y-2 text-[10px] font-bold">
                        <div className="flex justify-between"><span>Aporte Personal IESS (9.45%)</span> <span>-${d.iessContribution.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Préstamos / Anticipos</span> <span>-${d.loans.toFixed(2)}</span></div>
                        <div className="flex justify-between pt-2 border-t font-black text-red-600 text-xs"><span>TOTAL EGRESOS</span> <span>-${d.totalExpenses.toFixed(2)}</span></div>
                     </div>
                  </div>
               </div>

               <div className="bg-slate-900 p-8 rounded-[2rem] text-white flex justify-between items-center shadow-2xl">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-50">Líquido a Recibir</p>
                    {individualPayroll.bankInfo?.ifi === 'NO APLICA' ? (
                       <p className="text-[10px] font-bold uppercase mt-1">PAGO EN EFECTIVO</p>
                    ) : (
                       <>
                          <p className="text-[10px] font-bold uppercase mt-1">{individualPayroll.bankInfo?.ifi}</p>
                          <p className="text-[10px] font-bold uppercase">Cuenta: {individualPayroll.bankInfo?.account}</p>
                       </>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-[950] tracking-tighter italic">${d.netToReceive.toFixed(2)}</p>
                  </div>
               </div>

               <div className="pt-16 grid grid-cols-2 gap-20 text-center no-print-flex">
                  <div className="border-t border-slate-300 pt-4"><p className="text-[8px] font-black uppercase text-slate-400">Autorizado Gerencia</p></div>
                  <div className="border-t border-slate-300 pt-4"><p className="text-[8px] font-black uppercase text-slate-400">Firma Colaborador</p></div>
               </div>

               <div className="flex gap-4 pt-10 no-print">
                  <button onClick={() => exportIndividualExcel(individualPayroll)} className="flex-1 py-5 bg-emerald-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl">Descargar Excel</button>
                  <button onClick={() => window.print()} className="flex-1 py-5 bg-slate-900 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl">Imprimir</button>
                  <button onClick={() => setIndividualPayroll(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase text-[10px] tracking-widest">Cerrar</button>
               </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default PayrollModule;