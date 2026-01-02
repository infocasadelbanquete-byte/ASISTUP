
import React, { useState, useRef } from 'react';
import { Employee, Role, BloodType, TerminationReason, AttendanceRecord, Payment, Observation } from '../../types';
import Modal from '../../components/Modal';

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
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
  const [isAttendancePrintModalOpen, setIsAttendancePrintModalOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [terminationForm, setTerminationForm] = useState({
    date: new Date().toISOString().split('T')[0],
    reason: TerminationReason.VOLUNTARY,
    details: ''
  });

  const [absenceForm, setAbsenceForm] = useState({
    date: new Date().toISOString().split('T')[0],
    reason: '',
    type: 'Falta' as 'Falta' | 'Atraso' | 'Permiso'
  });

  const [observationForm, setObservationForm] = useState({
    text: ''
  });

  const [formData, setFormData] = useState<Partial<Employee>>({
    name: '', identification: '', birthDate: '', origin: '', address: '', phone: '', email: '',
    bloodType: BloodType.O_POS, emergencyContact: { name: '', phone: '' }, startDate: new Date().toISOString().split('T')[0],
    role: Role.EMPLOYEE, isFixed: true, salary: 460, isAffiliated: true,
    overSalaryType: 'monthly', bankInfo: { ifi: '', type: 'Ahorros', account: '' },
    photo: '', pin: '', pinChanges: 0, status: 'active', observations: [], justifications: [], totalHoursWorked: 0
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEmployee = () => {
    if (!formData.name || !formData.identification || !formData.phone || !formData.pin || !formData.emergencyContact?.name || !formData.emergencyContact?.phone || !formData.startDate) {
      alert("ERROR: Todos los campos marcados como obligatorios (*) deben ser llenados.");
      return;
    }
    if (formData.pin?.length !== 6) {
      alert("ERROR: El PIN debe ser estrictamente de 6 dígitos.");
      return;
    }
    if (formData.phone?.length !== 10) {
      alert("ERROR: El número de celular debe tener estrictamente 10 dígitos.");
      return;
    }

    const finalFormData = { ...formData };
    if (!formData.isAffiliated) {
      finalFormData.overSalaryType = 'none';
    }
    
    if (formData.id) {
      const newEmployees = employees.map(e => e.id === formData.id ? { ...e, ...finalFormData } as Employee : e);
      onUpdate(newEmployees);
    } else {
      const newEmployee: Employee = {
        ...finalFormData,
        id: Math.random().toString(36).substr(2, 9),
        totalHoursWorked: 0,
        observations: [],
        justifications: [],
        status: 'active'
      } as Employee;
      onUpdate([...employees, newEmployee]);
    }
    setIsRegisterModalOpen(false);
    resetForm();
  };

  const handleTerminate = () => {
    if (!selectedEmployee) return;
    const updatedEmployees = employees.map(e => {
      if (e.id === selectedEmployee.id) {
        return {
          ...e,
          status: 'terminated' as const,
          terminationDate: terminationForm.date,
          terminationReason: terminationForm.reason,
          terminationDetails: terminationForm.reason === TerminationReason.OTHER ? terminationForm.details : terminationForm.reason,
          isFixed: false,
          pin: 'DISABLED_' + Math.random() // Bloquear acceso
        };
      }
      return e;
    });
    onUpdate(updatedEmployees);
    setIsTerminationModalOpen(false);
    alert('Desvinculación procesada. Se generará el reporte de desvinculación para archivo.');
    setTimeout(() => {
      window.print();
      setSelectedEmployee(null);
    }, 500); 
  };

  const handleAddAbsence = () => {
    if (!selectedEmployee || !absenceForm.reason) return;
    const updated = employees.map(e => {
      if (e.id === selectedEmployee.id) {
        return {
          ...e,
          justifications: [...e.justifications, { date: absenceForm.date, reason: absenceForm.reason, type: absenceForm.type }]
        };
      }
      return e;
    });
    onUpdate(updated);
    setIsAbsenceModalOpen(false);
    setSelectedEmployee(updated.find(e => e.id === selectedEmployee.id) || null);
  };

  const handleAddObservation = () => {
    if (!selectedEmployee || !observationForm.text) return;
    const updated = employees.map(e => {
      if (e.id === selectedEmployee.id) {
        return {
          ...e,
          observations: [...e.observations, { date: new Date().toISOString().split('T')[0], text: observationForm.text }]
        };
      }
      return e;
    });
    onUpdate(updated);
    setIsObservationModalOpen(false);
    setSelectedEmployee(updated.find(e => e.id === selectedEmployee.id) || null);
  };

  const resetForm = () => {
    setFormData({
      name: '', identification: '', birthDate: '', origin: '', address: '', phone: '', email: '',
      bloodType: BloodType.O_POS, emergencyContact: { name: '', phone: '' }, startDate: new Date().toISOString().split('T')[0],
      role: Role.EMPLOYEE, isFixed: true, salary: 460, isAffiliated: true,
      overSalaryType: 'monthly', bankInfo: { ifi: '', type: 'Ahorros', account: '' },
      photo: '', pin: '', pinChanges: 0, status: 'active', observations: [], justifications: [], totalHoursWorked: 0
    });
  };

  const getEmpAttendance = (id: string) => attendance.filter(a => a.employeeId === id);
  const getEmpPayments = (id: string) => payments.filter(p => p.employeeId === id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100 no-print">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-blue-900">Módulo de Talento Humano</h2>
          <p className="text-sm text-gray-500">Registro de empleados y gestión de expedientes</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsRegisterModalOpen(true); }}
          className="px-8 py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          Registrar Empleado
        </button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden no-print">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Colaborador</th>
              <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Identificación</th>
              <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
              <th className="px-6 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {employees.map(emp => (
              <tr key={emp.id} className={`hover:bg-blue-50/50 transition-all ${emp.status === 'terminated' ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <img src={emp.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${emp.name}`} className="w-12 h-12 rounded-2xl border border-gray-100 object-cover" alt="User" />
                    <div>
                      <p className="font-bold text-gray-900">{emp.name}</p>
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{emp.role}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-600">{emp.identification}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-widest ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {emp.status === 'active' ? 'Activo' : 'Desvinculado'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => setSelectedEmployee(emp)} className="px-4 py-2 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl hover:bg-blue-700 hover:text-white transition-all mr-2">Ver Historial</button>
                  {emp.status === 'active' && (
                    <button onClick={() => { setFormData(emp); setIsRegisterModalOpen(true); }} className="p-2 text-gray-400 hover:text-blue-600 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)} title="Registro de Talento Humano">
        <div className="space-y-6">
          <div className="flex justify-center mb-6">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-32 h-32 rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-100 transition-all overflow-hidden relative group"
            >
              {formData.photo ? (
                <img src={formData.photo} className="w-full h-full object-cover" alt="Foto" />
              ) : (
                <>
                  <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  <span className="text-[9px] font-black text-blue-500 uppercase mt-2">Cargar Foto</span>
                </>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-white text-[10px] font-black uppercase">Cambiar</span>
              </div>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-black text-gray-500 uppercase">Nombre y Apellido del Empleado *</label>
              <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-gray-200 border rounded-xl p-3 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase">N° Identificación *</label>
              <input value={formData.identification} onChange={e => setFormData({...formData, identification: e.target.value})} className="w-full border-gray-200 border rounded-xl p-3 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase">Fecha Nacimiento *</label>
              <input type="date" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} className="w-full border-gray-200 border rounded-xl p-3 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase">Procedencia</label>
              <input value={formData.origin} onChange={e => setFormData({...formData, origin: e.target.value})} className="w-full border-gray-200 border rounded-xl p-3 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase">Celular (10 dígitos) *</label>
              <input maxLength={10} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} className="w-full border-gray-200 border rounded-xl p-3 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-black text-gray-500 uppercase">Dirección Domicilio</label>
              <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border-gray-200 border rounded-xl p-3 outline-none" />
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase">Contacto Emergencia (Nombre) *</label>
                <input value={formData.emergencyContact?.name} onChange={e => setFormData({...formData, emergencyContact: { ...formData.emergencyContact!, name: e.target.value }})} className="w-full border-gray-200 border rounded-xl p-3 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase">Contacto Emergencia (Teléfono) *</label>
                <input value={formData.emergencyContact?.phone} onChange={e => setFormData({...formData, emergencyContact: { ...formData.emergencyContact!, phone: e.target.value }})} className="w-full border-gray-200 border rounded-xl p-3 outline-none" />
              </div>
            </div>
            <div>
               <label className="text-[10px] font-black text-gray-500 uppercase">Fecha de Vinculación *</label>
               <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full border-gray-200 border rounded-xl p-3 font-bold text-blue-800" />
            </div>
            <div>
               <label className="text-[10px] font-black text-gray-500 uppercase">Rol en el Sistema *</label>
               <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as Role})} className="w-full border-gray-200 border rounded-xl p-3 font-bold">
                 {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
               </select>
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border border-gray-100 space-y-4">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Condiciones Económicas y Seguridad Social</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Afiliación IESS</label>
                <select value={formData.isAffiliated ? 'si' : 'no'} onChange={e => setFormData({...formData, isAffiliated: e.target.value === 'si'})} className="w-full border-gray-200 border rounded-xl p-3 font-bold">
                   <option value="si">SÍ</option>
                   <option value="no">NO (Bloquea sobre-sueldos)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Sueldo Bruto</label>
                <input type="number" value={formData.salary} onChange={e => setFormData({...formData, salary: Number(e.target.value)})} className="w-full border-gray-200 border rounded-xl p-3 font-black text-blue-900" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">Sobre Sueldos (Derecho legal)</label>
                <select 
                  disabled={!formData.isAffiliated} 
                  value={formData.isAffiliated ? formData.overSalaryType : 'none'} 
                  onChange={e => setFormData({...formData, overSalaryType: e.target.value as any})} 
                  className={`w-full border-gray-200 border rounded-xl p-3 font-bold ${!formData.isAffiliated ? 'bg-gray-100' : ''}`}
                >
                  <option value="monthly">Mensualiza (13ro, 14to, Reserva)</option>
                  <option value="accumulate">Acumula (Pago anual)</option>
                  <option value="none">Sin derecho (No afiliado)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-blue-900 text-white p-6 rounded-3xl shadow-xl">
             <label className="text-[10px] font-black text-blue-300 uppercase tracking-widest">PIN de Acceso Asistencia (6 dígitos) *</label>
             <input maxLength={6} type="password" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})} className="w-full bg-transparent border-b-2 border-blue-700 text-3xl font-black tracking-[0.5em] text-center outline-none py-2" placeholder="••••••" />
          </div>

          <button onClick={handleSaveEmployee} className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl hover:bg-emerald-700 transition-all uppercase tracking-widest text-xs">Finalizar Registro</button>
        </div>
      </Modal>

      {selectedEmployee && (
        <Modal isOpen={!!selectedEmployee} onClose={() => setSelectedEmployee(null)} title="Ficha Técnica y Historial Laboral">
          <div className="space-y-8 printable-report p-4">
            <div className="hidden print:block text-center mb-10 border-b-2 border-gray-100 pb-6">
               <h1 className="text-3xl font-black text-blue-900 uppercase">ASIST UP - REPORTE DE HISTORIAL LABORAL</h1>
               <p className="text-xs font-bold text-gray-500 mt-2 uppercase">Generado el: {new Date().toLocaleString()}</p>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
               <div className="w-40 h-48 bg-gray-100 rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white ring-1 ring-gray-100">
                  <img src={selectedEmployee.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedEmployee.name}`} className="w-full h-full object-cover" />
               </div>
               <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedEmployee.name}</h2>
                    <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">{selectedEmployee.role} • {selectedEmployee.isFixed ? 'Personal Fijo' : 'Personal Temporal'}</p>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 text-xs font-bold">
                     <div><p className="text-gray-400 uppercase text-[9px] mb-1">Identificación</p><p className="text-slate-800">{selectedEmployee.identification}</p></div>
                     <div><p className="text-gray-400 uppercase text-[9px] mb-1">Fecha Vinculación</p><p className="text-slate-800">{selectedEmployee.startDate}</p></div>
                     <div><p className="text-gray-400 uppercase text-[9px] mb-1">Afiliado IESS</p><p className={selectedEmployee.isAffiliated ? 'text-emerald-600' : 'text-red-600'}>{selectedEmployee.isAffiliated ? 'SÍ' : 'NO'}</p></div>
                     <div><p className="text-gray-400 uppercase text-[9px] mb-1">Tipo de Sangre</p><p className="text-slate-800">{selectedEmployee.bloodType}</p></div>
                     <div><p className="text-gray-400 uppercase text-[9px] mb-1">Contacto Emergencia</p><p className="text-slate-800">{selectedEmployee.emergencyContact.name} ({selectedEmployee.emergencyContact.phone})</p></div>
                     <div><p className="text-gray-400 uppercase text-[9px] mb-1">Horas Totales</p><p className="text-slate-800 font-black">{selectedEmployee.totalHoursWorked.toFixed(1)} h</p></div>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100">
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Faltas Acumuladas</p>
                  <p className="text-4xl font-black text-red-900">{selectedEmployee.justifications.filter(j => j.type === 'Falta').length} <span className="text-xs">Días</span></p>
               </div>
               <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Atrasos Registrados</p>
                  <p className="text-4xl font-black text-amber-900">{selectedEmployee.justifications.filter(j => j.type === 'Atraso').length} <span className="text-xs">Eventos</span></p>
               </div>
               <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Sueldo Actual</p>
                  <p className="text-4xl font-black text-blue-900">${selectedEmployee.salary.toFixed(2)}</p>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex justify-between">
                     Historial de Pagos <span>Total: {getEmpPayments(selectedEmployee.id).length}</span>
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scroll">
                     {getEmpPayments(selectedEmployee.id).map((p, i) => (
                       <div key={i} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl border-b border-gray-50 last:border-0">
                         <div>
                            <p className="text-xs font-black text-slate-800">{p.type === 'Salary' ? 'SUELDO/ABONO' : p.type.toUpperCase()}</p>
                            <p className="text-[10px] font-bold text-gray-400">{p.date} • {p.month}</p>
                         </div>
                         <p className="font-black text-emerald-600">${p.amount.toFixed(2)}</p>
                       </div>
                     ))}
                  </div>
               </div>

               <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Observaciones de Desempeño</h4>
                    {selectedEmployee.status === 'active' && (
                      <button onClick={() => setIsObservationModalOpen(true)} className="text-[10px] font-black text-blue-600">+ AGREGAR</button>
                    )}
                  </div>
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scroll">
                     {selectedEmployee.observations.map((o, i) => (
                       <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                         <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{o.date}</p>
                         <p className="text-xs font-medium text-slate-700 leading-relaxed">{o.text}</p>
                       </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="flex justify-between items-center pt-8 border-t border-gray-100 no-print">
               <div className="flex flex-wrap gap-2">
                  <button onClick={() => window.print()} className="px-6 py-3 bg-slate-900 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-md">Imprimir Historial</button>
                  <button onClick={() => setIsAttendancePrintModalOpen(true)} className="px-6 py-3 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-md">Reporte Asistencia</button>
                  {selectedEmployee.status === 'active' && (
                    <button onClick={() => setIsAbsenceModalOpen(true)} className="px-6 py-3 bg-amber-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-md">Reportar Incidencia</button>
                  )}
               </div>
               
               {selectedEmployee.status === 'active' ? (
                 <button 
                  onClick={() => { if(confirm("¿Desea desvincular al empleado? Esta acción es irreversible.")) setIsTerminationModalOpen(true); }}
                  className="px-6 py-3 bg-red-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-md"
                 >
                   Procesar Desvinculación
                 </button>
               ) : (
                 <div className="text-right">
                    <p className="text-[10px] font-black text-red-600 uppercase mb-1">Empleado Desvinculado el:</p>
                    <p className="text-lg font-black text-red-900 uppercase">{selectedEmployee.terminationDate}</p>
                 </div>
               )}
            </div>

            <div className="hidden print:grid grid-cols-2 gap-20 mt-32">
               <div className="border-t-2 border-slate-900 pt-4 text-center">
                  <p className="text-xs font-black uppercase text-slate-900">ADMINISTRACIÓN - TALENTO HUMANO</p>
               </div>
               <div className="border-t-2 border-slate-900 pt-4 text-center">
                  <p className="text-xs font-black uppercase text-slate-900">COLABORADOR / EX-COLABORADOR</p>
               </div>
            </div>
          </div>
        </Modal>
      )}

      {isAttendancePrintModalOpen && selectedEmployee && (
        <Modal isOpen={isAttendancePrintModalOpen} onClose={() => setIsAttendancePrintModalOpen(false)} title={`Reporte Cronológico de Asistencia - ${selectedEmployee.name}`}>
          <div className="printable-attendance space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-blue-900 uppercase">REGISTRO DE ASISTENCIA INDIVIDUAL</h2>
              <p className="text-sm font-bold text-gray-500">{selectedEmployee.name} | C.I. {selectedEmployee.identification}</p>
            </div>
            
            <div className="space-y-6">
              {/* Agrupación mensual simulada */}
              <div className="border border-gray-100 rounded-3xl p-6 bg-gray-50/50">
                 <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">Historial de Marcaciones</h4>
                 <table className="w-full text-left text-[10px]">
                   <thead className="border-b">
                     <tr className="font-black text-gray-400 uppercase">
                       <th className="py-2">Fecha</th>
                       <th className="py-2">Hora</th>
                       <th className="py-2">Evento</th>
                       <th className="py-2">IP / Dispositivo</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y">
                     {getEmpAttendance(selectedEmployee.id).sort((a,b) => b.timestamp.localeCompare(a.timestamp)).map(a => (
                       <tr key={a.id} className="font-medium text-slate-700">
                         <td className="py-2">{new Date(a.timestamp).toLocaleDateString()}</td>
                         <td className="py-2">{new Date(a.timestamp).toLocaleTimeString()}</td>
                         <td className="py-2 uppercase font-black">{a.type === 'in' ? 'Entrada' : 'Salida'}</td>
                         <td className="py-2 text-gray-300 italic">Terminal Admin</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                 {getEmpAttendance(selectedEmployee.id).length === 0 && <p className="p-10 text-center text-gray-400 italic">No hay registros de marcación.</p>}
              </div>
            </div>
            
            <div className="flex justify-end pt-6 no-print">
               <button onClick={() => window.print()} className="px-8 py-3 bg-blue-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Imprimir Reporte Cronológico</button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODALES DE ACCIÓN... (Desvinculación, Incidencia, Observación) - Se mantienen igual que en la versión previa */}
      <Modal isOpen={isTerminationModalOpen} onClose={() => setIsTerminationModalOpen(false)} title="Terminación de Relación Laboral" type="error">
        <div className="space-y-6">
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center gap-3 text-red-700">
             <span className="text-2xl">⚠️</span>
             <p className="text-xs font-bold leading-tight uppercase">ADVERTENCIA: Esta acción deshabilitará el PIN de asistencia y lo dará de baja de la nómina activa permanentemente.</p>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase">Fecha Efectiva de Desvinculación</label>
            <input type="date" value={terminationForm.date} onChange={e => setTerminationForm({...terminationForm, date: e.target.value})} className="w-full border-gray-200 border rounded-xl p-3 font-bold" />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase">Motivo Legal / Administrativo</label>
            <select value={terminationForm.reason} onChange={e => setTerminationForm({...terminationForm, reason: e.target.value as any})} className="w-full border-gray-200 border rounded-xl p-3 font-bold">
              {Object.values(TerminationReason).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase">Justificación Detallada</label>
            <textarea value={terminationForm.details} onChange={e => setTerminationForm({...terminationForm, details: e.target.value})} className="w-full border-gray-200 border rounded-xl p-3 min-h-[100px] outline-none" placeholder="Escriba los pormenores de la salida del empleado..." />
          </div>
          <button onClick={handleTerminate} className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl hover:bg-red-700 transition-all uppercase text-xs tracking-widest">Confirmar Salida Legal</button>
        </div>
      </Modal>

      <Modal isOpen={isAbsenceModalOpen} onClose={() => setIsAbsenceModalOpen(false)} title="Reporte de Incidencia de Asistencia" type="warning">
        <div className="space-y-4">
           <div>
              <label className="text-[10px] font-black text-gray-500 uppercase">Tipo de Incidencia</label>
              <select value={absenceForm.type} onChange={e => setAbsenceForm({...absenceForm, type: e.target.value as any})} className="w-full border-gray-200 border rounded-xl p-3 font-bold">
                 <option value="Falta">Falta Injustificada</option>
                 <option value="Atraso">Atraso / Retraso</option>
                 <option value="Permiso">Permiso Autorizado</option>
              </select>
           </div>
           <div>
              <label className="text-[10px] font-black text-gray-500 uppercase">Fecha del Evento</label>
              <input type="date" value={absenceForm.date} onChange={e => setAbsenceForm({...absenceForm, date: e.target.value})} className="w-full border-gray-200 border rounded-xl p-3" />
           </div>
           <div>
              <label className="text-[10px] font-black text-gray-500 uppercase">Detalle / Justificación</label>
              <textarea value={absenceForm.reason} onChange={e => setAbsenceForm({...absenceForm, reason: e.target.value})} className="w-full border-gray-200 border rounded-xl p-3 min-h-[80px]" placeholder="Motivo del evento..." />
           </div>
           <button onClick={handleAddAbsence} className="w-full py-3 bg-blue-700 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg">Registrar en Expediente</button>
        </div>
      </Modal>

      <Modal isOpen={isObservationModalOpen} onClose={() => setIsObservationModalOpen(false)} title="Nueva Observación de Desempeño">
        <div className="space-y-4">
           <div>
              <label className="text-[10px] font-black text-gray-500 uppercase">Contenido de la Observación</label>
              <textarea value={observationForm.text} onChange={e => setObservationForm({...observationForm, text: e.target.value})} className="w-full border-gray-200 border rounded-xl p-3 min-h-[120px] outline-none focus:border-blue-500" placeholder="Escriba aquí la retroalimentación o evento observado..." />
           </div>
           <button onClick={handleAddObservation} className="w-full py-3 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest">Guardar en Ficha</button>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeModule;
