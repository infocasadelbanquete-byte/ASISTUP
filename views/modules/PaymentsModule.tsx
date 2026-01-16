import React, { useState, useMemo } from 'react';
import { Employee, Payment, Role, CompanyConfig } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface PaymentsModuleProps {
  employees: Employee[];
  payments: Payment[];
  onUpdate: (payments: Payment[]) => void;
  role: Role;
  company: CompanyConfig | null;
}

const PaymentsModule: React.FC<PaymentsModuleProps> = ({ employees, payments, onUpdate, role, company }) => {
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selectedPayForPrint, setSelectedPayForPrint] = useState<Payment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para el formulario de pago inicializados en FEBRERO 2026
  const [payForm, setPayForm] = useState<Partial<Payment>>({
    type: 'Salary',
    amount: 0,
    method: 'Efectivo',
    concept: '',
    date: new Date().toISOString().split('T')[0],
    month: 'FEBRERO',
    year: '2026',
    status: 'paid'
  });

  const [dualData, setDualData] = useState({
    method1: 'Efectivo' as const,
    value1: 0,
    method2: 'Transferencia' as const,
    value2: 0,
    bankSource: 'Banco del Austro' as any
  });

  const [checkData, setCheckData] = useState({
    client: '',
    bank: '',
    number: '',
    value: 0
  });

  const [feedback, setFeedback] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info'}>({
    isOpen: false, title: '', message: '', type: 'info'
  });

  const generateSequentialCode = () => {
    const year = new Date().getFullYear();
    const count = payments.length + 1;
    return `VCH-${year}-${count.toString().padStart(5, '0')}`;
  };

  const handleCreate = () => {
    if (!payForm.employeeId || !payForm.amount || payForm.amount <= 0) {
        setFeedback({ isOpen: true, title: "Error", message: "Debe seleccionar un beneficiario e ingresar un monto válido.", type: "error" });
        return;
    }

    if (payForm.method === 'Transferencia' && !payForm.bankSource) {
        setFeedback({ isOpen: true, title: "Dato Requerido", message: "Seleccione la entidad bancaria para la transferencia.", type: "error" });
        return;
    }

    if (payForm.method === 'Dual' && (dualData.value1 + dualData.value2 !== payForm.amount)) {
        setFeedback({ isOpen: true, title: "Error de Monto", message: "La suma de los montos duales debe coincidir con el total del pago.", type: "error" });
        return;
    }

    const newPay: Payment = { 
      ...payForm, 
      id: Math.random().toString(36).substr(2, 15), 
      date: new Date(payForm.date!).toISOString(),
      voucherCode: generateSequentialCode(),
      checkDetails: payForm.method === 'Cheque' ? checkData : undefined,
      dualDetails: payForm.method === 'Dual' ? { ...dualData } : undefined,
      status: 'paid' 
    } as Payment;

    onUpdate([newPay, ...payments]);
    setIsPayOpen(false);
    setFeedback({ isOpen: true, title: "Pago Registrado", message: `Egreso procesado exitosamente. Código: ${newPay.voucherCode}`, type: "success" });
    
    // Reset forms manteniendo FEBRERO como mes base
    setPayForm({
      type: 'Salary', amount: 0, method: 'Efectivo', concept: '', 
      date: new Date().toISOString().split('T')[0],
      month: 'FEBRERO', 
      year: '2026', status: 'paid'
    });
  };

  const filteredPayments = payments.filter(p => {
    const emp = employees.find(e => e.id === p.employeeId);
    const searchStr = `${emp?.name} ${emp?.surname} ${emp?.identification} ${p.concept} ${p.type} ${p.voucherCode}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100 gap-6 no-print">
        <div>
           <h2 className="text-xl font-[950] text-slate-900 uppercase tracking-tighter">Caja y Tesorería</h2>
           <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">Gestión de Egresos y Comprobantes</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <input type="text" placeholder="Buscar por código, CI o nombre..." className="flex-1 md:w-64 p-3 border rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <button onClick={() => setIsPayOpen(true)} className="px-8 py-3.5 bg-blue-700 text-white font-black rounded-xl shadow-lg uppercase text-[9px] tracking-widest active:scale-95 transition-all">Nuevo Pago</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
        <div className="table-responsive">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Código / Fecha</th>
                <th className="px-6 py-4">Beneficiario</th>
                <th className="px-6 py-4">Concepto</th>
                <th className="px-6 py-4">Forma de Pago</th>
                <th className="px-6 py-4">Monto</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[10px] font-bold uppercase">
              {filteredPayments.map(p => {
                const emp = employees.find(e => e.id === p.employeeId);
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-6 py-4">
                      <p className="text-blue-600 font-black">{p.voucherCode}</p>
                      <p className="text-slate-400 text-[8px]">{new Date(p.date).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-900">{emp?.surname} {emp?.name}</p>
                      <p className="text-[8px] text-slate-400">{emp?.identification}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-600">{p.type}</p>
                      <p className="text-[8px] text-slate-400 truncate max-w-[120px]">{p.concept}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{p.method}</td>
                    <td className="px-6 py-4 font-black text-slate-900">${p.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => setSelectedPayForPrint(p)} className="px-3 py-1.5 bg-slate-900 text-white font-black rounded-lg text-[8px] uppercase active:scale-95">Ver Comprobante</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo Pago */}
      <Modal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} title="Generar Nuevo Egreso Institucional" maxWidth="max-w-3xl">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase">Beneficiario</label>
              <select className="w-full border-2 p-3 rounded-xl text-xs font-bold uppercase" value={payForm.employeeId} onChange={e => setPayForm({...payForm, employeeId: e.target.value})}>
                <option value="">Buscar Empleado...</option>
                {employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.surname} {e.name} - {e.identification}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase">Concepto de Pago</label>
              <select className="w-full border-2 p-3 rounded-xl text-xs font-bold uppercase" value={payForm.type} onChange={e => setPayForm({...payForm, type: e.target.value as any})}>
                <option value="Salary">Pago Sueldo</option>
                <option value="Advance">Anticipo</option>
                <option value="SalaryBalance">Saldo Sueldo</option>
                <option value="Loan">Préstamo</option>
                <option value="Settlement">Liquidación de Haberes</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase">Fecha Transacción</label>
              <input type="date" className="w-full border-2 p-3 rounded-xl text-xs font-bold" value={payForm.date} onChange={e => setPayForm({...payForm, date: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase">Monto Total ($)</label>
              <input type="number" step="0.01" className="w-full border-2 p-3 rounded-xl text-lg font-black" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: Number(e.target.value)})} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase">Detalle del Concepto</label>
            <textarea className="w-full border-2 p-3 rounded-xl text-xs font-bold uppercase h-20" placeholder="Ej: Pago de sueldo correspondiente al mes de..." value={payForm.concept} onChange={e => setPayForm({...payForm, concept: e.target.value.toUpperCase()})} />
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
            <label className="text-[10px] font-black text-blue-700 uppercase mb-3 block">Forma de Pago</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {['Efectivo', 'Transferencia', 'Cheque', 'Dual'].map(m => (
                <button key={m} onClick={() => setPayForm({...payForm, method: m as any})} className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${payForm.method === m ? 'bg-blue-700 text-white' : 'bg-white text-slate-400 border'}`}>{m}</button>
              ))}
            </div>

            {/* Lógica condicional según forma de pago */}
            {payForm.method === 'Transferencia' && (
              <div className="p-3 bg-white rounded-xl border">
                <label className="text-[8px] font-black text-slate-400 uppercase">Entidad Bancaria Origen</label>
                <select className="w-full border p-2 rounded-lg text-[10px] font-bold uppercase mt-1" value={payForm.bankSource} onChange={e => setPayForm({...payForm, bankSource: e.target.value as any})}>
                  <option value="">Seleccione Banco...</option>
                  <option value="Banco del Austro">Banco del Austro</option>
                  <option value="Banco Guayaquil">Banco Guayaquil</option>
                </select>
              </div>
            )}

            {payForm.method === 'Cheque' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border">
                <input placeholder="Nombre Cliente" className="border p-2 rounded-lg text-[10px] font-bold uppercase" value={checkData.client} onChange={e => setCheckData({...checkData, client: e.target.value.toUpperCase()})} />
                <input placeholder="Banco Emisor" className="border p-2 rounded-lg text-[10px] font-bold uppercase" value={checkData.bank} onChange={e => setCheckData({...checkData, bank: e.target.value.toUpperCase()})} />
                <input placeholder="Número de Cheque" className="border p-2 rounded-lg text-[10px] font-bold" value={checkData.number} onChange={e => setCheckData({...checkData, number: e.target.value})} />
                <input type="number" placeholder="Valor Informativo" className="border p-2 rounded-lg text-[10px] font-bold" value={checkData.value} onChange={e => setCheckData({...checkData, value: Number(e.target.value)})} />
              </div>
            )}

            {payForm.method === 'Dual' && (
              <div className="space-y-3 p-3 bg-white rounded-xl border">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <select className="w-full border p-2 rounded-lg text-[9px] font-black uppercase" value={dualData.method1} onChange={e => setDualData({...dualData, method1: e.target.value as any})}><option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option><option value="Cheque">Cheque</option></select>
                    <input type="number" placeholder="Monto 1" className="w-full border p-2 rounded-lg text-xs font-bold" value={dualData.value1} onChange={e => setDualData({...dualData, value1: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <select className="w-full border p-2 rounded-lg text-[9px] font-black uppercase" value={dualData.method2} onChange={e => setDualData({...dualData, method2: e.target.value as any})}><option value="Transferencia">Transferencia</option><option value="Efectivo">Efectivo</option><option value="Cheque">Cheque</option></select>
                    <input type="number" placeholder="Monto 2" className="w-full border p-2 rounded-lg text-xs font-bold" value={dualData.value2} onChange={e => setDualData({...dualData, value2: Number(e.target.value)})} />
                  </div>
                </div>
                {(dualData.method1 === 'Transferencia' || dualData.method2 === 'Transferencia') && (
                  <select className="w-full border p-2 rounded-lg text-[9px] font-bold uppercase" value={dualData.bankSource} onChange={e => setDualData({...dualData, bankSource: e.target.value as any})}>
                    <option value="Banco del Austro">Banco del Austro</option>
                    <option value="Banco Guayaquil">Banco Guayaquil</option>
                  </select>
                )}
                <p className="text-[9px] font-black text-slate-400 text-center uppercase">Total Parcial: ${(dualData.value1 + dualData.value2).toFixed(2)}</p>
              </div>
            )}
          </div>

          <button onClick={handleCreate} className="w-full py-5 bg-blue-700 text-white font-black rounded-2xl uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all">Pagar y Guardar Pago</button>
        </div>
      </Modal>

      {/* Comprobante de Pago */}
      <Modal isOpen={!!selectedPayForPrint} onClose={() => setSelectedPayForPrint(null)} title="Comprobante de Egreso">
        {selectedPayForPrint && (() => {
           const emp = employees.find(e => e.id === selectedPayForPrint.employeeId);
           return (
             <div className="p-10 space-y-8 bg-white" id="payment-voucher-print">
                <div className="text-center border-b-2 pb-6">
                   <h3 className="text-2xl font-black text-slate-900 uppercase italic">{company?.name || 'EMPRESA INSTITUCIONAL'}</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Comprobante de Caja - {selectedPayForPrint.voucherCode}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase">
                   <div className="space-y-1"><p className="text-slate-400">Beneficiario:</p><p className="text-slate-900">{emp?.surname} {emp?.name}</p><p className="text-slate-500">CI: {emp?.identification}</p></div>
                   <div className="text-right space-y-1"><p className="text-slate-400">Fecha de Pago:</p><p className="text-slate-900">{new Date(selectedPayForPrint.date).toLocaleDateString()}</p><p className="text-blue-600">Tipo: {selectedPayForPrint.type}</p></div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border"><p className="text-[9px] text-slate-400 uppercase mb-1">Por concepto de:</p><p className="text-[11px] text-slate-700 font-black italic">"{selectedPayForPrint.concept}"</p></div>
                
                <div className="bg-slate-900 p-6 rounded-2xl text-white flex justify-between items-center">
                   <div>
                      <p className="text-[8px] font-black uppercase opacity-60">Medio de Pago: {selectedPayForPrint.method}</p>
                      {selectedPayForPrint.bankSource && <p className="text-[8px] font-black uppercase opacity-60">{selectedPayForPrint.bankSource}</p>}
                   </div>
                   <p className="text-4xl font-black">${selectedPayForPrint.amount.toFixed(2)}</p>
                </div>

                <div className="mt-16 grid grid-cols-2 gap-10 text-center">
                   <div className="border-t pt-2 text-[10px] font-black uppercase">Firma del Beneficiario</div>
                   <div className="border-t pt-2 text-[10px] font-black uppercase">Autorizado Tesorería</div>
                </div>
                <button onClick={() => window.print()} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] no-print mt-10">Imprimir Comprobante</button>
             </div>
           );
        })()}
      </Modal>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
        <div className="text-center p-4">
          <p className="text-[11px] font-bold uppercase text-slate-600 leading-relaxed">{feedback.message}</p>
          <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-3.5 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] mt-6">Aceptar</button>
        </div>
      </Modal>
    </div>
  );
};

export default PaymentsModule;
