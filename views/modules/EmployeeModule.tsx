import React, { useState } from 'react';
import { Employee, Role, BloodType, TerminationReason, AbsenceRecord } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface EmployeeModuleProps {
  employees: Employee[];
  onUpdate: (employees: Employee[]) => void;
  role: Role;
  attendance: any[];
  payments: any[];
}

const EmployeeModule: React.FC<EmployeeModuleProps> = ({ employees, onUpdate, role }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [viewingEmp, setViewingEmp] = useState<Employee | null>(null);
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const initialForm: Partial<Employee> = {
    name: '', surname: '', identification: '', birthDate: '', origin: '', address: '',
    phone: '', email: '', bloodType: BloodType.O_POS,
    emergencyContact: { name: '', phone: '' }, startDate: new Date().toISOString().split('T')[0],
    role: Role.EMPLOYEE, isFixed: true, salary: 475, isAffiliated: true, overSalaryType: 'accumulate',
    bankInfo: { ifi: '', type: 'Ahorros', account: '' }, photo: '', pin: '',
    status: 'active', observations: [], absences: [], totalHoursWorked: 0
  };

  const [form, setForm] = useState<Partial<Employee>>(initialForm);

  const validateForm = () => {
    if (!form.name || !form.surname || !form.identification || !form.pin) return "Nombre, Apellido, ID y PIN son obligatorios.";
    if (form.pin?.length !== 6) return "El PIN debe ser de 6 dígitos estrictamente.";
    if (form.phone?.length !== 10) return "El celular debe tener estrictamente 10 dígitos.";
    if (form.identification?.length < 10) return "ID no válido.";
    if (form.isAffiliated === false && form.overSalaryType !== 'none') return "Si no es afiliado, no tiene derecho a sobresueldos.";
    return null;
  };

  const handleSave = () => {
    const error = validateForm();
    if (error) return alert(error);

    let updatedList;
    if (editingEmp) {
      updatedList = employees.map(e => e.id === editingEmp.id ? { ...e, ...form } as Employee : e);
    } else {
      const newEmp = { ...form, id: Math.random().toString(36).substr(2, 9), pinChanges: 0 } as Employee;
      updatedList = [...employees, newEmp];
    }

    onUpdate(updatedList);
    setIsModalOpen(false);
    setEditingEmp(null);
    setForm(initialForm);
    alert("Expediente guardado con éxito.");
  };

  const handleEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setForm(emp);
    setIsModalOpen(true);
  };

  const handleRegisterAbsence = (data: Partial<AbsenceRecord>) => {
    if (!viewingEmp) return;
    const newAbsence: AbsenceRecord = {
      id: Math.random().toString(36).substr(2, 5),
      date: data.date!,
      type: data.type!,
      reason: data.reason!,
      justified: data.justified || false
    };
    const updated = employees.map(e => e.id === viewingEmp.id ? { ...e, absences: [...(e.absences || []), newAbsence] } : e);
    onUpdate(updated);
    setIsAbsenceModalOpen(false);
    setViewingEmp(updated.find(e => e.id === viewingEmp.id)!);
    alert("Ausencia registrada correctamente.");
  };

  const handleTermination = (data: any) => {
    if (!viewingEmp) return;
    const updated = employees.map(e => e.id === viewingEmp.id ? {
      ...e,
      status: 'terminated' as const,
      terminationDate: data.date,
      terminationReason: data.reason,
      terminationDetails: data.details
    } : e);
    onUpdate(updated);
    setIsTermModalOpen(false);
    setViewingEmp(null);
    alert("Empleado desvinculado. Acceso bloqueado.");
    window.print();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setForm({ ...form, photo: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 fade-in no-print">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Gestión de Talento</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Control de Expedientes y Ausentismo</p>
        </div>
        <button onClick={() => { setForm(initialForm); setEditingEmp(null); setIsModalOpen(true); }} className="px-8 py-4 bg-blue-700 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest hover:scale-105 transition-transform">Registrar Empleado</button>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
        <div className="p-6 bg-slate-50 border-b flex gap-4">
          <input type="text" placeholder="Buscar por nombre o ID..." className="flex-1 bg-white border p-3 rounded-xl text-xs font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-8 py-4">Foto</th>
              <th className="px-8 py-4">Empleado</th>
              <th className="px-8 py-4">ID / PIN</th>
              <th className="px-8 py-4">Estado</th>
              <th className="px-8 py-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {employees.filter(e => (e.name + e.surname).toLowerCase().includes(searchTerm.toLowerCase())).map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-8 py-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border">
                    {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-300">N/A</div>}
                  </div>
                </td>
                <td className="px-8 py-4">
                  <p className="font-black text-slate-900 text-sm uppercase">{emp.name} {emp.surname}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">{emp.role}</p>
                </td>
                <td className="px-8 py-4 font-mono text-xs">
                  <span className="text-slate-600">{emp.identification}</span>
                  <span className="block text-blue-500 font-bold">PIN: {emp.pin}</span>
                </td>
                <td className="px-8 py-4">
                  <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{emp.status}</span>
                </td>
                <td className="px-8 py-4 text-right space-x-2">
                  <button onClick={() => handleEdit(emp)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all">Editar</button>
                  <button onClick={() => setViewingEmp(emp)} className="p-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">Ver Ficha</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Registro/Edición */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEmp ? "Editar Expediente" : "Nuevo Registro de Empleado"}>
        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scroll">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="w-32 h-32 rounded-3xl bg-slate-50 border-4 border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden group">
              {form.photo ? <img src={form.photo} className="w-full h-full object-cover" /> : <span className="text-slate-300 font-black text-[10px] uppercase">Foto Requerida</span>}
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Click para subir foto</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-1">
              <label className="text-[9px] font-black text-slate-400 uppercase">Nombre</label>
              <input className="w-full p-3 border rounded-xl" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="col-span-1">
              <label className="text-[9px] font-black text-slate-400 uppercase">Apellido</label>
              <input className="w-full p-3 border rounded-xl" value={form.surname} onChange={e => setForm({...form, surname: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase">N° Identificación</label>
              <input className="w-full p-3 border rounded-xl" value={form.identification} onChange={e => setForm({...form, identification: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase">PIN Asistencia (6 dígitos)</label>
              <input maxLength={6} className="w-full p-3 border-2 border-blue-100 rounded-xl font-black text-center text-xl tracking-tighter" value={form.pin} onChange={e => setForm({...form, pin: e.target.value.replace(/\D/g,'')})} />
            </div>
            <div>
               <label className="text-[9px] font-black text-slate-400 uppercase">Fecha Nacimiento</label>
               <input type="date" className="w-full p-3 border rounded-xl" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} />
            </div>
            <div>
               <label className="text-[9px] font-black text-slate-400 uppercase">Procedencia</label>
               <input className="w-full p-3 border rounded-xl" value={form.origin} onChange={e => setForm({...form, origin: e.target.value})} />
            </div>
            <div>
               <label className="text-[9px] font-black text-slate-400 uppercase">Tipo de Sangre</label>
               <select className="w-full p-3 border rounded-xl" value={form.bloodType} onChange={e => setForm({...form, bloodType: e.target.value as BloodType})}>
                  {Object.values(BloodType).map(v => <option key={v} value={v}>{v}</option>)}
               </select>
            </div>
            <div>
               <label className="text-[9px] font-black text-slate-400 uppercase">Celular (10 dígitos)</label>
               <input maxLength={10} className="w-full p-3 border rounded-xl" value={form.phone} onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g,'')})} />
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border space-y-4">
             <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Condiciones Laborales</h4>
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-[9px] font-black text-slate-400 uppercase">Sueldo Nominal ($)</label>
                   <input type="number" className="w-full p-3 border rounded-xl" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} />
                </div>
                <div>
                   <label className="text-[9px] font-black text-slate-400 uppercase">Afiliación IESS</label>
                   <select className="w-full p-3 border rounded-xl" value={form.isAffiliated ? 'si' : 'no'} onChange={e => {
                     const isAff = e.target.value === 'si';
                     setForm({...form, isAffiliated: isAff, overSalaryType: isAff ? 'accumulate' : 'none'});
                   }}>
                      <option value="si">SÍ</option>
                      <option value="no">NO (Bloquea Sobresueldos)</option>
                   </select>
                </div>
                <div>
                   <label className="text-[9px] font-black text-slate-400 uppercase">Sobresueldos (F. Reserva)</label>
                   <select disabled={!form.isAffiliated} className="w-full p-3 border rounded-xl disabled:opacity-30" value={form.overSalaryType} onChange={e => setForm({...form, overSalaryType: e.target.value as any})}>
                      <option value="accumulate">Acumula</option>
                      <option value="monthly">Mensualiza</option>
                      <option value="none">Ninguno</option>
                   </select>
                </div>
                <div>
                   <label className="text-[9px] font-black text-slate-400 uppercase">Tipo Contrato</label>
                   <select className="w-full p-3 border rounded-xl" value={form.isFixed ? 'fijo' : 'temp'} onChange={e => setForm({...form, isFixed: e.target.value === 'fijo'})}>
                      <option value="fijo">Fijo</option>
                      <option value="temp">Temporal</option>
                   </select>
                </div>
             </div>
          </div>

          <button onClick={handleSave} className="w-full py-5 bg-blue-700 text-white font-black rounded-2xl shadow-xl uppercase text-xs tracking-widest">Guardar Información</button>
        </div>
      </Modal>

      {/* Ficha Laboral Completa */}
      <Modal isOpen={!!viewingEmp} onClose={() => setViewingEmp(null)} title="Expediente Laboral Integral">
        {viewingEmp && (
          <div className="space-y-6">
            <div className="flex gap-6 items-center bg-slate-900 p-8 rounded-[2rem] text-white">
               <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/20">
                  {viewingEmp.photo ? <img src={viewingEmp.photo} className="w-full h-full object-cover" /> : <div className="bg-white/10 w-full h-full"></div>}
               </div>
               <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">{viewingEmp.name} {viewingEmp.surname}</h3>
                  <p className="text-blue-400 font-black text-xs uppercase tracking-widest">ID: {viewingEmp.identification}</p>
                  <div className="flex gap-2 mt-4">
                    <span className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase">Ingreso: {viewingEmp.startDate}</span>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${viewingEmp.isAffiliated ? 'bg-emerald-500' : 'bg-red-500'}`}>{viewingEmp.isAffiliated ? 'Afiliado' : 'No Afiliado'}</span>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="p-5 bg-slate-50 rounded-2xl border space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase border-b pb-1">Ausentismo</p>
                  <div className="flex justify-between text-xs"><span>Faltas Totales:</span><span className="font-black">{viewingEmp.absences?.filter(a => a.type === 'Falta').length || 0}</span></div>
                  <div className="flex justify-between text-xs"><span>Permisos:</span><span className="font-black">{viewingEmp.absences?.filter(a => a.type === 'Permiso').length || 0}</span></div>
                  <button onClick={() => setIsAbsenceModalOpen(true)} className="w-full mt-3 py-2 bg-slate-200 text-slate-800 font-black text-[9px] uppercase rounded-lg">Registrar Ausencia</button>
               </div>
               <div className="p-5 bg-slate-50 rounded-2xl border space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase border-b pb-1">Resumen Horas</p>
                  <div className="flex justify-between text-xs"><span>Horas Totales:</span><span className="font-black text-blue-600">{viewingEmp.totalHoursWorked}h</span></div>
                  <p className="text-[8px] text-slate-400 mt-2 uppercase font-bold italic">Actualizado al último marcaje</p>
               </div>
            </div>

            <div className="flex gap-4">
               <button onClick={() => { handleEdit(viewingEmp); setViewingEmp(null); }} className="flex-1 py-4 bg-slate-100 text-slate-900 font-black rounded-xl uppercase text-[10px]">Editar Datos</button>
               {viewingEmp.status === 'active' && (
                 <button onClick={() => setIsTermModalOpen(true)} className="flex-1 py-4 bg-red-50 text-red-600 border border-red-200 font-black rounded-xl uppercase text-[10px]">Desvincular</button>
               )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Desvinculación */}
      <Modal isOpen={isTermModalOpen} onClose={() => setIsTermModalOpen(false)} title="Proceso de Baja Laboral">
        <div className="space-y-6">
           <div className="p-4 bg-red-50 text-red-800 rounded-2xl text-[10px] font-bold italic border border-red-100">Confirmación Requerida: ¿Desea proceder con la desvinculación definitiva?</div>
           <div className="space-y-4">
              <div>
                 <label className="text-[9px] font-black uppercase text-slate-400">Fecha de Desvinculación</label>
                 <input type="date" id="t_date" className="w-full p-4 border rounded-xl" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                 <label className="text-[9px] font-black uppercase text-slate-400">Motivo</label>
                 <select id="t_reason" className="w-full p-4 border rounded-xl">
                    {Object.values(TerminationReason).map(r => <option key={r} value={r}>{r}</option>)}
                 </select>
              </div>
              <button onClick={() => {
                const date = (document.getElementById('t_date') as HTMLInputElement).value;
                const reason = (document.getElementById('t_reason') as HTMLSelectElement).value;
                handleTermination({ date, reason, details: '' });
              }} className="w-full py-5 bg-red-600 text-white font-black rounded-2xl uppercase text-xs shadow-xl">Confirmar Desvinculación</button>
           </div>
        </div>
      </Modal>

      {/* Modal Registro de Ausencia */}
      <Modal isOpen={isAbsenceModalOpen} onClose={() => setIsAbsenceModalOpen(false)} title="Registrar Falta / Permiso">
        <div className="space-y-4">
           <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Fecha del Evento</label>
              <input type="date" id="abs_date" className="w-full p-3 border rounded-xl" defaultValue={new Date().toISOString().split('T')[0]} />
           </div>
           <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Tipo</label>
              <select id="abs_type" className="w-full p-3 border rounded-xl">
                 <option value="Falta">Falta Injustificada</option>
                 <option value="Permiso">Permiso / Licencia</option>
                 <option value="Atraso">Atraso Justificado</option>
              </select>
           </div>
           <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Justificación / Motivo</label>
              <textarea id="abs_reason" className="w-full p-3 border rounded-xl h-24" placeholder="Argumente el motivo..."></textarea>
           </div>
           <button onClick={() => {
             const date = (document.getElementById('abs_date') as HTMLInputElement).value;
             const type = (document.getElementById('abs_type') as HTMLSelectElement).value as any;
             const reason = (document.getElementById('abs_reason') as HTMLTextAreaElement).value;
             handleRegisterAbsence({ date, type, reason });
           }} className="w-full py-4 bg-blue-700 text-white font-black rounded-xl uppercase text-xs">Guardar Registro</button>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeModule;