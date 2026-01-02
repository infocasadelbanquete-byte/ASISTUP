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
    if (!form.name || !form.identification || !form.pin || form.pin.length !== 6) {
      return alert("El PIN debe tener estrictamente 6 dígitos y todos los campos básicos son obligatorios.");
    }
    
    const isNew = !form.id;
    let updatedEmployees;
    
    if (isNew) {
      const newEmp = { ...form, id: Math.random().toString(36).substr(2, 9), pinChanges: 0 } as Employee;
      updatedEmployees = [...employees, newEmp];
    } else {
      updatedEmployees = employees.map(e => e.id === form.id ? (form as Employee) : e);
    }

    onUpdate(updatedEmployees);
    setIsRegModalOpen(false);
    setForm(initialForm);
    alert("Registro procesado correctamente.");
  };

  const processTermination = (data: any) => {
    if (!selectedEmp) return;
    if (data.reason === TerminationReason.OTHER && !data.details) return alert("Debe argumentar el motivo de desvinculación.");

    const updated = employees.map(e => e.id === selectedEmp.id ? {
      ...e,
      status: 'terminated' as const,
      terminationDate: data.date,
      terminationReason: data.reason,
      terminationDetails: data.details
    } : e);

    onUpdate(updated);
    setIsTermModalOpen(false);
    setSelectedEmp(null);
    alert("Empleado desvinculado. El acceso al sistema ha sido bloqueado.");
    window.print(); // Simular generación de imprimible para archivo
  };

  return (
    <div className="space-y-8 fade-in no-print">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-sm border">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Gestión de Talento Humano</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Directorio Activo y Expedientes</p>
        </div>
        {(role === Role.SUPER_ADMIN || role === Role.PARTIAL_ADMIN) && (
          <button onClick={() => { setForm(initialForm); setIsRegModalOpen(true); }} className="px-10 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 transition-all uppercase text-[10px] tracking-widest">Registrar Nuevo Talento</button>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
        <div className="p-6 bg-slate-50/50 border-b flex items-center gap-4">
          <span className="text-slate-400">🔍</span>
          <input type="text" placeholder="Buscar por nombre o identificación..." className="w-full bg-transparent text-sm font-bold outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-8 py-5">Empleado</th>
                <th className="px-8 py-5">Identificación</th>
                <th className="px-8 py-5">Contrato</th>
                <th className="px-8 py-5">Estado</th>
                <th className="px-8 py-5 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase())).map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center font-black text-blue-600 uppercase">
                        {emp.name[0]}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm uppercase">{emp.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">{emp.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-xs font-mono font-bold text-slate-600">{emp.identification}</td>
                  <td className="px-8 py-5">
                    <span className={`px-2 py-1 rounded text-[8px] font-black uppercase ${emp.isFixed ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>{emp.isFixed ? 'Fijo' : 'Temporal'}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${emp.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                       <span className="text-[10px] font-black uppercase text-slate-700">{emp.status === 'active' ? 'Vigente' : 'De Baja'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button onClick={() => setSelectedEmp(emp)} className="p-2 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-xl transition-all">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formulario de Registro */}
      <Modal isOpen={isRegModalOpen} onClose={() => setIsRegModalOpen(false)} title="Expediente de Talento Humano">
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 custom-scroll">
          <section className="space-y-4">
             <h3 className="text-xs font-black text-blue-700 uppercase tracking-widest border-b pb-2">Datos Personales</h3>
             <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                   <label className="text-[9px] font-black uppercase text-slate-400">Nombre Completo del Empleado</label>
                   <input className="w-full p-3 border-2 rounded-xl" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div>
                   <label className="text-[9px] font-black uppercase text-slate-400">N° Identificación</label>
                   <input className="w-full p-3 border-2 rounded-xl" value={form.identification} onChange={e => setForm({...form, identification: e.target.value})} />
                </div>
                <div>
                   <label className="text-[9px] font-black uppercase text-slate-400">PIN Asistencia (6 dígitos)</label>
                   <input maxLength={6} className="w-full p-3 border-2 rounded-xl font-black text-center text-xl tracking-widest" value={form.pin} onChange={e => setForm({...form, pin: e.target.value.replace(/\D/g,'')})} />
                </div>
                <div>
                   <label className="text-[9px] font-black uppercase text-slate-400">Procedencia</label>
                   <input className="w-full p-3 border-2 rounded-xl" value={form.origin} onChange={e => setForm({...form, origin: e.target.value})} />
                </div>
                <div>
                   <label className="text-[9px] font-black uppercase text-slate-400">Tipo de Sangre</label>
                   <select className="w-full p-3 border-2 rounded-xl" value={form.bloodType} onChange={e => setForm({...form, bloodType: e.target.value as BloodType})}>
                      {Object.values(BloodType).map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                </div>
             </div>
          </section>

          <section className="space-y-4">
             <h3 className="text-xs font-black text-blue-700 uppercase tracking-widest border-b pb-2">Condiciones Laborales</h3>
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-[9px] font-black uppercase text-slate-400">Sueldo Nominal ($)</label>
                   <input type="number" className="w-full p-3 border-2 rounded-xl" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} />
                </div>
                <div>
                   <label className="text-[9px] font-black uppercase text-slate-400">Tipo de Contrato</label>
                   <select className="w-full p-3 border-2 rounded-xl" value={form.isFixed ? 'fixed' : 'temp'} onChange={e => setForm({...form, isFixed: e.target.value === 'fixed'})}>
                      <option value="fixed">Fijo</option>
                      <option value="temp">Temporal</option>
                   </select>
                </div>
                <div>
                   <label className="text-[9px] font-black uppercase text-slate-400">Afiliación IESS</label>
                   <select className="w-full p-3 border-2 rounded-xl" value={form.isAffiliated ? 'yes' : 'no'} onChange={e => {
                     const aff = e.target.value === 'yes';
                     setForm({...form, isAffiliated: aff, overSalaryType: aff ? 'accumulate' : 'none'});
                   }}>
                      <option value="yes">SÍ</option>
                      <option value="no">NO (Bloquea sobre-sueldos)</option>
                   </select>
                </div>
                <div>
                   <label className="text-[9px] font-black uppercase text-slate-400">Rol en Sistema</label>
                   <select className="w-full p-3 border-2 rounded-xl" value={form.role} onChange={e => setForm({...form, role: e.target.value as Role})}>
                      <option value={Role.EMPLOYEE}>Empleado</option>
                      <option value={Role.PARTIAL_ADMIN}>Administrador Parcial</option>
                      <option value={Role.SUPER_ADMIN}>Super Administrador</option>
                   </select>
                </div>
             </div>
          </section>

          <button onClick={handleSave} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs">Guardar Expediente Laboral</button>
        </div>
      </Modal>

      {/* Ficha Laboral Completa */}
      <Modal isOpen={!!selectedEmp} onClose={() => setSelectedEmp(null)} title="Ficha Laboral Integral">
        {selectedEmp && (
          <div className="space-y-8">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex items-center gap-8 shadow-2xl">
               <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center text-4xl font-black">
                 {selectedEmp.name[0]}
               </div>
               <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">{selectedEmp.name}</h3>
                  <p className="text-blue-400 font-black text-xs uppercase tracking-widest">{selectedEmp.identification}</p>
                  <div className="flex gap-2 mt-4">
                     <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${selectedEmp.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}>{selectedEmp.status}</span>
                     <span className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase">Ingreso: {selectedEmp.startDate}</span>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
               <div className="p-6 bg-slate-50 rounded-3xl border space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase border-b pb-2">Historial de Rendimiento</p>
                  <div className="flex justify-between text-xs"><span>Faltas Acumuladas:</span><span className="font-black">0 días</span></div>
                  <div className="flex justify-between text-xs"><span>Atrasos:</span><span className="font-black">0 min</span></div>
                  <div className="flex justify-between text-xs"><span>Horas Totales:</span><span className="font-black text-blue-600">{selectedEmp.totalHoursWorked}h</span></div>
               </div>
               <div className="p-6 bg-slate-50 rounded-3xl border space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase border-b pb-2">Compensación</p>
                  <div className="flex justify-between text-xs"><span>Sueldo:</span><span className="font-black">${selectedEmp.salary.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs"><span>Afiliado:</span><span className="font-black">{selectedEmp.isAffiliated ? 'SÍ' : 'NO'}</span></div>
                  <div className="flex justify-between text-xs"><span>F. Reserva:</span><span className="font-black">{selectedEmp.overSalaryType === 'accumulate' ? 'ACUMULA' : 'MENSUALIZA'}</span></div>
               </div>
            </div>

            <div className="flex justify-between items-center gap-4">
               <button onClick={() => { setForm(selectedEmp); setIsRegModalOpen(true); }} className="flex-1 py-4 bg-slate-100 text-slate-900 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Editar Ficha</button>
               {selectedEmp.status === 'active' && role === Role.SUPER_ADMIN && (
                 <button onClick={() => { if(confirm("¿Seguro de iniciar el proceso de desvinculación? Esta acción es irreversible.")) setIsTermModalOpen(true); }} className="flex-1 py-4 bg-red-50 text-red-600 font-black rounded-2xl uppercase text-[10px] tracking-widest border border-red-100 hover:bg-red-600 hover:text-white transition-all">Desvincular Empleado</button>
               )}
            </div>
          </div>
        )}
      </Modal>

      {/* Formulario Desvinculación */}
      <Modal isOpen={isTermModalOpen} onClose={() => setIsTermModalOpen(false)} title="Acta de Desvinculación Laboral">
        <div className="space-y-6">
           <div className="p-4 bg-red-50 text-red-800 rounded-2xl text-[11px] font-bold border border-red-100 italic">⚠️ Advertencia: Al confirmar, el empleado perderá acceso inmediato al registro de asistencia y nómina.</div>
           <div className="grid grid-cols-1 gap-4">
              <div>
                 <label className="text-[9px] font-black uppercase text-slate-400">Fecha Efectiva de Salida</label>
                 <input type="date" id="term_date" className="w-full p-4 border-2 rounded-2xl bg-slate-50" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                 <label className="text-[9px] font-black uppercase text-slate-400">Motivo Legal de Desvinculación</label>
                 <select id="term_reason" className="w-full p-4 border-2 rounded-2xl bg-slate-50">
                    {Object.values(TerminationReason).map(r => <option key={r} value={r}>{r}</option>)}
                 </select>
              </div>
              <div>
                 <label className="text-[9px] font-black uppercase text-slate-400">Argumentación / Observaciones</label>
                 <textarea id="term_obs" className="w-full p-4 border-2 rounded-2xl bg-slate-50 h-32" placeholder="Detalle los motivos específicos aquí..."></textarea>
              </div>
           </div>
           <button onClick={() => {
             const date = (document.getElementById('term_date') as HTMLInputElement).value;
             const reason = (document.getElementById('term_reason') as HTMLSelectElement).value;
             const details = (document.getElementById('term_obs') as HTMLTextAreaElement).value;
             processTermination({date, reason, details});
           }} className="w-full py-5 bg-red-600 text-white font-black rounded-3xl shadow-xl uppercase text-xs">Confirmar y Registrar Baja Definitiva</button>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeModule;