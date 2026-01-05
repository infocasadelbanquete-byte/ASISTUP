import React, { useState } from 'react';
import { Employee, Payment, AttendanceRecord, CompanyConfig, GlobalSettings } from '../../types.ts';
import { db, doc, setDoc, compressData } from '../../firebase.ts';
import Modal from '../../components/Modal.tsx';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState({ isOpen: false, title: '', message: '', type: 'success' as any });

  const pendingAttendance = attendance.filter(a => a.status === 'pending_approval');
  
  const handleValidate = async (record: AttendanceRecord, newStatus: 'confirmed' | 'rejected') => {
    const updatedRecord = { 
      ...record, 
      status: newStatus,
      validatedAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, "attendance", record.id), { payload: compressData(updatedRecord), timestamp: record.timestamp });
    setFeedback({ isOpen: true, title: "Registro Actualizado", message: `El marcaje ha sido ${newStatus === 'confirmed' ? 'aprobado' : 'rechazado'} y sincronizado.`, type: 'success' });
  };

  const filteredPending = pendingAttendance.filter(req => {
    const emp = employees.find(e => e.id === req.employeeId);
    const searchStr = (emp?.name + " " + emp?.surname + " " + emp?.identification + " " + (req.justification || "")).toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  const filteredPaymentsReport = payments.filter(p => {
    const emp = employees.find(e => e.id === p.employeeId);
    const searchStr = (emp?.name + " " + emp?.surname + " " + emp?.identification + " " + p.concept + " " + p.type).toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase()) && p.status === 'paid';
  });

  const exportAttendanceExcel = () => {
    let csv = "Fecha,Hora,Empleado,Cédula,Tipo,Estado,Atraso\n";
    attendance.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).forEach(rec => {
      const emp = employees.find(e => e.id === rec.employeeId);
      const date = new Date(rec.timestamp);
      csv += `${date.toLocaleDateString()},${date.toLocaleTimeString()},${emp?.surname} ${emp?.name},${emp?.identification},${rec.type === 'in' ? 'Entrada' : 'Salida'},${rec.status},${rec.isLate ? 'SI' : 'NO'}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Asistencia_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportPaymentsExcel = () => {
    let csv = "Fecha,Empleado,Identificación,Monto,Tipo,Estado,Concepto\n";
    filteredPaymentsReport.forEach(p => {
      const emp = employees.find(e => e.id === p.employeeId);
      csv += `${new Date(p.date).toLocaleDateString()},${emp?.surname} ${emp?.name},${emp?.identification},${p.amount.toFixed(2)},${p.type},${p.status},${p.concept}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Pagos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-8 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 gap-6">
        <div className="w-full">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Centro de Reportes Analíticos</h2>
          <div className="flex flex-col md:flex-row gap-4 mt-4 items-center">
            <div className="flex gap-2">
              <button onClick={() => setReportType('attendance')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${reportType === 'attendance' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>Asistencia</button>
              <button onClick={() => setReportType('payments')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${reportType === 'payments' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>Pagos</button>
              <button onClick={() => setReportType('validation')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest relative ${reportType === 'validation' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                Validaciones
                {pendingAttendance.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-black">{pendingAttendance.length}</span>}
              </button>
            </div>
            <input 
              type="text" 
              placeholder="Filtro rápido (Empleado, CI, Motivo)..." 
              className="flex-1 p-2 border rounded-xl text-[10px] font-bold uppercase min-w-[200px]" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={() => {
            if (reportType === 'attendance') exportAttendanceExcel();
            else if (reportType === 'payments') exportPaymentsExcel();
          }} className="flex-1 md:flex-none px-6 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest no-print">Exportar Excel</button>
          <button onClick={() => window.print()} className="flex-1 md:flex-none px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest no-print">Imprimir</button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
         <div className="p-10">
            {reportType === 'validation' ? (
              <div className="space-y-6">
                <h3 className="text-xl font-black text-slate-900 uppercase">Solicitudes Pendientes</h3>
                {filteredPending.length === 0 ? (
                  <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed">
                    <p className="text-slate-400 font-black uppercase text-xs">Sin registros que coincidan.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPending.map(req => {
                      const emp = employees.find(e => e.id === req.employeeId);
                      return (
                        <div key={req.id} className="bg-white border rounded-3xl p-6 flex justify-between items-center group">
                          <div className="flex gap-6 items-center">
                            <div>
                              <p className="font-black text-slate-900 uppercase text-sm">{emp?.surname} {emp?.name}</p>
                              <p className="text-slate-400 font-black text-[9px] uppercase mt-1">{new Date(req.timestamp).toLocaleString()}</p>
                              <p className="mt-3 text-[11px] text-slate-500 italic bg-slate-50 p-3 rounded-xl border">Motivo: {req.justification}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => handleValidate(req, 'rejected')} className="px-4 py-2 bg-red-50 text-red-600 font-black text-[9px] uppercase rounded-xl">Rechazar</button>
                             <button onClick={() => handleValidate(req, 'confirmed')} className="px-4 py-2 bg-emerald-600 text-white font-black text-[9px] uppercase rounded-xl shadow-lg">Aprobar</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
               <div>
                  <div className="mb-10 text-center border-b-2 pb-8">
                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">INFORME INSTITUCIONAL - {reportType.toUpperCase()}</h1>
                  </div>
                  {/* Si es pagos, mostramos la lista filtrada */}
                  {reportType === 'payments' && (
                    <div className="space-y-4">
                      {filteredPaymentsReport.map(p => {
                        const emp = employees.find(e => e.id === p.employeeId);
                        return (
                          <div key={p.id} className="flex justify-between items-center p-4 border-b">
                            <div>
                              <p className="font-black text-slate-900 uppercase text-xs">{emp?.surname} {emp?.name}</p>
                              <p className="text-[9px] text-slate-400">{p.concept}</p>
                            </div>
                            <p className="font-black text-blue-700">${p.amount.toFixed(2)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="py-10 text-center opacity-30 font-black uppercase tracking-widest text-xs">Información generada por ASIST UP Enterprise Hub</div>
               </div>
            )}
         </div>
      </div>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
          <div className="text-center space-y-6">
              <p className="text-slate-600 font-bold uppercase text-[12px]">{feedback.message}</p>
              <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest">Aceptar</button>
          </div>
      </Modal>
    </div>
  );
};

export default ReportsModule;