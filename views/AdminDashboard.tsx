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
import { DAILY_QUOTES } from '../constants.tsx';

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

  const handlePurgeData = async () => {
    if (role !== Role.SUPER_ADMIN) return;
    onUpdateEmployees([]);
    onUpdatePayments([]);
    // La limpieza de asistencia debe manejarse en el componente padre si persiste en DB
  };

  const allAppData = {
    company,
    employees,
    attendance,
    payments,
    settings,
    exportDate: new Date().toISOString()
  };

  return (
    <div className="flex h-screen bg-[#fcfdfe] overflow-hidden flex-col md:flex-row">
      <Sidebar role={role} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={onLogout} companyName={company?.name} />
      
      <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10 md:py-10 scroll-smooth custom-scroll">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 no-print pt-10 md:pt-0">
          <h1 className="text-xl md:text-2xl font-[950] text-slate-900 tracking-tight uppercase">Panel Administrativo</h1>
          <div className="flex gap-3">
             {role === Role.SUPER_ADMIN && (
               <button onClick={() => setShowInstallModal(true)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase border border-slate-200">Instalar Kiosco</button>
             )}
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
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Personal Activo</p>
                    <p className="text-4xl font-black mt-1">{employees.length}</p>
                 </div>
                 <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-60">SBU 2026</p>
                    <p className="text-4xl font-black mt-1">${settings.sbu}</p>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Estatus DB</p>
                    <p className="text-xl font-black mt-1 uppercase text-slate-900">{isDbConnected ? 'Sincronizado' : 'Offline'}</p>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'company' && <CompanyModule company={company} onUpdate={onUpdateCompany} role={role} />}
          {activeTab === 'employees' && <EmployeeModule employees={employees} onUpdate={onUpdateEmployees} role={role} attendance={attendance} payments={payments} company={company} />}
          {activeTab === 'payroll' && <PayrollModule employees={employees} payments={payments} company={company} settings={settings} role={role} />}
          {activeTab === 'payments' && <PaymentsModule employees={employees} payments={payments} onUpdate={onUpdatePayments} role={role} />}
          {activeTab === 'settings' && <SettingsModule settings={settings} onUpdate={onUpdateSettings} role={role} onPurge={handlePurgeData} allData={allAppData} />}
          {activeTab === 'reports' && <ReportsModule employees={employees} payments={payments} attendance={attendance} company={company} settings={settings} />}
        </div>
      </main>

      <Modal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} title="Configuración de Equipo" maxWidth="max-w-md">
         <div className="space-y-6">
            <p className="text-xs text-slate-500 text-center">Seleccione el modo operativo para esta estación de trabajo.</p>
            <div className="space-y-3">
               <button onClick={() => { onUpdateAppMode('full'); setShowInstallModal(false); }} className={`w-full p-6 rounded-2xl border-2 text-left flex items-center justify-between ${appMode === 'full' ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>
                  <div>
                    <p className="font-black text-sm text-slate-900 uppercase">Administración Full</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Acceso total a módulos.</p>
                  </div>
               </button>
               <button onClick={() => { onUpdateAppMode('attendance'); setShowInstallModal(false); }} className={`w-full p-6 rounded-2xl border-2 text-left flex items-center justify-between ${appMode === 'attendance' ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>
                  <div>
                    <p className="font-black text-sm text-slate-900 uppercase">Sólo Marcación</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Modo kiosco seguro.</p>
                  </div>
               </button>
            </div>
         </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;