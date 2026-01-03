import React, { useState, useEffect } from 'react';
import { Employee, Role, BloodType, TerminationReason } from '../../types.ts';
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
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [termData, setTermData] = useState({
    date: new Date().toISOString().split('T')[0],
    reason: TerminationReason.VOLUNTARY,
    details: ''
  });

  const initialForm: Partial<Employee> = {
    name: '', surname: '', identification: '', birthDate: '', phone: '', email: '', 
    origin: 'ECUATORIANA', address: '', 
    bloodType: BloodType.O_POS, startDate: new Date().toISOString().split('T')[0],
    role: Role.EMPLOYEE, salary: 482.00, status: 'active', photo: '', pin: '',
    emergencyContact: { name: '', phone: '' },
    isFixed: true, isAffiliated: true, overSalaryType: 'monthly',
    bankInfo: { ifi: 'Banco del Austro', type: 'Ahorros', account: '' }
  };

  const [form, setForm] = useState<Partial<Employee>>(initialForm);

  // Habilitar Escape para cerrar modales del módulo
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
        setViewingEmp(null);
        setIsTermModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

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
    if (!form.name || !form.surname || !form.identification || !form.pin) {
      alert("Los campos marcados con (*) son obligatorios.");
      return;
    }

    let updatedList;
    if (editingEmp) {
      updatedList = employees.map(e => e.id === editingEmp.id ? { ...e, ...form } as Employee : e);
    } else {
      const newEmp = { 
        ...form, 
        id: Math.random().toString(36).substr(2, 9), 
        pinChanges: 0,
        observations: [],
        absences: [],
        totalHoursWorked: 0
      } as Employee;
      updatedList = [...employees, newEmp];
    }
    onUpdate(updatedList);
    setIsModalOpen(false);
  };

  const handleTermination = () => {
    if (!viewingEmp) return;
    const updated = employees.map(e => e.id === viewingEmp.id ? {
      ...e,
      status: 'terminated' as const,
      terminationDate: termData.date,
      terminationReason: termData.reason,
      terminationDetails: termData.details
    } : e);
    onUpdate(updated);
    setIsTermModalOpen(false);
    setViewingEmp(null);
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex justify-between items-center no-print">
        <div>
          <h2 className="text-xl font-[950] text-slate-900 tracking-tighter uppercase">Gestión de Talento</h2>
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">Expedientes Corporativos</p>
        </div>
        <button onClick={() => { setForm(initialForm); setEditingEmp(null); setIsModalOpen(true); }} className="px-8 py-4 bg-blue-700 text-white font-black rounded-2xl shadow-lg uppercase text-[10px] tracking-widest active:scale-95 transition-all">Nuevo Ingreso</button>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden no-print">
        <div className="p-4 bg-slate-50/50 border-b">
          <input type="text" placeholder="Filtrar por apellidos o identificación..." className="w-full bg-white border-2 border-slate-100 p-3 pl-10 rounded-xl text-xs font-black outline-none focus:border-blue-700" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Ficha Colaborador</th>
                <th className="px-6 py-4 text-center">Estatus</th>
                <th className="px-6 py-4 text-right">Expediente</th>
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
                  <td className="px-6 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {emp.status === 'active' ? 'Activo' : 'Liquidado'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                     <button onClick={() => setViewingEmp(emp)} className="px-3 py-1.5 bg-white text-blue-700 rounded-lg border border-slate-100 shadow-sm hover:bg-blue-700 hover:text-white transition-all text-[9px] font-black uppercase">
                       Detalle
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Ficha Detallada */}
      <Modal isOpen={!!viewingEmp} onClose={() => setViewingEmp(null)} title="Expediente Individual">
        {viewingEmp && (
          <div className="space-y-6">
            <div className="flex gap-6 items-center border-b pb-6">
               <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 border-2 border-white shadow-lg flex items-center justify-center text-3xl">
                 {viewingEmp.photo ? <img src={viewingEmp.photo} className="w-full h-full object-cover" /> : '👤'}
               </div>
               <div className="flex-1">
                 <h3 className="text-xl font-[950] text-slate-900 uppercase tracking-tighter">{viewingEmp.name} {viewingEmp.surname}</h3>
                 <p className="text-blue-600 font-black uppercase text-[9px] tracking-widest mt-1">{viewingEmp.role}</p>
                 <div className="flex gap-2 mt-4">
                    <button onClick={() => { setForm(viewingEmp); setEditingEmp(viewingEmp); setIsModalOpen(true); setViewingEmp(null); }} className="px-3 py-1.5 bg-slate-900 text-white font-black text-[8px] uppercase rounded-lg">Editar</button>
                    {viewingEmp.status === 'active' && (
                      <button onClick={() => setIsTermModalOpen(true)} className="px-3 py-1.5 bg-red-100 text-red-600 font-black text-[8px] uppercase rounded-lg">Liquidar</button>
                    )}
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-[10px] font-black uppercase tracking-tight">
               <div className="space-y-2">
                  <p className="text-slate-400 tracking-widest text-[8px] border-b pb-1 mb-2">Datos Laborales</p>
                  <p><span className="text-slate-400">ID Fiscal:</span> {viewingEmp.identification}</p>
                  <p><span className="text-slate-400">Ingreso:</span> {viewingEmp.startDate}</p>
                  <p><span className="text-slate-400">Sueldo:</span> ${viewingEmp.salary}</p>
                  <p><span className="text-slate-400">Contrato:</span> {viewingEmp.isFixed ? 'Fijo' : 'Temporal'}</p>
                  <p><span className="text-slate-400">IESS:</span> {viewingEmp.isAffiliated ? 'Afiliado' : 'No Afiliado'}</p>
               </div>
               <div className="space-y-2">
                  <p className="text-slate-400 tracking-widest text-[8px] border-b pb-1 mb-2">Información de Pago</p>
                  <p><span className="text-slate-400">Banco:</span> {viewingEmp.bankInfo.ifi}</p>
                  <p><span className="text-slate-400">Nro Cuenta:</span> {viewingEmp.bankInfo.account}</p>
                  <p><span className="text-slate-400">Tipo Cta:</span> {viewingEmp.bankInfo.type}</p>
               </div>
               <div className="col-span-2 space-y-2 pt-2">
                  <p className="text-slate-400 tracking-widest text-[8px] border-b pb-1 mb-2">Contactos y Otros</p>
                  <p><span className="text-slate-400">Email:</span> {viewingEmp.email}</p>
                  <p><span className="text-slate-400">Teléfono:</span> {viewingEmp.phone}</p>
                  <p><span className="text-slate-400">Emergencia:</span> {viewingEmp.emergencyContact.name} ({viewingEmp.emergencyContact.phone})</p>
                  <p><span className="text-slate-400">S. O.:</span> {viewingEmp.bloodType}</p>
               </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Registro Completo con Todos los Campos */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEmp ? "Actualizar Expediente" : "Registro de Talento"}>
         <div className="space-y-6 max-h-[75vh] overflow-y-auto px-2 custom-scroll">
            <div className="grid grid-cols-2 gap-4">
               {/* Sección Personal */}
               <div className="col-span-2 text-[10px] font-black uppercase text-blue-600 border-b pb-1">1. Datos Personales</div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Nombres*</label>
                  <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.name} onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} />
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Apellidos*</label>
                  <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.surname} onChange={e => setForm({...form, surname: e.target.value.toUpperCase()})} />
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">ID Fiscal / Cédula*</label>
                  <input maxLength={10} className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.identification} onChange={e => setForm({...form, identification: e.target.value.replace(/\D/g,'')})} />
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">F. Nacimiento</label>
                  <input type="date" className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} />
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Nacionalidad</label>
                  <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.origin} onChange={e => setForm({...form, origin: e.target.value.toUpperCase()})} />
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">T. Sangre</label>
                  <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.bloodType} onChange={e => setForm({...form, bloodType: e.target.value as BloodType})}>
                     {Object.values(BloodType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
               </div>
               <div className="col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Dirección Domiciliaria</label>
                  <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.address} onChange={e => setForm({...form, address: e.target.value.toUpperCase()})} />
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Celular</label>
                  <input className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Email</label>
                  <input type="email" className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.email} onChange={e => setForm({...form, email: e.target.value.toLowerCase()})} />
               </div>

               {/* Emergencia */}
               <div className="col-span-2 text-[10px] font-black uppercase text-blue-600 border-b pb-1 mt-4">2. Contacto de Emergencia</div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Nombre Completo</label>
                  <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.emergencyContact?.name} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, name: e.target.value.toUpperCase()}})} />
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Teléfono de Contacto</label>
                  <input className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.emergencyContact?.phone} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, phone: e.target.value}})} />
               </div>

               {/* Sección Laboral */}
               <div className="col-span-2 text-[10px] font-black uppercase text-blue-600 border-b pb-1 mt-4">3. Parámetros Laborales</div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Cargo / Rol</label>
                  <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.role} onChange={e => setForm({...form, role: e.target.value as Role})}>
                     {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Sueldo Base ($)</label>
                  <input type="number" className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} />
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Fecha de Ingreso</label>
                  <input type="date" className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Tipo Contrato</label>
                  <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.isFixed ? 'fijo' : 'temporal'} onChange={e => setForm({...form, isFixed: e.target.value === 'fijo'})}>
                     <option value="fijo">FIJO (INDEFINIDO)</option>
                     <option value="temporal">TEMPORAL (PLAZO FIJO)</option>
                  </select>
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Afiliación IESS</label>
                  <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.isAffiliated ? 'si' : 'no'} onChange={e => setForm({...form, isAffiliated: e.target.value === 'si'})}>
                     <option value="si">SÍ (AFILIADO)</option>
                     <option value="no">NO (CIVIL)</option>
                  </select>
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Décimos / Fondos</label>
                  <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.overSalaryType} onChange={e => setForm({...form, overSalaryType: e.target.value as any})}>
                     <option value="monthly">MENSUALIZAR</option>
                     <option value="accumulate">ACUMULAR</option>
                     <option value="none">NINGUNO</option>
                  </select>
               </div>

               {/* Sección Bancaria */}
               <div className="col-span-2 text-[10px] font-black uppercase text-blue-600 border-b pb-1 mt-4">4. Configuración de Pago</div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Institución Financiera</label>
                  <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.bankInfo?.ifi} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, ifi: e.target.value.toUpperCase()}})} />
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Tipo de Cuenta</label>
                  <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.bankInfo?.type} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, type: e.target.value as any}})}>
                     <option value="Ahorros">AHORROS</option>
                     <option value="Corriente">CORRIENTE</option>
                  </select>
               </div>
               <div className="col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Número de Cuenta</label>
                  <input className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.bankInfo?.account} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, account: e.target.value}})} />
               </div>

               {/* Sección Seguridad */}
               <div className="col-span-2 text-[10px] font-black uppercase text-blue-600 border-b pb-1 mt-4">5. Seguridad y Acceso</div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Cargar Fotografía</label>
                  <input type="file" accept="image/*" className="w-full text-[9px] font-black mt-1" onChange={handlePhotoUpload} />
                  {form.photo && <p className="text-[8px] text-emerald-600 font-bold uppercase mt-1">✓ Imagen cargada</p>}
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">PIN de Acceso (6 dígitos)*</label>
                  <input maxLength={6} type="password" placeholder="••••••" className="w-full border-2 p-3 rounded-xl text-center text-xl font-black" value={form.pin} onChange={e => setForm({...form, pin: e.target.value.replace(/\D/g,'')})} />
               </div>
            </div>
            <button onClick={handleSave} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl uppercase text-[11px] tracking-widest shadow-2xl active:scale-95 transition-all mt-6">Sincronizar Expediente en Cloud</button>
         </div>
      </Modal>

      {/* Modal: Desvinculación */}
      <Modal isOpen={isTermModalOpen} onClose={() => setIsTermModalOpen(false)} title="Liquidación Laboral" type="error">
         <div className="space-y-6">
            <p className="text-xs font-bold text-red-900 bg-red-50 p-4 rounded-xl">Revocación de privilegios de acceso inmediata tras confirmar.</p>
            <div className="space-y-4">
               <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">Fecha de Salida</label>
                  <input type="date" className="w-full border-2 p-4 rounded-2xl text-xs font-black mt-1" value={termData.date} onChange={e => setTermData({...termData, date: e.target.value})} />
               </div>
               <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">Motivo Legal</label>
                  <select className="w-full border-2 p-4 rounded-2xl text-xs font-black mt-1" value={termData.reason} onChange={e => setTermData({...termData, reason: e.target.value as any})}>
                     {Object.values(TerminationReason).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
               </div>
               <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">Observaciones</label>
                  <textarea className="w-full border-2 p-4 rounded-2xl text-xs font-black mt-1 h-24" placeholder="Detalles del finiquito..." value={termData.details} onChange={e => setTermData({...termData, details: e.target.value})}></textarea>
               </div>
            </div>
            <button onClick={handleTermination} className="w-full py-5 bg-red-600 text-white font-black rounded-3xl uppercase text-[11px] shadow-2xl active:scale-95 transition-all">Confirmar Baja Definitiva</button>
         </div>
      </Modal>
    </div>
  );
};

export default EmployeeModule;