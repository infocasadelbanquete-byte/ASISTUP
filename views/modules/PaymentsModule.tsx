import React, { useState } from 'react';
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

  const handleDeletePermanent = (id: string) => {
    if (confirm("¿Está seguro de eliminar este registro permanentemente de la tesorería? Esta acción borrará el registro de la base de datos de forma irreversible.")) {
      const updated = payments.filter(p => p.id !== id);
      onUpdate(updated);
      setFeedback({ isOpen: true, title: "Eliminado", message: "Registro borrado permanentemente.", type: "success" });
    }
  };

  const exportAllExcel = () => {
    let csv = "\uFEFFFecha,Empleado,CI,Monto,Tipo,Concepto,Estado\n";
    payments.forEach(p => {
      const emp = employees.find(e => e.id === p.employeeId);
      csv += `"${new Date(p.date).toLocaleDateString()}","${emp?.surname} ${emp?.name}","${emp?.identification}",${p.amount.toFixed(2)},"${p.type}","${p.concept}","${p.status}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `LISTADO_TESORERIA_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportSingleExcel = (p: Payment) => {
    const emp = employees.find(e => e.id === p.employeeId);
    let csv = "\uFEFFCAMPO,VALOR\n";
    csv += `ID TRANSACCION,${p.id}\n`;
    csv += `FECHA EMISION,${new Date(p.date).toLocaleString()}\n`;
    csv += `BENEFICIARIO,${emp?.surname} ${emp?.name}\n`;
    csv += `IDENTIFICACION,${emp?.identification}\n`;
    csv += `VALOR TOTAL,${p.amount.toFixed(2)}\n`;
    csv += `CATEGORIA,${p.type}\n`;
    csv += `DESCRIPCION,${p.concept}\n`;
    csv += `ESTADO ACTUAL,${p.status}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `COMPROBANTE_${emp?.surname || 'TESO'}_${p.id.substr(0,8)}.csv`;
    link.click();
  };

  const filteredPayments = payments.filter(p => {
    const emp = employees.find(e => e.id === p.employeeId);
    const searchStr = `${emp?.name} ${emp?.surname} ${emp?.identification} ${p.concept} ${p.type} ${p.month}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 gap-6 no-print">
        <div>
           <h2 className="text-xl font-[950] text-slate-900 uppercase tracking-tighter">Tesorería Institucional</h2>
           <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">Control de Egresos y Caja</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <input type="text" placeholder="Buscar por beneficiario, CI, concepto..." className="flex-1 md:w-80 p-3 border rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <button onClick={exportAllExcel} className="px-6 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all">Excel Global</button>
          <button onClick={() => window.print()} className="px-6 py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-lg">PDF Global</button>
          <button onClick={() => setIsPayOpen(true)} className="px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg uppercase text-[10px] tracking-widest active:scale-95 transition-all">Registrar Desembolso</button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
        <div className="table-responsive">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr><th className="px-8 py-4">Fecha</th><th className="px-8 py-4">Empleado</th><th className="px-8 py-4 text-center">Tipo / Concepto</th><th className="px-8 py-4">Monto</th><th className="px-8 py-4">Estado</th><th className="px-8 py-4 text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.map(p => {
                const emp = employees.find(e => e.id === p.employeeId);
                return (
                  <tr key={p.id} className={`text-xs hover:bg-slate-50 transition-all ${p.status === 'void' ? 'opacity-40 grayscale bg-slate-50' : ''}`}>
                    <td className="px-8 py-4 font-bold">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="px-8 py-4 font-black uppercase text-slate-900">{emp?.surname} {emp?.name}</td>
                    <td className="px-8 py-4 text-center"><p className="text-[10px] font-black uppercase text-slate-500">{p.type}</p><p className="text-[8px] font-bold text-slate-400 truncate max-w-[150px]">{p.concept}</p></td>
                    <td className="px-8 py-4 font-black text-blue-700">${p.amount.toFixed(2)}</td>
                    <td className="px-8 py-4"><span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${p.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{p.status === 'paid' ? 'Efectivo' : 'Anulado'}</span></td>
                    <td className="px-8 py-4 text-right flex gap-2 justify-end">
                      <button onClick={() => setSelectedPayForPrint(p)} className="px-2 py-1.5 bg-blue-50 text-blue-600 font-black rounded-lg text-[8px] uppercase active:scale-95 shadow-sm">Ver</button>
                      {p.status === 'paid' && role === Role.SUPER_ADMIN && (
                        <button onClick={() => { setVoidPay(p); setIsVoidModalOpen(true); }} className="px-2 py-1.5 bg-red-50 text-red-600 font-black rounded-lg text-[8px] uppercase active:scale-95 shadow-sm">Anular</button>
                      )}
                      {role === Role.SUPER_ADMIN && (
                        <button onClick={() => handleDeletePermanent(p.id)} className="px-2 py-1.5 bg-red-700 text-white font-black rounded-lg text-[8px] uppercase active:scale-95 shadow-sm">Borrar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredPayments.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-slate-300 font-black uppercase">Sin transacciones registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!selectedPayForPrint} onClose={() => setSelectedPayForPrint(null)} title="Comprobante de Caja / Tesorería">
        {selectedPayForPrint && (() => {
           const emp = employees.find(e => e.id === selectedPayForPrint.employeeId);
           return (
             <div className="p-10 space-y-10 bg-white" id="payment-voucher-print">
                <div className="text-center border-b-4 border-slate-900 pb-8"><h3 className="text-3xl font-[950] text-slate-900 uppercase tracking-tighter italic">{company?.name || 'EMPRESA'}</h3><p className="text-[11px] font-black text-slate-400 mt-2 uppercase tracking-widest">EGRESO DE TESORERÍA - COMPROBANTE NO. {selectedPayForPrint.id.substr(0,10).toUpperCase()}</p></div>
                <div className="grid grid-cols-2 gap-10 text-[11px] font-bold uppercase">
                   <div className="space-y-6">
                      <div><p className="text-slate-400 text-[9px] font-black mb-1">Beneficiario / Colaborador</p><p className="text-slate-900 text-xl font-[950]">{emp?.surname} {emp?.name}</p><p className="text-slate-500 font-black">Cédula: {emp?.identification}</p></div>
                      <div><p className="text-slate-400 text-[9px] font-black mb-1">Motivo del Pago</p><p className="text-slate-900 font-black">{selectedPayForPrint.type} - {selectedPayForPrint.month} {selectedPayForPrint.year}</p><p className="text-slate-500 text-[10px] lowercase italic border-l-2 pl-3 mt-1">{selectedPayForPrint.concept}</p></div>
                   </div>
                   <div className="text-right space-y-6">
                      <div><p className="text-slate-400 text-[9px] font-black mb-1">Valor Neto Pagado</p><p className="text-5xl font-[950] text-slate-900 tracking-tighter">${selectedPayForPrint.amount.toFixed(2)}</p></div>
                      <div><p className="text-slate-400 text-[9px] font-black mb-1">Fecha y Hora de Proceso</p><p className="text-slate-900 font-black">{new Date(selectedPayForPrint.date).toLocaleString()}</p></div>
                   </div>
                </div>
                {selectedPayForPrint.status === 'void' && (
                  <div className="border-4 border-red-600 p-6 text-center rounded-3xl bg-red-50"><p className="text-red-600 font-[950] text-2xl uppercase tracking-widest">TRANSACCIÓN ANULADA</p><p className="text-xs text-red-500 font-bold uppercase mt-1">Justificación: {selectedPayForPrint.voidJustification}</p></div>
                )}
                <div className="bg-slate-50 p-10 rounded-[3rem] border-2 border-dashed border-slate-300 grid grid-cols-2 gap-20 text-center pt-24 pb-10">
                   <div className="border-t-2 border-slate-900 pt-4 text-[10px] font-black uppercase text-slate-900">Recibí Conforme (Beneficiario)</div>
                   <div className="border-t-2 border-slate-900 pt-4 text-[10px] font-black uppercase text-slate-900">Autorizado (Caja General)</div>
                </div>
                <div className="flex gap-4 no-print pt-6">
                   <button onClick={() => exportSingleExcel(selectedPayForPrint)} className="flex-1 py-5 bg-emerald-600 text-white font-black rounded-3xl uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-lg">Descargar Excel Individual</button>
                   <button onClick={() => window.print()} className="flex-1 py-5 bg-slate-900 text-white font-black rounded-3xl uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-lg">Descargar PDF Individual</button>
                </div>
             </div>
           );
        })()}
      </Modal>

      <Modal isOpen={isVoidModalOpen} onClose={() => setIsVoidModalOpen(false)} title="Anular Transacción" maxWidth="max-w-sm">
         <div className="space-y-4 text-center">
            <p className="text-xs text-slate-500 font-bold uppercase">Debe ingresar la causa obligatoria para anular:</p>
            <textarea className="w-full border-2 p-3 rounded-xl h-24 text-[11px] font-black focus:border-red-500 outline-none" placeholder="Motivo de la anulación..." value={voidJustification} onChange={e => setVoidJustification(e.target.value)}></textarea>
            <div className="flex gap-3">
               <button onClick={() => setIsVoidModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[9px]">Cancelar</button>
               <button onClick={handleVoid} className="flex-1 py-4 bg-red-600 text-white font-black rounded-xl uppercase text-[9px] shadow-lg active:scale-95 transition-all">Confirmar Anulación</button>
            </div>
         </div>
      </Modal>

      <Modal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} title="Registrar Egreso de Tesorería">
        <div className="space-y-4 px-1">
          <label className="text-[9px] font-black text-slate-400 uppercase">Beneficiario del Pago</label>
          <select className="w-full border-2 p-3 rounded-xl bg-slate-50 text-[11px] font-black uppercase outline-none focus:border-blue-500" onChange={e => setPayForm({...payForm, employeeId: e.target.value})}><option value="">Seleccione Colaborador...</option>{employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.surname} {e.name} - {e.identification}</option>)}</select>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase">Categoría</label>
              <select className="w-full border-2 p-3 rounded-xl bg-slate-50 text-[11px] font-black uppercase outline-none focus:border-blue-500" value={payForm.type} onChange={e => setPayForm({...payForm, type: e.target.value as any})}><option value="Salary">Sueldo / Nómina</option><option value="ExtraHours">Horas Extras</option><option value="Bonus">Bono / Incentivo</option><option value="Loan">Anticipo / Préstamo</option><option value="Emergency">Emergencia Médica</option><option value="Thirteenth">Décimo Tercero</option><option value="Fourteenth">Décimo Cuarto</option></select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase">Mes de Proceso</label>
              <select className="w-full border-2 p-3 rounded-xl bg-slate-50 text-[11px] font-black uppercase outline-none focus:border-blue-500" value={payForm.month} onChange={e => setPayForm({...payForm, month: e.target.value})}>{['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}</select>
            </div>
          </div>
          <label className="text-[9px] font-black text-slate-400 uppercase">Monto Desembolsado</label>
          <input type="number" step="0.01" className="w-full border-2 p-5 rounded-2xl font-[950] text-4xl text-center focus:border-emerald-500 outline-none shadow-inner" placeholder="0.00" onChange={e => setPayForm({...payForm, amount: Number(e.target.value)})} />
          <label className="text-[9px] font-black text-slate-400 uppercase">Concepto o Descripción</label>
          <textarea className="w-full border-2 p-3 rounded-xl h-24 text-[11px] font-bold focus:border-blue-500 outline-none" placeholder="Detalles específicos de la transacción..." onChange={e => setPayForm({...payForm, concept: e.target.value})}></textarea>
          <button onClick={handleCreate} className="w-full py-5 bg-emerald-600 text-white font-[950] rounded-[2rem] uppercase text-[11px] tracking-widest shadow-2xl active:scale-95 transition-all mt-4">Confirmar y Registrar Pago</button>
        </div>
      </Modal>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}><div className="text-center p-4"><p className="text-[11px] font-bold uppercase text-slate-600">{feedback.message}</p><button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] mt-6 shadow-lg active:scale-95 transition-all">Aceptar</button></div></Modal>
    </div>
  );
};

export default PaymentsModule;