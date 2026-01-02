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
  const [selectedYear] = useState('2026');
  const [individualPayroll, setIndividualPayroll] = useState<Employee | null>(null);

  const calculatePayrollData = (emp: Employee) => {
    const isAffiliated = emp.isAffiliated;
    const baseSalary = emp.salary;
    
    // Antigüedad para Fondos de Reserva (2do año)
    const startDate = new Date(emp.startDate);
    const today = new Date();
    const diffYears = today.getFullYear() - startDate.getFullYear();
    const hasRightToReserve = isAffiliated && (diffYears >= 1); // Simplificación legal
    
    const reserveFund = (hasRightToReserve && emp.overSalaryType === 'monthly') ? (baseSalary * settings.reserveRate) : 0;
    const thirteenth = (isAffiliated && emp.overSalaryType === 'monthly') ? (baseSalary / 12) : 0;
    const fourteenth = (isAffiliated && emp.overSalaryType === 'monthly') ? (settings.sbu / 12) : 0;
    
    const totalIncome = baseSalary + reserveFund + thirteenth + fourteenth;

    // Egresos
    const iessContribution = isAffiliated ? (baseSalary * settings.iessRate) : 0;
    const loans = payments
      .filter(p => p.employeeId === emp.id && p.month === selectedMonth && p.status === 'paid' && p.type === 'Loan')
      .reduce((sum, p) => sum + p.amount, 0);
    const penalties = payments
      .filter(p => p.employeeId === emp.id && p.month === selectedMonth && p.status === 'paid' && p.type === 'Bonus' && p.amount < 0)
      .reduce((sum, p) => sum + Math.abs(p.amount), 0);

    const totalExpenses = iessContribution + loans + penalties;

    return { 
      baseSalary, reserveFund, thirteenth, fourteenth, 
      iessContribution, loans, penalties,
      totalIncome, totalExpenses, netToReceive: totalIncome - totalExpenses 
    };
  };

  return (
    <div className="space-y-8 fade-in">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 no-print">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Gestión Administrativa de Nómina</h2>
          <div className="flex gap-4 mt-2">
            <select className="bg-slate-50 border rounded-xl px-4 py-1.5 text-[10px] font-black uppercase outline-none focus:border-blue-500" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              {['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-4">
           <button onClick={() => window.print()} className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest hover:scale-105 transition-all">Descargar PDF / Imprimir A4</button>
        </div>
      </div>

      <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl border border-slate-100 print:shadow-none print:border-none print:p-0 mx-auto overflow-x-auto">
        <header className="flex justify-between items-start mb-12 border-b-4 border-slate-900 pb-10">
           <div className="space-y-6">
              <h1 className="text-4xl font-[900] text-slate-900 leading-tight">
                ROL DE PAGOS GENERAL<br/>
                <span className="text-blue-700 text-3xl uppercase italic">{company?.name.toUpperCase() || 'EMPRESA'}</span>
              </h1>
              <div className="space-y-1 text-[12px] font-black text-slate-600 uppercase tracking-tight">
                <p><span className="text-slate-400">Razón Social:</span> {company?.legalRep.toUpperCase()}</p>
                <p><span className="text-slate-400">RUC:</span> {company?.ruc}</p>
              </div>
           </div>
           <div className="text-right">
              <div className="text-emerald-700 font-[950] text-5xl uppercase leading-none mb-1">
                {selectedMonth}
              </div>
              <div className="text-slate-900 font-black text-2xl uppercase tracking-[0.2em]">
                {selectedYear}
              </div>
           </div>
        </header>

        <table className="w-full text-left border-collapse border-2 border-slate-900">
          <thead>
            <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest text-center">
              <th className="border-r border-slate-700 p-4">Empleado</th>
              <th className="border-r border-slate-700 p-4">Ingreso Base</th>
              <th className="border-r border-slate-700 p-4">F. Reserva (8.33%)</th>
              <th className="border-r border-slate-700 p-4">13ro Mens.</th>
              <th className="border-r border-slate-700 p-4">14to Mens.</th>
              <th className="border-r border-slate-700 p-4 bg-blue-800">Total Ingresos</th>
              <th className="border-r border-slate-700 p-4">IESS (9.45%)</th>
              <th className="border-r border-slate-700 p-4">Anticipos/Multas</th>
              <th className="border-r border-slate-700 p-4 bg-red-800">Total Egresos</th>
              <th className="border-r border-slate-700 p-4 font-black text-sm">Neto Recibir</th>
              <th className="p-4">Acciones</th>
            </tr>
          </thead>
          <tbody className="text-[10px] uppercase font-bold text-slate-700">
            {employees.filter(e => e.status === 'active').map(emp => {
              const data = calculatePayrollData(emp);
              const isFijo = emp.isFixed;
              
              return (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors border-b border-slate-200">
                  <td className="border-r border-slate-200 p-4 font-black text-slate-900 whitespace-nowrap">{emp.name} {emp.surname}</td>
                  <td className="border-r border-slate-200 p-4 text-right">${data.baseSalary.toFixed(2)}</td>
                  <td className="border-r border-slate-200 p-4 text-right">{isFijo ? `$${data.reserveFund.toFixed(2)}` : '---'}</td>
                  <td className="border-r border-slate-200 p-4 text-right">{isFijo ? `$${data.thirteenth.toFixed(2)}` : '---'}</td>
                  <td className="border-r border-slate-200 p-4 text-right">{isFijo ? `$${data.fourteenth.toFixed(2)}` : '---'}</td>
                  <td className="border-r border-slate-200 p-4 text-right bg-blue-50 font-black text-blue-900">${data.totalIncome.toFixed(2)}</td>
                  <td className="border-r border-slate-200 p-4 text-right">{isFijo ? `$${data.iessContribution.toFixed(2)}` : '---'}</td>
                  <td className="border-r border-slate-200 p-4 text-right">${(data.loans + data.penalties).toFixed(2)}</td>
                  <td className="border-r border-slate-200 p-4 text-right bg-red-50 font-black text-red-900">${data.totalExpenses.toFixed(2)}</td>
                  <td className="border-r border-slate-200 p-4 text-right font-black text-slate-900 text-xs bg-slate-50">${data.netToReceive.toFixed(2)}</td>
                  <td className="p-4">
                     <div className="flex flex-col gap-1 items-center">
                        <button onClick={() => setIndividualPayroll(emp)} className="no-print text-[8px] px-2 py-1 bg-blue-50 text-blue-600 rounded-md font-black hover:bg-blue-600 hover:text-white transition-all uppercase whitespace-nowrap">Individual</button>
                     </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-24 flex justify-around px-10">
           <div className="text-center">
              <div className="w-72 border-t-2 border-slate-900 pt-3">
                <p className="font-black text-xs uppercase text-slate-900">Firma del Empleador</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Gerencia Administrativa</p>
              </div>
           </div>
           <div className="text-center">
              <div className="w-72 border-t-2 border-slate-900 pt-3">
                <p className="font-black text-xs uppercase text-slate-900">Firma del Administrador</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Talento Humano</p>
              </div>
           </div>
        </div>
      </div>

      <Modal 
        isOpen={!!individualPayroll} 
        onClose={() => setIndividualPayroll(null)} 
        title="Rol de Pagos Individual"
        footer={
           <button onClick={() => setIndividualPayroll(null)} className="px-6 py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">Regresar a Nómina General</button>
        }
      >
        {individualPayroll && (
          <div className="p-6 space-y-8 bg-white">
            <div className="text-center border-b-2 border-slate-900 pb-6">
               <h2 className="text-2xl font-black text-slate-900 uppercase italic">ROL DE PAGOS INDIVIDUAL</h2>
               <p className="text-[12px] font-black text-blue-700 uppercase tracking-[0.3em] mt-2">{company?.name || 'EMPRESA'}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-y-4 text-[11px] font-black uppercase border-b pb-4">
               <p><span className="text-slate-400">EMPLEADO:</span> {individualPayroll.name} {individualPayroll.surname}</p>
               <p className="text-right"><span className="text-slate-400">ID:</span> {individualPayroll.identification}</p>
               <p><span className="text-slate-400">MES:</span> {selectedMonth} {selectedYear}</p>
               <p className="text-right"><span className="text-slate-400">TIPO:</span> {individualPayroll.isFixed ? 'FIJO' : 'TEMPORAL'}</p>
            </div>
            
            <div className="space-y-6">
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                  <p className="text-[10px] font-black text-blue-600 uppercase mb-4 tracking-widest">Detalle de Ingresos</p>
                  <div className="space-y-2 text-xs">
                     <div className="flex justify-between"><span>Sueldo Base</span><span className="font-bold">${calculatePayrollData(individualPayroll).baseSalary.toFixed(2)}</span></div>
                     {individualPayroll.isAffiliated && (
                       <>
                        <div className="flex justify-between"><span>F. Reserva (8.33%)</span><span className="font-bold">${calculatePayrollData(individualPayroll).reserveFund.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>13vo Sueldo Mensualizado</span><span className="font-bold">${calculatePayrollData(individualPayroll).thirteenth.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>14to Sueldo Mensualizado</span><span className="font-bold">${calculatePayrollData(individualPayroll).fourteenth.toFixed(2)}</span></div>
                       </>
                     )}
                     <div className="flex justify-between border-t pt-2 font-black text-blue-900 uppercase"><span>Total Ingresos</span><span>${calculatePayrollData(individualPayroll).totalIncome.toFixed(2)}</span></div>
                  </div>
               </div>

               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                  <p className="text-[10px] font-black text-red-600 uppercase mb-4 tracking-widest">Detalle de Egresos</p>
                  <div className="space-y-2 text-xs">
                     {individualPayroll.isAffiliated && (
                        <div className="flex justify-between"><span>Aporte IESS (9.45%)</span><span className="font-bold text-red-600">-${calculatePayrollData(individualPayroll).iessContribution.toFixed(2)}</span></div>
                     )}
                     <div className="flex justify-between"><span>Anticipos / Préstamos</span><span className="font-bold text-red-600">-${calculatePayrollData(individualPayroll).loans.toFixed(2)}</span></div>
                     <div className="flex justify-between border-t pt-2 font-black text-red-900 uppercase"><span>Total Egresos</span><span>${calculatePayrollData(individualPayroll).totalExpenses.toFixed(2)}</span></div>
                  </div>
               </div>

               <div className="p-6 bg-slate-900 rounded-3xl text-white flex justify-between items-center shadow-2xl">
                  <span className="text-sm font-black uppercase tracking-widest">Neto a Recibir:</span>
                  <span className="text-3xl font-[950] tracking-tighter">${calculatePayrollData(individualPayroll).netToReceive.toFixed(2)}</span>
               </div>
            </div>

            <div className="pt-20 grid grid-cols-2 gap-12 text-center">
               <div className="border-t-2 border-slate-900 pt-3">
                  <p className="text-[10px] font-black uppercase">Firma del Administrador</p>
               </div>
               <div className="border-t-2 border-slate-900 pt-3">
                  <p className="text-[10px] font-black uppercase">Firma del Colaborador</p>
               </div>
            </div>
            
            <button onClick={() => window.print()} className="no-print w-full py-4 bg-blue-700 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest mt-4">Imprimir Comprobante</button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PayrollModule;