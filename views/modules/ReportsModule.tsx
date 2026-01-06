import React, { useState } from 'react';
import { Employee, Payment, AttendanceRecord, CompanyConfig, GlobalSettings, Role } from '../../types.ts';
import { db, doc, setDoc, deleteDoc, compressData } from '../../firebase.ts';
import Modal from '../../components/Modal.tsx';

interface ReportsModuleProps {
  employees: Employee[];
  payments: Payment[];
  attendance: AttendanceRecord[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
  role: Role;
}

const ReportsModule: React.FC<ReportsModuleProps> = ({ employees, payments, attendance = [], company, settings, role }) => {
  const [reportType, setReportType] = useState<'attendance' | 'payments' | 'validation'>('attendance');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState({ isOpen: false, title: '', message: '', type: 'success' as any });

  const pendingAttendance = (attendance || []).filter(a => a.status === 'pending_approval');
  
  const handleValidate = async (record: AttendanceRecord, newStatus: 'confirmed' | 'rejected') => {
    const updatedRecord = { 
      ...record, 
      status: newStatus,
      validatedAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, "attendance", record.id), { payload: compressData(updatedRecord), timestamp: record.timestamp });
    setFeedback({ isOpen: true, title: "Actualización Exitosa", message: `La marcación ha sido validada como: ${newStatus.toUpperCase()}`, type: 'success' });
  };

  const handleDeleteAttendance = async (id: string) => {
    if (confirm("¿Está seguro de eliminar este registro permanentemente? Esta acción es irreversible.")) {
      try {
        await deleteDoc(doc(db, "attendance", id));
        setFeedback({ isOpen: true, title: "Registro Eliminado", message: "La marcación ha sido borrada del sistema.", type: 'success' });
      } catch (e) {
        setFeedback({ isOpen: true, title: "Error Crítico", message: "No se pudo eliminar el registro en la base de datos.", type: 'error' });
      }
    }
  };

