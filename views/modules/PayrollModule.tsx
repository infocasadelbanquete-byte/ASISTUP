
import React, { useState } from 'react';
import { Employee, Payment, CompanyConfig, GlobalSettings, Role } from '../../types';
import Modal from '../../components/Modal';

interface PayrollModuleProps {
  employees: Employee[];
  payments: Payment[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
  role: Role;
}

const PayrollModule: React.FC<PayrollModuleProps> = ({ employees, payments, company, settings, role }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('es-EC', { month: 'long' }));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [individualRoleEmployee, setIndividualRoleEmployee] = useState<Employee | null>(null);

  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const activeEmployees = employees.filter(e => {
    if (e.status === 'active') return true;
    if (e.status === 'terminated' && e.terminationDate?.includes(selectedYear)) return true;
    return false;
  });

  const isMoreThanOneYear = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 365;
  };

  const calculatePayrollData = (emp: Employee) => {
    const isAffiliated = emp.isAffiliated;
    const earnsReserve = isAffiliated && isMoreThanOneYear(emp.startDate);
    
    const reserve = (earnsReserve && emp.overSalaryType === 'monthly') ? emp.salary * settings.reserveRate : 0;
    const thirteenth = (isAffiliated && emp.overSalaryType === 'monthly') ? emp.salary / 12 : 0;
    const fourteenth = (isAffiliated && emp.overSalaryType === 'monthly') ? settings.sbu / 12 : 0;
    
    const iess = isAffiliated ? emp.salary * settings.iessRate : 0;
    
    const totalIngresos = emp.salary + reserve + thirteenth + fourteenth;
    const totalEgresos = iess;
    const neto = totalIngresos - totalEgresos;

    return { reserve, thirteenth, fourteenth, iess, totalIngresos, totalEgresos, neto };
  };

  const handleExportExcel = () => {
    let csv = "Empleado,Identificación,Sueldo,Reserva,13ro,14to,IESS 9.45%,Neto\n";
    activeEmployees.forEach(emp => {
      const data = calculatePayrollData(emp);
      csv += `${emp.name},${emp.identification},${emp.salary},${data.reserve},${data.thirteenth},${data.fourteenth},${data.iess},${data.neto}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Rol_General_${selectedMonth}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between no-print">
        <div className="flex gap-4">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border-gray-200 border rounded-xl px-4 py-3 font-bold uppercase text-xs outline-none">
            {months.map(m => <option key={m} value={m.toLowerCase()}>{m}</option>)}
          </select>
          <input type="number" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="border-gray-200 border rounded-xl px-4 py-3 font-bold w-24 text-xs outline-none" />
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportExcel} className="px-6 py-3 bg-emerald-600 text-white font-black rounded-2xl shadow-lg text-xs uppercase tracking-widest">Excel</button>
          <button onClick={() => window.print()} className="px-8 py-3 bg-blue-900 text-white font-black rounded-2xl shadow-lg text-xs">IMPRIMIR ROL GENERAL (A4)</button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-2xl overflow-x-auto border border-gray-100 min-h-[800px]">
        <div className="payroll-printable w-full text-[10px] text-gray-800 font-medium">
          <div className="flex justify-between items-start mb-6 border-b-2 border-gray-100 pb-6">
            <div>
              <h1 className="text-3xl font-black text-blue-900 uppercase tracking-tighter">ROL DE PAGOS GENERAL <span className="text-blue-500">{company?.name || ''}</span></h1>
              <div className="mt-4 text-[11px] font-bold text-gray-500">
                <p>Razón Social: <span className="text-gray-900">{company?.legalRep || '---'}</span></p>
                <p>RUC: <span className="text-gray-900">{company?.ruc || '---'}</span></p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black text-emerald-800 uppercase">{selectedMonth} <span className="text-emerald-400">{selectedYear}</span></p>
            </div>
          </div>

          <table className="w-full border-collapse">
            <thead className="bg-gray-50 font-black uppercase text-[9px]">
              <tr>
                <th className="border border-gray-200 p-2" rowSpan={2}>Empleado / Identificación</th>
                <th className="border border-gray-200 p-2 bg-blue-50" colSpan={7}>INGRESOS</th>
                <th className="border border-gray-200 p-2 bg-red-50" colSpan={4}>EGRESOS</th>
                <th className="border border-gray-200 p-2 bg-emerald-50" rowSpan={2}>Neto a Recibir</th>
                <th className="border border-gray-200 p-2 no-print" rowSpan={2}>Acciones</th>
              </tr>
              <tr className="bg-gray-100">
                <th className="border border-gray-200 p-1">Sueldo</th>
                <th className="border border-gray-200 p-1">H. Suple.</th>
                <th className="border border-gray-200 p-1">H. Extras</th>
                <th className="border border-gray-200 p-1">F. Reserva</th>
                <th className="border border-gray-200 p-1">13ro Mens.</th>
                <th className="border border-gray-200 p-1">14to Mens.</th>
                <th className="border border-gray-200 p-1">Otros</th>
                <th className="border border-gray-200 p-1">IESS 9.45%</th>
                <th className="border border-gray-200 p-1">Anticipos</th>
                <th className="border border-gray-200 p-1">Multas</th>
                <th className="border border-gray-200 p-1">Otros</th>
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map(emp => {
                const data = calculatePayrollData(emp);
                return (
                  <tr key={emp.id} className="text-center font-bold border-b border-gray-100 hover:bg-gray-50">
                    <td className="border border-gray-200 p-2 text-left">
                      <p className="text-blue-900">{emp.name}</p>
                      <p className="text-[8px] font-mono text-gray-400">{emp.identification}</p>
                    </td>
                    <td className="border border-gray-200 p-1">${emp.salary.toFixed(2)}</td>
                    <td className="border border-gray-200 p-1">$0.00</td>
                    <td className="border border-gray-200 p-1">$0.00</td>
                    <td className="border border-gray-200 p-1">${data.reserve.toFixed(2)}</td>
                    <td className="border border-gray-200 p-1">${data.thirteenth.toFixed(2)}</td>
                    <td className="border border-gray-200 p-1">${data.fourteenth.toFixed(2)}</td>
                    <td className="border border-gray-200 p-1">$0.00</td>
                    <td className="border border-gray-200 p-1">${data.iess.toFixed(2)}</td>
                    <td className="border border-gray-200 p-1">$0.00</td>
                    <td className="border border-gray-200 p-1">$0.00</td>
                    <td className="border border-gray-200 p-1">$0.00</td>
                    <td className="border border-gray-200 p-1 font-black text-emerald-800 bg-emerald-50">${data.neto.toFixed(2)}</td>
                    <td className="border border-gray-200 p-1 no-print">
                       <button 
                        onClick={() => setIndividualRoleEmployee(emp)}
                        className="text-[8px] px-2 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-700 hover:text-white transition-all font-black uppercase"
                       >
                         Rol Individual
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-20 flex justify-around no-print:hidden">
            <div className="w-64 border-t-2 border-gray-900 pt-2 text-center">
              <p className="font-black text-blue-900 uppercase">ADMINISTRADOR</p>
              <p className="text-[8px] font-bold text-gray-500 uppercase mt-1 tracking-widest">Firma Autorizada</p>
            </div>
            <div className="w-64 border-t-2 border-gray-900 pt-2 text-center">
              <p className="font-black text-blue-900 uppercase">EMPLEADOR</p>
              <p className="text-[8px] font-bold text-gray-500 uppercase mt-1 tracking-widest">Representante Legal</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Rol Individual para Impresión */}
      {individualRoleEmployee && (
        <Modal 
          isOpen={!!individualRoleEmployee} 
          onClose={() => setIndividualRoleEmployee(null)} 
          title="Comprobante de Pago Individual"
          footer={<button onClick={() => window.print()} className="px-8 py-2 bg-blue-700 text-white rounded-xl font-black text-xs">IMPRIMIR ROL INDIVIDUAL</button>}
        >
          <div className="p-8 text-gray-900 font-medium printable-role">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-black text-blue-900 uppercase">ROL DE PAGOS INDIVIDUAL</h2>
              <p className="text-lg font-bold text-blue-600">{company?.name}</p>
              <div className="mt-2 text-xs text-gray-500">
                <p>RUC: {company?.ruc} | Representante: {company?.legalRep}</p>
                <p className="font-black text-emerald-600 mt-1 uppercase">{selectedMonth} {selectedYear}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8 border-y py-6 border-gray-100">
               <div>
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Datos del Colaborador</p>
                 <p className="text-xl font-black text-slate-800">{individualRoleEmployee.name}</p>
                 <p className="text-xs font-bold text-gray-500">C.I.: {individualRoleEmployee.identification}</p>
                 <p className="text-xs font-bold text-gray-500">Fecha Ingreso: {individualRoleEmployee.startDate}</p>
               </div>
               <div className="text-right">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cuenta Bancaria</p>
                 <p className="text-sm font-bold">{individualRoleEmployee.bankInfo.ifi}</p>
                 <p className="text-xs text-gray-500">{individualRoleEmployee.bankInfo.type} - {individualRoleEmployee.bankInfo.account}</p>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-12">
               <div>
                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 border-b pb-2">Ingresos Detallados</h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between"><span>Sueldo Base:</span> <span>${individualRoleEmployee.salary.toFixed(2)}</span></div>
                    {calculatePayrollData(individualRoleEmployee).reserve > 0 && <div className="flex justify-between"><span>Fondos de Reserva (8.33%):</span> <span>${calculatePayrollData(individualRoleEmployee).reserve.toFixed(2)}</span></div>}
                    {calculatePayrollData(individualRoleEmployee).thirteenth > 0 && <div className="flex justify-between"><span>Décimo Tercer Sueldo:</span> <span>${calculatePayrollData(individualRoleEmployee).thirteenth.toFixed(2)}</span></div>}
                    {calculatePayrollData(individualRoleEmployee).fourteenth > 0 && <div className="flex justify-between"><span>Décimo Cuarto Sueldo:</span> <span>${calculatePayrollData(individualRoleEmployee).fourteenth.toFixed(2)}</span></div>}
                    <div className="flex justify-between font-black pt-2 border-t text-blue-900"><span>TOTAL INGRESOS:</span> <span>${calculatePayrollData(individualRoleEmployee).totalIngresos.toFixed(2)}</span></div>
                  </div>
               </div>
               <div>
                  <h4 className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-4 border-b pb-2">Egresos / Retenciones</h4>
                  <div className="space-y-3 text-xs">
                    {individualRoleEmployee.isAffiliated && <div className="flex justify-between"><span>Aporte Personal IESS (9.45%):</span> <span>${calculatePayrollData(individualRoleEmployee).iess.toFixed(2)}</span></div>}
                    <div className="flex justify-between"><span>Anticipos / Préstamos:</span> <span>$0.00</span></div>
                    <div className="flex justify-between font-black pt-2 border-t text-red-900"><span>TOTAL EGRESOS:</span> <span>${calculatePayrollData(individualRoleEmployee).totalEgresos.toFixed(2)}</span></div>
                  </div>
               </div>
            </div>

            <div className="mt-10 bg-slate-900 text-white p-6 rounded-2xl flex justify-between items-center shadow-2xl">
               <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Neto a Percibir</p>
                 <p className="text-4xl font-black tracking-tighter">${calculatePayrollData(individualRoleEmployee).neto.toFixed(2)}</p>
               </div>
               <div className="text-right">
                 <p className="text-[9px] font-bold text-slate-400 uppercase italic">Recibí conforme el valor estipulado en este comprobante.</p>
               </div>
            </div>

            <div className="mt-20 grid grid-cols-2 gap-20">
               <div className="border-t-2 border-gray-900 pt-2 text-center">
                 <p className="text-[10px] font-black uppercase">Firma del Empleador</p>
               </div>
               <div className="border-t-2 border-gray-900 pt-2 text-center">
                 <p className="text-[10px] font-black uppercase">Firma del Colaborador</p>
               </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PayrollModule;
