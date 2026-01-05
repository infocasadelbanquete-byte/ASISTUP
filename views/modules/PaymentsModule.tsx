import React, { useState } from 'react';
import { Employee, Payment, Role } from '../../types.ts';
import Modal from '../../components/Modal.tsx';
import { db, doc, deleteDoc } from '../../firebase.ts';

interface PaymentsModuleProps {
  employees: Employee[];
  payments: Payment[];
  onUpdate: (payments: Payment[]) => void;
  role: Role;
}

const PaymentsModule: React.FC<PaymentsModuleProps> = ({ employees, payments, onUpdate, role }) => {
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info'}>({
    isOpen: false, title: '', message: '', type: 'info'
  });

  const [payForm, setPayForm] = useState<Partial<Payment>>({
    type: 'Salary', 
    amount: 0, 
    method: 'Efectivo', 
    concept: '', 
    month: new Date().toLocaleString('es-EC', {month: 'long'}).toUpperCase(), 
    year: '2026', 
    status: 'paid'
  });

  const getPendingBalance = (empId: string, month: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return 0;
    
    const totalPaid = payments
      .filter(p => p.employeeId === empId && p.month === month && p.status === 'paid' && p.type === 'Salary')
      .reduce((sum, p) => sum + p.amount, 0);
      
    return Math.max(0, emp.salary - totalPaid);
  };

  const handleCreate = () => {
    if (!payForm.employeeId || !payForm.amount) {
        setFeedback({ isOpen: true, title: "Falta Información", message: "Seleccione empleado y monto para el pago.", type: "error" });
        return;
    }
    
    const balanceBefore = getPendingBalance(payForm.employeeId, payForm.month!);
    const remaining = payForm.type === 'Salary' ? balanceBefore - payForm.amount! : 0;
    
    const newPay: Payment = {
      ...payForm,
      id: Math.random().toString(36).substr(2, 15),
      date: new Date().toISOString(),
      balanceAfter: remaining,
      isPartial: remaining > 0
    } as Payment;

    onUpdate([newPay, ...payments]);
    setIsPayOpen(false);
    setFeedback({ isOpen: true, title: "Operación Exitosa", message: "Haber registrado y sincronizado con tesorería.", type: "success" });
  };

  const handleVoid = (id: string) => {
    const reason = prompt("Justificación obligatoria de anulación:");
    if (!reason) {
        setFeedback({ isOpen: true, title: "Cancelado", message: "La anulación requiere una justificación válida.", type: "error" });
        return;
    }
    onUpdate(payments.map(p => p.id === id ? { ...p, status: 'void', voidJustification: reason } : p));
    setFeedback({ isOpen: true, title: "Anulado", message: "El registro ha sido invalidado.", type: "info" });
  };

  const handleDeletePayment = async (id: string) => {
    if (confirm("¿Está seguro de eliminar este registro de pago de forma permanente?")) {
      try {
        await deleteDoc(doc(db, "payments", id));
        onUpdate(payments.filter(p => p.id !== id));
        setFeedback({ isOpen: true, title: "Registro Eliminado", message: "El pago ha sido borrado del sistema.", type: "success" });
      } catch (e) {
        setFeedback({ isOpen: true, title: "Error", message: "No se pudo eliminar el registro.", type: "error" });
      }
    }
  };

  const filteredPayments = payments.filter(p => {
    const emp = employees.find(e => e.id === p.employeeId);
    const searchStr = ((emp?.name || "") + " " + (emp?.surname || "") + " " + (emp?.identification || "") + " " + p.concept + " " + p.type).toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 gap-6">
        <h2 className="text-2xl font-black text-slate-900 uppercase">Tesorería y Gestión de Pagos</h2>
        <div className="flex gap-4 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Filtrar por Empleado o Concepto..." 
            className="flex-1 md:w-64 p-3 border rounded-xl text-[10px] font-bold uppercase" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
          />
          <button 
            onClick={() => {
              if (role === Role.PARTIAL_ADMIN || role === Role.SUPER_ADMIN) setIsPayOpen(true);
              else setFeedback({ isOpen: true, title: "Permisos Insuficientes", message: "No tiene privilegios para registrar desembolsos.", type: "error" });
            }} 
            className="px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg hover:bg-emerald-700 transition-all uppercase text-[10px] tracking-widest"
          >
            Nuevo Pago
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-8 py-4">Fecha / Mes</th>
              <th className="px-8 py-4">Empleado</th>
              <th className="px-8 py-4">Monto</th>
              <th className="px-8 py-4">Tipo</th>
              <th className="px-8 py-4">Estado</th>
              <th className="px-8 py-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPayments.map(p => {
              const emp = employees.find(e => e.id === p.employeeId);
              return (
                <tr key={p.id} className="text-xs hover:bg-slate-50/50 transition-all">
                  <td className="px-8 py-4">
                    <p className="font-bold">{new Date(p.date).toLocaleDateString()}</p>
                    <p className="text-[9px] uppercase font-black text-slate-400">{p.month}</p>
                  </td>
                  <td className="px-8 py-4 font-black uppercase text-slate-700">
                    {emp?.surname} {emp?.name}
                    <span className="block text-[8px] font-normal text-slate-400 lowercase">{p.concept}</span>
                  </td>
                  <td className="px-8 py-4 font-black text-slate-900 text-sm">${p.amount.toFixed(2)}</td>
                  <td className="px-8 py-4">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${p.type === 'ExtraHours' ? 'bg-blue-100 text-blue-700' : p.type === 'BackPay' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{p.type === 'BackPay' ? 'Pago Atrasado' : p.type}</span>
                  </td>
                  <td className="px-8 py-4">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${p.status === 'paid' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>{p.status === 'paid' ? 'Pagado' : 'Anulado'}</span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      {p.status === 'paid' && role === Role.SUPER_ADMIN && (
                        <button onClick={() => handleVoid(p.id)} className="text-amber-600 font-black text-[9px] uppercase hover:underline">Anular</button>
                      )}
                      {role === Role.SUPER_ADMIN && (
                        <button onClick={() => handleDeletePayment(p.id)} className="text-red-600 font-black text-[9px] uppercase hover:underline">Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} title="Registro de Pago / Haber">
        <div className="space-y-4">
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400">Colaborador Beneficiario</label>
            <select className="w-full border-2 p-3 rounded-xl bg-slate-50" onChange={e => setPayForm({...payForm, employeeId: e.target.value})}>
              <option value="">Seleccionar...</option>
              {employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.surname} {e.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Concepto</label>
              <select className="w-full border-2 p-3 rounded-xl bg-slate-50" value={payForm.type} onChange={e => setPayForm({...payForm, type: e.target.value as any})}>
                <option value="Salary">Sueldo / Abono</option>
                <option value="BackPay">Pago Atrasado / Saldo Pendiente</option>
                <option value="ExtraHours">Horas Extras/Supl.</option>
                <option value="Bonus">Bono / Comisiones</option>
                <option value="Loan">Préstamo</option>
                <option value="Settlement">Liquidación</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400">Mes Aplicable</label>
              <select className="w-full border-2 p-3 rounded-xl bg-slate-50" value={payForm.month} onChange={e => setPayForm({...payForm, month: e.target.value})}>
                {['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400">Monto ($)</label>
            <input type="number" step="0.01" className="w-full border-2 p-3 rounded-xl bg-slate-50 font-black text-xl" onChange={e => setPayForm({...payForm, amount: Number(e.target.value)})} />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400">Observación</label>
            <textarea className="w-full border-2 p-3 rounded-xl bg-slate-50 h-20" placeholder="Ej: Saldo pendiente de Noviembre 2025" onChange={e => setPayForm({...payForm, concept: e.target.value})}></textarea>
          </div>
          <button onClick={handleCreate} className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl uppercase text-xs shadow-xl active:scale-95 transition-all">Sincronizar Pago</button>
        </div>
      </Modal>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
          <div className="text-center space-y-6">
              <p className="text-slate-600 font-bold uppercase text-[12px]">{feedback.message}</p>
              <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest">Aceptar</button>
          </div>
      </Modal>
    </div>
  );
};

export default PaymentsModule;