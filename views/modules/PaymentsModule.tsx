
import React, { useState, useMemo } from 'react';
import { Employee, Payment, Role } from '../../types';
import Modal from '../../components/Modal';

interface PaymentsModuleProps {
  employees: Employee[];
  payments: Payment[];
  onUpdate: (payments: Payment[]) => void;
  role: Role;
}

const PaymentsModule: React.FC<PaymentsModuleProps> = ({ employees, payments, onUpdate, role }) => {
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState('');
  
  const [paymentForm, setPaymentForm] = useState<Partial<Payment>>({
    employeeId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    month: new Date().toLocaleString('es-EC', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    type: 'Salary',
    method: 'Transferencia',
    bankSource: 'Banco del Austro',
    concept: '',
    status: 'paid',
    isPartial: false
  });

  const selectedEmployeeData = useMemo(() => {
    return employees.find(e => e.id === paymentForm.employeeId);
  }, [paymentForm.employeeId, employees]);

  const pendingBalance = useMemo(() => {
    if (!selectedEmployeeData) return 0;
    const paidThisMonth = payments
      .filter(p => p.employeeId === selectedEmployeeData.id && p.month === paymentForm.month && p.status === 'paid' && p.type === 'Salary')
      .reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, selectedEmployeeData.salary - paidThisMonth);
  }, [selectedEmployeeData, paymentForm.month, payments]);

  const handleCreatePayment = () => {
    if (!paymentForm.employeeId || !paymentForm.amount || paymentForm.amount <= 0) {
      alert("ERROR: Por favor complete los campos obligatorios y asegúrese de que el monto sea válido.");
      return;
    }

    const newPayment: Payment = {
      ...paymentForm,
      id: Math.random().toString(36).substr(2, 9),
      balanceAfter: pendingBalance - (paymentForm.amount || 0)
    } as Payment;

    onUpdate([...payments, newPayment]);
    setIsPayModalOpen(false);
    alert('Pago registrado con éxito. Se ha actualizado el saldo del colaborador.');
  };

  const handleVoid = (p: Payment) => {
    const just = prompt("Justificación obligatoria para anular el pago:");
    if (!just) {
      alert("Debe ingresar una justificación.");
      return;
    }
    onUpdate(payments.map(pay => pay.id === p.id ? { ...pay, status: 'void', voidJustification: just } : pay));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100 no-print">
        <div className="flex-1 max-w-sm">
          <h2 className="text-xl font-bold text-blue-900">Gestión de Tesorería</h2>
          <p className="text-sm text-gray-500">Registro de desembolsos y control de saldos</p>
        </div>
        <div className="flex gap-4 items-center">
          <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className="border-gray-200 border rounded-xl px-4 py-3 text-xs font-bold uppercase outline-none">
            <option value="">TODOS LOS COLABORADORES</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button onClick={() => setIsPayModalOpen(true)} className="px-8 py-3 bg-blue-700 text-white font-black rounded-2xl shadow-xl hover:bg-blue-800 transition-all active:scale-95 text-xs">
            REGISTRAR DESEMBOLSO
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100 font-black text-[10px] text-gray-400 uppercase tracking-widest">
            <tr>
              <th className="px-6 py-5">Fecha / Mes</th>
              <th className="px-6 py-5">Colaborador</th>
              <th className="px-6 py-5">Concepto / Tipo</th>
              <th className="px-6 py-5 text-right">Monto</th>
              <th className="px-6 py-5">Estado</th>
              <th className="px-6 py-5 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.filter(p => !filterEmployee || p.employeeId === filterEmployee).reverse().map(p => {
              const emp = employees.find(e => e.id === p.employeeId);
              return (
                <tr key={p.id} className={`hover:bg-blue-50/30 transition-all ${p.status === 'void' ? 'bg-red-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-900">{p.date}</p>
                    <p className="text-[10px] font-black text-blue-600 uppercase">{p.month} {p.year}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-700">{emp?.name || 'No Identificado'}</p>
                    <p className="text-[9px] text-gray-400">{p.method} {p.bankSource ? `(${p.bankSource})` : ''}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 rounded text-[9px] font-black uppercase text-gray-600 mr-2">{p.type}</span>
                    <span className="text-sm font-medium text-gray-600 truncate max-w-xs inline-block align-middle">{p.concept}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className={`font-black text-lg ${p.status === 'void' ? 'text-gray-300 line-through' : 'text-blue-900'}`}>${p.amount.toFixed(2)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-widest ${p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {p.status === 'paid' ? 'PAGADO' : 'ANULADO'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => window.print()} className="p-2 text-gray-400 hover:text-blue-600" title="Imprimir Comprobante">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                      </button>
                      {p.status === 'paid' && role === Role.SUPER_ADMIN && (
                        <button onClick={() => handleVoid(p)} className="p-2 text-gray-400 hover:text-red-500" title="Anular">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de Pago Profesional */}
      <Modal 
        isOpen={isPayModalOpen} 
        onClose={() => setIsPayModalOpen(false)} 
        title="Formulario de Desembolso / Pago"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setIsPayModalOpen(false)} className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancelar</button>
            <button onClick={handleCreatePayment} className="px-8 py-2 bg-blue-700 text-white rounded-xl font-black shadow-xl hover:bg-blue-800 transition-all">Confirmar Pago</button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-5">
            <div className="col-span-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Seleccionar Colaborador *</label>
              <select value={paymentForm.employeeId} onChange={e => setPaymentForm({...paymentForm, employeeId: e.target.value})} className="w-full border-gray-200 border rounded-xl p-4 font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-100">
                <option value="">-- Buscar Colaborador --</option>
                {employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            {selectedEmployeeData && (
              <div className="col-span-2 bg-blue-50 p-4 rounded-2xl border border-blue-100 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Saldo Pendiente {paymentForm.month}:</p>
                  <p className="text-2xl font-black text-blue-900">${pendingBalance.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Sueldo Base:</p>
                  <p className="text-lg font-bold text-blue-800">${selectedEmployeeData.salary.toFixed(2)}</p>
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Valor a Desembolsar *</label>
              <input type="number" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: Number(e.target.value)})} className="w-full border-gray-200 border rounded-xl p-4 font-black text-lg outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Mes / Año de Pago</label>
              <div className="flex gap-2">
                <select value={paymentForm.month} onChange={e => setPaymentForm({...paymentForm, month: e.target.value})} className="flex-1 border-gray-200 border rounded-xl p-4 font-bold outline-none">
                  {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input value={paymentForm.year} onChange={e => setPaymentForm({...paymentForm, year: e.target.value})} className="w-24 border-gray-200 border rounded-xl p-4 font-bold outline-none" />
              </div>
            </div>
            
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Categoría de Desembolso</label>
              <select value={paymentForm.type} onChange={e => setPaymentForm({...paymentForm, type: e.target.value as any})} className="w-full border-gray-200 border rounded-xl p-4 font-bold outline-none">
                <option value="Salary">Sueldo / Abono</option>
                <option value="OverSalary">Sobre sueldo (13ro/14to/Vac)</option>
                <option value="Loan">Préstamo / Emergencia</option>
                <option value="Bonus">Bono / Gratificación</option>
                <option value="Settlement">Liquidación / Compensación</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Método de Pago</label>
              <select value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value as any})} className="w-full border-gray-200 border rounded-xl p-4 font-bold outline-none">
                <option value="Transferencia">Transferencia Bancaria</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            {paymentForm.method === 'Transferencia' && (
              <div className="col-span-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Cuenta de Origen (FONDOS EMPRESA)</label>
                <select value={paymentForm.bankSource} onChange={e => setPaymentForm({...paymentForm, bankSource: e.target.value as any})} className="w-full border-gray-200 border rounded-xl p-4 font-bold text-emerald-700 bg-emerald-50 outline-none">
                  <option value="Banco del Austro">Banco del Austro</option>
                  <option value="Banco Guayaquil">Banco Guayaquil</option>
                </select>
              </div>
            )}

            <div className="col-span-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Concepto Detallado del Pago</label>
              <textarea value={paymentForm.concept} onChange={e => setPaymentForm({...paymentForm, concept: e.target.value})} className="w-full border-gray-200 border rounded-xl p-4 outline-none min-h-[80px]" placeholder="Ej. Pago parcial sueldo mes de Octubre, restante pendiente..." />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PaymentsModule;
