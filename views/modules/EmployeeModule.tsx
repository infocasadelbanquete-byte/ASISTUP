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
  const [feedback, setFeedback] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info'}>({
    isOpen: false, title: '', message: '', type: 'info'
  });
  
  const [hasBankInfo, setHasBankInfo] = useState(true);

  const initialForm: Partial<Employee> = {
    name: '', surname: '', identification: '', birthDate: '', phone: '', email: '', 
    gender: Gender.MASCULINO, civilStatus: CivilStatus.SOLTERO,
    origin: 'ECUATORIANA', address: '', 
    bloodType: BloodType.O_POS, startDate: new Date().toISOString().split('T')[0],
    role: Role.EMPLOYEE, salary: 482.00, status: 'active', photo: '', pin: '',
    emergencyContact: { name: '', phone: '' },
    isFixed: true, isAffiliated: true, overSalaryType: 'monthly',
    bankInfo: { ifi: '', type: 'Ahorros', account: '' },
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
      setFeedback({ isOpen: true, title: "Error de Validación", message: "Nombres, apellidos y cédula son obligatorios.", type: "error" });
      return;
    }

    const finalForm = { ...form };
    if (!hasBankInfo) {
      finalForm.bankInfo = { ifi: 'NO APLICA', type: 'Ahorros', account: 'N/A' };
    }

    let updatedList;
    if (editingEmp) {
      updatedList = employees.map(e => e.id === editingEmp.id ? { ...e, ...finalForm } as Employee : e);
      setFeedback({ isOpen: true, title: "Éxito", message: "Expediente actualizado correctamente.", type: "success" });
    } else {
      const autoPin = Math.floor(100000 + Math.random() * 900000).toString();
      const newEmp = { 
        ...finalForm, 
        id: Math.random().toString(36).substr(2, 9), 
        pin: autoPin,
        pinChanged: false,
        pinNeedsReset: false,
        absences: [],
        observations: [],
        totalHoursWorked: 0
      } as Employee;
      updatedList = [...employees, newEmp];
      setFeedback({ isOpen: true, title: "Registro Exitoso", message: `Colaborador registrado. PIN Temporal: ${autoPin}`, type: "success" });
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
    setFeedback({ isOpen: true, title: "Aviso", message: "El colaborador ha sido desvinculado.", type: "success" });
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
    setFeedback({ isOpen: true, title: "Confirmación", message: "Novedad registrada en el historial.", type: "success" });
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
          <button onClick={() => { setForm(initialForm); setEditingEmp(null); setHasBankInfo(true); setIsModalOpen(true); }} className="px-8 py-4 bg-blue-700 text-white font-black rounded-2xl shadow-lg uppercase text-[10px] tracking-widest active:scale-95 transition-all">Nuevo Registro</button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden no-print">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4">Colaborador</th>
              <th className="px-6 py-4">Cédula</th>
              <th className="px-6 py-4">Género / Cargo</th>
              <th className="px-6 py-4 text-center">Estatus</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-[11px] font-black uppercase">
            {employees.filter(e => (e.surname + " " + e.name).toLowerCase().includes(searchTerm.toLowerCase())).map(emp => (
              <tr key={emp.id} className="hover:bg-blue-50/40 transition-colors">
                <td className="px-6 py-3 font-black text-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg overflow-hidden border">
                      {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : <div className="bg-slate-100 w-full h-full flex items-center justify-center text-[10px]">👤</div>}
                    </div>
                    <span>{emp.surname} {emp.name}</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-[10px] font-mono">{emp.identification}</td>
                <td className="px-6 py-3">
                  <p className="text-slate-700 text-[10px]">{emp.gender}</p>
                  <p className="text-blue-600 text-[9px] uppercase">{emp.role}</p>
                </td>
                <td className="px-6 py-3 text-center">
                  <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {emp.status === 'active' ? 'Activo' : 'Desvinculado'}
                  </span>
                </td>
                <td className="px-6 py-3 text-right flex gap-2 justify-end">
                   <button onClick={() => setViewingEmp(emp)} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[8px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">Ver Ficha</button>
                   {role === Role.SUPER_ADMIN && <button onClick={() => { setEditingEmp(emp); setForm(emp); setHasBankInfo(emp.bankInfo?.ifi !== 'NO APLICA'); setIsModalOpen(true); }} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[8px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all">Editar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEmp ? "Actualizar Expediente" : "Nuevo Registro Personal"}>
         <div className="space-y-6 max-h-[75vh] overflow-y-auto px-2 custom-scroll">
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
               </div>
            </div>

            <div className="border-b pb-4">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">II. Ubicación y Contacto</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                     <label className="text-[9px] font-black text-slate-400 uppercase">Dirección de Domicilio</label>
                     <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.address} onChange={e => setForm({...form, address: e.target.value.toUpperCase()})} />
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Teléfono Móvil</label>
                     <input maxLength={10} className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.phone} onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g,'')})} />
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Correo Electrónico</label>
                     <input type="email" className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.email} onChange={e => setForm({...form, email: e.target.value.toLowerCase()})} />
                  </div>
               </div>
            </div>

            <div className="border-b pb-4">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">III. Información Laboral</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Fecha de Ingreso</label>
                     <input type="date" className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Sueldo Base*</label>
                     <input type="number" step="0.01" className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} />
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Cargo / Rol</label>
                     <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.role} onChange={e => setForm({...form, role: e.target.value as Role})}>
                        {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                     </select>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                     <input type="checkbox" className="w-4 h-4" checked={form.isAffiliated} onChange={e => setForm({...form, isAffiliated: e.target.checked})} />
                     <label className="text-[10px] font-black text-slate-600 uppercase">Afiliación IESS</label>
                  </div>
               </div>
            </div>

            <div className="border-b pb-4">
               <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">IV. Información Bancaria</h4>
                  <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                     <input type="checkbox" id="hasBank" checked={hasBankInfo} onChange={(e) => setHasBankInfo(e.target.checked)} className="w-4 h-4" />
                     <label htmlFor="hasBank" className="text-[9px] font-black uppercase text-blue-700 cursor-pointer">Aplica información bancaria</label>
                  </div>
               </div>
               <div className={`grid grid-cols-3 gap-4 transition-opacity ${!hasBankInfo ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                  <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase">IFI / Banco</label>
                      <input disabled={!hasBankInfo} className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.bankInfo?.ifi} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, ifi: e.target.value}})} />
                  </div>
                  <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase">Tipo</label>
                      <select disabled={!hasBankInfo} className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.bankInfo?.type} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, type: e.target.value as any}})}>
                         <option value="Ahorros">Ahorros</option>
                         <option value="Corriente">Corriente</option>
                      </select>
                  </div>
                  <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase">N# Cuenta</label>
                      <input disabled={!hasBankInfo} className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.bankInfo?.account} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, account: e.target.value}})} />
                  </div>
               </div>
            </div>

            <div className="border-b pb-4">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">V. Contacto de Emergencia</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Nombre Completo</label>
                     <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.emergencyContact?.name} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, name: e.target.value.toUpperCase()}})} />
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase">Teléfono Móvil</label>
                     <input maxLength={10} className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.emergencyContact?.phone} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, phone: e.target.value.replace(/\D/g,'')}})} />
                  </div>
               </div>
            </div>

            <div className="border-b pb-4">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">VI. Fotografía de Perfil</h4>
               <div className="space-y-4">
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="block w-full text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                  {form.photo && (
                    <div className="w-20 h-20 rounded-xl overflow-hidden border">
                      <img src={form.photo} alt="Vista previa" className="w-full h-full object-cover" />
                    </div>
                  )}
               </div>
            </div>

            <div className="pt-6 no-print">
               <button onClick={handleSave} className="w-full py-5 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all">Sincronizar Expediente</button>
            </div>
         </div>
      </Modal>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
          <div className="text-center space-y-6">
              <p className="text-slate-600 font-bold uppercase text-[12px]">{feedback.message}</p>
              <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest">Aceptar</button>
          </div>
      </Modal>

      {/* Ver Ficha Detalle */}
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
                  </div>
               </header>
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                     <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Identidad y Contacto</h4>
                     <p className="text-[10px] font-bold">Cédula: {viewingEmp.identification}</p>
                     <p className="text-[10px] font-bold">Tel: {viewingEmp.phone}</p>
                     <p className="text-[10px] font-bold">Email: {viewingEmp.email}</p>
                     <p className="text-[10px] font-bold">Dirección: {viewingEmp.address}</p>
                  </div>
                  <div className="space-y-2">
                     <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Cuenta de Nómina</h4>
                     {viewingEmp.bankInfo?.ifi === 'NO APLICA' ? (
                        <p className="text-[10px] font-bold uppercase text-slate-400 italic">No aplica información bancaria.</p>
                     ) : (
                        <>
                           <p className="text-[10px] font-bold uppercase">{viewingEmp.bankInfo?.ifi}</p>
                           <p className="text-[10px] font-bold uppercase">{viewingEmp.bankInfo?.type} #{viewingEmp.bankInfo?.account}</p>
                        </>
                     )}
                  </div>
               </div>
               <div className="flex gap-4 pt-8 no-print border-t">
                  <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest">Imprimir Ficha</button>
                  {viewingEmp.status === 'active' && role === Role.SUPER_ADMIN && (
                     <button onClick={() => setIsTermModalOpen(true)} className="flex-1 py-4 bg-red-50 text-red-600 border-2 border-red-100 font-black rounded-xl uppercase text-[10px] tracking-widest">Desvincular</button>
                  )}
               </div>
            </div>
         )}
      </Modal>

      {/* Modal Desvinculación */}
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
            <button onClick={handleTerminate} className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest">Confirmar</button>
         </div>
      </Modal>
    </div>
  );
};

export default EmployeeModule;