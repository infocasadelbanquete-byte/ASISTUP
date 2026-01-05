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
  const [selectedPayForPrint, setSelectedPayForPrint] = useState<Payment | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidPay, setVoidPay] = useState<Payment | null>(null);
  const [voidJustification, setVoidJustification] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [payForm, setPayForm] = useState<Partial<Payment>>({ 
    type: 'Salary', 
    amount: 0, 
    method: 'Efectivo', 
    concept: '', 
    month: new Date().toLocaleString('es-EC', {month: 'long'}).toUpperCase(), 
    year: '2026', 
    status: 'paid' 
  });

  const [feedback, setFeedback] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info'}>({
    isOpen: false, title: '', message: '', type: 'info'
  });

  const handleCreate = () => {
    if (!payForm.employeeId || !payForm.amount) {
        setFeedback({ isOpen: true, title: "Error", message: "Seleccione colaborador y monto.", type: "error" });
        return;
    }
    const newPay: Payment = { ...payForm, id: Math.random().toString(36).substr(2, 15), date: new Date().toISOString(), status: 'paid' } as Payment;
    onUpdate([newPay, ...payments]);
    setIsPayOpen(false);
    setFeedback({ isOpen: true, title: "Éxito", message: "Pago registrado en tesorería.", type: "success" });
  };

  const handleVoid = () => {
    if (!voidPay || !voidJustification) return;
    const updated = payments.map(p => p.id === voidPay.id ? { ...p, status: 'void' as const, voidJustification } : p);
    onUpdate(updated);
    setIsVoidModalOpen(false);
    setVoidPay(null);
    setVoidJustification('');
    setFeedback({ isOpen: true, title: "Pago Anulado", message: "El comprobante ha sido invalidado.", type: "success" });
  };

  const exportAllExcel = () => {
    let csv = "Fecha,Empleado,CI,Monto,Tipo,Concepto,Estado\n";
    payments.forEach(p => {
      const emp = employees.find(e => e.id === p.employeeId);
      csv += `${new Date(p.date).toLocaleDateString()},${emp?.surname} ${emp?.name},${emp?.identification},${p.amount.toFixed(2)},${p.type},${p.concept},${p.status}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `LISTADO_PAGOS_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportSingleExcel = (p: Payment) => {
    const emp = employees.find(e => e.id === p.employeeId);
    let csv = "CAMPO,VALOR\n";
    csv += `ID PAGO,${p.id}\n`;
    csv += `FECHA,${new Date(p.date).toLocaleString()}\n`;
    csv += `EMPLEADO,${emp?.surname} ${emp?.name}\n`;
    csv += `CI,${emp?.identification}\n`;
    csv += `MONTO,${p.amount.toFixed(2)}\n`;
    csv += `CONCEPTO,${p.type} - ${p.month}\n`;
    csv += `DESCRIPCION,${p.concept}\n`;
    csv += `ESTADO,${p.status}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `COMPROBANTE_${emp?.surname || 'PAGO'}_${p.id.substr(0,5)}.csv`;
    link.click();
  };

  const filteredPayments = payments.filter(p => {
    const emp = employees.find(e => e.id === p.employeeId);
    const searchStr = ((emp?.name || "") + " " + (emp?.surname || "") + " " + (emp?.identification || "") + " " + p.concept + " " + p.type).toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 gap-6 no-print">
        <h2 className="text-xl font-black text-slate-900 uppercase">Tesorería Institucional</h2>
        <div className="flex gap-4 w-full md:w-auto">
          <input type="text" placeholder="Filtrar por nombre, CI o concepto..." className="flex-1 md:w-80 p-3 border rounded-xl text-[10px] font-bold uppercase" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <button onClick={exportAllExcel} className="px-6 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all">Exportar Excel</button>
          <button onClick={() => setIsPayOpen(true)} className="px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg uppercase text-[10px] tracking-widest active:scale-95 transition-all">Nuevo Pago</button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr><th className="px-8 py-4">Fecha</th><th className="px-8 py-4">Empleado</th><th className="px-8 py-4">Monto</th><th className="px-8 py-4">Estado</th><th className="px-8 py-4 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPayments.map(p => {
              const emp = employees.find(e => e.id === p.employeeId);
              return (
                <tr key={p.id} className={`text-xs hover:bg-slate-50 transition-all ${p.status === 'void' ? 'opacity-40 grayscale' : ''}`}>
                  <td className="px-8 py-4 font-bold">{new Date(p.date).toLocaleDateString()}</td>
                  <td className="px-8 py-4 font-black uppercase text-slate-900">{emp?.surname} {emp?.name}</td>
                  <td className="px-8 py-4 font-black text-blue-700">${p.amount.toFixed(2)}</td>
                  <td className="px-8 py-4"><span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${p.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{p.status === 'paid' ? 'Pagado' : 'Anulado'}</span></td>
                  <td className="px-8 py-4 text-right flex gap-3 justify-end">
                    <button onClick={() => setSelectedPayForPrint(p)} className="text-blue-600 font-black text-[9px] uppercase hover:underline">Imprimir/PDF</button>
                    {p.status === 'paid' && role === Role.SUPER_ADMIN && (
                      <button onClick={() => { setVoidPay(p); setIsVoidModalOpen(true); }} className="text-red-600 font-black text-[9px] uppercase hover:underline">Anular</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!selectedPayForPrint} onClose={() => setSelectedPayForPrint(null)} title="Comprobante de Pago">
        {selectedPayForPrint && (() => {
           const emp = employees.find(e => e.id === selectedPayForPrint.employeeId);
           return (
             <div className="p-10 space-y-10 bg-white" id="payment-voucher-print">
                <div className="text-center border-b-4 border-slate-900 pb-8"><h3 className="text-3xl font-[950] text-slate-900 uppercase tracking-tighter italic">EGRESO DE TESORERÍA</h3><p className="text-[11px] font-black text-slate-400 mt-2 uppercase tracking-widest">Comprobante Oficial de Desembolso</p></div>
                <div className="grid grid-cols-2 gap-10 text-[11px] font-bold uppercase">
                   <div className="space-y-6">
                      <div><p className="text-slate-400 text-[9px] font-black mb-1">Beneficiario</p><p className="text-slate-900 text-xl font-[950]">{emp?.surname} {emp?.name}</p><p className="text-slate-500 font-black">Cédula: {emp?.identification}</p></div>
                      <div><p className="text-slate-400 text-[9px] font-black mb-1">Concepto</p><p className="text-slate-900 font-black">{selectedPayForPrint.type} - {selectedPayForPrint.month} {selectedPayForPrint.year}</p><p className="text-slate-500 text-[10px] lowercase italic">{selectedPayForPrint.concept}</p></div>
                   </div>
                   <div className="text-right space-y-6">
                      <div><p className="text-slate-400 text-[9px] font-black mb-1">Monto Pagado</p><p className="text-5xl font-[950] text-slate-900 tracking-tighter">${selectedPayForPrint.amount.toFixed(2)}</p></div>
                      <div><p className="text-slate-400 text-[9px] font-black mb-1">Fecha Emisión</p><p className="text-slate-900 font-black">{new Date(selectedPayForPrint.date).toLocaleString()}</p></div>
                   </div>
                </div>
                {selectedPayForPrint.status === 'void' && (
                  <div className="border-4 border-red-600 p-4 text-center rounded-3xl"><p className="text-red-600 font-[950] text-2xl uppercase tracking-widest">DOCUMENTO ANULADO</p><p className="text-xs text-red-500 font-bold uppercase mt-1">Motivo: {selectedPayForPrint.voidJustification}</p></div>
                )}
                <div className="bg-slate-50 p-10 rounded-[3rem] border-2 border-dashed border-slate-300 grid grid-cols-2 gap-20 text-center pt-24 pb-10">
                   <div className="border-t-2 border-slate-900 pt-4 text-[10px] font-black uppercase text-slate-900">Firma Beneficiario</div>
                   <div className="border-t-2 border-slate-900 pt-4 text-[10px] font-black uppercase text-slate-900">Autorizado Caja</div>
                </div>
                <div className="flex gap-4 no-print">
                   <button onClick={() => exportSingleExcel(selectedPayForPrint)} className="flex-1 py-5 bg-emerald-600 text-white font-black rounded-3xl uppercase text-[10px] tracking-widest active:scale-95 transition-all">Excel Individual</button>
                   <button onClick={() => window.print()} className="flex-1 py-5 bg-slate-900 text-white font-black rounded-3xl uppercase text-[10px] tracking-widest active:scale-95 transition-all">Imprimir / PDF</button>
                </div>
             </div>
           );
        })()}
      </Modal>

      <Modal isOpen={isVoidModalOpen} onClose={() => setIsVoidModalOpen(false)} title="Anular Comprobante" maxWidth="max-w-sm">
         <div className="space-y-4 text-center">
            <p className="text-xs text-slate-500 font-bold uppercase">Ingrese la justificación para anular este pago:</p>
            <textarea className="w-full border-2 p-3 rounded-xl h-24 text-xs font-black" placeholder="Error en monto, duplicado, etc..." value={voidJustification} onChange={e => setVoidJustification(e.target.value)}></textarea>
            <div className="flex gap-3">
               <button onClick={() => setIsVoidModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[9px]">Cancelar</button>
               <button onClick={handleVoid} className="flex-1 py-4 bg-red-600 text-white font-black rounded-xl uppercase text-[9px] shadow-lg">Confirmar Anulación</button>
            </div>
         </div>
      </Modal>

      <Modal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} title="Nuevo Registro de Pago">
        <div className="space-y-4">
          <select className="w-full border-2 p-3 rounded-xl bg-slate-50 text-[11px] font-black uppercase" onChange={e => setPayForm({...payForm, employeeId: e.target.value})}><option value="">Seleccionar Beneficiario...</option>{employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.surname} {e.name}</option>)}</select>
          <div className="grid grid-cols-2 gap-4">
            <select className="w-full border-2 p-3 rounded-xl bg-slate-50 text-[11px] font-black uppercase" value={payForm.type} onChange={e => setPayForm({...payForm, type: e.target.value as any})}><option value="Salary">Sueldo</option><option value="ExtraHours">Horas Extras</option><option value="Bonus">Bono</option><option value="Loan">Préstamo</option><option value="Emergency">Emergencia</option><option value="Thirteenth">Décimo Tercero</option><option value="Fourteenth">Décimo Cuarto</option></select>
            <select className="w-full border-2 p-3 rounded-xl bg-slate-50 text-[11px] font-black uppercase" value={payForm.month} onChange={e => setPayForm({...payForm, month: e.target.value})}>{['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}</select>
          </div>
          <input type="number" step="0.01" className="w-full border-2 p-5 rounded-2xl font-[950] text-4xl text-center focus:border-blue-600 outline-none" placeholder="0.00" onChange={e => setPayForm({...payForm, amount: Number(e.target.value)})} />
          <textarea className="w-full border-2 p-3 rounded-xl h-24 text-xs font-bold" placeholder="Detalle del pago o motivo..." onChange={e => setPayForm({...payForm, concept: e.target.value})}></textarea>
          <button onClick={handleCreate} className="w-full py-5 bg-emerald-600 text-white font-[950] rounded-[2rem] uppercase text-[11px] tracking-widest shadow-2xl active:scale-95 transition-all">Registrar Desembolso</button>
        </div>
      </Modal>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}><div className="text-center p-4"><p className="text-xs font-bold uppercase">{feedback.message}</p><button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] mt-4">Entendido</button></div></Modal>
    </div>
  );
};

export default PaymentsModule;