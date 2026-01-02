
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
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isTerminationModalOpen, setIsTerminationModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<Partial<Employee>>({
    name: '', identification: '', birthDate: '', origin: '', address: '', phone: '', email: '',
    bloodType: BloodType.O_POS, emergencyContact: { name: '', phone: '' }, startDate: new Date().toISOString().split('T')[0],
    role: Role.EMPLOYEE, isFixed: true, salary: 460, isAffiliated: true, overSalaryType: 'accumulate',
    bankInfo: { ifi: '', type: 'Ahorros', account: '' }, pin: '', status: 'active', observations: [], justifications: [], totalHoursWorked: 0
  });

  const handleSave = () => {
    if (formData.pin?.length !== 6) return alert("El PIN debe ser de 6 dígitos.");
    if (formData.phone?.length !== 10) return alert("El celular debe tener 10 dígitos.");
    
    const newEmployee = { ...formData, id: Math.random().toString(36).substr(2, 9) } as Employee;
    onUpdate([...employees, newEmployee]);
    setIsRegisterModalOpen(false);
  };

  const handleTerminate = (reason: string, details: string) => {
    if (!selectedEmployee) return;
    const updated = employees.map(emp => 
      emp.id === selectedEmployee.id 
        ? { ...emp, status: 'terminated' as const, terminationDate: new Date().toISOString(), terminationReason: reason, terminationDetails: details }
        : emp
    );
    onUpdate(updated);
    setIsTerminationModalOpen(false);
    setSelectedEmployee(null);
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.identification.includes(searchTerm)
  );

  return (
    <div className="space-y-8 fade-in">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter">GESTIÓN DE TALENTO HUMANO</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Control integral de personal activo y pasivo</p>
        </div>
        <button 
          onClick={() => setIsRegisterModalOpen(true)}
          className="px-8 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 transition-all active:scale-95 uppercase text-[10px] tracking-widest"
        >
          Registrar Nuevo Empleado
        </button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
          <input 
            type="text" 
            placeholder="Buscar por nombre o identificación..." 
            className="w-full bg-white border border-slate-200 rounded-xl px-6 py-3 text-sm focus:border-blue-500 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              <tr>
                <th className="px-8 py-4">Empleado</th>
                <th className="px-8 py-4">ID / PIN</th>
                <th className="px-8 py-4">Rol / Estado</th>
                <th className="px-8 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 uppercase">
                        {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover rounded-xl" /> : emp.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{emp.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 font-mono text-xs">
                    <p>{emp.identification}</p>
                    <p className="text-blue-500 font-bold">PIN: {emp.pin}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-black uppercase tracking-widest block">{emp.role}</span>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => setSelectedEmployee(emp)}
                      className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline"
                    >
                      Ver Ficha Laboral
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registro */}
      <Modal isOpen={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)} title="Registro de Nuevo Empleado">
        <div className="space-y-8">
          <section>
            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-4 border-b pb-2">Datos Personales</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="text-[9px] font-bold uppercase">Nombre Completo</label><input className="w-full border p-2 rounded-lg" onChange={e => setFormData({...formData, name: e.target.value})} /></div>
              <div><label className="text-[9px] font-bold uppercase">Cédula / ID</label><input className="w-full border p-2 rounded-lg" onChange={e => setFormData({...formData, identification: e.target.value})} /></div>
              <div><label className="text-[9px] font-bold uppercase">Fecha Nacimiento</label><input type="date" className="w-full border p-2 rounded-lg" onChange={e => setFormData({...formData, birthDate: e.target.value})} /></div>
              <div><label className="text-[9px] font-bold uppercase">Celular (10 dígitos)</label><input maxLength={10} className="w-full border p-2 rounded-lg" onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
              <div><label className="text-[9px] font-bold uppercase">PIN Asistencia (6 dígitos)</label><input maxLength={6} className="w-full border p-2 rounded-lg font-mono" onChange={e => setFormData({...formData, pin: e.target.value})} /></div>
            </div>
          </section>
          
          <section>
            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-4 border-b pb-2">Condiciones Laborales</h4>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-[9px] font-bold uppercase">Sueldo</label><input type="number" className="w-full border p-2 rounded-lg" value={formData.salary} onChange={e => setFormData({...formData, salary: Number(e.target.value)})} /></div>
              <div><label className="text-[9px] font-bold uppercase">Afiliado IESS</label>
                <select className="w-full border p-2 rounded-lg" onChange={e => setFormData({...formData, isAffiliated: e.target.value === 'yes'})}>
                  <option value="yes">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div><label className="text-[9px] font-bold uppercase">Sobre Sueldos</label>
                <select 
                  disabled={!formData.isAffiliated} 
                  className="w-full border p-2 rounded-lg disabled:bg-gray-100" 
                  onChange={e => setFormData({...formData, overSalaryType: e.target.value as any})}
                >
                  <option value="accumulate">Acumula</option>
                  <option value="monthly">Mensualiza</option>
                </select>
              </div>
              <div><label className="text-[9px] font-bold uppercase">Rol en Sistema</label>
                <select className="w-full border p-2 rounded-lg" onChange={e => setFormData({...formData, role: e.target.value as Role})}>
                  <option value={Role.EMPLOYEE}>Empleado</option>
                  <option value={Role.PARTIAL_ADMIN}>Administrador Parcial</option>
                  <option value={Role.SUPER_ADMIN}>Super Administrador</option>
                </select>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setIsRegisterModalOpen(false)} className="px-6 py-2 text-slate-400 font-bold text-[10px] uppercase">Cancelar</button>
            <button onClick={handleSave} className="px-10 py-3 bg-blue-600 text-white font-black rounded-xl text-[10px] uppercase shadow-lg">Registrar Empleado</button>
          </div>
        </div>
      </Modal>

      {/* Modal Ficha Laboral */}
      <Modal isOpen={!!selectedEmployee} onClose={() => setSelectedEmployee(null)} title="Ficha Laboral Integral">
        {selectedEmployee && (
          <div className="space-y-8">
            <div className="flex items-center gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
               <div className="w-24 h-24 bg-white rounded-2xl shadow-sm flex items-center justify-center font-black text-3xl text-slate-300">
                 {selectedEmployee.photo ? <img src={selectedEmployee.photo} /> : selectedEmployee.name[0]}
               </div>
               <div className="flex-1">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{selectedEmployee.name}</h3>
                 <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{selectedEmployee.role} • {selectedEmployee.isFixed ? 'Personal Fijo' : 'Personal Temporal'}</p>
                 <div className="mt-2 flex gap-2">
                    <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase ${selectedEmployee.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>{selectedEmployee.status}</span>
                    <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded-md text-[8px] font-black uppercase">Ingreso: {selectedEmployee.startDate}</span>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-6 text-sm">
               <div className="space-y-4">
                  <h5 className="text-[10px] font-black uppercase border-b pb-1 text-slate-400">Datos del Contrato</h5>
                  <p><b>Sueldo:</b> ${selectedEmployee.salary}</p>
                  <p><b>Afiliación:</b> {selectedEmployee.isAffiliated ? 'SÍ' : 'NO'}</p>
                  <p><b>Sobre Sueldos:</b> {selectedEmployee.overSalaryType === 'accumulate' ? 'Acumula' : 'Mensualiza'}</p>
               </div>
               <div className="space-y-4">
                  <h5 className="text-[10px] font-black uppercase border-b pb-1 text-slate-400">Estadísticas</h5>
                  <p><b>Horas Totales:</b> {selectedEmployee.totalHoursWorked.toFixed(1)} h</p>
                  <p><b>PIN:</b> {selectedEmployee.pin}</p>
               </div>
            </div>

            {selectedEmployee.status === 'active' && (
              <div className="pt-8 border-t flex justify-center">
                 <button 
                  onClick={() => setIsTerminationModalOpen(true)}
                  className="px-8 py-3 bg-red-50 border border-red-200 text-red-600 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
                 >
                   Desvincular Empleado
                 </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Desvinculación */}
      <Modal isOpen={isTerminationModalOpen} onClose={() => setIsTerminationModalOpen(false)} title="Formulario de Desvinculación Laboral">
        <div className="space-y-6">
          <p className="p-4 bg-red-50 text-red-800 rounded-xl text-xs font-bold uppercase tracking-tight">⚠ Advertencia: Esta acción es irreversible y bloqueará el acceso del empleado.</p>
          <div><label className="text-[9px] font-bold uppercase">Motivo</label>
            <select className="w-full border p-3 rounded-xl" id="term_reason">
              {Object.values(TerminationReason).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div><label className="text-[9px] font-bold uppercase">Observaciones / Argumentos</label>
            <textarea className="w-full border p-3 rounded-xl h-24" id="term_obs" placeholder="Detalle los motivos de la terminación laboral..."></textarea>
          </div>
          <div className="flex justify-end gap-3">
             <button onClick={() => setIsTerminationModalOpen(false)} className="px-6 py-2 text-slate-400 uppercase font-black text-xs">Cancelar</button>
             <button 
              onClick={() => {
                const reason = (document.getElementById('term_reason') as HTMLSelectElement).value;
                const obs = (document.getElementById('term_obs') as HTMLTextAreaElement).value;
                handleTerminate(reason, obs);
              }}
              className="px-8 py-3 bg-red-600 text-white font-black rounded-xl uppercase text-xs shadow-xl"
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
