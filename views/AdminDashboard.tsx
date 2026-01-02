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
  const [isBackupReminderOpen, setIsBackupReminderOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  
  const dayOfYear = useMemo(() => {
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }, [today]);

  const dailyQuote = useMemo(() => DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length], [dayOfYear]);
  const activeBreak = useMemo(() => ACTIVE_BREAKS[dayOfYear % ACTIVE_BREAKS.length], [dayOfYear]);

  useEffect(() => {
    const lastBackup = localStorage.getItem('lastBackupDate');
    if (lastBackup) {
      const lastDate = new Date(lastBackup);
      const diffTime = Math.abs(today.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 15) setIsBackupReminderOpen(true);
    } else {
      localStorage.setItem('lastBackupDate', today.toISOString());
    }
  }, [today]);

  const upcomingBirthdays = useMemo(() => {
    return employees.filter(emp => {
      if (emp.status !== 'active') return false;
      const bday = new Date(emp.birthDate);
      const bdayThisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      const diff = (bdayThisYear.getTime() - today.getTime()) / (1000 * 3600 * 24);
      return diff >= 0 && diff <= 3;
    });
  }, [employees, today]);

  const currentHoliday = useMemo(() => {
    return ECUADOR_HOLIDAYS.find(h => {
      if (h.duration) {
        return today.getMonth() === h.month && today.getDate() >= h.day && today.getDate() < h.day + h.duration;
      }
      return today.getMonth() === h.month && today.getDate() === h.day;
    });
  }, [today]);

  const handleGoToBackup = () => {
    setIsBackupReminderOpen(false);
    setActiveTab('settings');
  };

  return (
    <div className="flex h-screen bg-[#fcfdfe] overflow-hidden flex-col md:flex-row">
      <Sidebar 
        role={role} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={onLogout} 
        companyName={company?.name}
      />
      
      <main className="flex-1 overflow-y-auto px-6 py-10 md:px-12 md:py-12 scroll-smooth custom-scroll">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 md:mb-16 gap-6 fade-in no-print pt-14 md:pt-0">
          <div className="flex items-center gap-4 md:gap-6">
            {activeTab !== 'dashboard' && (
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white shadow-xl border border-slate-100 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
              >
                <svg className="w-5 h-5 md:w-6 md:h-6 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
              </button>
            )}
            <div>
              <h1 className="text-2xl md:text-4xl font-[900] text-slate-900 tracking-tight">
                {activeTab === 'dashboard' ? 'Bienestar' : 
                 activeTab === 'company' ? 'Institucional' : 
                 activeTab === 'employees' ? 'Talento' : 
                 activeTab === 'payroll' ? 'Nómina' : 
                 activeTab === 'payments' ? 'Tesorería' : 
                 activeTab === 'reports' ? 'Reportes' : 'Ajustes'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></span>
                  <span className="text-slate-400 font-bold text-[8px] uppercase tracking-widest">
                    {isDbConnected ? 'Cloud Sync' : 'Offline Mode'}
                  </span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
             {currentHoliday && (
               <div className="bg-slate-900 text-white px-4 py-2 md:px-6 md:py-3 rounded-xl flex items-center gap-3 shrink-0">
                 <span className="text-xl">🇪🇨</span>
                 <p className="font-black text-[10px] md:text-xs">¡{currentHoliday.name}!</p>
               </div>
             )}
             {upcomingBirthdays.length > 0 && (
               <div className="bg-emerald-600 text-white px-4 py-2 md:px-6 md:py-3 rounded-xl flex items-center gap-3 shrink-0">
                 <span className="text-xl">🎂</span>
                 <p className="font-black text-[10px] md:text-xs">{upcomingBirthdays[0].name}</p>
               </div>
             )}
          </div>
        </header>

        <div className="animate-in fade-in duration-700">
          {activeTab === 'dashboard' && (
            <div className="space-y-8 md:space-y-12 no-print">
              <div className="bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[3rem] shadow-sm border border-slate-50 relative overflow-hidden group">
                <div className="relative z-10 max-w-2xl">
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.3em] mb-4">Reflexión</p>
                  <h2 className="text-xl md:text-3xl font-[800] text-slate-900 italic leading-snug">"{dailyQuote}"</h2>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                <div className="bg-slate-900 rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-10 text-white relative overflow-hidden flex flex-col justify-center">
                   <h2 className="text-2xl md:text-3xl font-[900] mb-4 tracking-tighter uppercase italic text-blue-400">Cultura</h2>
                   <p className="text-slate-400 mb-8 text-sm md:text-base font-medium">Gestionando el activo más valioso: Las personas.</p>
                   <button onClick={() => setActiveTab('employees')} className="w-fit px-8 py-3 bg-white text-slate-900 font-[900] rounded-xl uppercase text-[9px] tracking-widest">Ver equipo</button>
                </div>

                <div className="bg-white p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-sm border border-slate-50">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-2xl">{activeBreak.icon}</div>
                    <h3 className="text-base md:text-lg font-black text-slate-900 uppercase">{activeBreak.title}</h3>
                  </div>
                  <p className="text-slate-500 font-medium mb-4 text-xs md:text-sm">{activeBreak.description}</p>
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

      <Modal isOpen={isBackupReminderOpen} onClose={() => setIsBackupReminderOpen(false)} title="Seguridad de Datos" type="success">
        <div className="text-center space-y-4">
           <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto">🛡️</div>
           <p className="text-sm text-slate-500">Es momento de realizar un respaldo integral de su base de datos.</p>
           <button onClick={handleGoToBackup} className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl text-[10px] uppercase shadow-lg">Respaldar Ahora</button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;