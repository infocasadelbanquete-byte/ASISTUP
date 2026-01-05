
import React, { useState, useEffect } from 'react';
import { Employee, Role, BloodType, Gender, CivilStatus, AbsenceRecord, TerminationReason } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface EmployeeModuleProps {
  employees: Employee[];
  onUpdate: (employees: Employee[]) => void;
  role: Role;
  attendance: any[];
  payments: any[];
  company: any;
}

const EmployeeModule: React.FC<EmployeeModuleProps> = ({ employees, onUpdate, role }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [viewingEmp, setViewingEmp] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [hasBankInfo, setHasBankInfo] = useState(true);
  
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [newAbsence, setNewAbsence] = useState<Partial<AbsenceRecord>>({ type: 'Falta', justified: false, date: new Date().toISOString().split('T')[0], reason: '' });
  const [termData, setTermData] = useState({ reason: TerminationReason.VOLUNTARY, details: '', date: new Date().toISOString().split('T')[0] });

  const [feedback, setFeedback] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info'}>({
    isOpen: false, title: '', message: '', type: 'info'
  });

  const initialForm: Partial<Employee> = {
    name: '', surname: '', identification: '', birthDate: '', phone: '', email: '', 
    gender: Gender.MASCULINO, civilStatus: CivilStatus.SOLTERO,
    origin: 'ECUATORIANA', address: '', 
    bloodType: BloodType.O_POS, startDate: new Date().toISOString().split('T')[0],
    role: Role.EMPLOYEE, salary: 482.00, status: 'active' as const, photo: '', pin: '',
    emergencyContact: { name: '', phone: '' },
    isFixed: true, isAffiliated: true, overSalaryType: 'monthly',
    bankInfo: { ifi: '', type: 'Ahorros', account: '' },
    absences: [],
    observations: []
  };

  const [form, setForm] = useState<Partial<Employee>>(initialForm);

  useEffect(() => {
    if (!form.isAffiliated && form.overSalaryType !== 'none') {
      setForm(prev => ({ ...prev, overSalaryType: 'none' }));
    }
  }, [form.isAffiliated]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!form.name || !form.surname || !form.identification || !form.salary || !form.role) {
      setFeedback({ isOpen: true, title: "Error", message: "Nombres, apellidos, cédula, cargo y sueldo son obligatorios.", type: "error" });
      return;
    }
    const finalForm = { ...form };
    if (!hasBankInfo) finalForm.bankInfo = { ifi: 'NO APLICA', type: 'Ahorros', account: 'N/A' };

    let updatedList: Employee[];
    if (editingEmp) {
      updatedList = employees.map(e => e.id === editingEmp.id ? { ...e, ...finalForm } as Employee : e);
      setFeedback({ isOpen: true, title: "Éxito", message: "Expediente actualizado correctamente.", type: "success" });
    } else {
      const autoPin = Math.floor(100000 + Math.random() * 900000).toString();
      const newEmp: Employee = { 
        ...finalForm, 
        id: Math.random().toString(36).substr(2, 9), 
        pin: autoPin, 
        pinChanged: false, 
        pinNeedsReset: false, 
        pinResetRequested: false,
        absences: [], 
        observations: [], 
        totalHoursWorked: 0, 
        status: 'active' as const 
      } as Employee;
      updatedList = [...employees, newEmp];
      setFeedback({ isOpen: true, title: "Éxito", message: `Colaborador registrado. PIN Inicial: ${autoPin}`, type: "success" });
    }
    onUpdate(updatedList);
    setIsModalOpen(false);
  };

  const handleApprovePinReset = (emp: Employee) => {
    const updated: Employee[] = employees.map(e => e.id === emp.id ? { 
      ...e, 
      pin: "000000", 
      pinNeedsReset: true, 
      pinResetRequested: false,
      pinChanged: false 
    } : e);
    onUpdate(updated);
    setViewingEmp({ ...emp, pinNeedsReset: true, pinResetRequested: false, pin: "000000" });
    setFeedback({ 
      isOpen: true, 
      title: "Reseteo Aprobado", 
      message: `PIN reseteado para ${emp.name}. El empleado debe establecer su clave en el terminal.`, 
      type: "success" 
    });
  };

  const handleAddAbsence = () => {
    if (!viewingEmp) return;
    const record: AbsenceRecord = { ...newAbsence, id: Math.random().toString(36).substr(2, 9) } as AbsenceRecord;
    const updated: Employee[] = employees.map(e => e.id === viewingEmp.id ? { ...e, absences: [...(e.absences || []), record] } : e);
    onUpdate(updated);
    setViewingEmp({ ...viewingEmp, absences: [...(viewingEmp.absences || []), record] });
    setIsAbsenceModalOpen(false);
  };

  const handleTerminate = () => {
    if (!viewingEmp) return;
    const updated: Employee[] = employees.map(e => e.id === viewingEmp.id ? { 
      ...e, 
      status: 'terminated' as const, 
      terminationDate: termData.date, 
      terminationReason: termData.reason, 
      terminationDetails: termData.details 
    } : e);
    onUpdate(updated);
    setViewingEmp(null);
    setIsTermModalOpen(false);
    setFeedback({ isOpen: true, title: "Desvinculación", message: "Estatus del colaborador actualizado.", type: "success" });
  };

  const filteredEmployees = employees.filter(e => {
    const searchString = `${e.name} ${e.surname} ${e.identification} ${e.role} ${e.email} ${e.phone}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    return showArchived ? matchesSearch && e.status === 'archived' : matchesSearch && e.status !== 'archived';
  });

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white p-6 rounded-3xl md:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center no-print gap-4">
        <div className="w-full md:w-auto text-center md:text-left">
          <h2 className="text-xl font-[950] text-slate-900 tracking-tighter uppercase leading-none">Gestión Humana</h2>
          <div className="flex gap-4 mt-2 justify-center md:justify-start">
            <button onClick={() => setShowArchived(false)} className={`text-[9px] font-black uppercase tracking-widest ${!showArchived ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Activos</button>
            <button onClick={() => setShowArchived(true)} className={`text-[9px] font-black uppercase tracking-widest ${showArchived ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Archivados</button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <input type="text" placeholder="Buscar por nombre, CI, cargo..." className="w-full sm:w-64 p-3 border rounded-xl text-[11px] uppercase font-bold focus:border-blue-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <button onClick={() => { setForm(initialForm); setEditingEmp(null); setHasBankInfo(true); setIsModalOpen(true); }} className="w-full sm:w-auto px-6 py-3.5 bg-blue-700 text-white font-black rounded-xl shadow-lg uppercase text-[9px] tracking-widest active:scale-95 transition-all">Nuevo Registro</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-sm border overflow-hidden no-print">
        <div className="table-responsive">
          <table className="w-full text-left min-w-[600px] md:min-w-full">
            <thead className="bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Colaborador</th>
                <th className="px-6 py-4">Identificación</th>
                <th className="px-6 py-4">Cargo</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[10px] md:text-[11px] font-black uppercase">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-6 py-3 font-black text-slate-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg overflow-hidden border bg-slate-100 flex items-center justify-center shrink-0">
                      {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : <span>👤</span>}
                    </div>
                    <span className="truncate max-w-[120px] md:max-w-none">{emp.surname} {emp.name}</span>
                  </td>
                  <td className="px-6 py-3 font-mono">{emp.identification}</td>
                  <td className="px-6 py-3 text-blue-600 text-[9px]">{emp.role}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {emp.status === 'active' ? 'Activo' : 'Salida'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right flex gap-2 justify-end">
                     <button onClick={() => setViewingEmp(emp)} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[8px] font-black uppercase active:scale-95">Expediente</button>
                     {role === Role.SUPER_ADMIN && (
                       <button onClick={() => { setEditingEmp(emp); setForm(emp); setHasBankInfo(emp.bankInfo?.ifi !== 'NO APLICA'); setIsModalOpen(true); }} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[8px] font-black uppercase active:scale-95">Editar</button>
                     )}
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr><td colSpan={5} className="p-10 text-center text-[10px] font-black text-slate-400 uppercase">No se encontraron resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!viewingEmp} onClose={() => setViewingEmp(null)} title="Expediente de Personal">
        {viewingEmp && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-6 items-center border-b pb-6 text-center sm:text-left">
               <div className="w-24 h-24 rounded-2xl overflow-hidden border bg-slate-100 flex items-center justify-center shadow-lg shrink-0">
                  {viewingEmp.photo ? <img src={viewingEmp.photo} className="w-full h-full object-cover" /> : <span className="text-4xl">👤</span>}
               </div>
               <div className="flex-1">
                  <h3 className="text-xl md:text-2xl font-[950] text-slate-900 uppercase tracking-tighter leading-tight">{viewingEmp.surname} {viewingEmp.name}</h3>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">{viewingEmp.role} | CI: {viewingEmp.identification}</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Fecha de Ingreso: {viewingEmp.startDate}</p>
                  {viewingEmp.pinResetRequested && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                       <span className="text-[9px] font-black text-red-600 uppercase">Solicitud de Reseteo</span>
                       <button onClick={() => handleApprovePinReset(viewingEmp)} className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg text-[8px] font-black uppercase shadow active:scale-95">Aprobar</button>
                    </div>
                  )}
               </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px] font-bold uppercase">
               <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-slate-400 font-black text-[8px] mb-2">Información de Pago</p>
                  <p className="mb-1">Sueldo: ${viewingEmp.salary.toFixed(2)}</p>
                  <p className="mb-1">Modalidad: {viewingEmp.isFixed ? 'Tiempo Completo' : 'Eventual'}</p>
                  <p className="mb-1">IESS: {viewingEmp.isAffiliated ? 'Afiliado' : 'No Afiliado'}</p>
                  <p>Beneficios: {viewingEmp.overSalaryType === 'monthly' ? 'Mensualizados' : viewingEmp.overSalaryType === 'accumulate' ? 'Acumulados' : 'No Aplica'}</p>
               </div>
               <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-slate-400 font-black text-[8px] mb-2">Contacto de Emergencia</p>
                  <p className="mb-1">{viewingEmp.emergencyContact?.name || 'N/A'}</p>
                  <p>{viewingEmp.emergencyContact?.phone || 'N/A'}</p>
               </div>
            </div>

            <section>
               <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Historial de Novedades</h4>
                  {viewingEmp.status === 'active' && <button onClick={() => setIsAbsenceModalOpen(true)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[8px] font-black uppercase">Registrar</button>}
               </div>
               <div className="bg-slate-50 rounded-2xl overflow-hidden border max-h-48 table-responsive custom-scroll">
                  <table className="w-full text-left min-w-[400px]">
                     <thead className="bg-slate-100 text-[8px] font-black uppercase text-slate-400 sticky top-0">
                        <tr><th className="p-3">Fecha</th><th className="p-3">Tipo</th><th className="p-3">Motivo</th><th className="p-3">Just.</th></tr>
                     </thead>
                     <tbody className="text-[9px] font-bold uppercase divide-y">
                        {viewingEmp.absences?.map(a => (
                           <tr key={a.id}><td className="p-3 whitespace-nowrap">{a.date}</td><td className="p-3">{a.type}</td><td className="p-3 truncate max-w-[100px]">{a.reason}</td><td className="p-3 text-center">{a.justified ? 'SI' : 'NO'}</td></tr>
                        )) || <tr><td colSpan={4} className="p-10 text-center text-slate-300">Sin registros.</td></tr>}
                     </tbody>
                  </table>
               </div>
            </section>
            
            {viewingEmp.status === 'active' && role === Role.SUPER_ADMIN && (
              <div className="pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <button onClick={() => handleApprovePinReset(viewingEmp)} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase border border-slate-200">Resetear PIN</button>
                 <button onClick={() => setIsTermModalOpen(true)} className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-[9px] font-black uppercase border border-red-200">Procesar Salida</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEmp ? "Actualizar Colaborador" : "Nuevo Registro de Personal"}>
         <div className="space-y-6 max-h-[75vh] overflow-y-auto px-1 custom-scroll">
            <section className="border-b pb-6">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">I. Información de Identidad</h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 text-center sm:text-left">
                     <label className="text-[9px] font-black text-slate-400 uppercase">Fotografía del Colaborador</label>
                     <div className="flex flex-col sm:flex-row gap-4 items-center mt-2">
                        <div className="w-24 h-24 bg-slate-50 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden shrink-0 border-slate-200">
                           {form.photo ? <img src={form.photo} className="w-full h-full object-cover" /> : <span className="text-[9px] text-slate-300 uppercase font-black">Sin Foto</span>}
                        </div>
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="text-[9px] w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[9px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                     </div>
                  </div>
                  <div><label className="text-[9px] font-black text-slate-400 uppercase">Nombres*</label><input className="w-full border-2 p-3 rounded-xl text-[11px] font-black uppercase focus:border-blue-500 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} /></div>
                  <div><label className="text-[9px] font-black text-slate-400 uppercase">Apellidos*</label><input className="w-full border-2 p-3 rounded-xl text-[11px] font-black uppercase focus:border-blue-500 outline-none" value={form.surname} onChange={e => setForm({...form, surname: e.target.value.toUpperCase()})} /></div>
                  <div><label className="text-[9px] font-black text-slate-400 uppercase">Identificación/CI*</label><input maxLength={10} className="w-full border-2 p-3 rounded-xl text-[11px] font-black focus:border-blue-500 outline-none" value={form.identification} onChange={e => setForm({...form, identification: e.target.value.replace(/\D/g,'')})} /></div>
                  <div><label className="text-[9px] font-black text-slate-400 uppercase">Fecha de Nacimiento</label><input type="date" className="w-full border-2 p-3 rounded-xl text-[11px] font-black focus:border-blue-500 outline-none" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} /></div>
                  <div><label className="text-[9px] font-black text-slate-400 uppercase">Género</label><select className="w-full border-2 p-3 rounded-xl text-[11px] font-black focus:border-blue-500 outline-none" value={form.gender} onChange={e => setForm({...form, gender: e.target.value as Gender})}>{Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                  <div><label className="text-[9px] font-black text-slate-400 uppercase">Estado Civil</label><select className="w-full border-2 p-3 rounded-xl text-[11px] font-black focus:border-blue-500 outline-none" value={form.civilStatus} onChange={e => setForm({...form, civilStatus: e.target.value as CivilStatus})}>{Object.values(CivilStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div><label className="text-[9px] font-black text-slate-400 uppercase">Nacionalidad</label><input className="w-full border-2 p-3 rounded-xl text-[11px] font-black uppercase focus:border-blue-500 outline-none" value={form.origin} onChange={e => setForm({...form, origin: e.target.value.toUpperCase()})} /></div>
                  <div><label className="text-[9px] font-black text-slate-400 uppercase">Tipo de Sangre</label><select className="w-full border-2 p-3 rounded-xl text-[11px] font-black focus:border-blue-500 outline-none" value={form.bloodType} onChange={e => setForm({...form, bloodType: e.target.value as BloodType})}>{Object.values(BloodType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div className="sm:col-span-2"><label className="text-[9px] font-black text-slate-400 uppercase">Dirección de Domicilio</label><input className="w-full border-2 p-3 rounded-xl text-[11px] font-black uppercase focus:border-blue-500 outline-none" value={form.address} onChange={e => setForm({...form, address: e.target.value.toUpperCase()})} /></div>
                  <div><label className="text-[9px] font-black text-slate-400 uppercase">Teléfono de Contacto</label><input className="w-full border-2 p-3 rounded-xl text-[11px] font-black focus:border-blue-500 outline-none" value={form.phone} onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g,'')})} /></div>
                  <div><label className="text-[9px] font-black text-slate-400 uppercase">Correo Electrónico</label><input type="email" className="w-full border-2 p-3 rounded-xl text-[11px] font-black focus:border-blue-500 outline-none" value={form.email} onChange={e => setForm({...form, email: e.target.value.toLowerCase()})} /></div>
               </div>
            </section>
            <section className="border-b pb-6">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">II. Contacto de Emergencia</h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="text-[9px] font-black text-slate-400 uppercase">Nombre Completo</label><input className="w-full border-2 p-3 rounded-xl text-[11px] font-black uppercase focus:border-blue-500 outline-none" value={form.emergencyContact?.name} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, name: e.target.value.toUpperCase()}})} /></div>
                  <div><label className="text-[9px] font-black text-slate-400 uppercase">Teléfono</label><input className="w-full border-2 p-3 rounded-xl text-[11px] font-black focus:border-blue-500 outline-none" value={form.emergencyContact?.phone} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, phone: e.target.value.replace(/\D/g,'')}})} /></div>
               </div>
            </section>
            <section className="border-b pb-6">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">III. Configuración Laboral</h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Cargo Institucional*</label>
                    <select className="w-full border-2 p-3 rounded-xl text-[11px] font-black focus:border-blue-500 outline-none" value={form.role} onChange={e => setForm({...form, role: e.target.value as Role})}>
                      {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div><label className="text-[9px] font-black text-slate-400 uppercase">Fecha de Ingreso</label><input type="date" className="w-full border-2 p-3 rounded-xl text-[11px] font-black focus:border-blue-500 outline-none" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} /></div>
                  <div><label className="text-[9px] font-black text-slate-400 uppercase">Sueldo Base*</label><input type="number" step="0.01" className="w-full border-2 p-3 rounded-xl text-[11px] font-black focus:border-blue-500 outline-none" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} /></div>
                  <div className="flex items-center gap-6 pt-4">
                     <div className="flex items-center gap-2">
                        <input type="checkbox" id="isAffiliated" className="w-4 h-4 cursor-pointer" checked={form.isAffiliated} onChange={e => setForm({...form, isAffiliated: e.target.checked})} />
                        <label htmlFor="isAffiliated" className="text-[10px] font-black uppercase text-slate-600 cursor-pointer">Afiliado IESS</label>
                     </div>
                     <div className="flex items-center gap-2">
                        <input type="checkbox" id="isFixed" className="w-4 h-4 cursor-pointer" checked={form.isFixed} onChange={e => setForm({...form, isFixed: e.target.checked})} />
                        <label htmlFor="isFixed" className="text-[10px] font-black uppercase text-slate-600 cursor-pointer">Tiempo Completo</label>
                     </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase">Beneficios Adicionales</label>
                    <select className="w-full border-2 p-3 rounded-xl text-[11px] font-black focus:border-blue-500 outline-none disabled:bg-slate-50" disabled={!form.isAffiliated} value={form.overSalaryType} onChange={e => setForm({...form, overSalaryType: e.target.value as any})}>
                        <option value="monthly">Mensualizar Décimos</option>
                        <option value="accumulate">Acumular Décimos</option>
                        <option value="none">No Aplica</option>
                    </select>
                  </div>
               </div>
            </section>
            <section className="pb-6">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">IV. Datos para Acreditación</h4>
               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <input type="checkbox" id="hasBank" className="w-4 h-4 cursor-pointer" checked={hasBankInfo} onChange={e => setHasBankInfo(e.target.checked)} />
                     <label htmlFor="hasBank" className="text-[10px] font-black uppercase text-slate-600 cursor-pointer">Pago por Transferencia Bancaria</label>
                  </div>
                  {hasBankInfo && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200">
                       <div className="sm:col-span-2"><label className="text-[9px] font-black text-slate-400 uppercase">Institución Financiera (IFI)</label><input className="w-full border-2 p-3 rounded-xl text-[11px] font-black uppercase focus:border-blue-500 outline-none" value={form.bankInfo?.ifi} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, ifi: e.target.value.toUpperCase()}})} /></div>
                       <div><label className="text-[9px] font-black text-slate-400 uppercase">Tipo de Cuenta</label><select className="w-full border-2 p-3 rounded-xl text-[11px] font-black focus:border-blue-500 outline-none" value={form.bankInfo?.type} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, type: e.target.value as any}})}><option value="Ahorros">Ahorros</option><option value="Corriente">Corriente</option></select></div>
                       <div><label className="text-[9px] font-black text-slate-400 uppercase">Número de Cuenta</label><input className="w-full border-2 p-3 rounded-xl text-[11px] font-black focus:border-blue-500 outline-none" value={form.bankInfo?.account} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, account: e.target.value}})} /></div>
                    </div>
                  )}
               </div>
            </section>
            <button onClick={handleSave} className="w-full py-4 bg-slate-900 text-white font-[950] rounded-2xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Sincronizar Registro Maestro</button>
         </div>
      </Modal>

      <Modal isOpen={isAbsenceModalOpen} onClose={() => setIsAbsenceModalOpen(false)} title="Registrar Novedad" maxWidth="max-w-sm">
         <div className="space-y-4">
            <select className="w-full border-2 p-3 rounded-xl text-[11px] font-bold outline-none focus:border-blue-500" value={newAbsence.type} onChange={e => setNewAbsence({...newAbsence, type: e.target.value as any})}><option value="Falta">Falta</option><option value="Permiso">Permiso</option><option value="Atraso">Atraso</option></select>
            <input type="date" className="w-full border-2 p-3 rounded-xl text-[11px] font-bold outline-none focus:border-blue-500" value={newAbsence.date} onChange={e => setNewAbsence({...newAbsence, date: e.target.value})} />
            <textarea className="w-full border-2 p-3 rounded-xl text-[11px] font-bold h-20 outline-none focus:border-blue-500" placeholder="Motivo o Justificación..." value={newAbsence.reason} onChange={e => setNewAbsence({...newAbsence, reason: e.target.value})} />
            <div className="flex items-center gap-2"><input type="checkbox" id="isJustified" className="w-4 h-4" checked={newAbsence.justified} onChange={e => setNewAbsence({...newAbsence, justified: e.target.checked})} /><label htmlFor="isJustified" className="text-[10px] font-black uppercase text-slate-600">Justificado</label></div>
            <button onClick={handleAddAbsence} className="w-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase text-[10px] shadow-lg active:scale-95 transition-all">Guardar Novedad</button>
         </div>
      </Modal>

      <Modal isOpen={isTermModalOpen} onClose={() => setIsTermModalOpen(false)} title="Salida de Personal" maxWidth="max-w-sm">
         <div className="space-y-4">
            <label className="text-[9px] font-black text-slate-400 uppercase">Motivo de Desvinculación</label>
            <select className="w-full border-2 p-3 rounded-xl text-[11px] font-bold outline-none focus:border-red-500" value={termData.reason} onChange={e => setTermData({...termData, reason: e.target.value as TerminationReason})}>{Object.values(TerminationReason).map(r => <option key={r} value={r}>{r}</option>)}</select>
            <label className="text-[9px] font-black text-slate-400 uppercase">Fecha Efectiva</label>
            <input type="date" className="w-full border-2 p-3 rounded-xl text-[11px] font-bold outline-none focus:border-red-500" value={termData.date} onChange={e => setTermData({...termData, date: e.target.value})} />
            <textarea className="w-full border-2 p-3 rounded-xl text-[11px] font-bold h-24 outline-none focus:border-red-500" placeholder="Detalles u observaciones..." value={termData.details} onChange={e => setTermData({...termData, details: e.target.value})} />
            <button onClick={handleTerminate} className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase text-[10px] shadow-lg active:scale-95 transition-all">Confirmar Salida Definitiva</button>
         </div>
      </Modal>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
        <div className="text-center p-4">
          <p className="text-[11px] font-bold uppercase leading-relaxed text-slate-600">{feedback.message}</p>
          <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-3.5 bg-slate-900 text-white font-black rounded-xl uppercase text-[9px] mt-6 active:scale-95 transition-all">Entendido</button>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeModule;
