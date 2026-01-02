
import React, { useState } from 'react';
import { Employee, Payment, AttendanceRecord, CompanyConfig, GlobalSettings } from '../../types.ts';

interface ReportsModuleProps {
  employees: Employee[];
  payments: Payment[];
  attendance: AttendanceRecord[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
}

const ReportsModule: React.FC<ReportsModuleProps> = ({ employees, payments, attendance, company, settings }) => {
  const [reportType, setReportType] = useState<'attendance' | 'payroll' | 'payments'>('attendance');
  const [filterYear, setFilterYear] = useState('2024');
  const [filterEmp, setFilterEmp] = useState('');

  const filteredPayments = payments.filter(p => 
    (filterEmp === '' || p.employeeId === filterEmp) &&
    p.status === 'paid'
  );

  return (
    <div className="space-y-8 fade-in">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Centro de Inteligencia y Reportes</h2>
          <div className="flex gap-4 mt-4">
            <button onClick={() => setReportType('attendance')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${reportType === 'attendance' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>Historial Asistencia</button>
            <button onClick={() => setReportType('payments')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${reportType === 'payments' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>Control de Pagos</button>
          </div>
        </div>
        <button onClick={() => window.print()} className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest no-print">Imprimir Reporte A4</button>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border shadow-sm no-print">
         <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Filtros Avanzados</p>
         <div className="grid grid-cols-2 gap-4">
            <select className="p-3 border rounded-xl text-xs font-bold" onChange={e => setFilterEmp(e.target.value)}>
               <option value="">Todos los Empleados</option>
               {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select className="p-3 border rounded-xl text-xs font-bold" onChange={e => setFilterYear(e.target.value)}>
               <option value="2024">Año 2024</option>
               <option value="2025">Año 2025</option>
            </select>
         </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
         <div className="p-10">
            <div className="mb-10 text-center border-b-2 pb-8">
               <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">REPORTE DE {reportType === 'attendance' ? 'ASISTENCIA MENSUAL' : 'PAGOS Y DESEMBOLSOS'}</h1>
               <p className="text-blue-600 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">{company?.name || 'ASIST UP'}</p>
            </div>

            {reportType === 'payments' ? (
               <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white uppercase font-black">
                     <tr>
                        <th className="p-4">Fecha</th>
                        <th className="p-4">Empleado</th>
                        <th className="p-4">Monto</th>
                        <th className="p-4">Concepto</th>
                        <th className="p-4">Saldo Rest.</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y">
                     {filteredPayments.map(p => (
                        <tr key={p.id}>
                           <td className="p-4 font-bold">{new Date(p.date).toLocaleDateString()}</td>
                           <td className="p-4 uppercase font-black">{employees.find(e => e.id === p.employeeId)?.name}</td>
                           <td className="p-4 font-bold text-emerald-600">${p.amount.toFixed(2)}</td>
                           <td className="p-4 italic text-slate-400">{p.concept}</td>
                           <td className="p-4 font-black text-blue-600">${(p.balanceAfter || 0).toFixed(2)}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            ) : (
               <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed">
                  <p className="text-slate-400 font-black uppercase text-[10px]">Cargando matriz de asistencia...</p>
                  <p className="text-slate-300 text-[8px] mt-2 italic">Filtre por empleado para ver el desglose diario.</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default ReportsModule;
