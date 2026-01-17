
import React, { useState } from 'react';
import { Employee, Payment, AttendanceRecord, CompanyConfig, GlobalSettings, Role } from '../../types.ts';
import Modal from '../../components/Modal.tsx';
import JSZip from 'jszip';

interface ReportsModuleProps {
  employees: Employee[];
  payments: Payment[];
  attendance: AttendanceRecord[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
  role: Role;
}

const ReportsModule: React.FC<ReportsModuleProps> = ({ employees, payments = [], attendance = [], company, settings, role }) => {
  const [reportType, setReportType] = useState<'attendance' | 'payments' | 'history' | 'master'>('attendance');
  const [searchTerm, setSearchTerm] = useState('');
  const [isZipping, setIsZipping] = useState(false);
  const [feedback, setFeedback] = useState({ isOpen: false, title: '', message: '', type: 'success' as any });
  
  const getCSVData = (type: 'employees' | 'payroll' | 'attendance' | 'novedades' | 'bajas') => {
    let csv = "\uFEFF";
    if (type === 'employees') {
      csv += "ID,COLABORADOR,CARGO,INGRESO,AFILIACION IESS,FONDOS RESERVA,DECIMOS,SUELDO,STATUS\n";
      employees.forEach(e => {
        csv += `"${e.identification}","${e.surname} ${e.name}","${e.role}","${e.startDate}","${e.isAffiliated ? 'SI' : 'NO'}","${e.reserveFundType || 'N/A'}","${e.overSalaryType}","${e.salary.toFixed(2)}","${e.status}"\n`;
      });
    } else if (type === 'payroll') {
      csv += "VOUCHER,FECHA,BENEFICIARIO,CONCEPTO,METODO,MONTO,STATUS\n";
      payments.forEach(p => {
        const emp = employees.find(e => e.id === p.employeeId);
        csv += `"${p.voucherCode}","${new Date(p.date).toLocaleDateString()}","${emp?.surname} ${emp?.name}","${p.type}","${p.method}","${p.amount.toFixed(2)}","${p.status}"\n`;
      });
    } else if (type === 'attendance') {
      csv += "FECHA,COLABORADOR,ID,TIPO,ESTADO,ATRASO,JUSTIFICACION\n";
      attendance.forEach(a => {
        const emp = employees.find(e => e.id === a.employeeId);
        csv += `"${new Date(a.timestamp).toLocaleString()}","${emp?.surname} ${emp?.name}","${emp?.identification}","${a.type}","${a.status}","${a.isLate ? 'SI' : 'NO'}","${a.justification || ''}"\n`;
      });
    } else if (type === 'novedades') {
      csv += "FECHA REGISTRO,COLABORADOR,EVENTO ADMINISTRATIVO\n";
      employees.forEach(e => {
        if (e.observations) e.observations.forEach(obs => {
          csv += `"${new Date(obs.date).toLocaleString()}","${e.surname} ${e.name}","${obs.text}"\n`;
        });
      });
    } else if (type === 'bajas') {
      csv += "COLABORADOR,IDENTIFICACION,SALIDA,MOTIVO LEGAL,DETALLES FINALES\n";
      employees.filter(e => e.status === 'terminated').forEach(e => {
        csv += `"${e.surname} ${e.name}","${e.identification}","${e.terminationDate}","${e.terminationReason}","${e.terminationDetails}"\n`;
      });
    }
    return csv;
  };

  const handleDownloadMasterZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(`ARCHIVO_MAESTRO_ASISTUP_${new Date().getFullYear()}`);
      
      folder?.file("1_CENSO_PERSONAL_MAESTRO.csv", getCSVData('employees'));
      folder?.file("2_REGISTRO_PAGOS_NOMINA.csv", getCSVData('payroll'));
      folder?.file("3_BITACORA_ASISTENCIA.csv", getCSVData('attendance'));
      folder?.file("4_HISTORIAL_NOVEDADES.csv", getCSVData('novedades'));
      folder?.file("5_EXPEDIENTES_DESVINCULADOS.csv", getCSVData('bajas'));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `CONSOLIDADO_MASTER_ASISTUP_${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
      setFeedback({ isOpen: true, title: "Éxito Corporativo", message: "Contenedor ZIP generado y descargado correctamente para archivo físico.", type: "success" });
    } catch (e) {
      setFeedback({ isOpen: true, title: "Fallo Crítico", message: "No se pudo consolidar el paquete comprimido.", type: "error" });
    } finally {
      setIsZipping(false);
    }
  };

  const generateReportExcel = (type: any) => {
    const csv = getCSVData(type);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `REPORTE_MASTER_${type.toUpperCase()}.csv`;
    link.click();
  };

  const generateReportPDF = (type: any) => {
    setReportType(type);
    setTimeout(() => window.print(), 500);
  };

  const attendanceToDisplay = (attendance || []).filter(a => {
    const emp = employees.find(e => e.id === a.employeeId);
    return `${emp?.surname} ${emp?.name} ${emp?.identification}`.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a,b) => b.timestamp.localeCompare(a.timestamp));

  const paymentsToDisplay = payments.filter(p => {
    const emp = employees.find(e => e.id === p.employeeId);
    return `${emp?.surname} ${emp?.name} ${p.voucherCode}`.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a,b) => b.date.localeCompare(a.date));

  const historyToDisplay = employees.filter(e => {
    const searchStr = `${e.name} ${e.surname} ${e.identification} ${e.status}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  }).sort((a,b) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="space-y-6 md:space-y-8 fade-in">
      <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border no-print flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
           <h2 className="text-2xl font-[950] text-slate-900 uppercase italic">Centro de Reportes Maestro</h2>
           <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">Auditoría y Gestión de Datos Corporativos</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {['attendance', 'payments', 'history', 'master'].map(t => (
              <button key={t} onClick={() => {setReportType(t as any); setSearchTerm('');}} className={`whitespace-nowrap px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${reportType === t ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border'}`}>
                {t === 'attendance' ? 'Asistencia' : t === 'payments' ? 'Pagos' : t === 'history' ? 'Historial' : 'Archivo Maestro'}
              </button>
            ))}
          </div>
          {reportType !== 'master' && <input type="text" placeholder="Filtrar por nombre o CI..." className="flex-1 p-3 border-2 rounded-xl text-[11px] font-bold uppercase" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden" id="reports-printable-area">
         {/* CABECERA ESTRICTA PARA IMPRESIÓN */}
         <div className="hidden print:block p-10 border-b-4 border-black text-center space-y-4">
            <div className="flex items-center justify-center gap-6">
               <div className="w-20 h-20 border-2 border-black flex items-center justify-center overflow-hidden">
                  {company?.logo ? <img src={company.logo} className="w-full h-full object-contain" /> : <span className="text-2xl font-black">LOGO</span>}
               </div>
               <div className="text-left">
                  <h1 className="text-3xl font-[950] uppercase italic leading-none">{company?.name || 'EMPRESA INSTITUCIONAL'}</h1>
                  <p className="text-sm font-black uppercase mt-1">RUC: {company?.ruc || '0000000000001'}</p>
                  <p className="text-[10px] font-bold uppercase tracking-tighter">{company?.address || 'QUITO, ECUADOR'}</p>
               </div>
            </div>
            <div className="pt-4 border-t-2 border-black/10">
               <p className="text-[12px] font-[950] uppercase tracking-[0.3em]">Reporte de {reportType.toUpperCase()}</p>
               <p className="text-[8px] font-bold uppercase opacity-60">Documento Generado el {new Date().toLocaleString()}</p>
            </div>
         </div>

         {reportType === 'master' ? (
           <div className="p-10 md:p-16 space-y-12 no-print text-center">
              <header className="border-b pb-8">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-widest">Gestión de Archivo Maestro</h3>
                <p className="text-[11px] font-black text-blue-600 uppercase mt-2 tracking-widest italic leading-relaxed">Consolidado integral para cumplimiento legal y auditorías externas de talento humano</p>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                 {[
                   { id: 'employees', title: 'Censo Personal', icon: '👥', desc: 'Fichas, cargos y sueldos.' },
                   { id: 'payroll', title: 'Registro Pagos', icon: '💰', desc: 'Nómina, bonos y egresos.' },
                   { id: 'attendance', title: 'Asistencia', icon: '🕒', desc: 'Marcaciones y atrasos.' },
                   { id: 'novedades', title: 'Bitácora Novedades', icon: '📝', desc: 'Incidencias administrativas.' },
                   { id: 'bajas', title: 'Bajas Laborales', icon: '🚪', desc: 'Historial de desvinculaciones.' }
                 ].map(seg => (
                   <div key={seg.id} className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 flex flex-col justify-between hover:border-blue-200 transition-colors">
                      <div className="mb-4 flex items-start gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-inner flex items-center justify-center text-2xl">{seg.icon}</div>
                        <div>
                           <h4 className="text-[11px] font-[950] uppercase text-slate-900 leading-none mb-1">{seg.title}</h4>
                           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter leading-tight">{seg.desc}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => generateReportExcel(seg.id)} className="flex-1 py-2.5 bg-emerald-600 text-white text-[9px] font-black rounded-lg uppercase shadow-md active:scale-95 transition-all">Excel</button>
                        <button onClick={() => generateReportPDF(seg.id as any)} className="flex-1 py-2.5 bg-blue-700 text-white text-[9px] font-black rounded-lg uppercase shadow-md active:scale-95 transition-all">PDF</button>
                      </div>
                   </div>
                 ))}
              </div>
              <div className="pt-10 border-t flex flex-col items-center gap-6">
                 <button 
                   onClick={handleDownloadMasterZip} 
                   disabled={isZipping} 
                   className="w-full max-w-md py-6 bg-slate-900 text-white font-[950] rounded-[2rem] uppercase text-[12px] tracking-[0.4em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4 group"
                 >
                   <span>{isZipping ? '⌛' : '📦'}</span>
                   {isZipping ? 'CONSOLIDANDO DATOS...' : 'Descargar Archivo Maestro .ZIP'}
                 </button>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center italic opacity-60">Este paquete comprimido incluye todos los reportes superiores en formato CSV para respaldo institucional.</p>
              </div>
           </div>
         ) : (
           <div className="p-4 md:p-10">
              <div className="table-responsive">
                  <table className="w-full text-left print:table-auto border-collapse text-[11px] font-bold uppercase">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 print:bg-white print:text-black">
                        <tr>
                           <th className="p-5 border-b-2">Detalle de Registro</th>
                           <th className="p-5 border-b-2">Colaborador Principal</th>
                           <th className="p-5 border-b-2 text-right">Situación / Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y print:text-black">
                          {reportType === 'attendance' && attendanceToDisplay.map(a => (
                            <tr key={a.id}>
                               <td className="p-5">{new Date(a.timestamp).toLocaleString()}</td>
                               <td className="p-5">{employees.find(e => e.id === a.employeeId)?.surname} {employees.find(e => e.id === a.employeeId)?.name}</td>
                               <td className="p-5 text-right font-black">{a.status} - {a.type}</td>
                            </tr>
                          ))}
                          {reportType === 'payments' && paymentsToDisplay.map(p => (
                            <tr key={p.id}>
                               <td className="p-5"><p className="text-blue-600">{p.voucherCode}</p><p className="text-[9px] text-slate-400">{new Date(p.date).toLocaleDateString()}</p></td>
                               <td className="p-5">{employees.find(e => e.id === p.employeeId)?.surname}</td>
                               <td className="p-5 text-right font-[950] text-emerald-700">${p.amount.toFixed(2)}</td>
                            </tr>
                          ))}
                          {reportType === 'history' && historyToDisplay.map(e => (
                            <tr key={e.id}>
                               <td className="p-5"><p className="text-slate-900">{e.surname} {e.name}</p><p className="text-[9px] text-slate-400">CI: {e.identification}</p></td>
                               <td className="p-5">{e.role}</td>
                               <td className={`p-5 text-right font-[950] ${e.status === 'active' ? 'text-emerald-600' : 'text-red-500'}`}>{e.status}</td>
                            </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
           </div>
         )}
      </div>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
          <div className="text-center p-6 space-y-6">
              <p className="text-slate-700 font-bold uppercase text-[11px] italic leading-relaxed">{feedback.message}</p>
              <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Entendido</button>
          </div>
      </Modal>
    </div>
  );
};

export default ReportsModule;
