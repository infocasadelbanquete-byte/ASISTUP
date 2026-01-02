
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
  const [isNewPaymentModalOpen, setIsNewPaymentModalOpen] = useState(false);
  const [filterEmpId, setFilterEmpId] = useState('');
  const [paymentData, setPaymentData] = useState<Partial<Payment>>({
    type: 'Salary', amount: 0, method: 'Efectivo', concept: '', month: new Date().toLocaleString('es-EC', {month: 'long'}).toUpperCase(), year: '2024'
  });

  const handleCreatePayment = () => {
    if (!paymentData.employeeId || !paymentData.amount) return alert("Seleccione empleado y monto.");
    const newPayment: Payment = {
      ...paymentData,
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      status: 'paid'
    } as Payment;
    onUpdate([newPayment, ...payments]);
    setIsNewPaymentModalOpen(false);
  };

  const handleVoid = (id: string) => {
    const justification = prompt("Justificación de la anulación:");
    if (!justification) return;
    onUpdate(payments.map(p => p.id === id ? { ...p, status: 'void', voidJustification: justification } : p));
  };

  const filteredPayments = payments.filter(p => !filterEmpId || p.employeeId === filterEmpId);

  return (
    <div className="space-y-8 fade-in">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter">TESORERÍA Y PAGOS</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Control de desembolsos, préstamos y haberes</p>
        </div>
        <button 
          onClick={() => setIsNewPaymentModalOpen(true)}
          className="px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl hover:bg-emerald-700 transition-all uppercase text-[10px] tracking-widest"
        >
          Nuevo Desembolso / Pago
        </button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 bg-slate-50/50 flex gap-4">
           <select 
            className="flex-1 bg-white border rounded-xl px-4 py-2 text-xs font-bold"
            onChange={e => setFilterEmpId(e.target.value)}
           >
             <option value="">TODOS LOS EMPLEADOS</option>
             {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
           </select>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-8 py-4">Fecha / Mes</th>
              <th className="px-8 py-4">Empleado</th>
              <th className="px-8 py-4">Concepto / Tipo</th>
              <th className="px-8 py-4">Valor</th>
              <th className="px-8 py-4">Estado</th>
              <th className="px-8 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredPayments.map(p => {
              const emp = employees.find(e => e.id === p.employeeId);
              return (
                <tr key={p.id} className="text-xs">
                  <td className="px-8 py-4">
                    <p className="font-bold">{new Date(p.date).toLocaleDateString()}</p>
                    <p className="text-[10px] text-slate-400 uppercase">{p.month} {p.year}</p>
                  </td>
                  <td className="px-8 py-4 font-bold text-slate-900">{emp?.name || 'N/A'}</td>
                  <td className="px-8 py-4">
                    <span className="font-bold uppercase text-[10px] block">{p.type}</span>
                    <span className="text-slate-400 italic">{p.concept}</span>
                  </td>
                  <td className="px-8 py-4 font-black text-slate-900">${p.amount.toFixed(2)}</td>
                  <td className="px-8 py-4">
                    <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${p.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    {p.status === 'paid' && (
                      <button onClick={() => handleVoid(p.id)} className="text-red-500 hover:underline font-bold uppercase text-[9px]">Anular</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isNewPaymentModalOpen} onClose={() => setIsNewPaymentModalOpen(false)} title="Registro de Desembolso Financiero">
        <div className="space-y-6">
           <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[9px] font-bold uppercase">Empleado Beneficiario</label>
                <select className="w-full border p-3 rounded-xl" onChange={e => setPaymentData({...paymentData, employeeId: e.target.value})}>
                  <option value="">Seleccione...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.isAffiliated ? 'Afiliado' : 'No Afiliado'})</option>)}
                </select>
              </div>
              <div><label className="text-[9px] font-bold uppercase">Tipo de Pago</label>
                <select className="w-full border p-3 rounded-xl" onChange={e => setPaymentData({...paymentData, type: e.target.value as any})}>
                   <option value="Salary">Sueldo / Abono</option>
                   <option value="Loan">Préstamo</option>
                   <option value="Bonus">Bono / Premio</option>
                   <option value="Settlement">Liquidación</option>
                </select>
              </div>
              <div><label className="text-[9px] font-bold uppercase">Monto ($)</label><input type="number" className="w-full border p-3 rounded-xl font-black" onChange={e => setPaymentData({...paymentData, amount: Number(e.target.value)})} /></div>
              <div><label className="text-[9px] font-bold uppercase">Mes de Referencia</label>
                <select className="w-full border p-3 rounded-xl" onChange={e => setPaymentData({...paymentData, month: e.target.value})}>
                  {['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div><label className="text-[9px] font-bold uppercase">Forma de Pago</label>
                <select className="w-full border p-3 rounded-xl" onChange={e => setPaymentData({...paymentData, method: e.target.value as any})}>
                   <option value="Efectivo">Efectivo</option>
                   <option value="Transferencia">Transferencia</option>
                   <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[9px] font-bold uppercase">Concepto / Detalle</label>
                <input className="w-full border p-3 rounded-xl" placeholder="Ej: Pago de primera quincena de marzo..." onChange={e => setPaymentData({...paymentData, concept: e.target.value})} />
              </div>
           </div>
           <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setIsNewPaymentModalOpen(false)} className="px-6 py-2 text-slate-400 uppercase font-black text-xs">Cerrar</button>
              <button onClick={handleCreatePayment} className="px-10 py-3 bg-emerald-600 text-white font-black rounded-xl uppercase text-xs shadow-xl">Registrar Pago</button>
           </div>
        </div>
      </Modal>
    </div>
  );
};

export default PaymentsModule;
