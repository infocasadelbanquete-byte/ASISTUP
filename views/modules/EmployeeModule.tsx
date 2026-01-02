
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
    if (formData.pin?.length !== 6) return alert("ERROR: El PIN debe ser de 6 dígitos estrictamente.");
    if (formData.phone?.length !== 10) return alert("ERROR: El celular debe tener 10 dígitos.");
    if (!formData.name || !formData.identification) return alert("ERROR: Los campos de nombre e identificación son obligatorios.");
    
    const newEmployee = { ...formData, id: Math.random().toString(36).substr(2, 9) } as Employee;
    onUpdate([...employees, newEmployee]);
    setIsRegisterModalOpen(false);
    alert("Empleado registrado con éxito.");
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
    alert("Empleado desvinculado. Su acceso ha sido bloqueado.");
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.identification.includes(searchTerm)
  );

  return (
    <div className="space-y-8 fade-in">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Gestión de Talento Humano</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Nómina activa y registros históricos</p>
        </div>
        <button 
          onClick={() => setIsRegisterModalOpen(true)}
          className="px-8 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 transition-all uppercase text-[10px] tracking-widest"
        >
          Nuevo Empleado
        </button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 bg-slate-50/50">
          <input 
            type="text" 
            placeholder="Filtrar por nombre o CI..." 
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
                <th className="px-8 py-4">Identificación / PIN</th>
                <th className="px-8 py-4">Estado</th>
                <th className="px-8 py-4 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 uppercase">
                        {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover rounded-xl" /> : emp.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{emp.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{emp.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 font-mono text-xs">
                    <p className="font-bold">{emp.identification}</p>
                    <p className="text-blue-500 font-black">PIN: {emp.pin}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {emp.status === 'active' ? 'ACTIVO' : 'DE BAJA'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => setSelectedEmployee(emp)}
                      className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline"
                    >
                      Abrir Expediente
                    </button>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr><td colSpan={4} className="p-20 text-center text-slate-400 font-black text-xs uppercase italic">No se encontraron registros de empleados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)} title="Registro de Personal">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
             <div className="col-span-2"><label className="text-[9px] font-bold uppercase">Nombre y Apellidos</label><input className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setFormData({...formData, name: e.target.value})} /></div>
             <div><label className="text-[9px] font-bold uppercase">N° Identificación</label><input className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setFormData({...formData, identification: e.target.value})} /></div>
             <div><label className="text-[9px] font-bold uppercase">PIN (6 dígitos)</label><input maxLength={6} className="w-full border p-3 rounded-xl bg-slate-50 font-black text-center" onChange={e => setFormData({...formData, pin: e.target.value})} /></div>
             <div><label className="text-[9px] font-bold uppercase">Celular (10 dígitos)</label><input maxLength={10} className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
             <div><label className="text-[9px] font-bold uppercase">Sueldo Base</label><input type="number" className="w-full border p-3 rounded-xl bg-slate-50" value={formData.salary} onChange={e => setFormData({...formData, salary: Number(e.target.value)})} /></div>
             <div><label className="text-[9px] font-bold uppercase">Afiliación IESS</label>
                <select className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setFormData({...formData, isAffiliated: e.target.value === 'yes'})}>
                   <option value="yes">Asegurado (IESS)</option>
                   <option value="no">No Asegurado</option>
                </select>
             </div>
             <div><label className="text-[9px] font-bold uppercase">Sobre Sueldos</label>
                <select 
                  disabled={!formData.isAffiliated} 
                  className="w-full border p-3 rounded-xl disabled:opacity-30 bg-slate-50" 
                  onChange={e => setFormData({...formData, overSalaryType: e.target.value as any})}
                >
                   <option value="accumulate">Acumula (XVIII/XIV)</option>
                   <option value="monthly">Mensualiza (XVIII/XIV)</option>
                </select>
             </div>
             <div><label className="text-[9px] font-bold uppercase">Rol en Sistema</label>
                <select className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setFormData({...formData, role: e.target.value as Role})}>
                   <option value={Role.EMPLOYEE}>Empleado Regular</option>
                   <option value={Role.PARTIAL_ADMIN}>Administrador Parcial</option>
                   <option value={Role.SUPER_ADMIN}>Super Administrador</option>
                </select>
             </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setIsRegisterModalOpen(false)} className="px-6 py-2 text-slate-400 font-bold text-xs uppercase">Cerrar</button>
            <button onClick={handleSave} className="px-10 py-3 bg-blue-600 text-white font-black rounded-xl text-xs uppercase shadow-xl">Guardar Empleado</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!selectedEmployee} onClose={() => setSelectedEmployee(null)} title="Ficha Laboral Integral">
        {selectedEmployee && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-8 rounded-[2rem] text-white flex gap-6 items-center">
               <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center font-black text-2xl border border-white/10">
                 {selectedEmployee.name[0]}
               </div>
               <div>
                 <h3 className="text-xl font-black uppercase tracking-tight">{selectedEmployee.name}</h3>
                 <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{selectedEmployee.identification}</p>
                 <div className="mt-2 flex gap-2">
                    <span className="px-2 py-0.5 bg-white/10 rounded text-[8px] font-black uppercase tracking-widest">Ingreso: {selectedEmployee.startDate}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${selectedEmployee.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}>{selectedEmployee.status}</span>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
               <div className="p-4 bg-slate-50 rounded-2xl border">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Contrato y Haberes</p>
                  <p className="mb-1"><b>Sueldo:</b> ${selectedEmployee.salary}</p>
                  <p className="mb-1"><b>Afiliado:</b> {selectedEmployee.isAffiliated ? 'SÍ' : 'NO'}</p>
                  <p className="mb-1"><b>Decimos:</b> {selectedEmployee.overSalaryType === 'accumulate' ? 'ACUMULADOS' : 'MENSUALIZADOS'}</p>
               </div>
               <div className="p-4 bg-slate-50 rounded-2xl border">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Desempeño Anual</p>
                  <p className="mb-1"><b>Horas Totales:</b> {selectedEmployee.totalHoursWorked.toFixed(1)} h</p>
                  <p className="mb-1"><b>Faltas:</b> 0</p>
                  <p className="mb-1"><b>Atrasos:</b> 0</p>
               </div>
            </div>

            {selectedEmployee.status === 'active' && (
              <div className="pt-6 border-t flex justify-center">
                <button 
                  onClick={() => setIsTerminationModalOpen(true)}
                  className="px-8 py-3 bg-red-50 text-red-600 font-black rounded-xl text-[10px] uppercase tracking-[0.2em] border border-red-100 hover:bg-red-600 hover:text-white transition-all"
                >
                  Desvincular Empleado
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isTerminationModalOpen} onClose={() => setIsTerminationModalOpen(false)} title="Terminación Laboral">
        <div className="space-y-6">
           <p className="text-xs text-red-800 bg-red-50 p-4 rounded-xl font-bold uppercase tracking-tight">⚠ Advertencia: Una vez desvinculado, el empleado perderá el acceso al sistema de asistencia y gestión.</p>
           <div><label className="text-[9px] font-bold uppercase">Motivo Legal</label>
             <select className="w-full border p-3 rounded-xl bg-slate-50" id="t_reason">
               {Object.values(TerminationReason).map(r => <option key={r} value={r}>{r}</option>)}
             </select>
           </div>
           <div><label className="text-[9px] font-bold uppercase">Justificación / Argumentos</label>
             <textarea className="w-full border p-3 rounded-xl bg-slate-50 h-24" id="t_details" placeholder="Explique los motivos de la baja..."></textarea>
           </div>
           <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setIsTerminationModalOpen(false)} className="px-6 py-2 text-slate-400 font-bold uppercase text-xs">Cerrar</button>
              <button 
                onClick={() => {
                  const r = (document.getElementById('t_reason') as HTMLSelectElement).value;
                  const d = (document.getElementById('t_details') as HTMLTextAreaElement).value;
                  handleTerminate(r, d);
                }}
                className="px-10 py-3 bg-red-600 text-white font-black rounded-xl text-xs uppercase shadow-xl"
              >
                Ejecutar Desvinculación
              </button>
           </div>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeModule;
