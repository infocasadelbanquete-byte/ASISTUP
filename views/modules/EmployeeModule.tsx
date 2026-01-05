import React, { useState, useEffect } from 'react';
import { Employee, Role, BloodType, TerminationReason, Gender, CivilStatus } from '../../types.ts';
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
  
  const initialForm: Partial<Employee> = {
    name: '', surname: '', identification: '', birthDate: '', phone: '', email: '', 
    gender: Gender.MASCULINO, civilStatus: CivilStatus.SOLTERO,
    origin: 'ECUATORIANA', address: '', 
    bloodType: BloodType.O_POS, startDate: new Date().toISOString().split('T')[0],
    role: Role.EMPLOYEE, salary: 482.00, status: 'active', photo: '', pin: '',
    emergencyContact: { name: '', phone: '' },
    isFixed: true, isAffiliated: true, overSalaryType: 'monthly',
    bankInfo: { ifi: 'Banco del Austro', type: 'Ahorros', account: '' }
  };

  const [form, setForm] = useState<Partial<Employee>>(initialForm);

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
      reader.onloadend = () => setForm(prev => ({ ...prev, photo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!form.name || !form.surname || !form.identification) {
      alert("Nombres, apellidos e identificación son requeridos.");
      return;
    }

    let updatedList;
    if (editingEmp) {
      updatedList = employees.map(e => e.id === editingEmp.id ? { ...e, ...form } as Employee : e);
    } else {
      // PIN Automático de 6 dígitos
      const autoPin = Math.floor(100000 + Math.random() * 900000).toString();
      const newEmp = { 
        ...form, 
        id: Math.random().toString(36).substr(2, 9), 
        pin: autoPin,
        pinChanged: false,
        pinNeedsReset: false,
        observations: [],
        absences: [],
        totalHoursWorked: 0
      } as Employee;
      updatedList = [...employees, newEmp];
      alert(`Empleado registrado. PIN Temporal asignado: ${autoPin}`);
    }
    onUpdate(updatedList);
    setIsModalOpen(false);
  };

  const resetPin = (id: string) => {
    const newAutoPin = Math.floor(100000 + Math.random() * 900000).toString();
    const updated = employees.map(e => e.id === id ? { ...e, pin: newAutoPin, pinChanged: false, pinNeedsReset: true } : e);
    onUpdate(updated);
    alert(`PIN Reseteado. Nuevo PIN Temporal: ${newAutoPin}`);
  };

  const exportEmployeesToExcel = () => {
    const headers = "Identificacion,Nombres,Apellidos,Sexo,Estado Civil,Sueldo,Cargo,Estatus\n";
    const rows = employees.map(e => `${e.identification},${e.name},${e.surname},${e.gender},${e.civilStatus},${e.salary},${e.role},${e.status}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Personal_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex justify-between items-center no-print">
        <div>
          <h2 className="text-xl font-[950] text-slate-900 tracking-tighter uppercase">Gestión de Talento</h2>
        </div>
        <div className="flex gap-3">
          <button onClick={exportEmployeesToExcel} className="px-6 py-4 bg-emerald-50 text-emerald-600 font-black rounded-2xl border border-emerald-100 uppercase text-[9px] tracking-widest">Excel</button>
          <button onClick={() => { setForm(initialForm); setEditingEmp(null); setIsModalOpen(true); }} className="px-8 py-4 bg-blue-700 text-white font-black rounded-2xl shadow-lg uppercase text-[10px] tracking-widest">Nuevo Ingreso</button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Ficha Colaborador</th>
                <th className="px-6 py-4">Estado Civil / Sexo</th>
                <th className="px-6 py-4 text-center">Estatus</th>
                <th className="px-6 py-4 text-right">Acciones</th>
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
                  <td className="px-6 py-3">
                    <p className="text-slate-700 text-[10px]">{emp.civilStatus}</p>
                    <p className="text-slate-400 text-[8px]">{emp.gender}</p>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {emp.status === 'active' ? 'Activo' : 'Liquidado'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right flex gap-2 justify-end">
                     <button onClick={() => resetPin(emp.id)} className="px-3 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[8px] font-black uppercase">Reset PIN</button>
                     <button onClick={() => setViewingEmp(emp)} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[8px] font-black uppercase">Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEmp ? "Editar Ficha" : "Registro Personal"}>
         <div className="space-y-6 max-h-[75vh] overflow-y-auto px-2 custom-scroll">
            <div className="grid grid-cols-2 gap-4">
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Nombres*</label>
                  <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.name} onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} />
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Apellidos*</label>
                  <input className="w-full border-2 p-3 rounded-xl text-xs font-black uppercase" value={form.surname} onChange={e => setForm({...form, surname: e.target.value.toUpperCase()})} />
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Cédula*</label>
                  <input maxLength={10} className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.identification} onChange={e => setForm({...form, identification: e.target.value.replace(/\D/g,'')})} />
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Sexo</label>
                  <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.gender} onChange={e => setForm({...form, gender: e.target.value as Gender})}>
                     {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Estado Civil</label>
                  <select className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.civilStatus} onChange={e => setForm({...form, civilStatus: e.target.value as CivilStatus})}>
                     {Object.values(CivilStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
               </div>
               <div className="col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Sueldo Base*</label>
                  <input type="number" className="w-full border-2 p-3 rounded-xl text-xs font-black" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} />
               </div>
               <div className="col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Foto (Cargar archivo)</label>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="w-full text-[9px] mt-2" />
               </div>
            </div>
            <div className="flex gap-3 mt-6 no-print">
               <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px]">Imprimir Formulario</button>
               <button onClick={handleSave} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px]">Guardar Expediente</button>
            </div>
         </div>
      </Modal>

      <Modal isOpen={!!viewingEmp} onClose={() => setViewingEmp(null)} title="Vista de Expediente">
         {viewingEmp && (
            <div className="space-y-6">
               <div className="flex gap-6 border-b pb-6">
                  <div className="w-24 h-24 bg-slate-100 rounded-3xl overflow-hidden shrink-0 border-2 border-white shadow-xl">
                    {viewingEmp.photo ? <img src={viewingEmp.photo} className="w-full h-full object-cover" /> : '👤'}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase">{viewingEmp.name} {viewingEmp.surname}</h3>
                    <p className="text-blue-600 font-bold uppercase text-[9px] tracking-widest">{viewingEmp.role}</p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 text-[10px] font-bold uppercase">
                       <p><span className="text-slate-400">CI:</span> {viewingEmp.identification}</p>
                       <p><span className="text-slate-400">Sueldo:</span> ${viewingEmp.salary}</p>
                       <p><span className="text-slate-400">Estado:</span> {viewingEmp.civilStatus}</p>
                       <p><span className="text-slate-400">Sexo:</span> {viewingEmp.gender}</p>
                    </div>
                  </div>
               </div>
               <button onClick={() => window.print()} className="w-full py-4 bg-slate-50 text-slate-900 font-black rounded-xl border uppercase text-[10px] no-print">Imprimir Expediente Completo</button>
            </div>
         )}
      </Modal>
    </div>
  );
};

export default EmployeeModule;