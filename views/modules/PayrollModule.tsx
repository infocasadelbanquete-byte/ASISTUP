import React, { useState } from 'react';
import { Employee, Payment, CompanyConfig, GlobalSettings, Role } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface PayrollModuleProps {
  employees: Employee[];
  payments: Payment[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
  role: Role;
}

const PayrollModule: React.FC<PayrollModuleProps> = ({ employees, payments, company, settings, role }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('es-EC', {month: 'long'}).toUpperCase());
  const [individualPayroll, setIndividualPayroll] = useState<Employee | null>(null);

  const calculatePayrollData = (emp: Employee) => {
    const baseSalary = emp.salary;
    const reserveFund = emp.isAffiliated && emp.overSalaryType === 'monthly' ? (baseSalary * settings.reserveRate) : 0;
    const iessContribution = emp.isAffiliated ? (baseSalary * settings.iessRate) : 0;
    const totalIncome = baseSalary + reserveFund;
    const totalExpenses = iessContribution;

    return { 
      baseSalary, reserveFund, iessContribution,
      totalIncome, totalExpenses, netToReceive: totalIncome - totalExpenses 
    };
  };

  const exportGeneralExcel = () => {
    const headers = "Empleado,Sueldo Base,Fondos Reserva,Ingreso Total,Aporte IESS,Neto a Recibir\n";
    const rows = employees.map(emp => {
      const d = calculatePayrollData(emp);
      return `${emp.name} ${emp.surname},${d.baseSalary},${d.reserveFund},${d.totalIncome},${d.iessContribution},${d.netToReceive}`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Rol_General_${selectedMonth}_2026.csv`;
    link.click();
  };

  const exportIndividualExcel = (emp: Employee) => {
    const d = calculatePayrollData(emp);
    const content = `Empleado,${emp.name} ${emp.surname}\nCI,${emp.identification}\nCargo,${emp.role}\nMes,${selectedMonth}\n\nDetalle,Valor\nSueldo Base,${d.baseSalary}\nFondos Reserva,${d.reserveFund}\nAporte IESS,-${d.iessContribution}\nTOTAL NETO,${d.netToReceive}`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Rol_Individual_${emp.surname}_${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="space-y-8 fade-in">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 no-print">
        <h2 className="text-2xl font-black text-slate-900 uppercase">Gestión de Nómina</h2>
        <div className="flex gap-3">
           <button onClick={exportGeneralExcel} className="px-6 py-4 bg-emerald-50 text-emerald-600 font-black rounded-2xl border border-emerald-100 uppercase text-[9px]">Exportar Excel</button>
           <button onClick={() => window.print()} className="px-6 py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-[9px]">Imprimir Todos</button>
        </div>
      </div>

      <div className="bg-white p-12 rounded-[2.5rem] shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-900 text-white text-[9px] font-black uppercase">
            <tr>
              <th className="p-4">Empleado</th>
              <th className="p-4">Base</th>
              <th className="p-4">F. Reserva</th>
              <th className="p-4">Ingresos</th>
              <th className="p-4">IESS</th>
              <th className="p-4">Neto</th>
              <th className="p-4 no-print text-center">Detalle</th>
            </tr>
          </thead>
          <tbody className="text-[10px] uppercase font-bold text-slate-700">
            {employees.filter(e => e.status === 'active').map(emp => {
              const data = calculatePayrollData(emp);
              return (
                <tr key={emp.id} className="border-b">
                  <td className="p-4 font-black">{emp.surname} {emp.name}</td>
                  <td className="p-4">${data.baseSalary.toFixed(2)}</td>
                  <td className="p-4">${data.reserveFund.toFixed(2)}</td>
                  <td className="p-4 font-black text-blue-700">${data.totalIncome.toFixed(2)}</td>
                  <td className="p-4 text-red-600">-${data.iessContribution.toFixed(2)}</td>
                  <td className="p-4 font-black text-slate-900">${data.netToReceive.toFixed(2)}</td>
                  <td className="p-4 no-print text-center">
                     <button onClick={() => setIndividualPayroll(emp)} className="text-blue-600 font-black hover:underline">Ver Rol</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!individualPayroll} onClose={() => setIndividualPayroll(null)} title="Rol Individual">
        {individualPayroll && (
          <div className="p-6 space-y-6">
             <div className="text-center border-b pb-4">
                <h3 className="text-xl font-black">{company?.name || 'EMPRESA'}</h3>
                <p className="text-[10px] font-bold text-slate-400">ROL DE PAGOS - {selectedMonth}</p>
             </div>
             <div className="grid grid-cols-2 text-[10px] font-black">
                <p>NOMBRES: {individualPayroll.name} {individualPayroll.surname}</p>
                <p className="text-right">CARGO: {individualPayroll.role}</p>
             </div>
             <div className="bg-slate-50 p-6 rounded-2xl space-y-2">
                <div className="flex justify-between text-xs"><span>Sueldo</span> <span>${calculatePayrollData(individualPayroll).baseSalary.toFixed(2)}</span></div>
                <div className="flex justify-between text-xs text-red-600"><span>Aporte IESS</span> <span>-${calculatePayrollData(individualPayroll).iessContribution.toFixed(2)}</span></div>
                <div className="flex justify-between text-lg font-black pt-4 border-t"><span>NETO:</span> <span>${calculatePayrollData(individualPayroll).netToReceive.toFixed(2)}</span></div>
             </div>
             <div className="flex gap-3 no-print">
                <button onClick={() => exportIndividualExcel(individualPayroll)} className="flex-1 py-4 bg-emerald-50 text-emerald-600 font-black rounded-xl border border-emerald-100 text-[9px] uppercase">Descargar Excel</button>
                <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-xl text-[9px] uppercase">Imprimir Rol</button>
             </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PayrollModule;