
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
    
    // Ingresos
    const baseSalary = emp.salary;
    const overSueldos = emp.overSalaryType === 'monthly' && isAffiliated ? (baseSalary / 12) : 0;
    const fondoReserva = isAffiliated ? (baseSalary * settings.reserveRate) : 0;
    const totalIngresos = baseSalary + overSueldos + fondoReserva;

    // Egresos
    const iess = isAffiliated ? (baseSalary * settings.iessRate) : 0;
    const totalEgresos = iess;

    return { baseSalary, overSueldos, fondoReserva, iess, totalIngresos, totalEgresos, neto: totalIngresos - totalEgresos };
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-8 fade-in">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 no-print">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Generación de Nómina</h2>
          <div className="flex gap-4 mt-2">
            <select className="bg-slate-50 border rounded-lg px-4 py-1 text-[10px] font-black uppercase" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              {['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <button onClick={handlePrint} className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest">Imprimir Rol General A4</button>
      </div>

      <div className="bg-white p-16 rounded-[2rem] shadow-2xl border border-slate-100 min-h-[1000px] print:shadow-none print:border-none print:p-0">
        <div className="flex justify-between items-start mb-16 border-b-4 border-slate-900 pb-8">
           <div>
              <h1 className="text-4xl font-black text-slate-900 leading-none mb-4 uppercase">ROL DE PAGOS GENERAL <br/><span className="text-blue-600">{company?.name.toUpperCase()}</span></h1>
              <div className="space-y-1 text-xs font-black text-slate-500 uppercase">
                <p>Razón Social: {company?.legalRep.toUpperCase()}</p>
                <p>RUC: {company?.ruc}</p>
              </div>
           </div>
           <div className="text-right">
              <p className="text-emerald-700 font-black text-3xl uppercase">{selectedMonth} {selectedYear}</p>
              <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.2em] italic">Resumen de Haberes Mensuales</p>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-200">
            <thead className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
              <tr>
                <th className="border border-slate-700 p-4">Empleado</th>
                <th className="border border-slate-700 p-4 text-right">Sueldo Base</th>
                <th className="border border-slate-700 p-4 text-right">F. Reserva (8.33%)</th>
                <th className="border border-slate-700 p-4 text-right">Décimos Mens.</th>
                <th className="border border-slate-700 p-4 text-right bg-blue-900/50">Total Ingresos</th>
                <th className="border border-slate-700 p-4 text-right">Aporte Personal (9.45%)</th>
                <th className="border border-slate-700 p-4 text-right bg-red-900/50">Total Egresos</th>
                <th className="border border-slate-700 p-4 text-right font-black text-slate-200">Neto a Recibir</th>
                <th className="border border-slate-700 p-4 text-center">Firma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employees.filter(e => e.status === 'active').map(emp => {
                const data = calculatePayrollData(emp);
                return (
                  <tr key={emp.id} className="text-[10px] hover:bg-slate-50 font-medium">
                    <td className="border border-slate-200 p-4 font-black uppercase">{emp.name}</td>
                    <td className="border border-slate-200 p-4 text-right">${data.baseSalary.toFixed(2)}</td>
                    <td className="border border-slate-200 p-4 text-right">${data.fondoReserva.toFixed(2)}</td>
                    <td className="border border-slate-200 p-4 text-right">${data.overSueldos.toFixed(2)}</td>
                    <td className="border border-slate-200 p-4 text-right bg-slate-50/50 font-black">${data.totalIngresos.toFixed(2)}</td>
                    <td className="border border-slate-200 p-4 text-right">${data.iess.toFixed(2)}</td>
                    <td className="border border-slate-200 p-4 text-right bg-slate-50/50 font-black">${data.totalEgresos.toFixed(2)}</td>
                    <td className="border border-slate-200 p-4 text-right font-black text-blue-700 text-sm bg-blue-50/20">${data.neto.toFixed(2)}</td>
                    <td className="border border-slate-200 p-4 text-center">
                       <div className="w-32 border-b border-slate-400 mx-auto h-8 no-print">
                         <button onClick={() => setIndividualPayroll(emp)} className="text-[8px] uppercase font-black text-blue-500">Ver Individual</button>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-24 flex justify-around">
           <div className="text-center w-64 pt-4 border-t-4 border-slate-900">
              <p className="font-black text-xs uppercase">Firma del Empleador</p>
              <p className="text-[8px] text-slate-400 uppercase font-black mt-1">Cédula / Sello</p>
           </div>
           <div className="text-center w-64 pt-4 border-t-4 border-slate-900">
              <p className="font-black text-xs uppercase">Firma del Administrador</p>
              <p className="text-[8px] text-slate-400 uppercase font-black mt-1">Talento Humano</p>
           </div>
        </div>
      </div>

      <Modal isOpen={!!individualPayroll} onClose={() => setIndividualPayroll(null)} title="Comprobante de Pago Individual">
        {individualPayroll && (
          <div className="p-8 space-y-8 bg-white">
            <div className="text-center border-b-2 pb-6">
               <h2 className="text-2xl font-black text-slate-900 uppercase">ROL DE PAGOS INDIVIDUAL</h2>
               <p className="text-xs font-bold text-slate-400 uppercase">{company?.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-6 text-xs font-bold">
               <p>Empleado: <span className="font-black uppercase">{individualPayroll.name}</span></p>
               <p className="text-right">Período: <span className="font-black">{selectedMonth} {selectedYear}</span></p>
               <p>ID: <span className="font-black">{individualPayroll.identification}</span></p>
            </div>
            <div className="space-y-3 bg-slate-50 p-6 rounded-2xl border">
               <div className="flex justify-between border-b pb-2"><span>Sueldo Base</span><span className="font-black">${calculatePayrollData(individualPayroll).baseSalary.toFixed(2)}</span></div>
               <div className="flex justify-between border-b pb-2"><span>(+) Décimos Mensualizados</span><span className="font-black">${calculatePayrollData(individualPayroll).overSueldos.toFixed(2)}</span></div>
               <div className="flex justify-between border-b pb-2"><span>(+) Fondos de Reserva</span><span className="font-black">${calculatePayrollData(individualPayroll).fondoReserva.toFixed(2)}</span></div>
               <div className="flex justify-between text-red-600 font-black"><span>(-) Aporte Personal IESS (9.45%)</span><span>-${calculatePayrollData(individualPayroll).iess.toFixed(2)}</span></div>
               <div className="flex justify-between pt-6 text-xl font-black text-blue-800 uppercase"><span>Neto a Recibir</span><span>${calculatePayrollData(individualPayroll).neto.toFixed(2)}</span></div>
            </div>
            <div className="pt-24 text-center">
               <div className="w-48 border-b-2 border-slate-900 mx-auto"></div>
               <p className="mt-2 font-black text-[10px] uppercase">Firma del Recibí Conforme</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PayrollModule;
