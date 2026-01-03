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
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  role, isDbConnected, onLogout, company, onUpdateCompany, employees, onUpdateEmployees, attendance, payments, onUpdatePayments, settings, onUpdateSettings 
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'company' | 'employees' | 'payroll' | 'payments' | 'settings' | 'reports'>('dashboard');
  
  const today = useMemo(() => new Date(), []);
  const dayOfYear = useMemo(() => {
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }, [today]);

  const dailyQuote = useMemo(() => DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length], [dayOfYear]);
  const activeBreak = useMemo(() => ACTIVE_BREAKS[dayOfYear % ACTIVE_BREAKS.length], [dayOfYear]);

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
              {activeTab === 'dashboard' ? 'Centro de Bienestar' : 
               activeTab === 'company' ? 'Institucional' : 
               activeTab === 'employees' ? 'Talento Humano' : 
               activeTab === 'payroll' ? 'Nómina' : 
               activeTab === 'payments' ? 'Tesorería' : 
               activeTab === 'reports' ? 'Inteligencia' : 'Configuración'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`}></span>
                <span className="text-slate-400 font-black text-[7px] uppercase tracking-widest">
                  {isDbConnected ? 'Red Activa' : 'Sin Sincro'}
                </span>
            </div>
          </div>
        </header>

        <div className="animate-in fade-in duration-500">
          {activeTab === 'dashboard' && (
            <div className="space-y-6 no-print">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50">
                  <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-3">Reflexión Diaria</p>
                  <h2 className="text-lg md:text-xl font-[800] text-slate-800 leading-snug">"{dailyQuote}"</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white">
                   <h2 className="text-xl font-[950] mb-2 tracking-tighter uppercase text-blue-400">Personal</h2>
                   <p className="text-slate-400 mb-6 text-xs font-medium">Gestión del Capital Humano.</p>
                   <button onClick={() => setActiveTab('employees')} className="px-6 py-2 bg-white text-slate-900 font-black rounded-lg uppercase text-[8px] tracking-widest">Ver Expedientes</button>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 flex items-center gap-6">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl">{activeBreak.icon}</div>
                    <div>
                        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1">{activeBreak.title}</h3>
                        <p className="text-slate-500 font-medium text-[10px] leading-relaxed">{activeBreak.description}</p>
                    </div>
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
    </div>
  );
};

export default AdminDashboard;