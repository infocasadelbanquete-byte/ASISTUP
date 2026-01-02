
import React, { useState } from 'react';
import { Employee, Payment, Role } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface PaymentsModuleProps {
  employees: Employee[];
  payments: Payment[];
  onUpdate: (payments: Payment[]) => void;
  role: Role;
}

const PaymentsModule: React.FC<PaymentsModuleProps> = ({ employees, payments, onUpdate, role }) => {
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payForm, setPayForm] = useState<Partial<Payment>>({
    type: 'Salary', amount: 0, method: 'Efectivo', concept: '', month: new Date().toLocaleString('es-EC', {month: 'long'}).toUpperCase(), year: '2024'
  });

  const handleCreate = () => {
    if (!payForm.employeeId || !payForm.amount) return alert("Seleccione empleado y monto.");
    const newPay: Payment = {
      ...payForm,
      id: Math.random().toString(36).substr(2, 15),
      date: new Date().toISOString(),
      status: 'paid'
    } as Payment;
    onUpdate([newPay, ...payments]);
    setIsPayOpen(false);
  };

  const handleVoid = (id: string) => {
    const reason = prompt("Justificación de anulación:");
    if (!reason) return;
    onUpdate(payments.map(p => p.id === id ? { ...p, status: 'void', voidJustification: reason } : p));
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border">
        <h2 className="text-2xl font-black text-slate-900 uppercase">Tesorería y Pagos</h2>
        <button onClick={() => setIsPayOpen(true)} className="px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg hover:bg-emerald-700 transition-all uppercase text-[10px] tracking-widest">Nuevo Pago / Desembolso</button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-8 py-4">Fecha</th>
              <th className="px-8 py-4">Empleado</th>
              <th className="px-8 py-4">Tipo / Concepto</th>
              <th className="px-8 py-4">Valor</th>
              <th className="px-8 py-4">Estado</th>
              <th className="px-8 py-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payments.map(p => {
              const emp = employees.find(e => e.id === p.employeeId);
              return (
                <tr key={p.id} className="text-xs">
                  <td className="px-8 py-4 font-bold">{new Date(p.date).toLocaleDateString()}</td>
                  <td className="px-8 py-4 font-black uppercase text-slate-600">{emp?.name || '---'}</td>
                  <td className="px-8 py-4 uppercase font-bold text-[10px] text-blue-600">{p.type} <span className="text-slate-400 italic font-normal block">{p.concept}</span></td>
                  <td className="px-8 py-4 font-black text-slate-900 text-sm">${p.amount.toFixed(2)}</td>
                  <td className="px-8 py-4">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${p.status === 'paid' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>{p.status}</span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    {p.status === 'paid' && <button onClick={() => handleVoid(p.id)} className="text-red-500 font-black text-[10px] uppercase">Anular</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} title="Nuevo Desembolso Financiero">
        <div className="space-y-4">
          <div>
            <label className="text-[9px] font-bold uppercase">Beneficiario</label>
            <select className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setPayForm({...payForm, employeeId: e.target.value})}>
              <option value="">Seleccione empleado...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-bold uppercase">Tipo de Pago</label>
              <select className="w-full border p-3 rounded-xl bg-slate-50" onChange={e => setPayForm({...payForm, type: e.target.value as any})}>
                <option value="Salary">Sueldo / Abono</option>
                <option value="Loan">Préstamo</option>
                <option value="Bonus">Bono / Premio</option>
                <option value="Settlement">Liquidación</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase">Monto ($)</label>
              <input type="number" className="w-full border p-3 rounded-xl bg-slate-50 font-black" onChange={e => setPayForm({...payForm, amount: Number(e.target.value)})} />
            </div>
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase">Concepto detallado</label>
            <textarea className="w-full border p-3 rounded-xl bg-slate-50 h-20" onChange={e => setPayForm({...payForm, concept: e.target.value})}></textarea>
          </div>
          <button onClick={handleCreate} className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl uppercase text-xs shadow-xl">Registrar Desembolso</button>
        </div>
      </Modal>
    </div>
  );
};

export default PaymentsModule;
