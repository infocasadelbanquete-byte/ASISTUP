
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

  const [form, setForm] = useState<Partial<Employee>>({
    name: '', identification: '', birthDate: '', origin: '', address: '', phone: '', email: '',
    bloodType: BloodType.O_POS, emergencyContact: { name: '', phone: '' }, startDate: new Date().toISOString().split('T')[0],
    role: Role.EMPLOYEE, isFixed: true, salary: 460, isAffiliated: true, overSalaryType: 'accumulate',
    bankInfo: { ifi: '', type: 'Ahorros', account: '' }, pin: '', status: 'active', totalHoursWorked: 0,
    observations: [], justifications: []
  });

  const handleSave = () => {
    // Validaciones Estrictas
    if (form.pin?.length !== 6) return alert("EL PIN DEBE TENER ESTRICTAMENTE 6 DÍGITOS.");
    if (form.phone?.length !== 10) return alert("EL CELULAR DEBE TENER 10 DÍGITOS.");
    if (!form.name || !form.identification) return alert("NOMBRE E IDENTIFICACIÓN SON OBLIGATORIOS.");
    
    const newEmp = { 
      ...form, 
      id: Math.random().toString(36).substr(2, 9),
      pinChanges: 0 
    } as Employee;
    
    onUpdate([...employees, newEmp]);
    // Fix: changed setIsRegOpen to setIsRegModalOpen to match the state setter name
    setIsRegModalOpen(false);
  };

  const handleTerminate = (reason: string, details: string, date: string) => {
    if (!selectedEmp) return;
    const updated = employees.map(e => 
      e.id === selectedEmp.id 
        ? { 
            ...e, 
            status: 'terminated' as const, 
            terminationDate: date, 
            terminationReason: reason, 
            terminationDetails: details 
          }
        : e
    );
    onUpdate(updated);
    setIsTermModalOpen(false);
    setSelectedEmp(null);
    alert("Empleado desvinculado con éxito. Su acceso ha sido revocado.");
  };

  const filtered = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.identification.includes(searchTerm)
  );

  const canEdit = role === Role.SUPER_ADMIN || role === Role.PARTIAL_ADMIN;

  return (
    <div className="space-y-8 fade-in">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Gestión de Talento Humano</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Nómina Activa y Pasiva</p>
        </div>
        {canEdit && (
          <button 
            onClick={() => setIsRegModalOpen(true)}
            className="px-8 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 transition-all uppercase text-[10px] tracking-widest"
          >
            Registrar Nuevo Empleado
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 bg-slate-50/50 border-b">
          <input 
            type="text" 
            placeholder="Buscar por nombre o CI..." 
            className="w-full bg-white border border-slate-200 rounded-xl px-6 py-3 text-sm focus:border-blue-500 outline-none font-medium"
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
                <th className="px-8 py-4">Rol / Estado</th>
                <th className="px-8 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(emp => (
                <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400">
                        {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover rounded-xl" /> : emp.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{emp.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-tighter">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 font-mono text-xs">
                    <p className="font-bold">{emp.identification}</p>
                    <p className="text-blue-500 font-black">PIN: {emp.pin}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-black uppercase tracking-widest block mb-1">{emp.role}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {emp.status === 'active' ? 'Activo' : 'Desvinculado'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => setSelectedEmp(emp)}
                      className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline"
                    >
                      Abrir Ficha Laboral
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registro */}
      <Modal isOpen={isRegModalOpen} onClose={() => setIsRegModalOpen(false)} title="Registro de Personal">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[9px] font-bold uppercase text-slate-400">Nombre y Apellidos del Empleado</label>
              <input className="w-full border p-3 rounded-xl bg-slate-50 focus:bg-white transition-all outline-none focus:border-blue-500" onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-slate-400">N° de Identificación</label>
              <input className="w-full border p-3 rounded-xl bg-slate-50 focus:bg-white transition-all outline-none focus:border-blue-500" onChange={e => setForm({...form, identification: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-slate-400">Fecha de Nacimiento</label>
              <input type="date" className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setForm({...form, birthDate: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-slate-400">PIN de Asistencia (6 dígitos)</label>
              <input maxLength={6} className="w-full border p-3 rounded-xl bg-slate-50 font-black text-center text-xl tracking-widest" onChange={e => setForm({...form, pin: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-slate-400">Celular (10 dígitos)</label>
              <input maxLength={10} className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-slate-400">Sueldo</label>
              <input type="number" className="w-full border p-3 rounded-xl bg-slate-50" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-slate-400">Afiliación IESS</label>
              <select className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => {
                const isAff = e.target.value === 'yes';
                setForm({...form, isAffiliated: isAff, overSalaryType: isAff ? 'accumulate' : 'none'});
              }}>
                <option value="yes">Sí</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-slate-400">Sobresueldos</label>
              <select 
                disabled={!form.isAffiliated} 
                value={form.overSalaryType}
                className="w-full border p-3 rounded-xl bg-slate-50 disabled:opacity-30" 
                onChange={e => setForm({...form, overSalaryType: e.target.value as any})}
              >
                <option value="accumulate">Acumula</option>
                <option value="monthly">Mensualiza</option>
                <option value="none">No tiene derecho</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-slate-400">Rol Sistema</label>
              <select className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setForm({...form, role: e.target.value as Role})}>
                <option value={Role.EMPLOYEE}>Empleado</option>
                <option value={Role.PARTIAL_ADMIN}>Administrador Parcial</option>
                <option value={Role.SUPER_ADMIN}>Super Administrador</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setIsRegModalOpen(false)} className="px-6 py-2 text-slate-400 font-bold uppercase text-[10px]">Cerrar</button>
            <button onClick={handleSave} className="px-10 py-3 bg-blue-600 text-white font-black rounded-xl uppercase text-[10px] shadow-xl">Guardar Empleado</button>
          </div>
        </div>
      </Modal>

      {/* Ficha Laboral */}
      <Modal isOpen={!!selectedEmp} onClose={() => setSelectedEmp(null)} title="Ficha Laboral Integral">
        {selectedEmp && (
          <div className="space-y-6">
            <div className="flex items-center gap-6 bg-slate-900 p-8 rounded-[2rem] text-white">
               <div className="w-24 h-24 bg-white/10 rounded-2xl flex items-center justify-center font-black text-3xl">
                 {selectedEmp.name[0]}
               </div>
               <div>
                 <h3 className="text-2xl font-black uppercase tracking-tighter">{selectedEmp.name}</h3>
                 <p className="text-blue-400 font-bold text-xs uppercase tracking-widest">{selectedEmp.identification}</p>
                 <div className="mt-2 flex gap-2">
                    <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${selectedEmp.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                      {selectedEmp.status}
                    </span>
                    <span className="px-2 py-1 bg-white/10 rounded text-[8px] font-black uppercase tracking-widest">
                      Ingreso: {selectedEmp.startDate}
                    </span>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm font-medium">
               <div className="p-5 bg-slate-50 rounded-2xl border">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-3">Historial Laboral</p>
                  <p className="mb-2"><b>Sueldo:</b> ${selectedEmp.salary}</p>
                  <p className="mb-2"><b>Afiliación:</b> {selectedEmp.isAffiliated ? 'SÍ' : 'NO'}</p>
                  <p className="mb-2"><b>Sobre Sueldos:</b> {selectedEmp.overSalaryType.toUpperCase()}</p>
                  <p className="mb-2"><b>Horas Totales:</b> {selectedEmp.totalHoursWorked.toFixed(1)} h</p>
               </div>
               <div className="p-5 bg-slate-50 rounded-2xl border">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-3">Información de Contacto</p>
                  <p className="mb-2"><b>Celular:</b> {selectedEmp.phone}</p>
                  <p className="mb-2"><b>Email:</b> {selectedEmp.email}</p>
                  <p className="mb-2"><b>Emergencia:</b> {selectedEmp.emergencyContact.name}</p>
               </div>
            </div>

            {selectedEmp.status === 'active' && role === Role.SUPER_ADMIN && (
              <div className="pt-6 border-t flex justify-center">
                <button 
                  onClick={() => setIsTermModalOpen(true)}
                  className="px-8 py-3 bg-red-50 text-red-600 border border-red-100 font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm"
                >
                  Desvincular Empleado
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Desvinculación */}
      <Modal isOpen={isTermModalOpen} onClose={() => setIsTermModalOpen(false)} title="Formulario de Desvinculación">
        <div className="space-y-6">
           <div className="p-4 bg-red-50 text-red-800 rounded-xl text-xs font-bold uppercase tracking-tight">
             ⚠ Atención: Esta acción dará de baja al empleado de los registros activos y bloqueará su acceso al sistema de asistencia.
           </div>
           <div className="grid gap-4">
              <div>
                <label className="text-[9px] font-bold uppercase text-slate-400">Fecha de Desvinculación</label>
                <input type="date" id="term_date" className="w-full border p-3 rounded-xl bg-slate-50" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase text-slate-400">Motivo de Desvinculación</label>
                <select id="term_reason" className="w-full border p-3 rounded-xl bg-slate-50">
                   {Object.values(TerminationReason).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase text-slate-400">Argumentos / Observaciones</label>
                <textarea id="term_obs" className="w-full border p-3 rounded-xl bg-slate-50 h-24" placeholder="Detalle los motivos de la terminación..."></textarea>
              </div>
           </div>
           <div className="flex justify-end gap-3">
              <button onClick={() => setIsTermModalOpen(false)} className="px-6 py-2 text-slate-400 font-bold uppercase text-[10px]">Cancelar</button>
              <button 
                onClick={() => {
                  const date = (document.getElementById('term_date') as HTMLInputElement).value;
                  const reason = (document.getElementById('term_reason') as HTMLSelectElement).value;
                  const obs = (document.getElementById('term_obs') as HTMLTextAreaElement).value;
                  handleTerminate(reason, obs, date);
                }}
                className="px-10 py-3 bg-red-600 text-white font-black rounded-xl uppercase text-[10px] shadow-xl"
              >
                Confirmar Baja Definitiva
              </button>
           </div>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeModule;
