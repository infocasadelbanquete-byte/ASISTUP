import React, { useState } from 'react';
import { Employee, Payment, AttendanceRecord, CompanyConfig, GlobalSettings } from '../../types.ts';
import { db, doc, setDoc, compressData } from '../../firebase.ts';

interface ReportsModuleProps {
  employees: Employee[];
  payments: Payment[];
  attendance: AttendanceRecord[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
}

const ReportsModule: React.FC<ReportsModuleProps> = ({ employees, payments, attendance, company, settings }) => {
  const [reportType, setReportType] = useState<'attendance' | 'payments' | 'validation'>('attendance');
  const [filterYear, setFilterYear] = useState('2026');
  const [filterEmp, setFilterEmp] = useState('');

  const pendingAttendance = attendance.filter(a => a.status === 'pending_approval');
  
  const handleValidate = async (record: AttendanceRecord, newStatus: 'confirmed' | 'rejected') => {
    const updatedRecord = { 
      ...record, 
      status: newStatus,
      validatedAt: new Date().toISOString()
    };
    
    // Encontrar el documento en la DB por ID y actualizar
    await setDoc(doc(db, "attendance", record.id), { payload: compressData(updatedRecord), timestamp: record.timestamp });
    alert(`Marcaje ${newStatus === 'confirmed' ? 'Aprobado' : 'Rechazado'} correctamente.`);
  };

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
            <button onClick={() => setReportType('validation')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest relative ${reportType === 'validation' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
              Validaciones
              {pendingAttendance.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center">{pendingAttendance.length}</span>}
            </button>
          </div>
        </div>
        <button onClick={() => window.print()} className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest no-print">Imprimir Reporte A4</button>
      </div>

      {reportType !== 'validation' && (
        <div className="bg-white p-8 rounded-[2rem] border shadow-sm no-print">
           <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Filtros Avanzados</p>
           <div className="grid grid-cols-2 gap-4">
              <select className="p-3 border rounded-xl text-xs font-bold" value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
                 <option value="">Todos los Empleados</option>
                 {employees.map(e => <option key={e.id} value={e.id}>{e.name} {e.surname}</option>)}
              </select>
              <select className="p-3 border rounded-xl text-xs font-bold" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                 <option value="2026">Año 2026</option>
                 <option value="2025">Año 2025</option>
              </select>
           </div>
        </div>
      )}

      <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
         <div className="p-10">
            {reportType === 'validation' ? (
              <div className="space-y-6">
                <div className="border-b pb-6">
                  <h3 className="text-xl font-black text-slate-900 uppercase">Solicitudes de Marcaje Olvidado</h3>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Pendientes de revisión administrativa</p>
                </div>
                {pendingAttendance.length === 0 ? (
                  <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed">
                    <p className="text-slate-400 font-black uppercase text-xs">No hay solicitudes pendientes.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingAttendance.map(req => {
                      const emp = employees.find(e => e.id === req.employeeId);
                      return (
                        <div key={req.id} className="bg-white border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group">
                          <div className="flex gap-6 items-center">
                            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-xl font-black text-blue-600 uppercase">
                              {emp?.name[0]}
                            </div>
                            <div>
                              <p className="font-black text-slate-900 uppercase text-sm">{emp?.name} {emp?.surname}</p>
                              <div className="flex gap-2 items-center mt-1">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${req.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{req.type === 'in' ? 'Entrada' : 'Salida'}</span>
                                <span className="text-slate-400 font-black text-[9px] uppercase tracking-widest">{new Date(req.timestamp).toLocaleDateString()}</span>
                              </div>
                              <p className="mt-3 text-[11px] text-slate-500 italic bg-slate-50 p-3 rounded-xl border">" {req.justification} "</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => handleValidate(req, 'rejected')} className="px-4 py-2 bg-red-100 text-red-600 font-black text-[9px] uppercase rounded-xl hover:bg-red-600 hover:text-white transition-all">Rechazar</button>
                             <button onClick={() => handleValidate(req, 'confirmed')} className="px-4 py-2 bg-emerald-600 text-white font-black text-[9px] uppercase rounded-xl hover:bg-emerald-700 transition-all shadow-lg">Aprobar Marcaje</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : reportType === 'payments' ? (
               <div>
                  <div className="mb-10 text-center border-b-2 pb-8">
                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">REPORTE DE PAGOS Y DESEMBOLSOS</h1>
                    <p className="text-blue-600 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">{company?.name || 'ASIST UP'}</p>
                  </div>
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
               </div>
            ) : (
               <div>
                  <div className="mb-10 text-center border-b-2 pb-8">
                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">HISTORIAL DE ASISTENCIA INTEGRAL</h1>
                    <p className="text-blue-600 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">{company?.name || 'ASIST UP'}</p>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-white uppercase font-black">
                       <tr>
                          <th className="p-4">Fecha / Hora</th>
                          <th className="p-4">Empleado</th>
                          <th className="p-4">Tipo</th>
                          <th className="p-4">Origen</th>
                          <th className="p-4">Estado</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y">
                       {attendance.filter(a => filterEmp === '' || a.employeeId === filterEmp).sort((a,b) => b.timestamp.localeCompare(a.timestamp)).map(a => {
                         const emp = employees.find(e => e.id === a.employeeId);
                         return (
                          <tr key={a.id} className={a.status === 'rejected' ? 'bg-red-50/50 opacity-50' : ''}>
                             <td className="p-4 font-bold">
                               {new Date(a.timestamp).toLocaleDateString()}<br/>
                               <span className="text-[10px] text-slate-400">{new Date(a.timestamp).toLocaleTimeString()}</span>
                             </td>
                             <td className="p-4 font-black uppercase">{emp?.name} {emp?.surname}</td>
                             <td className="p-4">
                               <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${a.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{a.type === 'in' ? 'Ingreso' : 'Salida'}</span>
                             </td>
                             <td className="p-4">
                               <span className="text-[9px] font-bold text-slate-500 uppercase">{a.isForgotten ? 'Manual/Olvido' : 'Digital/PIN'}</span>
                             </td>
                             <td className="p-4">
                               <span className={`font-black text-[9px] uppercase ${a.status === 'confirmed' ? 'text-emerald-600' : a.status === 'rejected' ? 'text-red-600' : 'text-orange-500'}`}>
                                 {a.status === 'confirmed' ? 'Aprobado' : a.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                               </span>
                             </td>
                          </tr>
                         );
                       })}
                    </tbody>
                  </table>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default ReportsModule;