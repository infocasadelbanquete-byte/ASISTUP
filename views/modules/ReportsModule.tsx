
import React, { useState, useMemo } from 'react';
import { Employee, Payment, AttendanceRecord, CompanyConfig, GlobalSettings } from '../../types';

interface ReportsModuleProps {
  employees: Employee[];
  payments: Payment[];
  attendance: AttendanceRecord[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
}

type ReportCategory = 'payments' | 'attendance' | 'movements' | 'payroll';

const ReportsModule: React.FC<ReportsModuleProps> = ({ employees, payments, attendance, company, settings }) => {
  const [category, setCategory] = useState<ReportCategory>('payments');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const matchesEmployee = !selectedEmployeeId || p.employeeId === selectedEmployeeId;
      const matchesDate = (!dateFrom || p.date >= dateFrom) && (!dateTo || p.date <= dateTo);
      const emp = employees.find(e => e.id === p.employeeId);
      const matchesSearch = !searchTerm || emp?.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesEmployee && matchesDate && matchesSearch;
    });
  }, [payments, selectedEmployeeId, dateFrom, dateTo, searchTerm, employees]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter(a => {
      const date = a.timestamp.split('T')[0];
      const matchesEmployee = !selectedEmployeeId || a.employeeId === selectedEmployeeId;
      const matchesDate = (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
      const emp = employees.find(e => e.id === a.employeeId);
      const matchesSearch = !searchTerm || emp?.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesEmployee && matchesDate && matchesSearch;
    });
  }, [attendance, selectedEmployeeId, dateFrom, dateTo, searchTerm, employees]);

  const movements = useMemo(() => {
    const list: any[] = [];
    employees.forEach(emp => {
      list.push({ type: 'Vinculación', date: emp.startDate, employee: emp.name, details: 'Ingreso inicial a la empresa' });
      if (emp.status === 'terminated') {
        list.push({ type: 'Desvinculación', date: emp.terminationDate, employee: emp.name, details: emp.terminationReason });
      }
    });
    return list.filter(m => {
      const matchesEmployee = !selectedEmployeeId || employees.find(e => e.name === m.employee)?.id === selectedEmployeeId;
      const matchesDate = (!dateFrom || m.date >= dateFrom) && (!dateTo || m.date <= dateTo);
      const matchesSearch = !searchTerm || m.employee.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesEmployee && matchesDate && matchesSearch;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [employees, selectedEmployeeId, dateFrom, dateTo, searchTerm]);

  const handleExportCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(obj => Object.values(obj).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${filename}.csv`);
    link.click();
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="col-span-1 md:col-span-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Buscar por Nombre de Empleado</label>
            <input 
              type="text" 
              placeholder="Ej: Juan Perez..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-6 py-3 font-bold outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 font-bold" />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 font-bold" />
          </div>
        </div>
        
        <div className="mt-8 flex flex-wrap gap-3 border-t pt-8">
           {[
             { id: 'payments', label: 'Pagos Realizados', icon: '💰' },
             { id: 'attendance', label: 'Registros Asistencia', icon: '⏰' },
             { id: 'movements', label: 'Vinculaciones/Salidas', icon: '🔄' }
           ].map(cat => (
             <button
              key={cat.id}
              onClick={() => setCategory(cat.id as ReportCategory)}
              className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${category === cat.id ? 'bg-blue-900 text-white shadow-xl scale-105' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
             >
               <span>{cat.icon}</span> {cat.label}
             </button>
           ))}
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-2xl border border-gray-100 overflow-hidden min-h-[600px] relative">
        <div className="p-10">
          <div className="flex justify-between items-center mb-10 no-print">
             <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Vista de Reporte: <span className="text-blue-600">{category === 'payments' ? 'Tesorería' : category === 'attendance' ? 'Asistencia' : 'Movimientos Laborales'}</span></h3>
             <div className="flex gap-2">
                <button 
                  onClick={() => handleExportCSV(category === 'payments' ? filteredPayments : category === 'attendance' ? filteredAttendance : movements, `Reporte_${category}`)}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all"
                >
                  Exportar Excel
                </button>
                <button onClick={() => window.print()} className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">Imprimir A4</button>
             </div>
          </div>

          <div className="printable-report">
            {/* Header de impresión */}
            <div className="hidden print:block text-center mb-12 border-b pb-8">
               <h1 className="text-3xl font-black text-blue-900 uppercase">ASIST UP - REPORTE DE SISTEMA</h1>
               <p className="text-lg font-bold text-gray-600 mt-2 uppercase">{company?.name}</p>
               <p className="text-xs font-bold text-gray-400 mt-1">RUC: {company?.ruc} | Filtro: {searchTerm || 'Todos'} | Rango: {dateFrom || '--'} al {dateTo || '--'}</p>
            </div>

            {category === 'payments' && (
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Empleado</th>
                    <th className="px-6 py-4">Concepto</th>
                    <th className="px-6 py-4 text-right">Monto</th>
                    <th className="px-6 py-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs font-bold text-slate-700">
                  {filteredPayments.map(p => {
                    const emp = employees.find(e => e.id === p.employeeId);
                    return (
                      <tr key={p.id} className="hover:bg-blue-50/30">
                        <td className="px-6 py-4">{p.date}</td>
                        <td className="px-6 py-4 uppercase">{emp?.name}</td>
                        <td className="px-6 py-4 text-[10px]">{p.concept}</td>
                        <td className="px-6 py-4 text-right font-black text-blue-900">${p.amount.toFixed(2)}</td>
                        <td className="px-6 py-4">
                           <span className={p.status === 'paid' ? 'text-emerald-600' : 'text-red-600'}>{p.status.toUpperCase()}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPayments.length === 0 && <tr><td colSpan={5} className="p-20 text-center text-gray-400 italic">No se encontraron registros de pago con los filtros actuales.</td></tr>}
                </tbody>
              </table>
            )}

            {category === 'attendance' && (
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Fecha / Hora</th>
                    <th className="px-6 py-4">Empleado</th>
                    <th className="px-6 py-4">Tipo Marcaje</th>
                    <th className="px-6 py-4">Estado Jornada</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs font-bold text-slate-700">
                  {filteredAttendance.sort((a,b) => b.timestamp.localeCompare(a.timestamp)).map(a => {
                    const emp = employees.find(e => e.id === a.employeeId);
                    return (
                      <tr key={a.id} className="hover:bg-blue-50/30">
                        <td className="px-6 py-4">{new Date(a.timestamp).toLocaleString()}</td>
                        <td className="px-6 py-4 uppercase">{emp?.name}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black ${a.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                            {a.type === 'in' ? 'INGRESO' : 'SALIDA'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-[10px]">Registro exitoso vía PIN</td>
                      </tr>
                    );
                  })}
                  {filteredAttendance.length === 0 && <tr><td colSpan={4} className="p-20 text-center text-gray-400 italic">No hay registros de asistencia para mostrar.</td></tr>}
                </tbody>
              </table>
            )}

            {category === 'movements' && (
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Empleado</th>
                    <th className="px-6 py-4">Tipo de Movimiento</th>
                    <th className="px-6 py-4">Detalle / Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs font-bold text-slate-700">
                  {movements.map((m, i) => (
                    <tr key={i} className="hover:bg-blue-50/30">
                      <td className="px-6 py-4">{m.date}</td>
                      <td className="px-6 py-4 uppercase">{m.employee}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black ${m.type === 'Vinculación' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                          {m.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[10px]">{m.details}</td>
                    </tr>
                  ))}
                  {movements.length === 0 && <tr><td colSpan={4} className="p-20 text-center text-gray-400 italic">No se registran movimientos en este periodo.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="hidden print:grid grid-cols-2 gap-20 mt-32">
            <div className="border-t-2 border-slate-900 pt-4 text-center">
              <p className="text-xs font-black uppercase text-slate-900">REVISADO POR:</p>
            </div>
            <div className="border-t-2 border-slate-900 pt-4 text-center">
              <p className="text-xs font-black uppercase text-slate-900">AUDITORÍA INTERNA</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsModule;
