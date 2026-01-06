
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

const ReportsModule: React.FC<ReportsModuleProps> = ({ employees, payments = [], attendance = [], company, settings, role }) => {
  const [reportType, setReportType] = useState<'attendance' | 'payments' | 'validation'>('attendance');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState({ isOpen: false, title: '', message: '', type: 'success' as any });
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);
  const [showConfirmEdit, setShowConfirmEdit] = useState(false);

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

  const confirmDeleteAttendance = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteDoc(doc(db, "attendance", deleteConfirm.id));
      setDeleteConfirm({ isOpen: false, id: null });
      setFeedback({ isOpen: true, title: "Registro Eliminado", message: "La marcación ha sido borrada del sistema definitivamente.", type: 'success' });
    } catch (e) {
      setDeleteConfirm({ isOpen: false, id: null });
      setFeedback({ isOpen: true, title: "Error Crítico", message: "No se pudo eliminar el registro en la base de datos.", type: 'error' });
    }
  };

  const handleUpdateAttendance = async () => {
    if (!editingAttendance) return;
    try {
      await setDoc(doc(db, "attendance", editingAttendance.id), { 
        payload: compressData(editingAttendance), 
        timestamp: editingAttendance.timestamp 
      });
      setEditingAttendance(null);
      setShowConfirmEdit(false);
      setFeedback({ isOpen: true, title: "Cambios Guardados", message: "La marcación ha sido actualizada correctamente.", type: 'success' });
    } catch (e) {
      setFeedback({ isOpen: true, title: "Error", message: "No se pudieron guardar los cambios.", type: 'error' });
    }
  };

  const filteredPending = pendingAttendance.filter(req => {
    const emp = employees.find(e => e.id === req.employeeId);
    const searchStr = `${emp?.name} ${emp?.surname} ${emp?.identification} ${req.justification || ""}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  const exportExcel = () => {
    let csv = "";
    if (reportType === 'payments') {
        csv = "\uFEFFCódigo,Fecha,Beneficiario,Identificación,Concepto,Detalle,Método,Monto\n";
        paymentsToDisplay.forEach(p => {
          const emp = employees.find(e => e.id === p.employeeId);
          csv += `"${p.voucherCode}","${new Date(p.date).toLocaleDateString()}","${emp?.surname} ${emp?.name}","${emp?.identification}","${p.type}","${p.concept}","${p.method}","${p.amount.toFixed(2)}"\n`;
        });
    } else {
        csv = "\uFEFFFecha,Hora,Colaborador,Identificación,Cargo,Tipo Marcación,Estado,Atraso,Justificación\n";
        attendanceToDisplay.forEach(rec => {
          const emp = employees.find(e => e.id === rec.employeeId);
          const date = new Date(rec.timestamp);
          csv += `"${date.toLocaleDateString()}","${date.toLocaleTimeString()}","${emp?.surname} ${emp?.name}","${emp?.identification}","${emp?.role}","${rec.type === 'in' ? 'Entrada' : 'Salida'}","${rec.status}","${rec.isLate ? 'SI' : 'NO'}","${rec.justification || ''}"\n`;
        });
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `REPORTE_${reportType.toUpperCase()}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const attendanceToDisplay = (attendance || []).filter(a => {
    const emp = employees.find(e => e.id === a.employeeId);
    const searchStr = `${emp?.surname} ${emp?.name} ${emp?.identification} ${a.justification || ""} ${a.status} ${a.type}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  }).sort((a,b) => b.timestamp.localeCompare(a.timestamp));

  const paymentsToDisplay = (payments || []).filter(p => {
    const emp = employees.find(e => e.id === p.employeeId);
    const searchStr = `${emp?.surname} ${emp?.name} ${emp?.identification} ${p.concept} ${p.type} ${p.voucherCode} ${p.method}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  }).sort((a,b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6 md:space-y-8 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 md:p-8 rounded-3xl md:rounded-[2rem] shadow-sm border border-slate-100 gap-6 no-print">
        <div className="w-full">
          <h2 className="text-xl md:text-2xl font-[950] text-slate-900 uppercase tracking-tighter">Reportes Institucionales</h2>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scroll-smooth no-scrollbar">
              <button onClick={() => {setReportType('attendance'); setSearchTerm('');}} className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${reportType === 'attendance' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Registros de Asistencia</button>
              <button onClick={() => {setReportType('payments'); setSearchTerm('');}} className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${reportType === 'payments' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Reporte de Egresos</button>
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
          <button onClick={exportExcel} className="flex-1 md:flex-none px-6 py-4 bg-emerald-600 text-white font-black rounded-xl shadow-lg uppercase text-[9px] active:scale-95 transition-all">Excel Completo</button>
          <button onClick={() => window.print()} className="flex-1 md:flex-none px-6 py-4 bg-slate-900 text-white font-black rounded-xl shadow-lg uppercase text-[9px] active:scale-95 transition-all">Imprimir PDF</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl md:rounded-[2rem] shadow-sm border overflow-hidden min-h-[450px]" id="reports-printable-area">
         <div className="hidden print:block text-center border-b-2 border-slate-900 pb-6 mb-8 px-10 pt-10">
           <h1 className="text-2xl font-[950] text-slate-900 uppercase italic leading-none">{company?.name || 'ASIST UP - HR ENTERPRISE'}</h1>
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Reporte de {reportType === 'attendance' ? 'Asistencia Diaria' : reportType === 'payments' ? 'Egresos y Pagos Detallados' : 'Validaciones Pendientes'} - 2026</p>
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
            ) : reportType === 'payments' ? (
                <div className="table-responsive">
                    <table className="w-full text-left min-w-[900px] print:min-w-0 print:table-auto">
                        <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b tracking-widest print:bg-slate-900 print:text-white">
                            <tr>
                                <th className="p-4">Código / Fecha</th>
                                <th className="p-4">Beneficiario / CI</th>
                                <th className="p-4">Tipo de Pago</th>
                                <th className="p-4">Concepto Detallado</th>
                                <th className="p-4">Forma de Pago</th>
                                <th className="p-4 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="text-[9px] md:text-[10px] font-bold uppercase divide-y text-slate-600 print:text-slate-950">
                            {paymentsToDisplay.map(p => {
                                const emp = employees.find(e => e.id === p.employeeId);
                                return (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <p className="text-blue-600 font-black">{p.voucherCode}</p>
                                            <p className="text-[8px] font-bold text-slate-400">{new Date(p.date).toLocaleDateString()}</p>
                                        </td>
                                        <td className="p-4">
                                            <p className="font-black text-slate-900">{emp?.surname} {emp?.name}</p>
                                            <p className="text-[8px] font-bold text-slate-400">{emp?.identification}</p>
                                        </td>
                                        <td className="p-4">{p.type}</td>
                                        <td className="p-4 max-w-[200px] truncate">{p.concept}</td>
                                        <td className="p-4">
                                            <span className="text-[8px] bg-slate-100 px-2 py-0.5 rounded-lg border">{p.method}</span>
                                            {p.bankSource && <p className="text-[7px] text-slate-400 mt-1">{p.bankSource}</p>}
                                        </td>
                                        <td className="p-4 text-right font-black text-slate-900">${p.amount.toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {paymentsToDisplay.length === 0 && (
                        <div className="py-12 text-center text-slate-300 font-black uppercase text-[10px]">Sin registros de egresos</div>
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
                            <td className="p-4 text-right no-print flex gap-2 justify-end">
                              {role === Role.SUPER_ADMIN && (
                                <>
                                  <button onClick={() => setEditingAttendance(rec)} className="px-2 py-1.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase rounded-lg hover:bg-blue-600 hover:text-white transition-all">Editar</button>
                                  <button onClick={() => setDeleteConfirm({ isOpen: true, id: rec.id })} className="px-2 py-1.5 bg-red-50 text-red-600 text-[8px] font-black uppercase rounded-lg hover:bg-red-600 hover:text-white transition-all">Borrar</button>
                                </>
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

      {/* Modal de Edición de Asistencia */}
      <Modal isOpen={!!editingAttendance} onClose={() => setEditingAttendance(null)} title="Editar Marcación de Asistencia" maxWidth="max-w-md">
        {editingAttendance && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase">Fecha y Hora</label>
                <input 
                  type="datetime-local" 
                  className="w-full border-2 p-3 rounded-xl text-xs font-bold"
                  value={editingAttendance.timestamp.slice(0, 16)} 
                  onChange={e => setEditingAttendance({...editingAttendance, timestamp: new Date(e.target.value).toISOString()})}
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase">Tipo Marcación</label>
                <select 
                  className="w-full border-2 p-3 rounded-xl text-xs font-bold uppercase"
                  value={editingAttendance.type}
                  onChange={e => setEditingAttendance({...editingAttendance, type: e.target.value as any})}
                >
                  <option value="in">Ingreso</option>
                  <option value="out">Salida</option>
                  <option value="half_day">Media Jornada</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase">Estado</label>
              <select 
                className="w-full border-2 p-3 rounded-xl text-xs font-bold uppercase"
                value={editingAttendance.status}
                onChange={e => setEditingAttendance({...editingAttendance, status: e.target.value as any})}
              >
                <option value="confirmed">Confirmado</option>
                <option value="pending_approval">Pendiente</option>
                <option value="rejected">Rechazado</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase">Justificación / Nota</label>
              <textarea 
                className="w-full border-2 p-3 rounded-xl text-xs font-bold h-24"
                placeholder="Motivo del cambio..."
                value={editingAttendance.justification || ''}
                onChange={e => setEditingAttendance({...editingAttendance, justification: e.target.value})}
              />
            </div>
            <button onClick={() => setShowConfirmEdit(true)} className="w-full py-4 bg-blue-700 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Guardar Cambios</button>
          </div>
        )}
      </Modal>

      {/* Modal de Advertencia y Confirmación de Edición */}
      <Modal isOpen={showConfirmEdit} onClose={() => setShowConfirmEdit(false)} title="Confirmar Modificación" type="warning" maxWidth="max-w-sm">
        <div className="space-y-6 text-center">
          <p className="text-xs font-black text-yellow-600 uppercase italic">Advertencia de Seguridad</p>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">¿Confirma la modificación de este registro de asistencia? Los cambios afectarán directamente al cálculo de nómina mensual.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowConfirmEdit(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[9px]">Cancelar</button>
            <button onClick={handleUpdateAttendance} className="flex-1 py-4 bg-blue-600 text-white font-black rounded-xl uppercase text-[9px] shadow-lg active:scale-95">Confirmar Cambios</button>
          </div>
        </div>
      </Modal>

      {/* Modal de Confirmación de Borrado */}
      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({ isOpen: false, id: null })} title="Confirmar Eliminación" type="error" maxWidth="max-w-sm">
        <div className="space-y-6 text-center">
          <p className="text-xs font-black text-red-600 uppercase italic">Atención: Acción Irreversible</p>
          <p className="text-[11px] text-slate-500 font-medium">¿Está seguro de eliminar esta marcación permanentemente del servidor?</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteConfirm({ isOpen: false, id: null })} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[9px]">Cancelar</button>
            <button onClick={confirmDeleteAttendance} className="flex-1 py-4 bg-red-600 text-white font-black rounded-xl uppercase text-[9px] shadow-lg active:scale-95 transition-all">Borrar Registro</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
          <div className="text-center p-4">
              <p className="text-slate-600 font-bold uppercase text-[11px] leading-relaxed mb-6">{feedback.message}</p>
              <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] shadow-lg active:scale-95 transition-all">Aceptar</button>
          </div>
      </Modal>
    </div>
  );
};

export default ReportsModule;
