
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
  const [selectedYear, setSelectedYear] = useState('2024');
  const [individualPayroll, setIndividualPayroll] = useState<Employee | null>(null);

  const calculatePayrollData = (emp: Employee) => {
    const isFixed = emp.isFixed;
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
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Nómina General de Personal</h2>
          <div className="flex gap-4 mt-2">
            <select className="bg-slate-50 border rounded-lg px-4 py-1 text-[10px] font-black uppercase" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              {['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-4">
           <button onClick={handlePrint} className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest">Imprimir Rol General</button>
        </div>
      </div>

      <div className="bg-white p-12 rounded-[2rem] shadow-2xl border border-slate-100 min-h-[1000px]">
        {/* Encabezado solicitado */}
        <div className="flex justify-between items-start mb-12 border-b-4 border-slate-900 pb-8">
           <div className="space-y-1">
              <h1 className="text-3xl font-black text-slate-900 leading-none">ROL DE PAGOS GENERAL <br/><span className="text-blue-600">{company?.name.toUpperCase() || 'EMPRESA'}</span></h1>
              <div className="mt-4 space-y-1 text-xs font-bold text-slate-600">
                <p>RAZÓN SOCIAL: {company?.legalRep.toUpperCase()}</p>
                <p>RUC: {company?.ruc}</p>
              </div>
           </div>
           <div className="text-right">
              <p className="text-emerald-700 font-black text-2xl uppercase">{selectedMonth} {selectedYear}</p>
              <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest italic">Documento Oficial Interno</p>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">
              <tr>
                <th className="border p-3">Empleado</th>
                <th className="border p-3 text-right">Sueldo Base</th>
                <th className="border p-3 text-right">F. Reserva (8.33%)</th>
                <th className="border p-3 text-right">13/14 Mensual</th>
                <th className="border p-3 text-right bg-emerald-50">Total Ingresos</th>
                <th className="border p-3 text-right">Aporte IESS (9.45%)</th>
                <th className="border p-3 text-right bg-red-50">Total Egresos</th>
                <th className="border p-3 text-right font-black text-slate-900">Neto a Recibir</th>
                <th className="border p-3 text-center no-print">Firma</th>
              </tr>
            </thead>
            <tbody>
              {employees.filter(e => e.status === 'active').map(emp => {
                const data = calculatePayrollData(emp);
                return (
                  <tr key={emp.id} className="text-[10px] hover:bg-slate-50 transition-colors">
                    <td className="border p-3 font-black uppercase">{emp.name}</td>
                    <td className="border p-3 text-right">${data.baseSalary.toFixed(2)}</td>
                    <td className="border p-3 text-right">${data.fondoReserva.toFixed(2)}</td>
                    <td className="border p-3 text-right">${data.overSueldos.toFixed(2)}</td>
                    <td className="border p-3 text-right bg-emerald-50/30 font-bold">${data.totalIngresos.toFixed(2)}</td>
                    <td className="border p-3 text-right">${data.iess.toFixed(2)}</td>
                    <td className="border p-3 text-right bg-red-50/30 font-bold">${data.totalEgresos.toFixed(2)}</td>
                    <td className="border p-3 text-right font-black text-blue-700 text-xs">${data.neto.toFixed(2)}</td>
                    <td className="border p-3 no-print text-center">
                       <button onClick={() => setIndividualPayroll(emp)} className="text-blue-500 font-black text-[8px] uppercase">Individual</button>
                    </td>
                    <td className="border-b p-3 hidden print:table-cell w-32"></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-20 flex justify-around no-print print:flex">
           <div className="text-center w-64 border-t-2 border-slate-900 pt-4">
              <p className="font-black text-[10px] uppercase">Firma del Empleador</p>
              <p className="text-[8px] text-slate-400 mt-1 uppercase">Representación Legal</p>
           </div>
           <div className="text-center w-64 border-t-2 border-slate-900 pt-4">
              <p className="font-black text-[10px] uppercase">Firma del Administrador</p>
              <p className="text-[8px] text-slate-400 mt-1 uppercase">Validación de Nómina</p>
           </div>
        </div>
      </div>

      <Modal isOpen={!!individualPayroll} onClose={() => setIndividualPayroll(null)} title="Rol de Pagos Individual">
        {individualPayroll && (
          <div className="p-8 space-y-8 bg-white border">
            <h2 className="text-center font-black text-xl uppercase border-b-2 pb-4">COMPROBANTE DE PAGO INDIVIDUAL</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
               <p><b>EMPLEADO:</b> {individualPayroll.name.toUpperCase()}</p>
               <p className="text-right"><b>MES:</b> {selectedMonth} {selectedYear}</p>
               <p><b>ID:</b> {individualPayroll.identification}</p>
            </div>
            <div className="space-y-2 border p-4 rounded-xl">
               <div className="flex justify-between border-b py-2"><span className="font-bold">SUELDO BASE</span><span>${calculatePayrollData(individualPayroll).baseSalary.toFixed(2)}</span></div>
               <div className="flex justify-between border-b py-2"><span>FONDOS DE RESERVA</span><span>${calculatePayrollData(individualPayroll).fondoReserva.toFixed(2)}</span></div>
               <div className="flex justify-between border-b py-2"><span>DÉCIMOS MENSUALIZADOS</span><span>${calculatePayrollData(individualPayroll).overSueldos.toFixed(2)}</span></div>
               <div className="flex justify-between py-2 text-red-600"><span>(-) APORTE IESS</span><span>-${calculatePayrollData(individualPayroll).iess.toFixed(2)}</span></div>
               <div className="flex justify-between border-t-2 pt-4 font-black text-lg text-blue-900 uppercase"><span>Neto a Recibir</span><span>${calculatePayrollData(individualPayroll).neto.toFixed(2)}</span></div>
            </div>
            <div className="pt-20 text-center border-t border-dashed">
               <p className="font-black text-[10px] uppercase">Firma del Empleado</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PayrollModule;
