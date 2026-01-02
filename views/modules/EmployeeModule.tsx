import React, { useState } from 'react';
import { Employee, Role, BloodType, TerminationReason, AttendanceRecord, Payment } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface EmployeeModuleProps {
  employees: Employee[];
  onUpdate: (employees: Employee[]) => void;
  role: Role;
  attendance: AttendanceRecord[];
  payments: Payment[];
}

const EmployeeModule: React.FC<EmployeeModuleProps> = ({ employees, onUpdate, role, attendance, payments }) => {
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const initialForm: Partial<Employee> = {
    name: '', identification: '', birthDate: '', origin: '', address: '', phone: '', email: '',
    bloodType: BloodType.O_POS, emergencyContact: { name: '', phone: '' }, startDate: new Date().toISOString().split('T')[0],
    role: Role.EMPLOYEE, isFixed: true, salary: 460, isAffiliated: true, overSalaryType: 'accumulate',
    bankInfo: { ifi: '', type: 'Ahorros', account: '' }, pin: '', status: 'active', totalHoursWorked: 0,
    observations: [], justifications: []
  };

  const [form, setForm] = useState<Partial<Employee>>(initialForm);

  const handleSave = () => {
    // Validaciones Estrictas
    if (!form.name || !form.identification || !form.origin || !form.bloodType) {
      return alert("Campos estrictamente obligatorios: Nombre, Identificación, Procedencia y Tipo de Sangre.");
    }
    if (form.pin?.length !== 6) return alert("El PIN debe tener estrictamente 6 dígitos.");
    if (form.phone?.length !== 10) return alert("El celular debe tener estrictamente 10 dígitos numéricos.");
    if (!form.emergencyContact?.name || !form.emergencyContact?.phone) {
      return alert("El contacto de emergencia (nombre y teléfono) es obligatorio.");
    }
    
    const newEmp = { ...form, id: Math.random().toString(36).substr(2, 9), pinChanges: 0 } as Employee;
    onUpdate([...employees, newEmp]);
    setIsRegModalOpen(false);
    setForm(initialForm);
  };

  const handleTerminate = (reason: string, details: string, date: string) => {
    if (!selectedEmp) return;
    if (reason === TerminationReason.OTHER && !details) return alert("Debe argumentar el motivo legal en caso de seleccionar 'Otro'.");

    const updated = employees.map(e => 
      e.id === selectedEmp.id 
        ? { ...e, status: 'terminated' as const, terminationDate: date, terminationReason: reason, terminationDetails: details }
        : e
    );
    onUpdate(updated);
    setIsTermModalOpen(false);
    setSelectedEmp(null);
    alert("Empleado desvinculado. El acceso al sistema ha sido bloqueado automáticamente.");
  };

  return (
    <div className="space-y-8 fade-in">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Gestión de Talento Humano</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Nómina y Expedientes</p>
        </div>
        {(role === Role.SUPER_ADMIN || role === Role.PARTIAL_ADMIN) && (
          <button onClick={() => setIsRegModalOpen(true)} className="px-8 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 transition-all uppercase text-[10px] tracking-widest">Nuevo Empleado</button>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 bg-slate-50/50 border-b">
          <input 
            type="text" 
            placeholder="Buscar empleado por nombre..." 
            className="w-full bg-white border border-slate-200 rounded-xl px-6 py-3 text-sm focus:border-blue-500 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-8 py-4">Empleado</th>
                <th className="px-8 py-4">ID / PIN</th>
                <th className="px-8 py-4">Estado</th>
                <th className="px-8 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase())).map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400">
                        {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover rounded-xl" /> : emp.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{emp.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{emp.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-xs font-mono">
                    <p className="font-bold">{emp.identification}</p>
                    <p className="text-blue-500 font-black">PIN: {emp.pin}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {emp.status === 'active' ? 'ACTIVO' : 'DE BAJA'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button onClick={() => setSelectedEmp(emp)} className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline">Ficha Laboral</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registro Estricto */}
      <Modal isOpen={isRegModalOpen} onClose={() => setIsRegModalOpen(false)} title="Registro de Personal (Estricto)">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[9px] font-black uppercase text-slate-400">Nombre y Apellidos del Empleado</label>
              <input className="w-full border-2 p-3 rounded-xl bg-slate-50 focus:border-blue-500 outline-none" onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400">N° Identificación</label>
              <input className="w-full border-2 p-3 rounded-xl bg-slate-50 focus:border-blue-500 outline-none" onChange={e => setForm({...form, identification: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400">PIN Asistencia (6 dígitos)</label>
              <input maxLength={6} className="w-full border-2 p-3 rounded-xl bg-slate-50 font-black text-center text-xl tracking-[0.2em]" onChange={e => setForm({...form, pin: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Fecha de Nacimiento</label>
              <input type="date" className="w-full border-2 p-3 rounded-xl bg-slate-50" onChange={e => setForm({...form, birthDate: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Procedencia</label>
              <input className="w-full border-2 p-3 rounded-xl bg-slate-50" placeholder="Ej: Cuenca, Ecuador" onChange={e => setForm({...form, origin: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Celular (10 dígitos)</label>
              <input maxLength={10} className="w-full border-2 p-3 rounded-xl bg-slate-50" onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Tipo de Sangre</label>
              <select className="w-full border-2 p-3 rounded-xl bg-slate-50" onChange={e => setForm({...form, bloodType: e.target.value as BloodType})}>
                {Object.values(BloodType).map(bt => <option key={bt} value={bt}>{bt}</option>)}
              </select>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-3 bg-blue-50/50 p-4 rounded-xl border-2 border-blue-100">
               <p className="col-span-2 text-[9px] font-black uppercase text-blue-600 mb-1">Contacto de Emergencia (Obligatorio)</p>
               <input placeholder="Nombre Completo" className="p-3 border rounded-lg text-xs" onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, name: e.target.value}})} />
               <input placeholder="Teléfono" className="p-3 border rounded-lg text-xs" onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, phone: e.target.value}})} />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Sueldo</label>
              <input type="number" className="w-full border-2 p-3 rounded-xl bg-slate-50" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Afiliación IESS</label>
              <select className="w-full border-2 p-3 rounded-xl bg-slate-50" onChange={e => {
                const isAff = e.target.value === 'yes';
                setForm({...form, isAffiliated: isAff, overSalaryType: isAff ? 'accumulate' : 'none'});
              }}>
                <option value="yes">SÍ</option>
                <option value="no">NO</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Rol Sistema</label>
              <select className="w-full border-2 p-3 rounded-xl bg-slate-50" onChange={e => setForm({...form, role: e.target.value as Role})}>
                <option value={Role.EMPLOYEE}>Empleado</option>
                <option value={Role.PARTIAL_ADMIN}>Administrador Parcial</option>
                <option value={Role.SUPER_ADMIN}>Super Administrador</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Contrato</label>
              <select className="w-full border-2 p-3 rounded-xl bg-slate-50" onChange={e => setForm({...form, isFixed: e.target.value === 'fixed'})}>
                <option value="fixed">Fijo</option>
                <option value="temp">Temporal</option>
              </select>
            </div>
          </div>
          <button onClick={handleSave} className="w-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase text-xs shadow-xl hover:bg-blue-700 transition-all">Guardar Empleado</button>
        </div>
      </Modal>

      {/* Ficha e Historial */}
      <Modal isOpen={!!selectedEmp} onClose={() => setSelectedEmp(null)} title="Ficha Laboral Integral">
        {selectedEmp && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-8 rounded-[2rem] text-white flex items-center gap-6">
               <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center font-black text-4xl">
                 {selectedEmp.name[0]}
               </div>
               <div>
                 <h3 className="text-xl font-black uppercase">{selectedEmp.name}</h3>
                 <p className="text-blue-400 font-black text-xs uppercase tracking-widest">{selectedEmp.identification}</p>
                 <div className="mt-3 flex gap-2">
                    <span className={`px-2 py-1 rounded text-[8px] font-black uppercase ${selectedEmp.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}>{selectedEmp.status}</span>
                    <span className="px-2 py-1 bg-white/10 rounded text-[8px] font-black uppercase">Ingreso: {selectedEmp.startDate}</span>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-medium">
               <div className="p-5 bg-slate-50 rounded-2xl border">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-3">Condiciones Laborales</p>
                  <p className="mb-2"><b>Sueldo:</b> ${selectedEmp.salary.toFixed(2)}</p>
                  <p className="mb-2"><b>Afiliación:</b> {selectedEmp.isAffiliated ? 'SÍ' : 'NO'}</p>
                  <p className="mb-2"><b>Sobre Sueldos:</b> {selectedEmp.overSalaryType.toUpperCase()}</p>
                  <p className="mb-2"><b>Procedencia:</b> {selectedEmp.origin}</p>
               </div>
               <div className="p-5 bg-slate-50 rounded-2xl border">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-3">Contacto Emergencia</p>
                  <p className="mb-2"><b>Nombre:</b> {selectedEmp.emergencyContact.name}</p>
                  <p className="mb-2"><b>Teléfono:</b> {selectedEmp.emergencyContact.phone}</p>
                  <p className="mb-2"><b>Sangre:</b> {selectedEmp.bloodType}</p>
               </div>
            </div>

            {selectedEmp.status === 'active' && role === Role.SUPER_ADMIN && (
              <div className="pt-6 border-t flex justify-center">
                <button onClick={() => setIsTermModalOpen(true)} className="px-8 py-3 bg-red-50 text-red-600 border border-red-100 font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm">Desvincular Empleado</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Formulario de Desvinculación */}
      <Modal isOpen={isTermModalOpen} onClose={() => setIsTermModalOpen(false)} title="Formulario de Desvinculación">
        <div className="space-y-6">
           <div className="p-4 bg-red-50 text-red-800 rounded-xl text-xs font-bold uppercase">⚠ Acción Crítica: La desvinculación es permanente y bloquea el acceso.</div>
           <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Fecha de Desvinculación</label>
              <input type="date" id="t_date" className="w-full border-2 p-3 rounded-xl bg-slate-50" defaultValue={new Date().toISOString().split('T')[0]} />
           </div>
           <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Motivo</label>
              <select id="t_reason" className="w-full border-2 p-3 rounded-xl bg-slate-50">
                {Object.values(TerminationReason).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
           </div>
           <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Argumentación (Obligatorio para "Otro")</label>
              <textarea id="t_obs" className="w-full border-2 p-3 rounded-xl bg-slate-50 h-24" placeholder="Detalle motivos..."></textarea>
           </div>
           <button onClick={() => {
             const date = (document.getElementById('t_date') as HTMLInputElement).value;
             const reason = (document.getElementById('t_reason') as HTMLSelectElement).value;
             const obs = (document.getElementById('t_obs') as HTMLTextAreaElement).value;
             handleTerminate(reason, obs, date);
           }} className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase text-xs shadow-xl">Confirmar Registro de Baja</button>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeModule;