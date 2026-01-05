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

  const calculatePayrollData = (emp: Employee) => {
    const baseSalary = emp.salary;
    
    // Pagos de Tesorería del mes seleccionado
    const monthlyPayments = payments.filter(p => p.employeeId === emp.id && p.month === selectedMonth && p.status === 'paid');
    
    const bonuses = monthlyPayments.filter(p => p.type === 'Bonus').reduce((sum, p) => sum + p.amount, 0);
    const extraHours = monthlyPayments.filter(p => p.type === 'ExtraHours').reduce((sum, p) => sum + p.amount, 0);
    const thirteenth = monthlyPayments.filter(p => p.type === 'Thirteenth').reduce((sum, p) => sum + p.amount, 0);
    const fourteenth = monthlyPayments.filter(p => p.type === 'Fourteenth').reduce((sum, p) => sum + p.amount, 0);
    const vacation = monthlyPayments.filter(p => p.type === 'Vacation').reduce((sum, p) => sum + p.amount, 0);
    
    // Fondos de Reserva (Solo si está afiliado y configurado como mensual)
    const reserveFund = (emp.isAffiliated && emp.overSalaryType === 'monthly') ? ((baseSalary + extraHours) * settings.reserveRate) : 0;
    
    const totalIncomes = baseSalary + reserveFund + bonuses + extraHours + thirteenth + fourteenth + vacation;

    // Egresos
    // La aportación personal se calcula sobre todo ingreso regular (Sueldo + Extras + Bonos)
    const taxableIncome = baseSalary + extraHours + bonuses;
    const iessContribution = emp.isAffiliated ? (taxableIncome * settings.iessRate) : 0;
    const loans = monthlyPayments.filter(p => p.type === 'Loan' || p.type === 'Emergency').reduce((sum, p) => sum + p.amount, 0);
    
    const totalExpenses = iessContribution + loans;

    return { 
      baseSalary, reserveFund, bonuses, extraHours, thirteenth, fourteenth, vacation,
      iessContribution, loans,
      totalIncomes, totalExpenses, netToReceive: totalIncomes - totalExpenses 
    };
  };

  const exportGeneralExcel = () => {
    const headers = "Empleado,Sueldo Base,Horas Extras,Fondos Reserva,Décimos/Vacaciones,Bonos,Ingreso Total,Aporte IESS,Préstamos,Egreso Total,Neto a Recibir\n";
    const rows = employees.map(emp => {
      const d = calculatePayrollData(emp);
      const otherIncomes = d.thirteenth + d.fourteenth + d.vacation;
      return `${emp.surname} ${emp.name},${d.baseSalary.toFixed(2)},${d.extraHours.toFixed(2)},${d.reserveFund.toFixed(2)},${otherIncomes.toFixed(2)},${d.bonuses.toFixed(2)},${d.totalIncomes.toFixed(2)},${d.iessContribution.toFixed(2)},${d.loans.toFixed(2)},${d.totalExpenses.toFixed(2)},${d.netToReceive.toFixed(2)}`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Nomina_Detallada_${selectedMonth}_2026.csv`;
    link.click();
  };

  return (
    <div className="space-y-8 fade-in">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 no-print">
        <div>
          <h2 className="text-2xl font-[950] text-slate-900 uppercase tracking-tighter">Liquidación de Nómina Analítica</h2>
          <div className="flex items-center gap-3 mt-2">
             <p className="text-[10px] font-black text-slate-400 uppercase">Periodo Fiscal:</p>
             <select className="p-2 border rounded-lg text-[10px] font-black uppercase" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                {['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}
             </select>
          </div>
        </div>
        <div className="flex gap-3">
           <button onClick={exportGeneralExcel} className="px-6 py-4 bg-emerald-50 text-emerald-600 font-black rounded-2xl border border-emerald-100 uppercase text-[9px] tracking-widest hover:bg-emerald-600 hover:text-white transition-all">Exportar General Excel</button>
           <button onClick={() => window.print()} className="px-6 py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-[9px] tracking-widest shadow-lg">Imprimir Todo</button>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] shadow-sm overflow-x-auto border">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-900 text-white text-[9px] font-black uppercase">
            <tr>
              <th className="p-4 rounded-tl-2xl">Colaborador</th>
              <th className="p-4">Base + Extras</th>
              <th className="p-4">IESS (-)</th>
              <th className="p-4">Ingresos Total (+)</th>
              <th className="p-4">Neto Recibir</th>
              <th className="p-4 no-print text-center rounded-tr-2xl">Acción</th>
            </tr>
          </thead>
          <tbody className="text-[10px] uppercase font-bold text-slate-700">
            {employees.filter(e => e.status === 'active').map(emp => {
              const d = calculatePayrollData(emp);
              return (
                <tr key={emp.id} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-black text-slate-900">{emp.surname} {emp.name}</td>
                  <td className="p-4">${(d.baseSalary + d.extraHours).toFixed(2)}</td>
                  <td className="p-4 text-red-600 font-bold">-${d.iessContribution.toFixed(2)}</td>
                  <td className="p-4 text-emerald-600 font-black">${d.totalIncomes.toFixed(2)}</td>
                  <td className="p-4 font-[950] text-blue-700 text-xs shadow-inner bg-blue-50/20">${d.netToReceive.toFixed(2)}</td>
                  <td className="p-4 no-print text-center">
                     <button onClick={() => setIndividualPayroll(emp)} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-black hover:bg-blue-600 hover:text-white transition-all">Ver Detalle</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Rol Individual Detallado */}
      <Modal isOpen={!!individualPayroll} onClose={() => setIndividualPayroll(null)} title="Rol Individual de Pagos">
        {individualPayroll && (() => {
          const d = calculatePayrollData(individualPayroll);
          return (
            <div className="p-4 space-y-8 print:p-0">
               <header className="text-center border-b-2 border-slate-900 pb-6">
                  <h3 className="text-2xl font-[950] tracking-tighter uppercase leading-none">{company?.name || 'ASIST UP CORPORATE'}</h3>
                  <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.4em]">COMPROBANTE ANALÍTICO DE PAGO - {selectedMonth} 2026</p>
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
                  {/* Detalle de Ingresos */}
                  <div className="space-y-4">
                     <h4 className="text-[9px] font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-50 pb-2">I. Ingresos y Extras</h4>
                     <div className="space-y-2 text-[10px] font-bold">
                        <div className="flex justify-between"><span>Sueldo Base</span> <span>${d.baseSalary.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Horas Extras/Supl.</span> <span className="text-blue-600 font-black">${d.extraHours.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Fondos Reserva</span> <span>${d.reserveFund.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Bonificaciones</span> <span>${d.bonuses.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Décimo Tercero</span> <span>${d.thirteenth.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Décimo Cuarto</span> <span>${d.fourteenth.toFixed(2)}</span></div>
                        <div className="flex justify-between pt-2 border-t font-black text-emerald-600 text-xs"><span>TOTAL INGRESOS</span> <span>${d.totalIncomes.toFixed(2)}</span></div>
                     </div>
                  </div>
                  {/* Detalle de Egresos */}
                  <div className="space-y-4">
                     <h4 className="text-[9px] font-black text-red-600 uppercase tracking-widest border-b border-red-50 pb-2">II. Deducciones</h4>
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
                    <p className="text-[10px] font-bold uppercase mt-1">{individualPayroll.bankInfo?.ifi} - {individualPayroll.bankInfo?.type}</p>
                    <p className="text-[10px] font-bold uppercase">#{individualPayroll.bankInfo?.account}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-[950] tracking-tighter italic">${d.netToReceive.toFixed(2)}</p>
                  </div>
               </div>

               <div className="pt-16 grid grid-cols-2 gap-20 text-center no-print-flex">
                  <div className="border-t border-slate-300 pt-4">
                     <p className="text-[8px] font-black uppercase text-slate-400">Autorizado por Gerencia</p>
                  </div>
                  <div className="border-t border-slate-300 pt-4">
                     <p className="text-[8px] font-black uppercase text-slate-400">Firma Colaborador</p>
                  </div>
               </div>

               <div className="flex gap-4 pt-10 no-print">
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