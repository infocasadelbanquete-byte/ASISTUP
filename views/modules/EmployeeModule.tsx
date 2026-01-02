import React, { useState } from 'react';
import { Employee, Role, BloodType, TerminationReason, AbsenceRecord, CompanyConfig } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface EmployeeModuleProps {
  employees: Employee[];
  onUpdate: (employees: Employee[]) => void;
  role: Role;
  attendance: any[];
  payments: any[];
  company: CompanyConfig | null;
}

const EmployeeModule: React.FC<EmployeeModuleProps> = ({ employees, onUpdate, role, company }) => {
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
    role: Role.EMPLOYEE, isFixed: true, salary: 482.00, isAffiliated: true, overSalaryType: 'accumulate',
    bankInfo: { ifi: '', type: 'Ahorros', account: '' }, photo: '', pin: '',
    status: 'active', observations: [], absences: [], totalHoursWorked: 0
  };

  const [form, setForm] = useState<Partial<Employee>>(initialForm);

  const validateForm = () => {
    if (!form.name || !form.surname || !form.identification || !form.pin) return "Datos básicos obligatorios faltantes.";
    if (form.pin?.length !== 6) return "PIN debe ser de 6 dígitos estrictamente.";
    if (form.phone?.length !== 10) return "El celular debe tener estrictamente 10 dígitos.";
    if (!form.emergencyContact?.name || !form.emergencyContact?.phone) return "Contacto de emergencia es obligatorio (Nombre y Teléfono).";
    if (form.emergencyContact.phone.length !== 10) return "El teléfono de emergencia debe tener 10 dígitos.";
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
    alert("Expediente de personal guardado con éxito.");
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
    alert("Empleado desvinculado con éxito. Se generará el acta de cese de funciones.");
    setTimeout(() => window.print(), 500);
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border flex justify-between items-center no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Gestión de Talento Humano</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Registros, Fichas e Historiales</p>
        </div>
        <button onClick={() => { setForm(initialForm); setEditingEmp(null); setIsModalOpen(true); }} className="px-8 py-4 bg-blue-700 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest hover:scale-105 transition-all">Registrar Empleado</button>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden no-print">
        <div className="p-6 bg-slate-50 border-b flex gap-4">
          <input type="text" placeholder="Buscar por nombre, apellido o ID..." className="flex-1 bg-white border p-3 rounded-xl text-xs font-bold focus:border-blue-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-8 py-4">Foto</th>
              <th className="px-8 py-4">Colaborador</th>
              <th className="px-8 py-4">Rol en Sistema</th>
              <th className="px-8 py-4">Estado</th>
              <th className="px-8 py-4 text-right">Expediente</th>
            </tr>
          </thead>
          <tbody className="divide-y text-xs">
            {employees.filter(e => (e.name + " " + e.surname + " " + e.identification).toLowerCase().includes(searchTerm.toLowerCase())).map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-8 py-4">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border">
                    {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : null}
                  </div>
                </td>
                <td className="px-8 py-4">
                   <p className="font-black uppercase text-slate-900">{emp.name} {emp.surname}</p>
                   <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">{emp.identification}</p>
                </td>
                <td className="px-8 py-4 font-bold text-slate-400 uppercase">{emp.role}</td>
                <td className="px-8 py-4">
                  <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{emp.status}</span>
                </td>
                <td className="px-8 py-4 text-right">
                   <button onClick={() => setViewingEmp(emp)} className="text-blue-600 font-black uppercase hover:underline">Ver Ficha Completa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingEmp ? "Editar Expediente Laboral" : "Nuevo Registro de Personal"}
        footer={
           <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">Regresar al Listado</button>
        }
      >
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-4 custom-scroll">
           <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 flex flex-col items-center gap-2">
                 <div className="w-28 h-28 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group">
                    {form.photo ? <img src={form.photo} className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-slate-300 uppercase">Subir Foto</span>}
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                       const file = e.target.files?.[0];
                       if(file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setForm({...form, photo: reader.result as string});
                          reader.readAsDataURL(file);
                       }
                    }} />
                 </div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Imagen Identificativa</p>
              </div>

              <div><label className="text-[9px] font-black uppercase text-slate-400">Nombres del empleado</label><input required className="w-full border-2 p-3 rounded-xl focus:border-blue-500 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><label className="text-[9px] font-black uppercase text-slate-400">Apellidos del empleado</label><input required className="w-full border-2 p-3 rounded-xl focus:border-blue-500 outline-none" value={form.surname} onChange={e => setForm({...form, surname: e.target.value})} /></div>
              <div><label className="text-[9px] font-black uppercase text-slate-400">N° de identificación</label><input required className="w-full border-2 p-3 rounded-xl focus:border-blue-500 outline-none" value={form.identification} onChange={e => setForm({...form, identification: e.target.value})} /></div>
              <div><label className="text-[9px] font-black uppercase text-slate-400">PIN de Asistencia (6 dígitos)</label><input maxLength={6} required className="w-full border-2 border-blue-100 p-3 rounded-xl text-center font-black text-2xl tracking-widest" value={form.pin} onChange={e => setForm({...form, pin: e.target.value.replace(/\D/g,'')})} /></div>
              
              <div><label className="text-[9px] font-black uppercase text-slate-400">Fecha de nacimiento</label><input type="date" required className="w-full border-2 p-3 rounded-xl" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} /></div>
              <div><label className="text-[9px] font-black uppercase text-slate-400">Procedencia (Lugar de origen)</label><input required className="w-full border-2 p-3 rounded-xl focus:border-blue-500 outline-none" value={form.origin} onChange={e => setForm({...form, origin: e.target.value})} /></div>
              
              <div className="col-span-2"><label className="text-[9px] font-black uppercase text-slate-400">Dirección de domicilio completa</label><input required className="w-full border-2 p-3 rounded-xl focus:border-blue-500 outline-none" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
              
              <div><label className="text-[9px] font-black uppercase text-slate-400">Teléfono (Celular estrictamente 10 dígitos)</label><input maxLength={10} required className="w-full border-2 p-3 rounded-xl focus:border-blue-500 outline-none" value={form.phone} onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g,'')})} /></div>
              <div><label className="text-[9px] font-black uppercase text-slate-400">Correo electrónico</label><input type="email" required className="w-full border-2 p-3 rounded-xl focus:border-blue-500 outline-none" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              
              <div><label className="text-[9px] font-black uppercase text-slate-400">Tipo de sangre</label>
                 <select className="w-full border-2 p-3 rounded-xl" value={form.bloodType} onChange={e => setForm({...form, bloodType: e.target.value as BloodType})}>
                    {Object.values(BloodType).map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
              </div>
              <div><label className="text-[9px] font-black uppercase text-slate-400">Fecha de vinculación (Ingreso)</label><input type="date" required className="w-full border-2 p-3 rounded-xl" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} /></div>
              
              <div className="col-span-2 border-t pt-4">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contacto de Emergencia (Obligatorio)</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Nombre completo" className="w-full border-2 p-3 rounded-xl focus:border-blue-500 outline-none" value={form.emergencyContact?.name} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, name: e.target.value}})} />
                    <input maxLength={10} placeholder="Teléfono/Celular" className="w-full border-2 p-3 rounded-xl focus:border-blue-500 outline-none" value={form.emergencyContact?.phone} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, phone: e.target.value.replace(/\D/g,'')}})} />
                 </div>
              </div>

              <div className="col-span-2 bg-slate-50 p-6 rounded-3xl border border-slate-200">
                 <h4 className="text-[11px] font-black text-blue-800 uppercase tracking-widest mb-4">Condiciones Laborales y Bancarias</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[9px] font-black uppercase">Tipo de empleado</label>
                        <select className="w-full border p-2 rounded-lg bg-white" value={form.isFixed ? 'f' : 't'} onChange={e => setForm({...form, isFixed: e.target.value === 'f'})}>
                            <option value="f">Empleado Fijo</option>
                            <option value="t">Empleado Temporal</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase">Sueldo acordado ($)</label>
                        <input type="number" step="0.01" className="w-full border p-2 rounded-lg bg-white font-bold" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase">Afiliación IESS</label>
                        <select className="w-full border p-2 rounded-lg bg-white" value={form.isAffiliated ? 'si' : 'no'} onChange={e => {
                            const isA = e.target.value === 'si'; 
                            setForm({...form, isAffiliated: isA, overSalaryType: isA ? 'accumulate' : 'none'})
                        }}>
                            <option value="si">SÍ (Derecho a afiliación)</option>
                            <option value="no">NO (Sin derecho a afiliación/sobresueldos)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase">Sobre sueldos (Fondos Reserva)</label>
                        <select disabled={!form.isAffiliated} className="w-full border p-2 rounded-lg bg-white disabled:bg-slate-200 disabled:opacity-50" value={form.overSalaryType} onChange={e => setForm({...form, overSalaryType: e.target.value as any})}>
                            <option value="accumulate">Acumula</option>
                            <option value="monthly">Mensualiza</option>
                            <option value="none">No tiene derecho</option>
                        </select>
                        <p className="text-[8px] text-slate-400 mt-1 italic leading-none">Fondos de reserva se pagan a partir del segundo año.</p>
                    </div>
                    <div className="col-span-2 mt-4 space-y-3">
                       <label className="text-[10px] font-black uppercase text-blue-600 block border-b pb-1">Registro de Cuenta Bancaria</label>
                       <div className="grid grid-cols-3 gap-2">
                          <input placeholder="IFI (Ej: Banco Pichincha)" className="w-full border p-2 rounded-lg bg-white text-[11px]" value={form.bankInfo?.ifi} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, ifi: e.target.value}})} />
                          <select className="w-full border p-2 rounded-lg bg-white text-[11px]" value={form.bankInfo?.type} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, type: e.target.value as any}})}>
                             <option value="Ahorros">Ahorros</option>
                             <option value="Corriente">Corriente</option>
                          </select>
                          <input placeholder="# de Cuenta" className="w-full border p-2 rounded-lg bg-white text-[11px]" value={form.bankInfo?.account} onChange={e => setForm({...form, bankInfo: {...form.bankInfo!, account: e.target.value}})} />
                       </div>
                    </div>
                 </div>
              </div>

              <div><label className="text-[9px] font-black uppercase text-slate-400">Rol en el Sistema</label>
                 <select className="w-full border-2 p-3 rounded-xl focus:border-blue-500 outline-none" value={form.role} onChange={e => setForm({...form, role: e.target.value as Role})}>
                    {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                 </select>
              </div>
           </div>
           <button onClick={handleSave} className="w-full py-5 bg-blue-700 text-white font-black rounded-3xl shadow-xl uppercase text-xs tracking-widest hover:bg-blue-800 transition-all">Guardar Expediente Maestro</button>
        </div>
      </Modal>

      <Modal isOpen={!!viewingEmp} onClose={() => setViewingEmp(null)} title="Ficha Laboral Integral">
        {viewingEmp && (
          <div className="space-y-8 print:p-0">
             <header className="flex gap-8 items-center bg-slate-900 p-10 rounded-[2.5rem] text-white print:bg-white print:text-black print:border-b-2 print:border-black print:rounded-none">
                <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-white/20 print:border-black shadow-2xl">
                   {viewingEmp.photo ? <img src={viewingEmp.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center text-3xl">👤</div>}
                </div>
                <div className="flex-1">
                   <h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">{viewingEmp.name} {viewingEmp.surname}</h1>
                   <div className="flex gap-4">
                      <p className="text-blue-400 font-black text-xs uppercase tracking-widest print:text-black">ID: {viewingEmp.identification}</p>
                      <p className="text-white/40 font-black text-xs uppercase tracking-widest print:text-black">| Sangre: {viewingEmp.bloodType}</p>
                   </div>
                   <div className="flex gap-3 mt-6 no-print">
                      <span className="px-4 py-1.5 bg-white/10 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest">Desde: {viewingEmp.startDate}</span>
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${viewingEmp.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}>{viewingEmp.status === 'active' ? 'Activo' : 'Desvinculado'}</span>
                   </div>
                </div>
                <div className="no-print"><button onClick={() => window.print()} className="p-5 bg-white/10 rounded-2xl hover:bg-white/20 transition-all shadow-xl">🖨️</button></div>
             </header>

             <div className="grid grid-cols-2 gap-8 print:grid-cols-1">
                <section className="space-y-4">
                   <h3 className="text-[12px] font-black text-blue-700 uppercase tracking-widest border-b-2 border-blue-100 pb-2">Información del Personal</h3>
                   <div className="text-[11px] space-y-3">
                      <p className="flex justify-between border-b border-slate-50 pb-1"><span className="text-slate-400 uppercase">Procedencia:</span> <span className="font-black text-slate-900 uppercase">{viewingEmp.origin}</span></p>
                      <p className="flex justify-between border-b border-slate-50 pb-1"><span className="text-slate-400 uppercase">F. Nacimiento:</span> <span className="font-black text-slate-900">{viewingEmp.birthDate}</span></p>
                      <p className="flex justify-between border-b border-slate-50 pb-1"><span className="text-slate-400 uppercase">Teléfono:</span> <span className="font-black text-slate-900">{viewingEmp.phone}</span></p>
                      <p className="flex justify-between border-b border-slate-50 pb-1"><span className="text-slate-400 uppercase">Email:</span> <span className="font-black text-slate-900 lowercase">{viewingEmp.email}</span></p>
                      <p className="flex justify-between mt-6 p-4 bg-slate-50 rounded-2xl">
                         <span className="text-slate-500 uppercase font-black text-[9px]">Contacto Emergencia:</span> 
                         <span className="font-black text-slate-900 text-right uppercase leading-tight">{viewingEmp.emergencyContact?.name}<br/>{viewingEmp.emergencyContact?.phone}</span>
                      </p>
                   </div>
                </section>
                <section className="space-y-4">
                   <h3 className="text-[12px] font-black text-blue-700 uppercase tracking-widest border-b-2 border-blue-100 pb-2">Condiciones Contractuales</h3>
                   <div className="text-[11px] space-y-3">
                      <p className="flex justify-between border-b border-slate-50 pb-1"><span className="text-slate-400 uppercase">Tipo Contrato:</span> <span className="font-black text-slate-900 uppercase">{viewingEmp.isFixed ? 'Personal Fijo' : 'Personal Temporal'}</span></p>
                      <p className="flex justify-between border-b border-slate-50 pb-1"><span className="text-slate-400 uppercase">Sueldo Acordado:</span> <span className="font-black text-emerald-600 text-lg">${viewingEmp.salary.toFixed(2)}</span></p>
                      <p className="flex justify-between border-b border-slate-50 pb-1"><span className="text-slate-400 uppercase">IESS:</span> <span className="font-black text-slate-900 uppercase">{viewingEmp.isAffiliated ? 'SÍ (Afiliado)' : 'NO (Sin Afiliación)'}</span></p>
                      <p className="flex justify-between border-b border-slate-50 pb-1"><span className="text-slate-400 uppercase">Fondos Reserva:</span> <span className="font-black text-slate-900 uppercase">{viewingEmp.overSalaryType === 'accumulate' ? 'ACUMULA' : viewingEmp.overSalaryType === 'monthly' ? 'MENSUALIZA' : 'NO APLICA'}</span></p>
                      <div className="mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                         <span className="text-blue-700 uppercase font-black text-[9px] block mb-1">Datos Bancarios para Nómina:</span> 
                         <p className="text-[11px] font-black text-slate-900 uppercase">{viewingEmp.bankInfo?.ifi} - {viewingEmp.bankInfo?.type}</p>
                         <p className="text-[12px] font-black text-blue-600">CTA: {viewingEmp.bankInfo?.account}</p>
                      </div>
                   </div>
                </section>
             </div>

             <section className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200">
                <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-widest mb-6 flex justify-between">
                   <span>Resumen de historial laboral</span>
                   <span className="text-blue-600">Corte 2026</span>
                </h3>
                <div className="grid grid-cols-3 gap-6 text-center">
                   <div className="bg-white p-4 rounded-2xl shadow-sm border">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Faltas acumuladas</p>
                      <p className="text-2xl font-black text-red-600">{viewingEmp.absences?.filter(a => a.type === 'Falta').length || 0}</p>
                   </div>
                   <div className="bg-white p-4 rounded-2xl shadow-sm border">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Atrasos totales</p>
                      <p className="text-2xl font-black text-orange-500">{viewingEmp.absences?.filter(a => a.type === 'Atraso').length || 0}</p>
                   </div>
                   <div className="bg-white p-4 rounded-2xl shadow-sm border">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Horas trabajadas</p>
                      <p className="text-2xl font-black text-blue-600">{viewingEmp.totalHoursWorked || 0}h</p>
                   </div>
                </div>
                {viewingEmp.status === 'terminated' && (
                   <div className="mt-8 p-6 bg-red-50 border-2 border-red-200 rounded-3xl">
                      <h4 className="text-[10px] font-black text-red-700 uppercase mb-2 italic">Registro de Desvinculación:</h4>
                      <p className="text-xs font-bold text-slate-700">FECHA: {viewingEmp.terminationDate} | MOTIVO: {viewingEmp.terminationReason}</p>
                      <p className="text-[11px] text-slate-500 mt-2">Detalle: {viewingEmp.terminationDetails}</p>
                   </div>
                )}
             </section>

             <div className="flex gap-4 no-print">
                {viewingEmp.status === 'active' && (
                  <button onClick={() => { setIsTermModalOpen(true); }} className="flex-1 py-5 bg-red-600 text-white font-black rounded-3xl uppercase text-[11px] shadow-xl hover:bg-red-700 transition-all">Desvinculación Laboral</button>
                )}
                <button onClick={() => { setEditingEmp(viewingEmp); setForm(viewingEmp); setIsModalOpen(true); setViewingEmp(null); }} className="flex-1 py-5 bg-slate-900 text-white font-black rounded-3xl uppercase text-[11px] shadow-xl hover:bg-slate-800 transition-all">Editar Ficha</button>
                <button onClick={() => setViewingEmp(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-3xl uppercase text-[11px] shadow-sm hover:bg-slate-200 transition-all">Regresar</button>
             </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isTermModalOpen} onClose={() => setIsTermModalOpen(false)} title="Proceso de Cese de Funciones">
         <div className="space-y-6">
            <div className="p-5 bg-red-50 border-2 border-red-100 text-red-800 rounded-3xl text-[10px] font-black uppercase italic text-center leading-relaxed">
               ¿Confirmar desvinculación? Al proceder, se bloqueará el acceso al sistema y se registrará la baja definitiva del personal fijo.
            </div>
            <div className="space-y-4">
               <div><label className="text-[9px] font-black uppercase text-slate-400">Fecha de desvinculación</label><input type="date" id="t_date" className="w-full border-2 p-4 rounded-2xl focus:border-red-500 outline-none font-bold" defaultValue={new Date().toISOString().split('T')[0]} /></div>
               <div><label className="text-[9px] font-black uppercase text-slate-400">Motivo de la desvinculación</label>
                  <select id="t_reason" className="w-full border-2 p-4 rounded-2xl focus:border-red-500 outline-none font-bold">
                     {Object.values(TerminationReason).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
               </div>
               <div><label className="text-[9px] font-black uppercase text-slate-400">Argumentación / Observaciones</label><textarea id="t_details" className="w-full border-2 p-4 rounded-2xl h-28 focus:border-red-500 outline-none" placeholder="En caso de 'Otro' u observaciones adicionales, detalle aquí..."></textarea></div>
               <div className="flex gap-4">
                 <button onClick={() => setIsTermModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black rounded-2xl uppercase text-xs tracking-widest">Atrás</button>
                 <button onClick={() => {
                    const date = (document.getElementById('t_date') as HTMLInputElement).value;
                    const reason = (document.getElementById('t_reason') as HTMLSelectElement).value;
                    const details = (document.getElementById('t_details') as HTMLTextAreaElement).value;
                    if (reason === 'Otro' && !details) return alert("Si señala 'Otro', debe argumentar el motivo obligatoriamente.");
                    handleTermination({ date, reason, details });
                 }} className="flex-[2] py-4 bg-red-600 text-white font-black rounded-2xl uppercase text-xs shadow-2xl hover:bg-red-700 transition-all">Registrar Baja definitiva</button>
               </div>
            </div>
         </div>
      </Modal>
    </div>
  );
};

export default EmployeeModule;