  const filteredPending = pendingAttendance.filter(req => {
    const emp = employees.find(e => e.id === req.employeeId);
    const searchStr = `${emp?.name} ${emp?.surname} ${emp?.identification} ${req.justification || ""}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  const exportAttendanceExcel = () => {
    let csv = "\uFEFFFecha,Hora,Colaborador,Identificación,Cargo,Tipo Marcación,Estado,Atraso,Justificación\n";
    (attendance || []).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).forEach(rec => {
      const emp = employees.find(e => e.id === rec.employeeId);
      const date = new Date(rec.timestamp);
      csv += `"${date.toLocaleDateString()}","${date.toLocaleTimeString()}","${emp?.surname} ${emp?.name}","${emp?.identification}","${emp?.role}","${rec.type === 'in' ? 'Entrada' : 'Salida'}","${rec.status}","${rec.isLate ? 'SI' : 'NO'}","${rec.justification || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `REPORTE_ASISTENCIA_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const attendanceToDisplay = (attendance || []).filter(a => {
    const emp = employees.find(e => e.id === a.employeeId);
    const searchStr = `${emp?.surname} ${emp?.name} ${emp?.identification} ${a.justification || ""} ${a.status} ${a.type}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  }).sort((a,b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className="space-y-6 md:space-y-8 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 md:p-8 rounded-3xl md:rounded-[2rem] shadow-sm border border-slate-100 gap-6 no-print">
        <div className="w-full">
          <h2 className="text-xl md:text-2xl font-[950] text-slate-900 uppercase tracking-tighter">Reportes Institucionales</h2>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scroll-smooth no-scrollbar">
              <button onClick={() => {setReportType('attendance'); setSearchTerm('');}} className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${reportType === 'attendance' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Registros de Asistencia</button>
              <button onClick={() => {setReportType('validation'); setSearchTerm('');}} className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest relative transition-all ${reportType === 'validation' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                Validaciones
                {pendingAttendance.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-black animate-pulse shadow-md">{pendingAttendance.length}</span>}
              </button>
            </div>
            <input 
              type="text" 
              placeholder="Filtrar registros..." 
              className="flex-1 p-2.5 border rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-500 shadow-sm" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={exportAttendanceExcel} className="flex-1 md:flex-none px-6 py-4 bg-emerald-600 text-white font-black rounded-xl shadow-lg uppercase text-[9px] active:scale-95 transition-all">Excel Completo</button>
          <button onClick={() => window.print()} className="flex-1 md:flex-none px-6 py-4 bg-slate-900 text-white font-black rounded-xl shadow-lg uppercase text-[9px] active:scale-95 transition-all">Imprimir PDF</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl md:rounded-[2rem] shadow-sm border overflow-hidden min-h-[450px]" id="reports-printable-area">
         <div className="hidden print:block text-center border-b-2 border-slate-900 pb-6 mb-8 px-10 pt-10">
           <h1 className="text-2xl font-[950] text-slate-900 uppercase italic leading-none">{company?.name || 'ASIST UP - HR ENTERPRISE'}</h1>
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Reporte de {reportType === 'attendance' ? 'Asistencia Diaria' : 'Validaciones Pendientes'} - 2026</p>
           <div className="grid grid-cols-2 gap-4 mt-3 max-w-xl mx-auto text-[9px] font-bold uppercase text-slate-600">
             <p className="text-left border-l-4 border-slate-900 pl-3">RUC: {company?.ruc || '0000000000001'}</p>
             <p className="text-right border-r-4 border-slate-900 pr-3">Representante: {company?.legalRep || 'ADMINISTRACIÓN'}</p>
           </div>
           <p className="text-[7px] text-slate-400 mt-2 uppercase font-bold italic text-right">Generado: {new Date().toLocaleString()}</p>
         </div>

         <div className="p-6 md:p-10">
            {reportType === 'validation' ? (
              <div className="space-y-6">
                <h3 className="text-lg font-[950] text-slate-900 uppercase tracking-tighter border-b pb-4 no-print">Validaciones Pendientes por Revisar</h3>
                {filteredPending.length === 0 ? (
                  <div className="py-24 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <span className="text-5xl opacity-20">✅</span>
                    <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mt-6">No existen justificaciones pendientes</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredPending.map(req => {
                      const emp = employees.find(e => e.id === req.employeeId);
                      return (
                        <div key={req.id} className="bg-white border rounded-3xl p-6 flex flex-col gap-5 hover:border-blue-500 transition-all shadow-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-[950] text-slate-900 uppercase text-sm tracking-tight">{emp?.surname} {emp?.name}</p>
                              <p className="text-slate-400 font-black text-[8px] uppercase mt-1">CI: {emp?.identification} | {new Date(req.timestamp).toLocaleString()}</p>
                            </div>
                            <span className={`px-2 py-1 text-[8px] font-black rounded-lg uppercase ${req.type === 'in' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{req.type === 'in' ? 'Ingreso' : 'Salida'}</span>
                          </div>
                          <div className="space-y-2">
                             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Justificación del Colaborador</p>
                             <p className="text-[11px] text-slate-600 font-bold bg-slate-50 p-4 rounded-2xl border leading-relaxed shadow-inner italic">"{req.justification}"</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 pt-2 no-print">
                             <button onClick={() => handleValidate(req, 'rejected')} className="py-3 bg-red-50 text-red-600 font-black text-[9px] uppercase rounded-xl hover:bg-red-100 transition-all active:scale-95">Rechazar</button>
                             <button onClick={() => handleValidate(req, 'confirmed')} className="py-3 bg-emerald-600 text-white font-black text-[9px] uppercase rounded-xl shadow-lg hover:bg-emerald-700 transition-all active:scale-95">Validar</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
               <div className="table-responsive">
                  <table className="w-full text-left min-w-[750px] print:min-w-0 print:table-auto">
                    <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b tracking-widest print:bg-slate-900 print:text-white">
                      <tr>
                        <th className="p-4">Fecha / Hora</th>
                        <th className="p-4">Colaborador / Identificación</th>
                        <th className="p-4">Marcación</th>
                        <th className="p-4 text-center">Atraso</th>
                        <th className="p-4">Estado Sistema</th>
                        <th className="p-4 text-right no-print">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="text-[9px] md:text-[10px] font-bold uppercase divide-y text-slate-600 print:text-slate-950">
                      {attendanceToDisplay.map(rec => {
                        const emp = employees.find(e => e.id === rec.employeeId);
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 whitespace-nowrap">{new Date(rec.timestamp).toLocaleString()}</td>
                            <td className="p-4">
                               <p className="font-black text-slate-900">{emp?.surname} {emp?.name}</p>
                               <p className="text-[8px] font-bold text-slate-400">{emp?.identification}</p>
                            </td>
                            <td className="p-4 font-black">{rec.type === 'in' ? 'Ingreso' : rec.type === 'out' ? 'Salida' : 'Media Jornada'}</td>
                            <td className="p-4 text-center">
                               {rec.isLate ? <span className="text-red-600 font-black">SÍ (Crítico)</span> : <span className="text-emerald-600">NO</span>}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase shadow-sm ${rec.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : rec.status === 'pending_approval' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>{rec.status}</span>
                            </td>
                            <td className="p-4 text-right no-print">
                              {role === Role.SUPER_ADMIN && (
                                <button onClick={() => handleDeleteAttendance(rec.id)} className="px-2 py-1.5 bg-red-50 text-red-600 text-[8px] font-black uppercase rounded-lg hover:bg-red-600 hover:text-white transition-all">Borrar</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
               </div>
            )}
         </div>

         <div className="hidden print:grid grid-cols-2 gap-10 mt-20 p-10 pt-20 border-t-2 border-slate-100">
           <div className="text-center">
              <div className="border-t-2 border-slate-900 pt-3 text-[10px] font-black uppercase">Firma RRHH / Supervisión</div>
              <p className="text-[7px] text-slate-400 mt-1 uppercase font-bold">Responsable de Auditoría</p>
           </div>
           <div className="text-center">
              <div className="border-t-2 border-slate-900 pt-3 text-[10px] font-black uppercase">Sello de Recepción</div>
           </div>
        </div>
      </div>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
          <div className="text-center p-4">
              <p className="text-slate-600 font-bold uppercase text-[11px] leading-relaxed mb-6">{feedback.message}</p>
              <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[9px] shadow-lg active:scale-95 transition-all">Aceptar</button>
          </div>
      </Modal>
    </div>
  );
};

export default ReportsModule;