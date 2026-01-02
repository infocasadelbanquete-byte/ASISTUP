
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
  const [isRegOpen, setIsRegOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isTermOpen, setIsTermOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState<Partial<Employee>>({
    name: '', identification: '', birthDate: '', origin: '', address: '', phone: '', email: '',
    bloodType: BloodType.O_POS, emergencyContact: { name: '', phone: '' }, startDate: new Date().toISOString().split('T')[0],
    role: Role.EMPLOYEE, isFixed: true, salary: 460, isAffiliated: true, overSalaryType: 'accumulate',
    bankInfo: { ifi: '', type: 'Ahorros', account: '' }, pin: '', status: 'active', totalHoursWorked: 0
  });

  const handleSave = () => {
    if (!form.name || !form.identification) return alert("Faltan datos obligatorios.");
    if (form.pin?.length !== 6) return alert("El PIN debe tener exactamente 6 dígitos.");
    if (form.phone?.length !== 10) return alert("El celular debe tener 10 dígitos.");
    
    const newEmp = { ...form, id: Math.random().toString(36).substr(2, 9), observations: [], justifications: [], pinChanges: 0 } as Employee;
    onUpdate([...employees, newEmp]);
    setIsRegOpen(false);
  };

  const handleTerminate = (reason: string, details: string) => {
    if (!selectedEmp) return;
    const updated = employees.map(e => 
      e.id === selectedEmp.id 
        ? { ...e, status: 'terminated' as const, terminationDate: new Date().toISOString(), terminationReason: reason, terminationDetails: details }
        : e
    );
    onUpdate(updated);
    setIsTermOpen(false);
    setSelectedEmp(null);
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border">
        <h2 className="text-2xl font-black text-slate-900 uppercase">Gestión de Talento Humano</h2>
        <button onClick={() => setIsRegOpen(true)} className="px-8 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg hover:bg-blue-700 transition-all uppercase text-[10px] tracking-widest">Registrar Nuevo Empleado</button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
        <div className="p-4 bg-slate-50">
          <input 
            type="text" 
            placeholder="Buscar empleado..." 
            className="w-full p-3 rounded-xl border bg-white outline-none focus:ring-2 focus:ring-blue-100"
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-8 py-4">Empleado</th>
              <th className="px-8 py-4">ID / PIN</th>
              <th className="px-8 py-4">Estado</th>
              <th className="px-8 py-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase())).map(e => (
              <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-8 py-4 font-bold text-slate-900">{e.name}</td>
                <td className="px-8 py-4 text-xs font-mono">{e.identification} <span className="text-blue-500 font-bold ml-2">PIN: {e.pin}</span></td>
                <td className="px-8 py-4">
                  <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${e.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>{e.status}</span>
                </td>
                <td className="px-8 py-4 text-right">
                  <button onClick={() => setSelectedEmp(e)} className="text-blue-600 font-black text-[10px] uppercase">Ver Ficha</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Registro */}
      <Modal isOpen={isRegOpen} onClose={() => setIsRegOpen(false)} title="Nuevo Registro de Empleado">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-[9px] font-bold uppercase">Nombre y Apellido</label>
            <input className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase">N° Identificación</label>
            <input className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setForm({...form, identification: e.target.value})} />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase">PIN Asistencia (6 dígitos)</label>
            <input maxLength={6} className="w-full border p-3 rounded-xl bg-slate-50 font-black text-center" onChange={e => setForm({...form, pin: e.target.value})} />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase">Celular (10 dígitos)</label>
            <input maxLength={10} className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setForm({...form, phone: e.target.value})} />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase">Sueldo</label>
            <input type="number" className="w-full border p-3 rounded-xl bg-slate-50" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase">Afiliación IESS</label>
            <select className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setForm({...form, isAffiliated: e.target.value === 'yes'})}>
              <option value="yes">SÍ</option>
              <option value="no">NO</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase">Sobre Sueldos</label>
            <select 
              disabled={!form.isAffiliated} 
              className="w-full border p-3 rounded-xl bg-slate-50 disabled:opacity-30" 
              onChange={e => setForm({...form, overSalaryType: e.target.value as any})}
            >
              <option value="accumulate">Acumula</option>
              <option value="monthly">Mensualiza</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase">Rol en Sistema</label>
            <select className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setForm({...form, role: e.target.value as Role})}>
              <option value={Role.EMPLOYEE}>Empleado</option>
              <option value={Role.PARTIAL_ADMIN}>Admin Parcial</option>
              <option value={Role.SUPER_ADMIN}>Super Admin</option>
            </select>
          </div>
          <div className="col-span-2 pt-4">
            <button onClick={handleSave} className="w-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase text-xs shadow-xl">Guardar Empleado</button>
          </div>
        </div>
      </Modal>

      {/* Ficha Laboral */}
      <Modal isOpen={!!selectedEmp} onClose={() => setSelectedEmp(null)} title="Ficha Laboral">
        {selectedEmp && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-8 rounded-[2rem] text-white flex gap-6 items-center">
              <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center font-black text-3xl">{selectedEmp.name[0]}</div>
              <div>
                <h3 className="text-xl font-black uppercase">{selectedEmp.name}</h3>
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Ingreso: {selectedEmp.startDate}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs font-medium">
              <div className="p-4 bg-slate-50 rounded-2xl border">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Condiciones</p>
                <p><b>Sueldo:</b> ${selectedEmp.salary}</p>
                <p><b>Afiliación:</b> {selectedEmp.isAffiliated ? 'SI' : 'NO'}</p>
                <p><b>Horas Totales:</b> {selectedEmp.totalHoursWorked.toFixed(1)}h</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Contacto</p>
                <p><b>Celular:</b> {selectedEmp.phone}</p>
                <p><b>Emergencia:</b> {selectedEmp.emergencyContact.name}</p>
              </div>
            </div>
            {selectedEmp.status === 'active' && (
              <button onClick={() => setIsTermOpen(true)} className="w-full py-4 bg-red-50 text-red-600 font-black rounded-xl border border-red-100 uppercase text-[10px] tracking-widest hover:bg-red-600 hover:text-white transition-all">Desvincular Empleado</button>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isTermOpen} onClose={() => setIsTermOpen(false)} title="Confirmar Desvinculación">
        <div className="space-y-4">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">Motivo de la terminación laboral:</p>
          <select id="t_reason" className="w-full border p-3 rounded-xl bg-slate-50">
            {Object.values(TerminationReason).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <textarea id="t_details" placeholder="Argumentos de la desvinculación..." className="w-full border p-3 rounded-xl bg-slate-50 h-24"></textarea>
          <button 
            onClick={() => {
              const r = (document.getElementById('t_reason') as HTMLSelectElement).value;
              const d = (document.getElementById('t_details') as HTMLTextAreaElement).value;
              handleTerminate(r, d);
            }}
            className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase text-xs"
          >
            Confirmar y Dar de Baja
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeModule;
