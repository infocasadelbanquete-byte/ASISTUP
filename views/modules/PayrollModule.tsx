
import React, { useState, useEffect } from 'react';
import { Employee, Payment, CompanyConfig, GlobalSettings, Role } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface PayrollModuleProps {
  employees: Employee[];
  payments: Payment[];
  onUpdatePayments: (payments: Payment[]) => void;
  onUpdateEmployees?: (employees: Employee[]) => void;
  attendance: any[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
  role: Role;
}

const PayrollModule: React.FC<PayrollModuleProps> = ({ employees, payments, onUpdatePayments, onUpdateEmployees, attendance = [], company, settings, role }) => {
  const [selectedMonth, setSelectedMonth] = useState('FEBRERO');
  const [individualPayroll, setIndividualPayroll] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState({ isOpen: false, title: '', message: '', type: 'success' as any });
  
  // Estado para capturar ediciones locales antes de persistir
  const [gridEdits, setGridEdits] = useState<Record<string, {
    workedDays?: number;
    extraHours?: number;
    otherIncomes?: number;
    fines?: number;
    advances?: number;
    otherDiscounts?: number;
  }>>({});

  const monthMap: { [key: string]: number } = {
    'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
    'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
  };

  const calculatePayrollData = (emp: Employee) => {
    const monthIndex = monthMap[selectedMonth] ?? 0;
    const year = 2026;

    // Valores base de asistencia automáticos
    const empAttendance = (attendance || []).filter(a => {
      const d = new Date(a.timestamp);
      return a.employeeId === emp.id && d.getMonth() === monthIndex && d.getFullYear() === year && a.status === 'confirmed';
    });
    const attendanceDates = new Set(empAttendance.map(a => a.timestamp.split('T')[0]));
    let autoWorkedDays = attendanceDates.size >= 22 ? 30 : attendanceDates.size;
    
    // Habilitar edición de Días Trabajados
    const workedDays = gridEdits[emp.id]?.workedDays !== undefined ? gridEdits[emp.id].workedDays : autoWorkedDays;
    
    const valuePerDay = emp.salary / 30;
    const baseSalaryEarned = valuePerDay * (workedDays || 0);

    const monthlyPayments = payments.filter(p => p.employeeId === emp.id && p.month === selectedMonth && p.status === 'paid');
    
    // Habilitar edición de valores financieros
    const extraHours = gridEdits[emp.id]?.extraHours !== undefined 
      ? gridEdits[emp.id].extraHours 
      : monthlyPayments.filter(p => p.type === 'ExtraHours').reduce((sum, p) => sum + p.amount, 0);

    const otherIncomes = gridEdits[emp.id]?.otherIncomes !== undefined 
      ? gridEdits[emp.id].otherIncomes 
      : monthlyPayments.filter(p => p.type === 'Bonus' || p.type === 'Vacation').reduce((sum, p) => sum + p.amount, 0);

    const fines = gridEdits[emp.id]?.fines !== undefined 
      ? gridEdits[emp.id].fines 
      : monthlyPayments.filter(p => p.type === 'Fine').reduce((sum, p) => sum + p.amount, 0);

    const advances = gridEdits[emp.id]?.advances !== undefined 
      ? gridEdits[emp.id].advances 
      : monthlyPayments.filter(p => p.type === 'Advance' || p.type === 'Loan' || p.type === 'Emergency').reduce((sum, p) => sum + p.amount, 0);

    const otherDiscounts = gridEdits[emp.id]?.otherDiscounts !== undefined 
      ? gridEdits[emp.id].otherDiscounts 
      : monthlyPayments.filter(p => p.type === 'BackPay').reduce((sum, p) => sum + p.amount, 0);

    // Cálculos automáticos de beneficios de ley (Ecuador)
    const ordinaryRemuneration = baseSalaryEarned + (extraHours || 0) + (otherIncomes || 0);

    const monthly13th = (emp.overSalaryType === 'monthly') ? ordinaryRemuneration / 12 : 0;
    const sbuPrev = settings.sbuPrev || 460.00;
    const monthly14th = (emp.overSalaryType === 'monthly') ? (sbuPrev / 12) * ((workedDays || 0) / 30) : 0;

    const reserveFund = (emp.isAffiliated) ? (ordinaryRemuneration * 0.0833) : 0;
    const reserveFundPaid = (emp.isAffiliated && emp.reserveFundType === 'monthly') ? reserveFund : 0;

    const iessContribution = emp.isAffiliated ? (ordinaryRemuneration * settings.iessRate) : 0;

    const totalIncomes = baseSalaryEarned + (extraHours || 0) + monthly13th + monthly14th + reserveFundPaid + (otherIncomes || 0);
    const totalExpenses = iessContribution + (fines || 0) + (advances || 0) + (otherDiscounts || 0);
    const netToReceive = totalIncomes - totalExpenses;

    return { 
      baseSalary: baseSalaryEarned,
      extraHours: extraHours || 0,
      reserveFund,
      monthly13th,
      monthly14th,
      otherIncomes: otherIncomes || 0,
      iessContribution,
      fines: fines || 0,
      advances: advances || 0,
      otherDiscounts: otherDiscounts || 0,
      netToReceive,
      workedDays: workedDays || 0
    };
  };

  const handleGridEdit = (empId: string, field: string, value: number) => {
    setGridEdits(prev => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || {}),
        [field]: value
      }
    }));
  };

  const saveAllChanges = () => {
    // Sincronización de ediciones con la base de datos de pagos
    const newPayments = [...payments];
    const now = new Date().toISOString();

    // Fix: Explicitly type 'edits' to resolve 'unknown' property access errors in saveAllChanges
    Object.entries(gridEdits).forEach(([empId, edits]) => {
      const typedEdits = edits as {
        workedDays?: number;
        extraHours?: number;
        otherIncomes?: number;
        fines?: number;
        advances?: number;
        otherDiscounts?: number;
      };

      // Para cada edición, se genera un registro de ajuste en la tesorería si el valor es positivo
      if (typedEdits && typedEdits.extraHours && typedEdits.extraHours > 0) {
        newPayments.push({
          id: Math.random().toString(36).substr(2, 9),
          employeeId: empId,
          amount: typedEdits.extraHours,
          date: now,
          month: selectedMonth,
          year: '2026',
          type: 'ExtraHours',
          method: 'Efectivo',
          concept: `AJUSTE HORAS EXTRAS ${selectedMonth}`,
          status: 'paid',
          voucherCode: `ADJ-EXT-${Date.now().toString().slice(-5)}`
        });
      }
      if (typedEdits && typedEdits.otherIncomes && typedEdits.otherIncomes > 0) {
        newPayments.push({
          id: Math.random().toString(36).substr(2, 9),
          employeeId: empId,
          amount: typedEdits.otherIncomes,
          date: now,
          month: selectedMonth,
          year: '2026',
          type: 'Bonus',
          method: 'Efectivo',
          concept: `AJUSTE BONO/OTROS ${selectedMonth}`,
          status: 'paid',
          voucherCode: `ADJ-BON-${Date.now().toString().slice(-5)}`
        });
      }
      // Se pueden añadir más tipos de ajustes aquí...
    });

    onUpdatePayments(newPayments);
    setGridEdits({});
    setFeedback({ isOpen: true, title: "Nómina Sincronizada", message: "Ajustes guardados correctamente en el sistema maestro.", type: "success" });
  };

  const exportGeneralExcel = () => {
    let csv = "\uFEFFColaborador,Identificación,Días,Sueldo Base,H. Extras,F. Reserva,13ero,14to,Otros Ing.,IESS,Multas,Anticipos,Otros Desc.,Neto\n";
    employees.filter(e => e.status === 'active').forEach((emp) => {
      const d = calculatePayrollData(emp);
      csv += `"${emp.surname} ${emp.name}","${emp.identification}","${d.workedDays}","${d.baseSalary.toFixed(2)}","${d.extraHours.toFixed(2)}","${d.reserveFund.toFixed(2)}","${d.monthly13th.toFixed(2)}","${d.monthly14th.toFixed(2)}","${d.otherIncomes.toFixed(2)}","${d.iessContribution.toFixed(2)}","${d.fines.toFixed(2)}","${d.advances.toFixed(2)}","${d.otherDiscounts.toFixed(2)}","${d.netToReceive.toFixed(2)}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ROL_GENERAL_${selectedMonth}_2026.csv`;
    link.click();
  };

  const filteredEmployees = employees.filter(e => {
    const searchStr = `${e.name} ${e.surname} ${e.identification}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 md:space-y-8 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm border no-print gap-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase">Rol de Pagos General</h2>
          <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">Habilitada la edición directa de valores mensuales</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
             <select className="p-3 border rounded-xl text-[11px] font-black uppercase outline-none focus:border-blue-500" value={selectedMonth} onChange={e => {setSelectedMonth(e.target.value); setGridEdits({});}}>
                {['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'].map(m => <option key={m} value={m}>{m}</option>)}
             </select>
             <input type="text" placeholder="Filtrar por nombre..." className="flex-1 p-3 border rounded-xl text-[11px] font-bold uppercase" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             <div className="flex gap-2">
               <button onClick={saveAllChanges} className="px-6 py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] active:scale-95 shadow-lg">Guardar Ajustes</button>
               <button onClick={exportGeneralExcel} className="px-6 py-4 bg-emerald-600 text-white font-black rounded-xl uppercase text-[10px] active:scale-95 shadow-lg">Descargar Excel</button>
             </div>
        </div>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-[2.5rem] shadow-sm border overflow-hidden">
        <div className="table-responsive overflow-x-auto custom-scroll">
          <table className="w-full text-left border-collapse min-w-[1900px] print:min-w-0">
            <thead className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
              <tr>
                <th className="p-4 sticky left-0 bg-slate-900 z-20">Colaborador / CI</th>
                <th className="p-4 text-center">Días</th>
                <th className="p-4 text-center">Sueldo Base</th>
                <th className="p-4 text-center">H. Extras</th>
                <th className="p-4 text-center">F. Reserva</th>
                <th className="p-4 text-center">13ero</th>
                <th className="p-4 text-center">14to</th>
                <th className="p-4 text-center">Otros Ing.</th>
                <th className="p-4 text-center">IESS 9.45%</th>
                <th className="p-4 text-center">Multas</th>
                <th className="p-4 text-center">Anticipos</th>
                <th className="p-4 text-center">Otros Desc.</th>
                <th className="p-4 text-center bg-blue-800 text-white sticky right-0 z-20">Neto Recibir</th>
                <th className="p-4 text-center no-print">Ver</th>
              </tr>
            </thead>
            <tbody className="text-[10px] uppercase font-bold text-slate-700 divide-y">
              {filteredEmployees.filter(e => e.status === 'active').map((emp) => {
                const d = calculatePayrollData(emp);
                return (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 sticky left-0 bg-white shadow-sm z-10">
                      <p className="font-black text-slate-900 leading-none">{emp.surname} {emp.name}</p>
                      <p className="text-[8px] text-slate-400 mt-1">{emp.identification}</p>
                    </td>
                    <td className="p-2 text-center">
                       <input type="number" className="w-12 p-1 border border-slate-200 rounded text-center font-black focus:border-blue-500" value={d.workedDays} onChange={e => handleGridEdit(emp.id, 'workedDays', Number(e.target.value))} />
                    </td>
                    <td className="p-4 text-center font-mono">${d.baseSalary.toFixed(2)}</td>
                    <td className="p-2 text-center">
                       <input type="number" step="0.01" className="w-16 p-1 border border-slate-200 rounded text-center font-black bg-blue-50 text-blue-700 focus:border-blue-500" value={d.extraHours} onChange={e => handleGridEdit(emp.id, 'extraHours', Number(e.target.value))} />
                    </td>
                    <td className="p-4 text-center font-black text-emerald-700">${d.reserveFund.toFixed(2)}</td>
                    <td className="p-4 text-center">${d.monthly13th.toFixed(2)}</td>
                    <td className="p-4 text-center">${d.monthly14th.toFixed(2)}</td>
                    <td className="p-2 text-center">
                       <input type="number" step="0.01" className="w-16 p-1 border border-slate-200 rounded text-center font-black bg-emerald-50 text-emerald-700 focus:border-blue-500" value={d.otherIncomes} onChange={e => handleGridEdit(emp.id, 'otherIncomes', Number(e.target.value))} />
                    </td>
                    <td className="p-4 text-center text-red-500">${d.iessContribution.toFixed(2)}</td>
                    <td className="p-2 text-center">
                       <input type="number" step="0.01" className="w-16 p-1 border border-slate-200 rounded text-center font-black bg-red-50 text-red-600 focus:border-blue-500" value={d.fines} onChange={e => handleGridEdit(emp.id, 'fines', Number(e.target.value))} />
                    </td>
                    <td className="p-2 text-center">
                       <input type="number" step="0.01" className="w-16 p-1 border border-slate-200 rounded text-center font-black bg-orange-50 text-orange-600 focus:border-blue-500" value={d.advances} onChange={e => handleGridEdit(emp.id, 'advances', Number(e.target.value))} />
                    </td>
                    <td className="p-2 text-center">
                       <input type="number" step="0.01" className="w-16 p-1 border border-slate-200 rounded text-center font-black focus:border-blue-500" value={d.otherDiscounts} onChange={e => handleGridEdit(emp.id, 'otherDiscounts', Number(e.target.value))} />
                    </td>
                    <td className="p-4 text-center font-black text-blue-700 bg-blue-50/20 sticky right-0 z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                      ${d.netToReceive.toFixed(2)}
                    </td>
                    <td className="p-4 text-center no-print">
                       <button onClick={() => setIndividualPayroll(emp)} className="p-2 bg-blue-50 text-blue-600 rounded-lg shadow-sm hover:bg-blue-600 hover:text-white transition-all">📄</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
          <div className="text-center p-6 space-y-8">
              <p className="text-slate-700 font-black uppercase text-[11px] italic leading-relaxed">{feedback.message}</p>
              <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest active:scale-95 shadow-lg">Aceptar</button>
          </div>
      </Modal>

      {/* ROL INDIVIDUAL (MODAL) */}
      <Modal isOpen={!!individualPayroll} onClose={() => setIndividualPayroll(null)} title="Rol Individual">
        {individualPayroll && (() => {
           const d = calculatePayrollData(individualPayroll);
           return (
             <div className="space-y-8 bg-white p-6" id="individual-role-print">
               <div className="flex justify-between items-center border-b-4 border-black pb-8">
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 border-2 border-black flex items-center justify-center overflow-hidden">
                      {company?.logo ? <img src={company.logo} className="w-full h-full object-contain" /> : <span className="text-2xl font-black">LOGO</span>}
                    </div>
                    <div>
                      <h3 className="text-2xl font-[950] uppercase italic leading-none">{company?.name || 'EMPRESA'}</h3>
                      <p className="text-sm font-black mt-2">RUC: {company?.ruc || '001'}</p>
                      <p className="text-[10px] font-bold uppercase">{company?.address}</p>
                    </div>
                  </div>
                  <div className="text-right">
                     <p className="font-black uppercase text-[14px]">ROL INDIVIDUAL</p>
                     <p className="font-bold uppercase text-[12px]">{selectedMonth} / 2026</p>
                  </div>
               </div>
               
               <div className="grid grid-cols-2 gap-6 text-[11px] font-bold uppercase border p-4 bg-slate-50/30 rounded-2xl">
                  <div>
                    <p className="text-[9px] text-slate-400">COLABORADOR:</p>
                    <p className="text-black font-black text-base">{individualPayroll.surname} {individualPayroll.name}</p>
                    <p className="text-[10px] text-blue-600">{individualPayroll.role} | ID: {individualPayroll.identification}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400">LIQUIDACIÓN:</p>
                    <p className="text-black font-black text-lg">{d.workedDays} DÍAS LABORADOS</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-2">
                     <h4 className="text-[11px] font-black uppercase border-b-2 border-emerald-600">Haberes</h4>
                     <div className="flex justify-between text-[11px]"><span>Sueldo Proporcional</span><span>${d.baseSalary.toFixed(2)}</span></div>
                     <div className="flex justify-between text-[11px]"><span>Extras/Suplem.</span><span>${d.extraHours.toFixed(2)}</span></div>
                     <div className="flex justify-between text-[11px] text-emerald-700"><span>Reserva (8.33%)</span><span>${d.reserveFund.toFixed(2)}</span></div>
                     <div className="flex justify-between text-[11px]"><span>Décimos (Mensual)</span><span>${(d.monthly13th + d.monthly14th).toFixed(2)}</span></div>
                  </div>
                  <div className="space-y-2">
                     <h4 className="text-[11px] font-black uppercase border-b-2 border-red-600">Egresos</h4>
                     <div className="flex justify-between text-[11px]"><span>IESS (9.45%)</span><span>${d.iessContribution.toFixed(2)}</span></div>
                     <div className="flex justify-between text-[11px]"><span>Anticipos/Préstamos</span><span>${d.advances.toFixed(2)}</span></div>
                     <div className="flex justify-between text-[11px]"><span>Multas/Otros</span><span>${(d.fines + d.otherDiscounts).toFixed(2)}</span></div>
                  </div>
               </div>

               <div className="border-4 border-slate-900 p-8 flex justify-between items-center bg-slate-900 text-white rounded-[2rem] shadow-2xl mt-6">
                  <p className="text-[16px] font-[950] uppercase tracking-[0.5em]">Líquido a Recibir</p>
                  <p className="text-5xl font-[950] tracking-tighter">${d.netToReceive.toFixed(2)}</p>
               </div>
               
               <div className="mt-20 grid grid-cols-2 gap-24 text-center text-[10px] font-black uppercase">
                  <div className="border-t-2 border-black pt-6">Firma del Colaborador</div>
                  <div className="border-t-2 border-black pt-6">Gerencia / Tesorería</div>
               </div>

               <button onClick={() => window.print()} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl uppercase text-[11px] no-print mt-10 shadow-xl tracking-widest active:scale-95 transition-all">Imprimir Comprobante</button>
             </div>
           );
        })()}
      </Modal>
    </div>
  );
};

export default PayrollModule;
