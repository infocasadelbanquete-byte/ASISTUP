
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
    client: '', bank: '', number: '', value: 0
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
        setFeedback({ isOpen: true, title: "Error", message: "Datos de pago incompletos.", type: "error" });
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
    setFeedback({ isOpen: true, title: "Pago Sincronizado", message: `Voucher ${newPay.voucherCode} registrado en tesorería.`, type: "success" });
    
    setPayForm({
      type: 'Salary', amount: 0, method: 'Efectivo', concept: '', 
      date: new Date().toISOString().split('T')[0],
      month: 'FEBRERO', year: '2026', status: 'paid'
    });
  };

  const filteredPayments = payments.filter(p => {
    const emp = employees.find(e => e.id === p.employeeId);
    return `${emp?.surname} ${p.voucherCode}`.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm border no-print gap-6">
        <h2 className="text-xl font-black text-slate-900 uppercase">Caja y Tesorería</h2>
        <div className="flex gap-3 w-full md:w-auto">
          <input type="text" placeholder="Filtrar registros..." className="flex-1 p-3 border rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <button onClick={() => setIsPayOpen(true)} className="px-8 py-3.5 bg-blue-700 text-white font-black rounded-xl shadow-lg uppercase text-[9px] active:scale-95 transition-all">Nuevo Egreso</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase">
            <tr><th className="px-6 py-4">Voucher</th><th className="px-6 py-4">Beneficiario</th><th className="px-6 py-4">Concepto</th><th className="px-6 py-4">Monto</th><th className="px-6 py-4 text-right">Acción</th></tr>
          </thead>
          <tbody className="divide-y text-[10px] font-bold uppercase">
            {filteredPayments.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-all">
                <td className="px-6 py-4 font-black text-blue-600">{p.voucherCode}</td>
                <td className="px-6 py-4">{employees.find(e => e.id === p.employeeId)?.surname}</td>
                <td className="px-6 py-4">{p.type}</td>
                <td className="px-6 py-4 font-black">${p.amount.toFixed(2)}</td>
                <td className="px-6 py-4 text-right"><button onClick={() => setSelectedPayForPrint(p)} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[8px] uppercase">Comprobante</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} title="Nuevo Pago Institucional">
        <div className="space-y-4">
           <select className="w-full border-2 p-3 rounded-xl text-xs font-bold uppercase" value={payForm.employeeId} onChange={e => setPayForm({...payForm, employeeId: e.target.value})}>
             <option value="">Beneficiario...</option>
             {employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.surname} {e.name}</option>)}
           </select>
           <input type="number" step="0.01" className="w-full border-2 p-3 rounded-xl text-lg font-black" placeholder="Monto ($)" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: Number(e.target.value)})} />
           <textarea className="w-full border-2 p-3 rounded-xl text-xs font-bold uppercase h-20" placeholder="Detalle concepto..." value={payForm.concept} onChange={e => setPayForm({...payForm, concept: e.target.value.toUpperCase()})} />
           <button onClick={handleCreate} className="w-full py-4 bg-blue-700 text-white font-black rounded-xl uppercase text-[10px]">Guardar y Pagar</button>
        </div>
      </Modal>

      <Modal isOpen={!!selectedPayForPrint} onClose={() => setSelectedPayForPrint(null)} title="Comprobante de Egreso">
        {selectedPayForPrint && (() => {
           const emp = employees.find(e => e.id === selectedPayForPrint.employeeId);
           return (
             <div className="p-8 space-y-8 bg-white" id="payment-voucher-print">
                <div className="flex justify-between items-center border-b-4 border-black pb-8">
                   <div className="flex items-center gap-6">
                      <div className="w-20 h-20 border-2 border-black flex items-center justify-center overflow-hidden">
                         {company?.logo ? <img src={company.logo} className="w-full h-full object-contain" /> : <span className="font-black text-xs">LOGO</span>}
                      </div>
                      <div className="text-left">
                         <h3 className="text-2xl font-[950] uppercase italic leading-none">{company?.name || 'EMPRESA INSTITUCIONAL'}</h3>
                         <p className="text-sm font-black mt-1">RUC: {company?.ruc || '0000000000001'}</p>
                         <p className="text-[10px] font-bold uppercase tracking-tighter">{company?.address || 'QUITO, ECUADOR'}</p>
                      </div>
                   </div>
                   <div className="text-right border-l-2 border-black/10 pl-6">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">COMPROBANTE DE CAJA</p>
                      <p className="text-xl font-[950]">{selectedPayForPrint.voucherCode}</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-10 text-[11px] font-bold uppercase">
                   <div className="space-y-2 border p-4 bg-slate-50/50">
                      <p className="text-[9px] text-slate-400">BENEFICIARIO:</p>
                      <p className="text-black font-[950] text-sm">{emp?.surname} {emp?.name}</p>
                      <p className="text-slate-600">CI: {emp?.identification}</p>
                   </div>
                   <div className="text-right space-y-2 border p-4 bg-slate-50/50">
                      <p className="text-[9px] text-slate-400">DATOS DEL PAGO:</p>
                      <p className="text-black font-[950]">{new Date(selectedPayForPrint.date).toLocaleDateString()}</p>
                      <p className="text-blue-600">MODALIDAD: {selectedPayForPrint.method}</p>
                   </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-xl border-l-8 border-slate-900">
                   <p className="text-[9px] font-black text-slate-400 uppercase mb-2">POR CONCEPTO DE:</p>
                   <p className="text-[12px] text-slate-800 font-black italic">"{selectedPayForPrint.concept}"</p>
                </div>
                
                <div className="bg-slate-900 p-8 rounded-2xl text-white flex justify-between items-center shadow-2xl">
                   <p className="text-[16px] font-[950] uppercase tracking-[0.4em]">VALOR PAGADO</p>
                   <p className="text-5xl font-[950] tracking-tighter">${selectedPayForPrint.amount.toFixed(2)}</p>
                </div>

                <div className="mt-24 grid grid-cols-2 gap-20 text-center">
                   <div className="border-t-2 border-black pt-4 text-[10px] font-black uppercase">Firma de Recibido</div>
                   <div className="border-t-2 border-black pt-4 text-[10px] font-black uppercase">Autorizado por Tesorería</div>
                </div>
                <button onClick={() => window.print()} className="w-full py-5 bg-slate-900 text-white font-black rounded-xl uppercase text-[11px] no-print mt-12 shadow-xl tracking-widest active:scale-95">Imprimir Egreso</button>
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
