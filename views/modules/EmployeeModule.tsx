
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  
  const [selectedEmpAction, setSelectedEmpAction] = useState<Employee | null>(null);
  const [isNovedadModalOpen, setIsNovedadModalOpen] = useState(false);
  const [isDesvinculacionModalOpen, setIsDesvinculacionModalOpen] = useState(false);
  
  const [novedadText, setNovedadText] = useState('');
  const [desvinculacionData, setDesvinculacionData] = useState({
    date: new Date().toISOString().split('T')[0],
    reason: TerminationReason.VOLUNTARY,
    details: ''
  });

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
    isFixed: true, isAffiliated: true, 
    overSalaryType: 'monthly', 
    reserveFundType: 'monthly', 
    bankInfo: { ifi: '', type: 'Ahorros', account: '' },
    absences: [],
    observations: []
  };

  const [form, setForm] = useState<Partial<Employee>>(initialForm);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setFeedback({ isOpen: true, title: "Error", message: "La imagen no debe superar los 2MB.", type: "error" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    // Validación estricta y obligatoria de campos
    if (
      !form.name || !form.surname || !form.identification || !form.salary || 
      !form.birthDate || !form.gender || !form.civilStatus || !form.address || 
      !form.email || !form.emergencyContact?.name || !form.emergencyContact?.phone || 
      !form.startDate
    ) {
      setFeedback({ 
        isOpen: true, 
        title: "Faltan datos obligatorios", 
        message: "Debe completar: Fecha de nacimiento, Sexo, Estado civil, Dirección, Correo, Datos de emergencia y Fecha de ingreso.", 
        type: "error" 
      });
      return;
    }

    let updatedList: Employee[];
    if (editingEmp) {
      updatedList = employees.map(e => e.id === editingEmp.id ? { ...e, ...form } as Employee : e);
      setFeedback({ isOpen: true, title: "Éxito", message: "Colaborador actualizado correctamente.", type: "success" });
    } else {
      const autoPin = Math.floor(100000 + Math.random() * 900000).toString();
      const newEmp: Employee = { 
        ...form, 
        id: Math.random().toString(36).substr(2, 9), 
        pin: autoPin, 
        pinChanged: false, 
        pinNeedsReset: false, 
        status: 'active' as const 
      } as Employee;
      updatedList = [...employees, newEmp];
      setFeedback({ isOpen: true, title: "Registro Exitoso", message: `Empleado registrado. PIN: ${autoPin}`, type: "success" });
    }
    onUpdate(updatedList);
    setIsModalOpen(false);
  };

  const handleAddNovedad = () => {
    if (!novedadText.trim() || !selectedEmpAction) return;
    const newNovedad = { date: new Date().toISOString(), text: novedadText.toUpperCase() };
    const updated = employees.map(e => e.id === selectedEmpAction.id ? {
      ...e,
      observations: [newNovedad, ...(e.observations || [])]
    } : e);
    onUpdate(updated);
    setNovedadText('');
    setIsNovedadModalOpen(false);
    setFeedback({ isOpen: true, title: "Novedad Guardada", message: "Se ha registrado la novedad en el historial.", type: "success" });
  };

  const handleProcessDesvinculacion = () => {
    if (!selectedEmpAction) return;
    const updated = employees.map(e => e.id === selectedEmpAction.id ? {
      ...e,
      status: 'terminated' as const,
      terminationDate: desvinculacionData.date,
      terminationReason: desvinculacionData.reason,
      terminationDetails: desvinculacionData.details.toUpperCase()
    } : e);
    onUpdate(updated);
    setIsDesvinculacionModalOpen(false);
    setFeedback({ isOpen: true, title: "Baja Procesada", message: "El empleado ha sido desvinculado.", type: "success" });
  };

  const filteredEmployees = employees.filter(e => {
    const searchString = `${e.name} ${e.surname} ${e.identification}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    return showArchived ? matchesSearch && e.status !== 'active' : matchesSearch && e.status === 'active';
  });

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border flex flex-col md:flex-row justify-between items-center no-print gap-6">
        <div>
          <h2 className="text-2xl font-[950] text-slate-900 uppercase italic leading-none">Gestión de Personal</h2>
          <div className="flex gap-6 mt-3">
            <button onClick={() => setShowArchived(false)} className={`text-[10px] font-black uppercase tracking-widest ${!showArchived ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Activos</button>
            <button onClick={() => setShowArchived(true)} className={`text-[10px] font-black uppercase tracking-widest ${showArchived ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Bajas</button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <input type="text" placeholder="Buscar empleado..." className="w-full sm:w-64 p-3 border-2 rounded-xl text-[11px] font-bold uppercase outline-none focus:border-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <button onClick={() => { setForm(initialForm); setEditingEmp(null); setIsModalOpen(true); }} className="px-8 py-4 bg-blue-700 text-white font-black rounded-xl shadow-lg uppercase text-[10px] tracking-widest active:scale-95 transition-all">Registrar Nuevo</button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden no-print">
        <div className="table-responsive">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-5">Colaborador / ID</th>
                <th className="px-6 py-5">Cargo</th>
                <th className="px-6 py-5 text-center">Estado</th>
                <th className="px-6 py-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y text-[11px] font-black uppercase">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl overflow-hidden border flex items-center justify-center">
                           {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : <span className="text-slate-400">👤</span>}
                        </div>
                        <div>
                           <p className="text-slate-900 leading-none">{emp.surname} {emp.name}</p>
                           <p className="text-[9px] text-slate-400 font-mono mt-1">{emp.identification}</p>
                        </div>
                     </div>
                  </td>
                  <td className="px-6 py-4"><p className="text-blue-600">{emp.role}</p><p className="text-[9px] text-slate-400 mt-1">Ingreso: {emp.startDate}</p></td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setEditingEmp(emp); setForm(emp); setIsModalOpen(true); }} className="p-2.5 bg-slate-100 text-slate-600 rounded-lg shadow-sm">✏️</button>
                      <button onClick={() => { setSelectedEmpAction(emp); setIsNovedadModalOpen(true); }} className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shadow-sm">📝</button>
                      {emp.status === 'active' && (
                        <button onClick={() => { setSelectedEmpAction(emp); setIsDesvinculacionModalOpen(true); }} className="p-2.5 bg-red-50 text-red-600 rounded-lg shadow-sm">🚪</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORMULARIO ESTRICTO */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEmp ? "Actualizar Expediente" : "Registrar empleado"} maxWidth="max-w-4xl">
        <div className="space-y-8 max-h-[75vh] overflow-y-auto pr-2 custom-scroll pb-6">
          <div className="flex flex-col md:flex-row gap-6 items-center bg-slate-50 p-6 rounded-[2rem] border">
             <div className="relative w-32 h-32 bg-white rounded-3xl border-2 border-dashed border-blue-200 flex items-center justify-center overflow-hidden shadow-inner group">
                {form.photo ? <img src={form.photo} className="w-full h-full object-cover" /> : <span className="text-3xl opacity-20">📸</span>}
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handlePhotoUpload} />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[8px] font-black uppercase pointer-events-none text-center p-2">Click para subir foto</div>
             </div>
             <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase">Nombres</label>
                   <input className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase focus:border-blue-500 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase">Apellidos</label>
                   <input className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase focus:border-blue-500 outline-none" value={form.surname} onChange={e => setForm({...form, surname: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase">Identificación (CI/RUC)</label>
                   <input className="w-full p-3 border-2 rounded-xl text-xs font-mono font-black focus:border-blue-500 outline-none" value={form.identification} onChange={e => setForm({...form, identification: e.target.value.replace(/\D/g,'')})} />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase">Sueldo Base ($)</label>
                   <input type="number" step="0.01" className="w-full p-3 border-2 rounded-xl text-lg font-black focus:border-blue-500 outline-none" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} />
                </div>
             </div>
          </div>

          <section className="space-y-4">
             <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest border-b pb-1">Datos Personales Obligatorios</h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Fecha de Nacimiento</label>
                  <input type="date" className="w-full p-3 border-2 rounded-xl text-xs font-bold" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Sexo</label>
                  <select className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase" value={form.gender} onChange={e => setForm({...form, gender: e.target.value as any})}>
                    {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Estado Civil</label>
                  <select className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase" value={form.civilStatus} onChange={e => setForm({...form, civilStatus: e.target.value as any})}>
                    {Object.values(CivilStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase">Correo Electrónico</label>
                   <input type="email" className="w-full p-3 border-2 rounded-xl text-xs font-bold" placeholder="email@institucional.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Dirección de Domicilio</label>
                  <input className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase" placeholder="Calle principal, secundaria y # casa" value={form.address} onChange={e => setForm({...form, address: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase font-bold text-blue-600">Fecha de Ingreso</label>
                  <input type="date" className="w-full p-3 border-2 border-blue-200 rounded-xl text-xs font-bold" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Cargo</label>
                  <select className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase" value={form.role} onChange={e => setForm({...form, role: e.target.value as any})}>
                    {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase">Tipo de Sangre</label>
                   <select className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase" value={form.bloodType} onChange={e => setForm({...form, bloodType: e.target.value as any})}>
                      {Object.values(BloodType).map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                </div>
             </div>
          </section>

          <section className="space-y-4">
             <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest border-b pb-1">Contacto de Emergencia</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Persona de Contacto</label>
                  <input className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase" placeholder="Nombre completo del contacto" value={form.emergencyContact?.name} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, name: e.target.value.toUpperCase()}})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Teléfono de Emergencia</label>
                  <input className="w-full p-3 border-2 rounded-xl text-xs font-bold" placeholder="EJ: 0999999999" value={form.emergencyContact?.phone} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, phone: e.target.value.replace(/\D/g,'')}})} />
                </div>
             </div>
          </section>

          <section className="space-y-4 border-t pt-6">
             <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest border-b pb-1">Seguridad Social</h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="p-4 bg-slate-50 rounded-2xl border flex items-center justify-between">
                   <span className="text-[10px] font-black uppercase text-slate-600">Afiliación IESS</span>
                   <button onClick={() => setForm({...form, isAffiliated: !form.isAffiliated})} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isAffiliated ? 'bg-blue-600' : 'bg-slate-300'}`}>
                     <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isAffiliated ? 'translate-x-6' : 'translate-x-1'}`} />
                   </button>
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Fondos de Reserva</label>
                    <select className="w-full p-3 border-2 rounded-xl text-[10px] font-black uppercase" value={form.reserveFundType || 'monthly'} onChange={e => setForm({...form, reserveFundType: e.target.value as any})}>
                      <option value="monthly">Mensualizar</option>
                      <option value="accumulate">Acumular</option>
                      <option value="none">No aplica</option>
                    </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Décimos Sueldos</label>
                  <select className="w-full p-3 border-2 rounded-xl text-[10px] font-black uppercase" value={form.overSalaryType} onChange={e => setForm({...form, overSalaryType: e.target.value as any})}>
                    <option value="monthly">Mensualizar</option>
                    <option value="accumulate">Acumular</option>
                    <option value="none">No Aplica</option>
                  </select>
                </div>
             </div>
          </section>

          <button onClick={handleSave} className="w-full py-5 bg-blue-700 text-white font-[950] rounded-2xl uppercase text-[11px] tracking-[0.3em] shadow-2xl active:scale-95 transition-all">Registrar empleado</button>
        </div>
      </Modal>

      {/* FEEDBACK */}
      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
        <div className="text-center p-6">
          <p className="text-[11px] font-black uppercase text-slate-600 leading-relaxed italic">{feedback.message}</p>
          <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] mt-8 active:scale-95 transition-all tracking-widest shadow-lg">Entendido</button>
        </div>
      </Modal>

      {/* NOVEDADES Y DESVINCULACION */}
      <Modal isOpen={isNovedadModalOpen} onClose={() => setIsNovedadModalOpen(false)} title="Bitácora Administrativa">
         <div className="space-y-4">
            <textarea className="w-full border-2 p-4 rounded-xl text-xs font-bold uppercase focus:border-blue-500 outline-none min-h-[140px]" placeholder="Escriba la novedad..." value={novedadText} onChange={e => setNovedadText(e.target.value)} />
            <button onClick={handleAddNovedad} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg">Guardar Novedad</button>
         </div>
      </Modal>

      <Modal isOpen={isDesvinculacionModalOpen} onClose={() => setIsDesvinculacionModalOpen(false)} title="Dar de baja empleado" type="error">
         <div className="space-y-6">
            <div className="space-y-4">
               <input type="date" className="w-full border-2 p-3 rounded-xl text-xs font-bold" value={desvinculacionData.date} onChange={e => setDesvinculacionData({...desvinculacionData, date: e.target.value})} />
               <select className="w-full border-2 p-3 rounded-xl text-xs font-bold uppercase" value={desvinculacionData.reason} onChange={e => setDesvinculacionData({...desvinculacionData, reason: e.target.value as any})}>
                  {Object.values(TerminationReason).map(v => <option key={v} value={v}>{v}</option>)}
               </select>
               <textarea className="w-full border-2 p-3 rounded-xl text-xs font-bold uppercase h-24 focus:border-red-600 outline-none" placeholder="Observaciones finales..." value={desvinculacionData.details} onChange={e => setDesvinculacionData({...desvinculacionData, details: e.target.value})} />
            </div>
            <div className="flex gap-4">
               <button onClick={() => setIsDesvinculacionModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-xl uppercase text-[10px]">Cancelar</button>
               <button onClick={handleProcessDesvinculacion} className="flex-1 py-4 bg-red-600 text-white font-black rounded-xl uppercase text-[10px] shadow-xl">Confirmar Baja</button>
            </div>
         </div>
      </Modal>
    </div>
  );
};

export default EmployeeModule;
