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
  const [selectedYear] = useState('2024');
  const [individualPayroll, setIndividualPayroll] = useState<Employee | null>(null);

  const calculatePayrollData = (emp: Employee) => {
    const isAffiliated = emp.isAffiliated;
    const baseSalary = emp.salary;
    
    // Ingresos
    // Nota: Fondos de reserva solo a partir del 2do año (365 días)
    const startDate = new Date(emp.startDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const hasRightToReserve = isAffiliated && diffDays >= 365;
    const reserveFund = (hasRightToReserve && emp.overSalaryType === 'monthly') ? (baseSalary * settings.reserveRate) : 0;
    const thirteenth = (isAffiliated && emp.overSalaryType === 'monthly') ? (baseSalary / 12) : 0;
    const fourteenth = (isAffiliated && emp.overSalaryType === 'monthly') ? (settings.sbu / 12) : 0;
    
    const totalIncome = baseSalary + reserveFund + thirteenth + fourteenth;

    // Egresos
    const iessContribution = isAffiliated ? (baseSalary * settings.iessRate) : 0;
    // Simulación de otros egresos (anticipos o multas registrados en el mes)
    const otherDeductions = payments
      .filter(p => p.employeeId === emp.id && p.month === selectedMonth && p.status === 'paid' && (p.type === 'Loan' || p.type === 'Emergency'))
      .reduce((sum, p) => sum + p.amount, 0);

    const totalExpenses = iessContribution + otherDeductions;

    return { 
      baseSalary, 
      reserveFund, 
      thirteenth, 
      fourteenth, 
      iessContribution, 
      otherDeductions,
      totalIncome, 
      totalExpenses, 
      netToReceive: totalIncome - totalExpenses 
    };
  };

  return (
    <div className="space-y-8 fade-in">
      {/* Panel de Control de Impresión */}
      <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 no-print">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Nómina General de Personal</h2>
          <div className="flex gap-4 mt-2">
            <select className="bg-slate-50 border rounded-lg px-4 py-1 text-[10px] font-black uppercase outline-none focus:border-blue-500" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              {['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="text-[10px] font-black text-slate-300 self-center">PDF / EXCEL Habilitado</span>
          </div>
        </div>
        <div className="flex gap-3">
           <button onClick={() => window.print()} className="px-8 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all">Imprimir Rol General A4</button>
        </div>
      </div>

      {/* Diseño de Hoja A4 Horizontal para Impresión */}
      <div className="payroll-container bg-white p-12 rounded-[2rem] shadow-2xl border border-slate-100 print:shadow-none print:border-none print:p-4 mx-auto overflow-x-auto">
        <header className="flex justify-between items-start mb-12 border-b-2 border-slate-900 pb-8">
           <div className="space-y-4">
              <h1 className="text-4xl font-black text-slate-900 leading-none uppercase">ROL DE PAGOS GENERAL <br/> 
                <span className="text-blue-600 text-2xl">{company?.name.toUpperCase() || 'EMPRESA'}</span>
              </h1>
              <div className="grid grid-cols-1 gap-1 text-[11px] font-bold text-slate-600 uppercase">
                <p><span className="text-slate-400">Razón Social:</span> {company?.legalRep.toUpperCase()}</p>
                <p><span className="text-slate-400">RUC:</span> {company?.ruc}</p>
              </div>
           </div>
           <div className="text-right">
              <div className="text-emerald-700 font-black text-4xl uppercase leading-none">
                {selectedMonth}
              </div>
              <div className="text-slate-400 font-black text-xl uppercase tracking-widest">
                {selectedYear}
              </div>
           </div>
        </header>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest text-center">
              <th className="border border-slate-700 p-3">Empleado</th>
              <th className="border border-slate-700 p-3">Sueldo Base</th>
              <th className="border border-slate-700 p-3">F. Reserva (8.33%)</th>
              <th className="border border-slate-700 p-3">13vo Mens.</th>
              <th className="border border-slate-700 p-3">14vo Mens.</th>
              <th className="border border-slate-700 p-3 bg-blue-900">Total Ingresos</th>
              <th className="border border-slate-700 p-3">IESS (9.45%)</th>
              <th className="border border-slate-700 p-3">Otros Egresos</th>
              <th className="border border-slate-700 p-3 bg-red-900">Total Egresos</th>
              <th className="border border-slate-700 p-3 font-black text-sm">Neto Recibir</th>
              <th className="border border-slate-700 p-3">Firma del Empleado</th>
            </tr>
          </thead>
          <tbody className="text-[10px] uppercase font-bold text-slate-700">
            {employees.filter(e => e.status === 'active').map(emp => {
              const data = calculatePayrollData(emp);
              const isFixed = emp.isFixed;
              
              return (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="border border-slate-200 p-3 font-black whitespace-nowrap">{emp.name}</td>
                  <td className="border border-slate-200 p-3 text-right">${data.baseSalary.toFixed(2)}</td>
                  <td className="border border-slate-200 p-3 text-right">{isFixed ? `$${data.reserveFund.toFixed(2)}` : '---'}</td>
                  <td className="border border-slate-200 p-3 text-right">{isFixed ? `$${data.thirteenth.toFixed(2)}` : '---'}</td>
                  <td className="border border-slate-200 p-3 text-right">{isFixed ? `$${data.fourteenth.toFixed(2)}` : '---'}</td>
                  <td className="border border-slate-200 p-3 text-right bg-blue-50/50 font-black text-blue-900">${data.totalIncome.toFixed(2)}</td>
                  <td className="border border-slate-200 p-3 text-right">{isFixed ? `$${data.iessContribution.toFixed(2)}` : '---'}</td>
                  <td className="border border-slate-200 p-3 text-right">${data.otherDeductions.toFixed(2)}</td>
                  <td className="border border-slate-200 p-3 text-right bg-red-50/50 font-black text-red-900">${data.totalExpenses.toFixed(2)}</td>
                  <td className="border border-slate-200 p-3 text-right font-black text-slate-900 text-xs bg-slate-100">${data.netToReceive.toFixed(2)}</td>
                  <td className="border border-slate-200 p-3">
                     <div className="w-full border-b border-slate-400 h-8 flex items-end justify-center">
                        <button onClick={() => setIndividualPayroll(emp)} className="no-print text-[8px] text-blue-500 font-black hover:underline mb-1">Generar Individual</button>
                     </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Líneas de Firma para el Rol General */}
        <div className="mt-20 flex justify-between px-20">
           <div className="text-center">
              <div className="w-64 border-t-2 border-slate-900 pt-2">
                <p className="font-black text-xs uppercase">Firma del Empleador</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Gerente General</p>
              </div>
           </div>
           <div className="text-center">
              <div className="w-64 border-t-2 border-slate-900 pt-2">
                <p className="font-black text-xs uppercase">Firma del Administrador</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Talento Humano</p>
              </div>
           </div>
        </div>
      </div>

      {/* Modal para Rol Individual */}
      <Modal isOpen={!!individualPayroll} onClose={() => setIndividualPayroll(null)} title="Comprobante de Pago Individual">
        {individualPayroll && (
          <div className="p-4 space-y-6">
            <div className="text-center border-b pb-4">
               <h2 className="text-xl font-black text-slate-900 uppercase">Comprobante de Nómina Individual</h2>
               <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{company?.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs font-bold uppercase">
               <p>Colaborador: <span className="text-slate-500 font-black">{individualPayroll.name}</span></p>
               <p className="text-right">Período: <span className="text-slate-500 font-black">{selectedMonth} {selectedYear}</span></p>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-2xl border space-y-3">
               <div className="flex justify-between font-black text-slate-400 text-[10px] uppercase tracking-widest"><span>Descripción de Haberes</span><span>Valor ($)</span></div>
               <hr/>
               <div className="flex justify-between text-xs"><span>Sueldo Base</span><span>{calculatePayrollData(individualPayroll).baseSalary.toFixed(2)}</span></div>
               <div className="flex justify-between text-xs"><span>(+) Fondos de Reserva</span><span>{calculatePayrollData(individualPayroll).reserveFund.toFixed(2)}</span></div>
               <div className="flex justify-between text-xs"><span>(+) Décimo Tercero</span><span>{calculatePayrollData(individualPayroll).thirteenth.toFixed(2)}</span></div>
               <div className="flex justify-between text-xs"><span>(+) Décimo Cuarto</span><span>{calculatePayrollData(individualPayroll).fourteenth.toFixed(2)}</span></div>
               <hr/>
               <div className="flex justify-between text-xs text-red-600"><span>(-) Aporte IESS (9.45%)</span><span>-{calculatePayrollData(individualPayroll).iessContribution.toFixed(2)}</span></div>
               <div className="flex justify-between text-xs text-red-600"><span>(-) Otros Egresos / Multas</span><span>-{calculatePayrollData(individualPayroll).otherDeductions.toFixed(2)}</span></div>
               <hr className="border-slate-900"/>
               <div className="flex justify-between text-lg font-black text-blue-900 uppercase"><span>Neto a Recibir</span><span>${calculatePayrollData(individualPayroll).netToReceive.toFixed(2)}</span></div>
            </div>

            <div className="pt-16 grid grid-cols-2 gap-8 text-center">
               <div className="border-t border-slate-400 pt-2">
                  <p className="text-[9px] font-black uppercase">Administración</p>
               </div>
               <div className="border-t border-slate-400 pt-2">
                  <p className="text-[9px] font-black uppercase">Firma del Recibí Conforme</p>
               </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PayrollModule;