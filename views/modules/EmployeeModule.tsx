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

const EmployeeModule: React.FC<EmployeeModuleProps> = ({ employees, onUpdate, role, company }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [viewingEmp, setViewingEmp] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [hasBankInfo, setHasBankInfo] = useState(true);
  
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);
  
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
      setFeedback({ isOpen: true, title: "Registro Exitoso", message: `Colaborador registrado. PIN PROVISIONAL: ${autoPin}.`, type: "success" });
    }
    onUpdate(updatedList);
    setIsModalOpen(false);
  };

  const handleApprovePinReset = (emp: Employee) => {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    const updated: Employee[] = employees.map(e => e.id === emp.id ? { 
      ...e, 
      pin: randomPin, 
      pinNeedsReset: true, 
      pinResetRequested: false,
      pinChanged: false 
    } : e);
    onUpdate(updated);
    if (viewingEmp && viewingEmp.id === emp.id) {
       setViewingEmp({ ...viewingEmp, pinNeedsReset: true, pinResetRequested: false, pin: randomPin, pinChanged: false });
    }
    setFeedback({ 
      isOpen: true, 
      title: "Reseteo Aplicado", 
      message: `PIN restablecido exitosamente. El nuevo PIN PROVISIONAL es: ${randomPin}. El empleado deberá cambiarlo obligatoriamente en su próxima marcación.`, 
      type: "success" 
    });
    setIsResetConfirmModalOpen(false);
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
    setFeedback({ isOpen: true, title: "Desvinculación", message: "Colaborador desvinculado con éxito.", type: "success" });
  };

  const handleDeletePermanent = () => {
    if (!viewingEmp) return;
    const updated = employees.filter(e => e.id !== viewingEmp.id);
    onUpdate(updated);
    setViewingEmp(null);
    setIsDeleteConfirmModalOpen(false);
    setFeedback({ isOpen: true, title: "Registro Eliminado", message: "El colaborador ha sido borrado definitivamente.", type: "success" });
  };

  const filteredEmployees = employees.filter(e => {
    const searchString = `${e.name} ${e.surname} ${e.identification} ${e.role}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    return showArchived 
      ? matchesSearch && (e.status === 'archived' || e.status === 'terminated') 
      : matchesSearch && e.status === 'active';
  });

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white p-6 rounded-3xl md:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center no-print gap-4">
        <div className="w-full md:w-auto text-center md:text-left">
          <h2 className="text-xl font-[950] text-slate-900 tracking-tighter uppercase leading-none">Gestión Humana</h2>
          <div className="flex gap-4 mt-2 justify-center md:justify-start">
            <button onClick={() => setShowArchived(false)} className={`text-[9px] font-black uppercase tracking-widest ${!showArchived ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Activos</button>
            <button onClick={() => setShowArchived(true)} className={`text-[9px] font-black uppercase tracking-widest ${showArchived ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Historial / Bajas</button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <input type="text" placeholder="Filtrar por nombre, CI..." className="w-full sm:w-64 p-3 border rounded-xl text-[11px] uppercase font-bold focus:border-blue-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <button onClick={() => { setForm(initialForm); setEditingEmp(null); setIsModalOpen(true); }} className="w-full sm:w-auto px-6 py-3.5 bg-blue-700 text-white font-black rounded-xl shadow-lg uppercase text-[9px] tracking-widest active:scale-95 transition-all">Nuevo Registro</button>
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
                    <span className="truncate">{emp.surname} {emp.name}</span>
                  </td>
                  <td className="px-6 py-3 font-mono">{emp.identification}</td>
                  <td className="px-6 py-3 text-blue-600 text-[9px]">{emp.role}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {emp.status === 'active' ? 'Activo' : 'Desvinculado'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right flex gap-2 justify-end">
                     <button onClick={() => setViewingEmp(emp)} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[8px] font-black uppercase active:scale-95">Expediente</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEmp ? "Editar Expediente" : "Nuevo Registro Maestro"} maxWidth="max-w-4xl">
        <div className="space-y-8 max-h-[75vh] overflow-y-auto pr-2 custom-scroll">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <section className="space-y-4 col-span-1 lg:col-span-2">
              <h4 className="text-[10px] font-black uppercase text-blue-600 border-b pb-1">1. Datos Personales Primarios</h4>
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="w-24 h-24 bg-slate-50 rounded-2xl border flex items-center justify-center overflow-hidden shrink-0 shadow-inner relative">
                  {form.photo ? <img src={form.photo} className="w-full h-full object-cover" /> : <span className="text-3xl">👤</span>}
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Nombres</label>
                    <input className="w-full p-2.5 border rounded-xl text-xs uppercase font-bold" value={form.name} onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Apellidos</label>
                    <input className="w-full p-2.5 border rounded-xl text-xs uppercase font-bold" value={form.surname} onChange={e => setForm({...form, surname: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Cédula / ID</label>
                    <input className="w-full p-2.5 border rounded-xl text-xs font-mono font-bold" value={form.identification} onChange={e => setForm({...form, identification: e.target.value.replace(/\D/g,'')})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase">F. Nacimiento</label>
                    <input type="date" className="w-full p-2.5 border rounded-xl text-xs font-bold" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">Género</label>
                  <select className="w-full p-2.5 border rounded-xl text-xs font-bold" value={form.gender} onChange={e => setForm({...form, gender: e.target.value as Gender})}>
                    {Object.values(Gender).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">Estado Civil</label>
                  <select className="w-full p-2.5 border rounded-xl text-xs font-bold" value={form.civilStatus} onChange={e => setForm({...form, civilStatus: e.target.value as CivilStatus})}>
                    {Object.values(CivilStatus).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">Tipo de Sangre</label>
                  <select className="w-full p-2.5 border rounded-xl text-xs font-bold" value={form.bloodType} onChange={e => setForm({...form, bloodType: e.target.value as BloodType})}>
                    {Object.values(BloodType).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </section>
            <section className="space-y-4 bg-slate-50 p-4 rounded-2xl border">
              <h4 className="text-[10px] font-black uppercase text-slate-900 border-b pb-1">2. Contacto</h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">Celular Personal</label>
                  <input className="w-full p-2.5 border rounded-xl text-xs font-bold" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">Email Corporativo/Pers.</label>
                  <input className="w-full p-2.5 border rounded-xl text-xs font-bold" value={form.email} onChange={e => setForm({...form, email: e.target.value.toLowerCase()})} />
                </div>
                <div className="space-y-2 pt-2">
                  <label className="text-[8px] font-black text-red-600 uppercase">Contacto de Emergencia</label>
                  <input placeholder="Nombre" className="w-full p-2.5 border rounded-xl text-[10px] uppercase font-bold" value={form.emergencyContact?.name} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, name: e.target.value.toUpperCase()}})} />
                  <input placeholder="Teléfono" className="w-full p-2.5 border rounded-xl text-[10px] font-bold" value={form.emergencyContact?.phone} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, phone: e.target.value}})} />
                </div>
              </div>
            </section>

            {/* LABORAL */}
            <section className="space-y-4 col-span-1 lg:col-span-2">
              <h4 className="text-[10px] font-black uppercase text-blue-600 border-b pb-1">3. Información Laboral</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">Cargo / Función</label>
                  <select className="w-full p-2.5 border rounded-xl text-xs font-bold" value={form.role} onChange={e => setForm({...form, role: e.target.value as Role})}>
                    {Object.values(Role).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">Sueldo Base ($)</label>
                  <input type="number" step="0.01" className="w-full p-2.5 border rounded-xl text-xs font-black" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">F. Ingreso</label>
                  <input type="date" className="w-full p-2.5 border rounded-xl text-xs font-bold" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                  <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={form.isAffiliated} onChange={e => setForm({...form, isAffiliated: e.target.checked})} />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-slate-700 leading-none">Aporte IESS</span>
                    <span className="text-[7px] font-bold text-blue-500 uppercase mt-1">Beneficios Sociales</span>
                  </div>
                </div>
                {form.isAffiliated && (
                  <div className="space-y-1 flex-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Sobresueldos (Décimos)</label>
                    <select className="w-full p-2.5 border rounded-xl text-xs font-bold" value={form.overSalaryType} onChange={e => setForm({...form, overSalaryType: e.target.value as any})}>
                      <option value="monthly">Mensualizar (Recibir cada mes)</option>
                      <option value="accumulate">Acumular (Un pago anual)</option>
                    </select>
                  </div>
                )}
              </div>
            </section>

            {/* BANCARIO */}
            <section className="space-y-4 bg-slate-50 p-4 rounded-2xl border">
              <h4 className="text-[10px] font-black uppercase text-emerald-600 border-b pb-1">4. Pago de Nómina</h4>
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" id="bank-toggle" checked={hasBankInfo} onChange={e => setHasBankInfo(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                <label htmlFor="bank-toggle" className="text-[9px] font-black text-slate-500 uppercase">Tiene Cuenta Bancaria</label>
              </div>
              {hasBankInfo ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Institución Financiera</label>
                    <input className="w-full p-2.5 border rounded-xl text-xs font-bold uppercase" value={form.bankInfo?.ifi} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, ifi: e.target.value.toUpperCase()}})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Tipo de Cuenta</label>
                    <select className="w-full p-2.5 border rounded-xl text-xs font-bold" value={form.bankInfo?.type} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, type: e.target.value as any}})}>
                      <option value="Ahorros">Ahorros</option>
                      <option value="Corriente">Corriente</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Número de Cuenta</label>
                    <input className="w-full p-2.5 border rounded-xl text-xs font-bold" value={form.bankInfo?.account} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, account: e.target.value}})} />
                  </div>
                </div>
              ) : (
                <p className="text-[9px] font-bold text-red-500 uppercase italic">Se registrará como pago en efectivo.</p>
              )}
            </section>
          </div>
          <div className="pt-6 border-t flex flex-col sm:flex-row gap-3">
            <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase text-[10px]">Cerrar</button>
            <button onClick={handleSave} className="flex-[2] py-4 bg-blue-700 text-white font-[950] rounded-2xl uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all">Sincronizar Expediente Maestro</button>
          </div>
        </div>
      </Modal>

      {/* Expediente Maestro (Vista Detallada e Imprimible) */}
      <Modal isOpen={!!viewingEmp} onClose={() => setViewingEmp(null)} title="Expediente Maestro de Personal" maxWidth="max-w-4xl">
        {viewingEmp && (
          <div className="space-y-6">
            <div id="employee-file-print" className="bg-white p-0 print:p-8">
              {/* Encabezado Institucional exclusivo para Impresión */}
              <div className="hidden print:flex justify-between items-center border-b-2 border-slate-900 pb-6 mb-8">
                <div>
                   <h3 className="text-2xl font-[950] text-slate-900 uppercase italic leading-none">{company?.name || 'ASIST UP - HR ENTERPRISE'}</h3>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">Ficha Maestro de Personal / Expediente Individual</p>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-black uppercase text-slate-400">RUC: {company?.ruc || '—'}</p>
                   <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Fecha Generación: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-6 items-center border-b pb-6 text-center sm:text-left bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 print:bg-white print:border-none print:p-0">
                 <div className="w-28 h-28 rounded-3xl overflow-hidden border-4 border-white bg-slate-100 flex items-center justify-center shadow-xl shrink-0 print:shadow-none print:border-2">
                    {viewingEmp.photo ? <img src={viewingEmp.photo} className="w-full h-full object-cover" /> : <span className="text-5xl">👤</span>}
                 </div>
                 <div className="flex-1 space-y-1">
                    <h3 className="text-2xl md:text-3xl font-[950] text-slate-900 uppercase tracking-tighter leading-none">{viewingEmp.surname} {viewingEmp.name}</h3>
                    <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.3em]">{viewingEmp.role} | CI: {viewingEmp.identification}</p>
                    <div className="flex flex-wrap gap-2 pt-2 justify-center sm:justify-start">
                       <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${viewingEmp.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>{viewingEmp.status === 'active' ? 'Activo' : 'Desvinculado'}</span>
                       <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[9px] font-black uppercase rounded-full border">Ingreso: {new Date(viewingEmp.startDate).toLocaleDateString()}</span>
                       {viewingEmp.pinResetRequested && <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-[9px] font-black uppercase rounded-full animate-pulse shadow-sm no-print">Reset PIN Pendiente</span>}
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print mt-6">
                 <button onClick={() => { setForm(viewingEmp); setEditingEmp(viewingEmp); setIsModalOpen(true); }} className="p-4 bg-blue-50 text-blue-700 rounded-2xl flex flex-col items-center gap-2 hover:bg-blue-600 hover:text-white transition-all border border-blue-100 shadow-sm active:scale-95 group">
                    <span className="text-2xl group-hover:scale-110 transition-transform">📝</span>
                    <span className="text-[8px] font-black uppercase">Editar Datos</span>
                 </button>
                 <button onClick={() => setIsAbsenceModalOpen(true)} className="p-4 bg-slate-50 text-slate-700 rounded-2xl flex flex-col items-center gap-2 hover:bg-slate-900 hover:text-white transition-all border border-slate-100 shadow-sm active:scale-95 group">
                    <span className="text-2xl group-hover:scale-110 transition-transform">📌</span>
                    <span className="text-[8px] font-black uppercase">Nueva Novedad</span>
                 </button>
                 <button onClick={() => window.print()} className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl flex flex-col items-center gap-2 hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 shadow-sm active:scale-95 group">
                    <span className="text-2xl group-hover:scale-110 transition-transform">🖨️</span>
                    <span className="text-[8px] font-black uppercase">Imprimir Ficha</span>
                 </button>
                 {viewingEmp.status === 'active' && (
                    <button onClick={() => setIsResetConfirmModalOpen(true)} className="p-4 bg-yellow-50 text-yellow-700 rounded-2xl flex flex-col items-center gap-2 border border-yellow-200 shadow-sm hover:bg-yellow-500 hover:text-white transition-all active:scale-95 group">
                      <span className="text-2xl group-hover:scale-110 transition-transform">🔑</span>
                      <span className="text-[8px] font-black uppercase">{viewingEmp.pinResetRequested ? 'Aprobar PIN' : 'Resetear PIN'}</span>
                    </button>
                 )}
                 {viewingEmp.status === 'active' && (
                    <button onClick={() => setIsTermModalOpen(true)} className="p-4 bg-red-50 text-red-700 rounded-2xl flex flex-col items-center gap-2 border border-red-100 shadow-sm hover:bg-red-600 hover:text-white transition-all active:scale-95 group">
                      <span className="text-2xl group-hover:scale-110 transition-transform">🚪</span>
                      <span className="text-[8px] font-black uppercase">Dar de Baja</span>
                    </button>
                 )}
                 {role === Role.SUPER_ADMIN && (
                   <button onClick={() => setIsDeleteConfirmModalOpen(true)} className="p-4 bg-red-700 text-white rounded-2xl flex flex-col items-center gap-2 shadow-lg active:scale-95 group">
                      <span className="text-2xl group-hover:scale-110 transition-transform">🗑️</span>
                      <span className="text-[8px] font-black uppercase">Eliminar Def.</span>
                   </button>
                 )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 print:pt-4">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1 print:text-slate-900 print:border-slate-900">Datos Personales</h4>
                  <div className="grid grid-cols-2 gap-3 text-[10px] font-bold uppercase">
                    <div className="space-y-1">
                      <p className="text-[8px] text-slate-400">Género / Sangre</p>
                      <p className="text-slate-900">{viewingEmp.gender} | {viewingEmp.bloodType}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] text-slate-400">Estado Civil</p>
                      <p className="text-slate-900">{viewingEmp.civilStatus}</p>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <p className="text-[8px] text-slate-400">Contacto Directo</p>
                      <p className="text-slate-900">{viewingEmp.phone} | {viewingEmp.email}</p>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <p className="text-[8px] text-slate-400">Emergencia</p>
                      <p className="text-slate-900">{viewingEmp.emergencyContact?.name} ({viewingEmp.emergencyContact?.phone})</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1 print:text-slate-900 print:border-slate-900">Perfil Laboral y Financiero</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Sueldo Base</p>
                      <p className="text-lg font-black text-slate-900">${viewingEmp.salary.toFixed(2)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Seguro IESS</p>
                      <p className="text-[10px] font-black text-blue-600 uppercase print:text-slate-900">{viewingEmp.isAffiliated ? 'Afiliado' : 'No Afiliado'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2 print:bg-white print:border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Información Bancaria</p>
                      <p className="text-[10px] font-black text-slate-700 uppercase print:text-slate-950">{viewingEmp.bankInfo?.ifi} | {viewingEmp.bankInfo?.type} | {viewingEmp.bankInfo?.account}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 col-span-1 md:col-span-2 mt-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1 print:text-slate-900 print:border-slate-900">Historial de Novedades Registradas</h4>
                  <div className="space-y-2">
                      {viewingEmp.absences?.length ? [...viewingEmp.absences].reverse().map(abs => (
                         <div key={abs.id} className="p-3 bg-white rounded-xl border border-slate-100 flex justify-between items-center shadow-sm print:shadow-none print:border-slate-200">
                            <div>
                               <p className="text-[9px] font-black text-slate-900 uppercase">{abs.type} — {new Date(abs.date).toLocaleDateString()}</p>
                               <p className="text-[8px] font-bold text-slate-500 italic">"{abs.reason}"</p>
                            </div>
                            {abs.justified && <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 print:bg-white print:border-slate-900 print:text-slate-900">VALIDADO</span>}
                         </div>
                      )) : <p className="text-center py-6 text-[9px] text-slate-300 font-black uppercase">Sin registros de novedades</p>}
                  </div>
                </div>
              </div>

              {/* Sección de Firmas para Impresión */}
              <div className="hidden print:grid grid-cols-2 gap-20 mt-24 text-center">
                 <div className="border-t-2 border-slate-900 pt-3">
                    <p className="text-[9px] font-black uppercase text-slate-900">Firma del Colaborador</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Declaro veracidad de la información</p>
                 </div>
                 <div className="border-t-2 border-slate-900 pt-3">
                    <p className="text-[9px] font-black uppercase text-slate-900">Auditoría / RRHH</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Sello Institucional</p>
                 </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isAbsenceModalOpen} onClose={() => setIsAbsenceModalOpen(false)} title="Registrar Novedad" maxWidth="max-w-sm">
         <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase">Tipo de Registro</label>
              <select className="w-full border-2 p-3 rounded-xl text-[11px] font-bold uppercase" value={newAbsence.type} onChange={e => setNewAbsence({...newAbsence, type: e.target.value as any})}><option value="Falta">Falta Injustificada</option><option value="Permiso">Permiso Autorizado</option><option value="Atraso">Atraso Crítico</option></select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase">Fecha del Evento</label>
              <input type="date" className="w-full border-2 p-3 rounded-xl text-[11px] font-bold" value={newAbsence.date} onChange={e => setNewAbsence({...newAbsence, date: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase">Justificación / Motivo</label>
              <textarea className="w-full border-2 p-3 rounded-xl text-[11px] font-bold h-24 uppercase" placeholder="Describa la novedad..." value={newAbsence.reason} onChange={e => setNewAbsence({...newAbsence, reason: e.target.value.toUpperCase()})} />
            </div>
            <div className="flex items-center gap-3 py-2 bg-slate-50 p-4 rounded-xl">
               <input type="checkbox" id="just-check" className="w-5 h-5 accent-emerald-600" checked={newAbsence.justified} onChange={e => setNewAbsence({...newAbsence, justified: e.target.checked})} />
               <label htmlFor="just-check" className="text-[10px] font-black uppercase text-slate-600">Considerar como Justificado</label>
            </div>
            <button onClick={handleAddAbsence} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] shadow-lg active:scale-95 transition-all">Guardar Novedad en Expediente</button>
         </div>
      </Modal>

      <Modal isOpen={isResetConfirmModalOpen} onClose={() => setIsResetConfirmModalOpen(false)} title="Seguridad de Acceso" type="warning" maxWidth="max-w-sm">
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-3xl mx-auto">🔑</div>
          <p className="text-xs font-black text-yellow-600 uppercase italic">Confirmar Reseteo de PIN</p>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">¿Confirma que desea restablecer el PIN de este colaborador? Se generará un nuevo PIN provisional aleatorio y el sistema obligará al cambio en la próxima marcación.</p>
          <div className="flex gap-3">
            <button onClick={() => setIsResetConfirmModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[9px]">Cancelar</button>
            <button onClick={() => viewingEmp && handleApprovePinReset(viewingEmp)} className="flex-1 py-4 bg-yellow-600 text-white font-black rounded-xl uppercase text-[9px] shadow-lg active:scale-95 transition-all">Confirmar Reseteo</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isTermModalOpen} onClose={() => setIsTermModalOpen(false)} title="Salida de Personal / Desvinculación" maxWidth="max-w-sm">
         <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase">Motivo Legal de Salida</label>
              <select className="w-full border-2 p-3 rounded-xl text-[11px] font-bold uppercase" value={termData.reason} onChange={e => setTermData({...termData, reason: e.target.value as TerminationReason})}>{Object.values(TerminationReason).map(r => <option key={r} value={r}>{r}</option>)}</select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase">Fecha de Cese de Funciones</label>
              <input type="date" className="w-full border-2 p-3 rounded-xl text-[11px] font-bold" value={termData.date} onChange={e => setTermData({...termData, date: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase">Observaciones Finales</label>
              <textarea className="w-full border-2 p-3 rounded-xl text-[11px] font-bold h-24 uppercase" placeholder="Detalles de la liquidación o motivo..." value={termData.details} onChange={e => setTermData({...termData, details: e.target.value.toUpperCase()})} />
            </div>
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
               <p className="text-[10px] font-black text-red-600 uppercase">Advertencia</p>
               <p className="text-[8px] font-bold text-red-400 uppercase mt-1">El colaborador pasará al historial de bajas y no podrá marcar asistencia.</p>
            </div>
            <button onClick={handleTerminate} className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase text-[10px] shadow-lg active:scale-95 transition-all">Ejecutar Baja Definitiva</button>
         </div>
      </Modal>

      <Modal isOpen={isDeleteConfirmModalOpen} onClose={() => setIsDeleteConfirmModalOpen(false)} title="ELIMINACIÓN DE REGISTRO MAESTRO" type="error" maxWidth="max-w-sm">
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mx-auto animate-pulse">🗑️</div>
          <p className="text-xs font-black text-red-600 uppercase italic">Acción Crítica e Irreversible</p>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">¿Desea borrar permanentemente este expediente? Se perderán todos los históricos bancarios, novedades y registros personales asociados.</p>
          <div className="flex gap-3">
            <button onClick={() => setIsDeleteConfirmModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[9px]">Cancelar</button>
            <button onClick={handleDeletePermanent} className="flex-1 py-4 bg-red-600 text-white font-black rounded-xl uppercase text-[9px] shadow-lg active:scale-95 transition-all">Confirmar Borrado</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
        <div className="text-center p-4">
          <p className="text-[11px] font-bold uppercase leading-relaxed text-slate-600">{feedback.message}</p>
          <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-3.5 bg-slate-900 text-white font-black rounded-xl uppercase text-[9px] mt-6 active:scale-95 transition-all">Aceptar</button>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeModule;