
import React, { useState, useEffect } from 'react';
import { Employee, Payment, AttendanceRecord, CompanyConfig, GlobalSettings, Role, SavedReport } from '../../types.ts';
import Modal from '../../components/Modal.tsx';
import JSZip from 'jszip';

interface ReportsModuleProps {
  employees: Employee[];
  payments: Payment[];
  attendance: AttendanceRecord[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
  role: Role;
  savedReports?: SavedReport[];
}

const ReportsModule: React.FC<ReportsModuleProps> = ({ employees, payments = [], attendance = [], company, settings, role, savedReports = [] }) => {
  const [reportType, setReportType] = useState<'attendance' | 'payments' | 'history' | 'master' | 'employees' | 'payroll' | 'novedades' | 'bajas' | 'saved_payroll'>('attendance');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [isZipping, setIsZipping] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [feedback, setFeedback] = useState({ isOpen: false, title: '', message: '', type: 'success' as any });

  // Efecto para disparar la impresión una vez que el estado de reporte ha cambiado y el DOM está listo
  useEffect(() => {
    if (isPrinting) {
      const timer = setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isPrinting]);
  
  const getCSVData = (type: string) => {
    let csv = "\uFEFF";
    const filterFn = (timestamp: string) => {
      if (!startDate && !endDate) return true;
      const date = new Date(timestamp);
      const start = startDate ? new Date(startDate + 'T00:00:00') : null;
      const end = endDate ? new Date(endDate + 'T23:59:59') : null;
      if (start && date < start) return false;
      if (end && date > end) return false;
      return true;
    };

    if (type === 'employees' || type === 'history') {
      csv += "ID,COLABORADOR,CARGO,INGRESO,AFILIACION IESS,FONDOS RESERVA,DECIMOS,SUELDO,STATUS\n";
      employees.filter(e => filterFn(e.startDate)).forEach(e => {
        csv += `"${e.identification}","${e.surname} ${e.name}","${e.role}","${e.startDate}","${e.isAffiliated ? 'SI' : 'NO'}","${e.reserveFundType || 'N/A'}","${e.overSalaryType}","${e.salary.toFixed(2)}","${e.status}"\n`;
      });
    } else if (type === 'payroll' || type === 'payments') {
      csv += "VOUCHER,FECHA,BENEFICIARIO,CONCEPTO,METODO,MONTO,STATUS\n";
      payments.filter(p => filterFn(p.date)).forEach(p => {
        const emp = employees.find(e => e.id === p.employeeId);
        csv += `"${p.voucherCode}","${new Date(p.date).toLocaleDateString()}","${emp?.surname} ${emp?.name}","${p.type}","${p.method}","${p.amount.toFixed(2)}","${p.status}"\n`;
      });
    } else if (type === 'attendance') {
      csv += "FECHA,COLABORADOR,ID,TIPO,ESTADO,ATRASO,JUSTIFICACION\n";
      // Ordenamiento obligatorio para Excel: Empleado y luego Cronológico
      const sortedForExcel = [...attendance].filter(a => filterFn(a.timestamp)).sort((a, b) => {
        const empA = employees.find(e => e.id === a.employeeId);
        const empB = employees.find(e => e.id === b.employeeId);
        const nameA = `${empA?.surname || ''} ${empA?.name || ''}`.toLowerCase();
        const nameB = `${empB?.surname || ''} ${empB?.name || ''}`.toLowerCase();
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return a.timestamp.localeCompare(b.timestamp);
      });
      
      sortedForExcel.forEach(a => {
        const emp = employees.find(e => e.id === a.employeeId);
        let statusTexto = a.status === 'confirmed' ? "CONFIRMADO" : "PENDIENTE";
        csv += `"${new Date(a.timestamp).toLocaleString()}","${emp?.surname} ${emp?.name}","${emp?.identification}","${a.type}","${statusTexto}","${a.isLate ? 'SI' : 'NO'}","${a.justification || ''}"\n`;
      });
    } else if (type === 'novedades') {
      csv += "FECHA REGISTRO,COLABORADOR,EVENTO ADMINISTRATIVO\n";
      employees.flatMap(e => e.observations?.map(obs => ({ emp: e, obs })) || [])
        .filter(item => filterFn(item.obs.date))
        .forEach(item => {
          csv += `"${new Date(item.obs.date).toLocaleString()}","${item.emp.surname} ${item.emp.name}","${item.obs.text}"\n`;
        });
    } else if (type === 'bajas') {
      csv += "COLABORADOR,IDENTIFICACION,SALIDA,MOTIVO LEGAL,DETALLES FINALES\n";
      employees.filter(e => e.status === 'terminated' && filterFn(e.terminationDate || '')).forEach(e => {
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
      setFeedback({ isOpen: true, title: "Éxito Corporativo", message: "Contenedor ZIP generado correctamente.", type: "success" });
    } catch (e) {
      setFeedback({ isOpen: true, title: "Fallo Crítico", message: "No se pudo consolidar el paquete comprimido.", type: "error" });
    } finally {
      setIsZipping(false);
    }
  };

  const generateReportExcel = (type: string) => {
    const csv = getCSVData(type);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `REPORTE_${type.toUpperCase()}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const generateReportPDF = (type: any) => {
    // Si estamos en el panel maestro, limpiamos filtros para reporte completo
    if (reportType === 'master') {
      setSearchTerm('');
      setStartDate('');
      setEndDate('');
    }
    setReportType(type);
    setIsPrinting(true);
  };

  const filterByDate = (timestamp: string) => {
    if (!startDate && !endDate) return true;
    const date = new Date(timestamp);
    const start = startDate ? new Date(startDate + 'T00:00:00') : null;
    const end = endDate ? new Date(endDate + 'T23:59:59') : null;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  };

  const attendanceToDisplay = (attendance || []).filter(a => {
    const emp = employees.find(e => e.id === a.employeeId);
    const matchesSearch = `${emp?.surname} ${emp?.name} ${emp?.identification}`.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && filterByDate(a.timestamp);
  }).sort((a, b) => {
    // Ordenamiento obligatorio para UI/PDF: Empleado y luego Cronológico
    const empA = employees.find(e => e.id === a.employeeId);
    const empB = employees.find(e => e.id === b.employeeId);
    const nameA = `${empA?.surname || ''} ${empA?.name || ''}`.toLowerCase();
    const nameB = `${empB?.surname || ''} ${empB?.name || ''}`.toLowerCase();
    
    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return a.timestamp.localeCompare(b.timestamp);
  });

  const paymentsToDisplay = payments.filter(p => {
    const emp = employees.find(e => e.id === p.employeeId);
    const matchesSearch = `${emp?.surname} ${emp?.name} ${p.voucherCode}`.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && filterByDate(p.date);
  }).sort((a,b) => b.date.localeCompare(a.date));

  const historyToDisplay = employees.filter(e => {
    const searchStr = `${e.name} ${e.surname} ${e.identification} ${e.status}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
    return matchesSearch && (reportType === 'bajas' ? filterByDate(e.terminationDate || '') : filterByDate(e.startDate));
  }).sort((a,b) => b.startDate.localeCompare(a.startDate));

  const translateAttendanceStatus = (record: AttendanceRecord) => {
    let base = "";
    if (record.type === 'in') base = record.status === 'confirmed' ? "INGRESO APROBADO" : record.status === 'pending_approval' ? "INGRESO PENDIENTE" : "INGRESO RECHAZADO";
    else if (record.type === 'out') base = record.status === 'confirmed' ? "SALIDA APROBADA" : record.status === 'pending_approval' ? "SALIDA PENDIENTE" : "SALIDA RECHAZADA";
    else if (record.type === 'half_day') base = "MEDIA JORNADA LIBRE";
    
    return (
      <span className="flex flex-col items-end">
        <span>{base}</span>
        {record.isLate && <span className="text-[8px] font-black lowercase opacity-60">(atraso)</span>}
      </span>
    );
  };

  const renderTableRows = () => {
    switch (reportType) {
      case 'saved_payroll':
        return savedReports
          .filter(r => {
            const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesMonth = !filterMonth || r.month === filterMonth;
            // Si el reporte no tiene año (reportes antiguos), lo mostramos si el filtro de año está vacío
            const matchesYear = !filterYear || r.year === filterYear || (!r.year && filterYear === '');
            return matchesSearch && matchesMonth && matchesYear;
          })
          .sort((a, b) => b.date.localeCompare(a.date)).map(r => (
          <tr key={r.id}>
            <td className="p-5">
              <p className="text-slate-900 font-black">{r.name}</p>
              <p className="text-[9px] text-slate-400">{new Date(r.date).toLocaleString()}</p>
            </td>
            <td className="p-5">Nómina Generada</td>
            <td className="p-5 text-right">
              <button 
                onClick={() => {
                  const blob = new Blob([r.content], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(blob);
                  link.download = `${r.name}.csv`;
                  link.click();
                }} 
                className="px-4 py-2 bg-emerald-600 text-white text-[9px] font-black rounded-lg uppercase shadow-md active:scale-95"
              >
                Descargar
              </button>
            </td>
          </tr>
        ));
      case 'attendance':
        return attendanceToDisplay.map(a => (
          <tr key={a.id}>
            <td className="p-5">{new Date(a.timestamp).toLocaleString()}</td>
            <td className="p-5">{employees.find(e => e.id === a.employeeId)?.surname} {employees.find(e => e.id === a.employeeId)?.name}</td>
            <td className="p-5 text-right font-black">{translateAttendanceStatus(a)}</td>
          </tr>
        ));
      case 'payments':
      case 'payroll':
        return paymentsToDisplay.map(p => (
          <tr key={p.id}>
            <td className="p-5"><p className="text-blue-600">{p.voucherCode}</p><p className="text-[9px] text-slate-400">{new Date(p.date).toLocaleDateString()}</p></td>
            <td className="p-5">{employees.find(e => e.id === p.employeeId)?.surname}</td>
            <td className="p-5 text-right font-[950] text-emerald-700">${p.amount.toFixed(2)}</td>
          </tr>
        ));
      case 'history':
      case 'employees':
        return historyToDisplay.map(e => (
          <tr key={e.id}>
            <td className="p-5"><p className="text-slate-900">{e.surname} {e.name}</p><p className="text-[9px] text-slate-400">CI: {e.identification}</p></td>
            <td className="p-5">{e.role}</td>
            <td className={`p-5 text-right font-[950] ${e.status === 'active' ? 'text-emerald-600' : 'text-red-500'}`}>{e.status}</td>
          </tr>
        ));
      case 'novedades':
        const novedades = employees.flatMap(e => e.observations?.map(obs => ({ emp: e, obs })) || []).filter(item => filterByDate(item.obs.date));
        return novedades.map((item, idx) => (
          <tr key={idx}>
            <td className="p-5">{new Date(item.obs.date).toLocaleString()}</td>
            <td className="p-5">{item.emp.surname} {item.emp.name}</td>
            <td className="p-5 text-right font-black italic">{item.obs.text}</td>
          </tr>
        ));
      case 'bajas':
        const bajas = employees.filter(e => e.status === 'terminated' && filterByDate(e.terminationDate || ''));
        return bajas.map(e => (
          <tr key={e.id}>
            <td className="p-5">{e.terminationDate}</td>
            <td className="p-5">{e.surname} {e.name}</td>
            <td className="p-5 text-right font-black text-red-600">{e.terminationReason} <span className="text-[9px] opacity-60">({e.terminationDetails})</span></td>
          </tr>
        ));
      default:
        return null;
    }
  };

  const getReportHeaderTitle = () => {
    switch(reportType) {
      case 'saved_payroll': return 'NÓMINAS GUARDADAS (HISTORIAL)';
      case 'employees': return 'CENSO DE PERSONAL MAESTRO';
      case 'payroll': return 'REGISTRO DE PAGOS DE NÓMINA';
      case 'novedades': return 'HISTORIAL DE NOVEDADES ADMINISTRATIVAS';
      case 'bajas': return 'EXPEDIENTES DE DESVINCULACIONES';
      case 'attendance': return 'BITÁCORA DE ASISTENCIA Y PUNTUALIDAD';
      case 'payments': return 'HISTORIAL DE EGRESOS Y PAGOS';
      case 'history': return 'EXPEDIENTES DE PERSONAL ACTIVO';
      default: return `REPORTE DE ${reportType.toUpperCase()}`;
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 fade-in">
      <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border no-print flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="shrink-0">
           <h2 className="text-2xl font-[950] text-slate-900 uppercase italic">Centro de Reportes Maestro</h2>
           <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">Auditoría y Gestión de Datos Corporativos</p>
        </div>
        <div className="flex flex-col gap-4 w-full md:w-auto">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {['attendance', 'payments', 'history', 'saved_payroll', 'master'].map(t => (
              <button key={t} onClick={() => {setReportType(t as any); setSearchTerm(''); setStartDate(''); setEndDate(''); setFilterMonth(''); setFilterYear(new Date().getFullYear().toString());}} className={`whitespace-nowrap px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${reportType === t ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border'}`}>
                {t === 'attendance' ? 'Asistencia' : t === 'payments' ? 'Pagos' : t === 'history' ? 'Historial' : t === 'saved_payroll' ? 'Nóminas Guardadas' : 'Archivo Maestro'}
              </button>
            ))}
          </div>
          
          {reportType !== 'master' && (
            <div className="flex flex-col sm:flex-row gap-3">
              <input type="text" placeholder="Filtrar por nombre o CI..." className="flex-1 p-3 border-2 rounded-xl text-[11px] font-bold uppercase outline-none focus:border-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              
              {reportType === 'saved_payroll' && (
                <div className="flex gap-2">
                  <select 
                    className="p-3 border-2 rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-500" 
                    value={filterMonth} 
                    onChange={e => setFilterMonth(e.target.value)}
                  >
                    <option value="">TODOS LOS MESES</option>
                    {['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select 
                    className="p-3 border-2 rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-500" 
                    value={filterYear} 
                    onChange={e => setFilterYear(e.target.value)}
                  >
                    <option value="">TODOS LOS AÑOS</option>
                    {['2024', '2025', '2026', '2027'].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              {reportType !== 'saved_payroll' && (
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[7px] font-black uppercase text-slate-400">Desde</label>
                    <input type="date" className="p-3 border-2 rounded-xl text-[10px] font-black uppercase outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[7px] font-black uppercase text-slate-400">Hasta</label>
                    <input type="date" className="p-3 border-2 rounded-xl text-[10px] font-black uppercase outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="flex gap-1 items-end">
                {reportType !== 'saved_payroll' && (
                  <>
                    <button onClick={() => generateReportExcel(reportType)} title="Excel" className="p-3 bg-emerald-600 text-white rounded-xl shadow-md active:scale-95 transition-all text-[10px] font-black uppercase">XLS</button>
                    <button onClick={() => generateReportPDF(reportType)} title="PDF" className="p-3 bg-blue-700 text-white rounded-xl shadow-md active:scale-95 transition-all text-[10px] font-black uppercase">PDF</button>
                  </>
                )}
                <button onClick={() => {setStartDate(''); setEndDate(''); setSearchTerm(''); setFilterMonth(''); setFilterYear(new Date().getFullYear().toString()); setReportType('master');}} className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors">✕</button>
              </div>
            </div>
          )}
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
               <p className="text-[12px] font-[950] uppercase tracking-[0.3em]">{getReportHeaderTitle()}</p>
               {startDate || endDate ? (
                 <p className="text-[10px] font-black uppercase mt-1">Período: {startDate || 'Inicio'} al {endDate || 'Hoy'}</p>
               ) : null}
               {searchTerm && <p className="text-[9px] font-black uppercase italic">Filtro aplicado: "{searchTerm}"</p>}
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
                          {renderTableRows()}
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
