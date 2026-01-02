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
      if (diffDays >= 15) {
        setIsBackupReminderOpen(true);
      }
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
    <div className="flex h-screen bg-[#fcfdfe] overflow-hidden">
      <Sidebar 
        role={role} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={onLogout} 
        companyName={company?.name}
      />
      
      <main className="flex-1 overflow-y-auto px-12 py-12 scroll-smooth custom-scroll">
        <header className="flex justify-between items-center mb-16 fade-in no-print">
          <div className="flex items-center gap-6">
            {activeTab !== 'dashboard' && (
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className="w-12 h-12 rounded-2xl bg-white shadow-xl border border-slate-100 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all group active:scale-90"
                title="Regresar al Dashboard"
              >
                <svg className="w-6 h-6 transform rotate-180 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
              </button>
            )}
            <div>
              <h1 className="text-[2.75rem] font-[900] text-slate-900 tracking-tight leading-tight">
                {activeTab === 'dashboard' ? 'Centro de Bienestar' : 
                 activeTab === 'company' ? 'Perfil Institucional' : 
                 activeTab === 'employees' ? 'Gestión de Talento' : 
                 activeTab === 'payroll' ? 'Nómina General' : 
                 activeTab === 'payments' ? 'Tesorería' : 
                 activeTab === 'reports' ? 'Centro de Reportes' : 'Ajustes Maestros'}
              </h1>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-slate-100 text-slate-500 font-black text-[9px] uppercase tracking-widest rounded-full">{role}</span>
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Entorno de Liderazgo Positivo</span>
                </div>
                
                {role === Role.SUPER_ADMIN && (
                   <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-50/50 border border-blue-100 rounded-2xl relative overflow-hidden group">
                      <div className="absolute inset-0 shimmer-bg opacity-10"></div>
                      <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] transition-all duration-700 ${isDbConnected ? 'bg-emerald-500 shadow-emerald-500 animate-pulse' : 'bg-red-500 shadow-red-500'}`}></div>
                      <span className="text-[9px] font-black text-blue-800 uppercase tracking-widest leading-none">
                        {isDbConnected ? 'Nube Sincronizada' : 'Error de Conexión'}
                      </span>
                   </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-3">
             {currentHoliday && (
               <div className="bg-slate-900 text-white px-8 py-3 rounded-2xl shadow-2xl flex items-center gap-4 transition-transform hover:scale-105">
                 <span className="text-2xl">🇪🇨</span>
                 <div>
                   <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-50">Festividad Nacional</p>
                   <p className="font-black text-sm">¡Feliz {currentHoliday.name}!</p>
                 </div>
               </div>
             )}
             {upcomingBirthdays.length > 0 && (
               <div className="bg-emerald-600 text-white px-8 py-3 rounded-2xl shadow-2xl flex items-center gap-4 transition-transform hover:scale-105">
                 <span className="text-2xl">🎂</span>
                 <div>
                   <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-60">Próximos Cumpleaños</p>
                   <p className="font-black text-sm">{upcomingBirthdays.map(e => e.name).join(', ')}</p>
                 </div>
               </div>
             )}
          </div>
        </header>

        <div className="animate-in fade-in duration-700">
          {activeTab === 'dashboard' && (
            <div className="space-y-12 no-print">
              <div className="bg-white p-10 md:p-12 rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.03)] border border-slate-50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:scale-110 transition-transform duration-700">
                   <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H16.017C14.9124 8 14.017 7.10457 14.017 6V3L22.017 3V15C22.017 18.3137 19.3307 21 16.017 21H14.017ZM2.01697 21L2.01697 18C2.01697 16.8954 2.9124 16 4.01697 16H7.01697C7.56925 16 8.01697 15.5523 8.01697 15V9C8.01697 8.44772 7.56925 8 7.01697 8H4.01697C2.9124 8 2.01697 7.10457 2.01697 6V3L10.017 3V15C10.017 18.3137 7.33068 21 4.01697 21H2.01697Z"/></svg>
                </div>
                <div className="relative z-10 max-w-2xl">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-4">Reflexión del día</p>
                  <h2 className="text-2xl md:text-3xl font-[800] text-slate-900 leading-[1.2] tracking-tight mb-6 italic">
                    "{dailyQuote}"
                  </h2>
                  <div className="h-1 w-16 bg-blue-600 rounded-full"></div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl flex flex-col justify-center">
                   <div className="relative z-10">
                      <h2 className="text-3xl font-[900] mb-4 tracking-tighter uppercase italic text-blue-400">Cultura ASIST UP</h2>
                      <p className="text-slate-400 mb-8 text-base font-medium leading-relaxed">El éxito de una empresa no se mide solo en números, sino en el bienestar y la motivación de quienes la construyen día a día.</p>
                      <button onClick={() => setActiveTab('employees')} className="px-10 py-4 bg-white text-slate-900 font-[900] rounded-2xl hover:bg-slate-100 transition-all shadow-xl uppercase text-[10px] tracking-widest">Ver mi equipo</button>
                   </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.02)] border border-slate-50">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                      {activeBreak.icon}
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Pausa Activa Sugerida</p>
                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{activeBreak.title}</h3>
                    </div>
                  </div>
                  <p className="text-slate-500 font-medium leading-relaxed mb-6 text-sm">
                    {activeBreak.description}
                  </p>
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-emerald-800 text-[10px] font-bold italic flex items-center gap-3">
                    <span className="text-lg">💡</span>
                    <span>Tomar descansos cortos cada hora aumenta la productividad y reduce el estrés laboral.</span>
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
          {activeTab === 'reports' && (
            <ReportsModule 
              employees={employees} 
              payments={payments} 
              attendance={attendance} 
              company={company} 
              settings={settings}
            />
          )}
        </div>
      </main>

      <Modal 
        isOpen={isBackupReminderOpen} 
        onClose={() => setIsBackupReminderOpen(false)} 
        title="Protección de Activos Digitales"
        type="success"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setIsBackupReminderOpen(false)} className="px-6 py-2 text-gray-400 font-bold text-[10px] uppercase">Luego</button>
            <button onClick={handleGoToBackup} className="px-8 py-2 bg-emerald-600 text-white font-black rounded-xl text-[10px] uppercase shadow-lg">Asegurar Información Ahora</button>
          </div>
        }
      >
        <div className="space-y-6 text-center">
           <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner">🛡️</div>
           <div>
             <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">¡La seguridad de sus datos es prioridad!</h3>
             <p className="text-sm text-slate-500 font-medium leading-relaxed">Han pasado 15 días desde su último respaldo integral. Mantener una copia local de su base de datos garantiza la continuidad operativa ante cualquier imprevisto.</p>
           </div>
           <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest italic">
              Proceso rápido • Encriptado • Seguro
           </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;