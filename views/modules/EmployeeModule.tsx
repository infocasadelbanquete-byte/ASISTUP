import React, { useState, useEffect } from 'react';
import { Employee, Role, BloodType, TerminationReason, Gender, CivilStatus, AbsenceRecord } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface EmployeeModuleProps {
  employees: Employee[];
  onUpdate: (employees: Employee[]) => void;
  role: Role;
  attendance: any[];
  payments: any[];
  company: any;
}

const EmployeeModule: React.FC<EmployeeModuleProps> = ({ employees, onUpdate, role, payments }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [viewingEmp, setViewingEmp] = useState<Employee | null>(null);
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const initialForm: Partial<Employee> = {
    name: '', surname: '', identification: '', birthDate: '', phone: '', email: '', 
    gender: Gender.MASCULINO, civilStatus: CivilStatus.SOLTERO,
    origin: 'ECUATORIANA', address: '', 
    bloodType: BloodType.O_POS, startDate: new Date().toISOString().split('T')[0],
    role: Role.EMPLOYEE, salary: 482.00, status: 'active', photo: '', pin: '',
    emergencyContact: { name: '', phone: '' },
    isFixed: true, isAffiliated: true, overSalaryType: 'monthly',
    bankInfo: { ifi: 'Banco del Austro', type: 'Ahorros', account: '' },
    absences: [],
    observations: []
  };

  const [form, setForm] = useState<Partial<Employee>>(initialForm);
  const [termForm, setTermForm] = useState({ reason: TerminationReason.VOLUNTARY, date: new Date().toISOString().split('T')[0], details: '' });
  const [absenceForm, setAbsenceForm] = useState<Partial<AbsenceRecord>>({ type: 'Falta', date: new Date().toISOString().split('T')[0], reason: '', justified: false });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setForm(prev => ({ ...prev, photo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!form.name || !form.surname || !form.identification) {
      alert("Nombres, apellidos e identificación son requeridos.");
      return;
    }

    let updatedList;
    if (editingEmp) {
      updatedList = employees.map(e => e.id === editingEmp.id ? { ...e, ...form } as Employee : e);
    } else {
      const autoPin = Math.floor(100000 + Math.random() * 900000).toString();
      const newEmp = { 
        ...form, 
        id: Math.random().toString(36).substr(2, 9), 
        pin: autoPin,
        pinChanged: false,
        pinNeedsReset: false,
        absences: [],
        observations: [],
        totalHoursWorked: 0
      } as Employee;
      updatedList = [...employees, newEmp];
      alert(`Empleado registrado. PIN Temporal asignado: ${autoPin}`);
    }
    onUpdate(updatedList);
    setIsModalOpen(false);
  };

  const handleTerminate = () => {
    if (!viewingEmp) return;
    const updated = employees.map(e => e.id === viewingEmp.id ? { 
      ...e, 
      status: 'terminated', 
      terminationDate: termForm.date,
      terminationReason: termForm.reason,
      terminationDetails: termForm.details
    } as Employee : e);
    onUpdate(updated);
    setIsTermModalOpen(false);
    setViewingEmp(null);
    alert("Colaborador desvinculado del sistema.");
  };

  const handleAddAbsence = () => {
    if (!viewingEmp || !absenceForm.reason) return;
    const newAbsence: AbsenceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      ...absenceForm
    } as AbsenceRecord;
    
    const updated = employees.map(e => e.id === viewingEmp.id ? { 
      ...e, 
      absences: [...(e.absences || []), newAbsence]
    } : e);
    
    onUpdate(updated);
    setIsAbsenceModalOpen(false);
    setAbsenceForm({ type: 'Falta', date: new Date().toISOString().split('T')[0], reason: '', justified: false });
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex justify-between items-center no-print">
        <h2 className="text-xl font-[950] text-slate-900 tracking-tighter uppercase">Gestión de Talento Humano</h2>
        <div className="flex gap-3">
          <input 
            type="text" 
            placeholder="Buscar por apellido..." 
            className="p-3 border rounded-xl text-xs uppercase font-bold" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
          />
          <button onClick={() => { setForm(initialForm); setEditingEmp(null); setIsModalOpen(true); }} className="px-8 py-4 bg-blue-700 text-white font-black rounded-2xl shadow-lg uppercase text-[10px] tracking-widest active:scale-95 transition-all">Nuevo Registro</button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden no-print">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4">Colaborador</th>
              <th className="px-6 py-4">Género / Estado Civil</th>
              <th className="px-6 py-4">Cargo / Sueldo</th>
              <th className="px-6 py-4 text-center">Estatus</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-[11px] font-black uppercase">
            {employees.filter(e => (e.surname + " " + e.name).toLowerCase().includes(searchTerm.toLowerCase())).map(emp => (
              <tr key={emp.id} className="hover:bg-blue-50/40 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border flex items-center justify-center shrink-0">
                      {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : <span className="text-lg">👤</span>}
                    </div>
                    <div>
                      <p className="text-slate-900 leading-tight">{emp.surname} {emp.name}</p>
                      <p className="text-[8px] text-slate-400 tracking-widest font-bold">{emp.identification}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3">
                  <p className="text-slate-700 text-[10px]">{emp.gender}</p>
                  <p className="text-slate-400 text-[8px]">{emp.civilStatus}</p>
                </td>
                <td className="px-6 py-3">
                  <p className="text-slate-700 text-[10px]">{emp.role}</p>
                  <p className="text-blue-600 text-[9px]">${emp.salary.toFixed(2)}</p>
                </td>
                <td className="px-6 py-3 text-center">
                  <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {emp.status === 'active' ? 'Activo' : 'Desvinculado'}
                  </span>
                </td>
                <td className="px-6 py-3 text-right flex gap-2 justify-end">
                   <button onClick={() => setViewingEmp(emp)} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[8px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">Ver Ficha</button>
                   {role === Role.SUPER_ADMIN && <button onClick={() => { setEditingEmp(emp); setForm(emp); setIsModalOpen(true); }} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[8px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all">Editar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEmp ? "Actualizar Expediente" : "Nuevo Registro Personal"}>
         <div className="space-y-6 max-h-[75vh] overflow-y-auto px-2 custom-scroll">
            {/* Sección 1: Datos Personales */}
            <div className="border-b pb-4">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">I. Datos de Identidad</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Nombres*</label>
                     <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.name} onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} />
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Apellidos*</label>
                     <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.surname} onChange={e => setForm({...form, surname: e.target.value.toUpperCase()})} />
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Cédula*</label>
                     <input maxLength={10} className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.identification} onChange={e => setForm({...form, identification: e.target.value.replace(/\D/g,'')})} />
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Fecha Nacimiento</label>
                     <input type="date" className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} />
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Sexo</label>
                     <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.gender} onChange={e => setForm({...form, gender: e.target.value as Gender})}>
                        {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Estado Civil</label>
                     <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.civilStatus} onChange={e => setForm({...form, civilStatus: e.target.value as CivilStatus})}>
                        {Object.values(CivilStatus).map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Origen/Nacionalidad</label>
                     <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.origin} onChange={e => setForm({...form, origin: e.target.value.toUpperCase()})} />
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Tipo Sangre</label>
                     <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.bloodType} onChange={e => setForm({...form, bloodType: e.target.value as BloodType})}>
                        {Object.values(BloodType).map(b => <option key={b} value={b}>{b}</option>)}
                     </select>
                  </div>
               </div>
            </div>

            {/* Sección 2: Contacto */}
            <div className="border-b pb-4">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">II. Contacto y Ubicación</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Teléfono Móvil</label>
                     <input maxLength={10} className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.phone} onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g,'')})} />
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Correo Electrónico</label>
                     <input type="email" className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.email} onChange={e => setForm({...form, email: e.target.value.toLowerCase()})} />
                  </div>
                  <div className="col-span-2">
                     <label className="text-[9px] font-black text-slate-400 uppercase">Dirección Domiciliaria</label>
                     <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.address} onChange={e => setForm({...form, address: e.target.value.toUpperCase()})} />
                  </div>
               </div>
            </div>

            {/* Sección 3: Laboral */}
            <div className="border-b pb-4">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">III. Información Laboral y Afiliación</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Fecha de Ingreso</label>
                     <input type="date" className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Cargo / Rol</label>
                     <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.role} onChange={e => setForm({...form, role: e.target.value as Role})}>
                        {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Sueldo Base*</label>
                     <input type="number" step="0.01" className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} />
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                     <input type="checkbox" className="w-4 h-4" checked={form.isFixed} onChange={e => setForm({...form, isFixed: e.target.checked})} />
                     <label className="text-[10px] font-black text-slate-600 uppercase">¿Sueldo Fijo?</label>
                  </div>
                  <div className="flex items-center gap-2">
                     <input type="checkbox" className="w-4 h-4" checked={form.isAffiliated} onChange={e => setForm({...form, isAffiliated: e.target.checked})} />
                     <label className="text-[10px] font-black text-slate-600 uppercase">¿Afiliado IESS?</label>
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Fondos de Reserva</label>
                     <select 
                       disabled={!form.isAffiliated}
                       className="w-full border-2 p-3 rounded-xl text-xs font-black disabled:opacity-30" 
                       value={form.overSalaryType} 
                       onChange={e => setForm({...form, overSalaryType: e.target.value as any})}
                     >
                        <option value="monthly">Pago Mensual</option>
                        <option value="accumulate">Acumular</option>
                        <option value="none">No aplica</option>
                     </select>
                  </div>
               </div>
            </div>

            {/* Sección 4: Bancaria */}
            <div className="border-b pb-4">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">IV. Información Bancaria</h4>
               <div className="grid grid-cols-3 gap-4">
                  <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase">IFI / Banco</label>
                      <input className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.bankInfo?.ifi} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, ifi: e.target.value}})} />
                  </div>
                  <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase">Tipo</label>
                      <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.bankInfo?.type} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, type: e.target.value as any}})}>
                         <option value="Ahorros">Ahorros</option>
                         <option value="Corriente">Corriente</option>
                      </select>
                  </div>
                  <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase">N# Cuenta</label>
                      <input className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.bankInfo?.account} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, account: e.target.value}})} />
                  </div>
               </div>
            </div>

            {/* Sección 5: Emergencia */}
            <div className="border-b pb-4">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">V. Contacto de Emergencia</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Nombre Completo</label>
                     <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.emergencyContact?.name} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, name: e.target.value.toUpperCase()}})} />
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Teléfono Contacto</label>
                     <input maxLength={10} className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.emergencyContact?.phone} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, phone: e.target.value.replace(/\D/g,'')}})} />
                  </div>
               </div>
            </div>

            <div className="col-span-2">
               <label className="text-[9px] font-black text-slate-400 uppercase">Foto de Perfil</label>
               <input type="file" accept="image/*" onChange={handlePhotoUpload} className="w-full text-[9px] mt-2" />
               {form.photo && <div className="mt-2 w-20 h-20 rounded-xl overflow-hidden border"><img src={form.photo} className="w-full h-full object-cover" /></div>}
            </div>

            <div className="pt-6 no-print">
               <button onClick={handleSave} className="w-full py-5 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all">Sincronizar Expediente</button>
            </div>
         </div>
      </Modal>

      {/* Ficha Completa del Empleado (Vista previa) */}
      <Modal isOpen={!!viewingEmp} onClose={() => setViewingEmp(null)} title="Ficha Técnica Institucional">
         {viewingEmp && (
            <div className="space-y-8 max-h-[85vh] overflow-y-auto px-4 custom-scroll">
               <header className="flex gap-8 items-start border-b pb-8">
                  <div className="w-32 h-32 bg-slate-100 rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl shrink-0">
                    {viewingEmp.photo ? <img src={viewingEmp.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl bg-slate-200">👤</div>}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-3xl font-[950] text-slate-900 uppercase tracking-tighter leading-none mb-2">{viewingEmp.name} {viewingEmp.surname}</h3>
                    <div className="flex gap-4">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black uppercase">{viewingEmp.role}</span>
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${viewingEmp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{viewingEmp.status === 'active' ? 'Activo' : 'Desvinculado'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-6 text-[10px] font-black uppercase text-slate-500">
                       <p>Cédula: <span className="text-slate-900">{viewingEmp.identification}</span></p>
                       <p>Género: <span className="text-slate-900">{viewingEmp.gender}</span></p>
                       <p>Estado Civil: <span className="text-slate-900">{viewingEmp.civilStatus}</span></p>
                       <p>Nacionalidad: <span className="text-slate-900">{viewingEmp.origin}</span></p>
                       <p>Ingreso: <span className="text-slate-900">{viewingEmp.startDate}</span></p>
                       <p>Sangre: <span className="text-slate-900 font-bold text-red-600">{viewingEmp.bloodType}</span></p>
                    </div>
                  </div>
               </header>

               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                     <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Información de Contacto</h4>
                     <p className="text-[10px] font-bold uppercase">Tel: {viewingEmp.phone || 'N/A'}</p>
                     <p className="text-[10px] font-bold lowercase">{viewingEmp.email || 'N/A'}</p>
                     <p className="text-[10px] font-bold uppercase">{viewingEmp.address || 'N/A'}</p>
                  </div>
                  <div className="space-y-2">
                     <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Cuenta de Nómina</h4>
                     <p className="text-[10px] font-bold uppercase">{viewingEmp.bankInfo?.ifi}</p>
                     <p className="text-[10px] font-bold uppercase">{viewingEmp.bankInfo?.type}</p>
                     <p className="text-[10px] font-bold uppercase">#{viewingEmp.bankInfo?.account}</p>
                  </div>
               </div>

               <section className="space-y-6">
                  <div className="flex justify-between items-center border-b pb-4">
                     <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Historial de Novedades</h4>
                     <button onClick={() => setIsAbsenceModalOpen(true)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 no-print">Reportar Novedad</button>
                  </div>
                  <div className="grid gap-3">
                     {viewingEmp.absences?.length === 0 ? (
                        <p className="text-[10px] text-slate-400 uppercase italic py-4 text-center border-2 border-dashed rounded-2xl">Sin novedades registradas.</p>
                     ) : (
                        viewingEmp.absences?.map(abs => (
                           <div key={abs.id} className="p-4 bg-slate-50 rounded-2xl border flex justify-between items-center">
                              <div>
                                 <p className="text-[10px] font-black uppercase text-slate-900">{abs.type} - {abs.date}</p>
                                 <p className="text-[9px] text-slate-500 italic mt-1">{abs.reason}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${abs.justified ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>{abs.justified ? 'Justificado' : 'No Justificado'}</span>
                           </div>
                        ))
                     )}
                  </div>
               </section>

               <div className="flex gap-4 pt-8 no-print border-t">
                  <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl">Imprimir Ficha</button>
                  {viewingEmp.status === 'active' && role === Role.SUPER_ADMIN && (
                     <button onClick={() => setIsTermModalOpen(true)} className="flex-1 py-4 bg-red-50 text-red-600 border-2 border-red-100 font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-red-600 hover:text-white transition-all">Desvincular Personal</button>
                  )}
               </div>
            </div>
         )}
      </Modal>

      {/* Modales de Desvinculación y Novedades */}
      <Modal isOpen={isTermModalOpen} onClose={() => setIsTermModalOpen(false)} title="Terminación Laboral" type="warning">
         <div className="space-y-4">
            <p className="text-xs text-slate-500 text-center font-medium italic">Se registrará la salida definitiva del colaborador.</p>
            <div>
               <label className="text-[9px] font-black uppercase text-slate-400">Motivo Legal</label>
               <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={termForm.reason} onChange={e => setTermForm({...termForm, reason: e.target.value as TerminationReason})}>
                  {Object.values(TerminationReason).map(r => <option key={r} value={r}>{r}</option>)}
               </select>
            </div>
            <div>
               <label className="text-[9px] font-black uppercase text-slate-400">Fecha de Salida</label>
               <input type="date" className="w-full border-2 p-3 rounded-xl text-xs font-black" value={termForm.date} onChange={e => setTermForm({...termForm, date: e.target.value})} />
            </div>
            <button onClick={handleTerminate} className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl">Confirmar Desvinculación</button>
         </div>
      </Modal>

      <Modal isOpen={isAbsenceModalOpen} onClose={() => setIsAbsenceModalOpen(false)} title="Reportar Novedad">
         <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="text-[9px] font-black uppercase text-slate-400">Tipo Novedad</label>
                  <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={absenceForm.type} onChange={e => setAbsenceForm({...absenceForm, type: e.target.value as any})}>
                     <option value="Falta">Falta</option>
                     <option value="Permiso">Permiso</option>
                     <option value="Atraso">Atraso</option>
                  </select>
               </div>
               <div>
                  <label className="text-[9px] font-black uppercase text-slate-400">Fecha</label>
                  <input type="date" className="w-full border-2 p-3 rounded-xl text-xs font-black" value={absenceForm.date} onChange={e => setAbsenceForm({...absenceForm, date: e.target.value})} />
               </div>
            </div>
            <div>
               <label className="text-[9px] font-black uppercase text-slate-400">Justificación</label>
               <textarea className="w-full border-2 p-3 rounded-xl text-xs font-black h-20" value={absenceForm.reason} onChange={e => setAbsenceForm({...absenceForm, reason: e.target.value})}></textarea>
            </div>
            <button onClick={handleAddAbsence} className="w-full py-4 bg-blue-700 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl">Guardar Novedad</button>
         </div>
      </Modal>
    </div>
  );
};

export default EmployeeModule;