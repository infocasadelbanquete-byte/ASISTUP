import React, { useState, useMemo, useEffect } from 'react';
import { Role, CompanyConfig, Employee, AttendanceRecord, Payment, GlobalSettings } from '../types.ts';
import Sidebar from '../components/Sidebar.tsx';
import CompanyModule from './modules/CompanyModule.tsx';
import EmployeeModule from './modules/EmployeeModule.tsx';
import PayrollModule from './modules/PayrollModule.tsx';
import PaymentsModule from './modules/PaymentsModule.tsx';
import SettingsModule from './modules/SettingsModule.tsx';
import ReportsModule from './modules/ReportsModule.tsx';
import Modal from '../components/Modal.tsx';
import { ECUADOR_HOLIDAYS, DAILY_QUOTES, ACTIVE_BREAKS } from '../constants.tsx';

interface AdminDashboardProps {
  role: Role;
  isDbConnected?: boolean;
  onLogout: () => void;
  company: CompanyConfig | null;
  onUpdateCompany: (config: CompanyConfig) => void;
  employees: Employee[];
  onUpdateEmployees: (employees: Employee[]) => void;
  attendance: AttendanceRecord[];
  payments: Payment[];
  onUpdatePayments: (payments: Payment[]) => void;
  settings: GlobalSettings;
  onUpdateSettings: (settings: GlobalSettings) => void;
  onUpdateAppMode: (mode: 'full' | 'attendance') => void;
  appMode: 'full' | 'attendance';
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  role, isDbConnected, onLogout, company, onUpdateCompany, employees, onUpdateEmployees, attendance, payments, onUpdatePayments, settings, onUpdateSettings, onUpdateAppMode, appMode 
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'company' | 'employees' | 'payroll' | 'payments' | 'settings' | 'reports'>('dashboard');
  const [showInstallModal, setShowInstallModal] = useState(false);
  
  const today = useMemo(() => new Date(), []);
  const dayOfYear = useMemo(() => {
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, [today]);

  const dailyQuote = DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];

  const exportGeneralToExcel = () => {
    const headers = "Empleado,Sueldo,Identificacion,Estado\n";
    const rows = employees.map(e => `${e.name} ${e.surname},${e.salary},${e.identification},${e.status}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Nomina_Resumen_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showInstallModal) setShowInstallModal(false);
        else setActiveTab('dashboard');
      }
    };
    window.addEventListener('keydown', handleEsc);
    // Fix: Changed handleKey to handleEsc to match defined variable
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showInstallModal]);

  return (
    <div className="flex h-screen bg-[#fcfdfe] overflow-hidden flex-col md:flex-row">
      <Sidebar 
        role={role} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={onLogout} 
        companyName={company?.name}
      />
      
      <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10 md:py-10 scroll-smooth custom-scroll">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 no-print pt-10 md:pt-0">
          <div>
            <h1 className="text-xl md:text-2xl font-[950] text-slate-900 tracking-tight uppercase">
              Consola Operativa
            </h1>
          </div>
          <div className="flex gap-3">
             {role === Role.SUPER_ADMIN && (
               <button onClick={() => setShowInstallModal(true)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-200">Instalar Equipo</button>
             )}
             <button onClick={exportGeneralToExcel} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-emerald-100">Exportar Excel</button>
          </div>
        </header>

        <div className="animate-in fade-in duration-500">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50">
                  <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-3">Reflexión Diaria</p>
                  <h2 className="text-lg md:text-xl font-[800] text-slate-800 leading-snug">"{dailyQuote}"</h2>
              </div>
              <div className="grid grid-cols-3 gap-6">
                 <div className="bg-blue-600 p-6 rounded-[2rem] text-white">
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Total Colaboradores</p>
                    <p className="text-4xl font-black mt-1">{employees.length}</p>
                 </div>
                 <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-60">SBU Vigente</p>
                    <p className="text-4xl font-black mt-1">${settings.sbu}</p>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Modo App</p>
                    <p className="text-xl font-black mt-1 uppercase text-slate-900">{appMode === 'full' ? 'Suite Completa' : 'Solo Asistencia'}</p>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'company' && <CompanyModule company={company} onUpdate={onUpdateCompany} role={role} />}
          {activeTab === 'employees' && <EmployeeModule employees={employees} onUpdate={onUpdateEmployees} role={role} attendance={attendance} payments={payments} company={company} />}
          {activeTab === 'payroll' && <PayrollModule employees={employees} payments={payments} company={company} settings={settings} role={role} />}
          {activeTab === 'payments' && <PaymentsModule employees={employees} payments={payments} onUpdate={onUpdatePayments} role={role} />}
          {activeTab === 'settings' && <SettingsModule settings={settings} onUpdate={onUpdateSettings} role={role} />}
          {activeTab === 'reports' && <ReportsModule employees={employees} payments={payments} attendance={attendance} company={company} settings={settings} />}
        </div>
      </main>

      <Modal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} title="Configuración de Dispositivo" maxWidth="max-w-md">
         <div className="space-y-6">
            <p className="text-xs text-slate-500 text-center">Defina cómo operará ASIST UP en este equipo físico.</p>
            <div className="space-y-3">
               <button onClick={() => { onUpdateAppMode('full'); setShowInstallModal(false); }} className={`w-full p-6 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${appMode === 'full' ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}>
                  <div>
                    <p className="font-black text-sm text-slate-900 uppercase">Suite Completa (Administración)</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Habilita todos los módulos de gestión.</p>
                  </div>
                  {appMode === 'full' && <span className="text-blue-600">✓</span>}
               </button>
               <button onClick={() => { onUpdateAppMode('attendance'); setShowInstallModal(false); }} className={`w-full p-6 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${appMode === 'attendance' ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}>
                  <div>
                    <p className="font-black text-sm text-slate-900 uppercase">Terminal de Asistencia (Kiosco)</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Oculta la administración por seguridad.</p>
                  </div>
                  {appMode === 'attendance' && <span className="text-blue-600">✓</span>}
               </button>
            </div>
            <button onClick={() => setShowInstallModal(false)} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest">Finalizar Configuración</button>
         </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;