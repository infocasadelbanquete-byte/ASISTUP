
import React, { useState, useMemo, useEffect } from 'react';
import { Role, CompanyConfig, Employee, AttendanceRecord, Payment, GlobalSettings, NotificationMessage } from '../types.ts';
import Sidebar from '../components/Sidebar.tsx';
import CompanyModule from './modules/CompanyModule.tsx';
import EmployeeModule from './modules/EmployeeModule.tsx';
import PayrollModule from './modules/PayrollModule.tsx';
import PaymentsModule from './modules/PaymentsModule.tsx';
import SettingsModule from './modules/SettingsModule.tsx';
import ReportsModule from './modules/ReportsModule.tsx';
import AiAssistant from './modules/AiAssistant.tsx';
import NotificationsModule from './modules/NotificationsModule.tsx';
import Modal from '../components/Modal.tsx';
import { DAILY_QUOTES, ACTIVE_BREAKS, ECUADOR_HOLIDAYS } from '../constants.tsx';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'company' | 'employees' | 'payroll' | 'payments' | 'settings' | 'reports' | 'ai' | 'notifications'>('dashboard');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(new Set());
  
  const today = useMemo(() => new Date(), []);
  const todayDateStr = useMemo(() => today.toISOString().split('T')[0], [today]);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const addNotification = (title: string, message: string, type: 'info' | 'alert' | 'critical') => {
    const contentId = `notif-${title}-${message}`.replace(/\s/g, '-');
    
    if (dismissedNotificationIds.has(contentId)) return;

    setNotifications(prev => {
      if (prev.some(n => n.id === contentId)) return prev;
      return [{ id: contentId, title, message, timestamp: new Date().toISOString(), type, isRead: false, isProcessed: false }, ...prev];
    });
  };
  
  useEffect(() => {
    const activeEmployees = employees.filter(e => e.status === 'active');
    const markedTodayIds = new Set((attendance || [])
      .filter(a => a.timestamp.includes(todayDateStr))
      .map(a => a.employeeId));
    
    const missingAttendanceCount = activeEmployees.filter(e => !markedTodayIds.has(e.id)).length;
    if (missingAttendanceCount > 0 && activeTab === 'dashboard') {
      addNotification(
        "Pendiente de Ingreso", 
        `Hay ${missingAttendanceCount} colaboradores que aún no han registrado su marcación hoy.`, 
        'alert'
      );
    }
  }, [employees, attendance, todayDateStr, activeTab, dismissedNotificationIds]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const dayOfYear = useMemo(() => {
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, [today]);

  const dailyQuote = DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
  const activeBreak = ACTIVE_BREAKS[dayOfYear % ACTIVE_BREAKS.length];

  const relaxingImages = [
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=2070",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=2071",
    "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=2070",
    "https://images.unsplash.com/photo-1541450805268-4822a3a774ce?auto=format&fit=crop&q=80&w=2070"
  ];
  const currentRelaxingImage = relaxingImages[dayOfYear % relaxingImages.length];

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [currentMonth, currentYear]);

  const monthHolidays = ECUADOR_HOLIDAYS.filter(h => h.month === currentMonth);
  const monthBirthdays = employees.filter(e => {
    if (!e.birthDate || e.status !== 'active') return false;
    return new Date(e.birthDate).getMonth() === currentMonth;
  });

  const handleDismissNotification = (id: string) => {
    setDismissedNotificationIds(prev => new Set([...prev, id]));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handlePurgeData = async () => {
    if (role !== Role.SUPER_ADMIN) return;
    onUpdateEmployees([]);
    onUpdatePayments([]);
  };

  return (
    <div className="flex h-screen bg-[#fcfdfe] overflow-hidden flex-col md:flex-row">
      <Sidebar 
        role={role} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={onLogout} 
        companyName={company?.name} 
        unreadCount={unreadCount}
      />
      
      <main className="flex-1 overflow-y-auto px-4 md:px-10 py-6 md:py-8 scroll-smooth custom-scroll">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-4 md:gap-6 no-print pt-14 md:pt-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full md:w-auto">
            <h1 className="text-lg md:text-xl font-[950] text-slate-900 tracking-tight uppercase leading-none">Management Console</h1>
            <div className="flex items-center gap-3 px-3 py-1.5 bg-white border rounded-xl shadow-sm w-fit">
               <div className={`w-1.5 h-1.5 rounded-full ${isDbConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
               <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-500">{isDbConnected ? 'Sincronizado' : 'Sin Conexión'}</span>
            </div>
          </div>
        </header>

        <div className="animate-in fade-in duration-500 pb-20 md:pb-0">
          {activeTab === 'dashboard' && (
            <div className="space-y-4 md:space-y-6">
              
              <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-5 md:p-6 text-white shadow-xl min-h-[90px] flex items-center bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.7)), url(${currentRelaxingImage})` }}>
                  <div className="relative z-10 w-full text-center md:text-left">
                    <p className="text-blue-400 font-black text-[7px] uppercase tracking-[0.4em] mb-2">Mensaje del día</p>
                    <h2 className="text-base md:text-lg font-[800] leading-tight tracking-tight italic">"{dailyQuote}"</h2>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
                <div className="lg:col-span-2 bg-white p-4 md:p-5 rounded-3xl border border-slate-100 shadow-sm">
                   <div className="flex justify-between items-center mb-3">
                      <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-widest leading-none">Calendario Corporativo</h3>
                      <div className="flex gap-2">
                         <span className="flex items-center gap-1 text-[6px] font-black text-blue-600 uppercase">Festivo</span>
                         <span className="flex items-center gap-1 text-[6px] font-black text-emerald-600 uppercase">Natalicio</span>
                      </div>
                   </div>
                   <div className="grid grid-cols-7 gap-1 text-center max-w-[340px] mx-auto">
                      {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => (
                        <div key={d} className="text-[7px] font-black text-slate-300 uppercase py-0.5">{d}</div>
                      ))}
                      {calendarDays.map((day, i) => {
                        const isHoliday = day && monthHolidays.some(h => h.day === day);
                        const isBirthday = day && monthBirthdays.some(e => new Date(e.birthDate).getDate() === day);
                        const isToday = day === today.getDate();
                        
                        return (
                          <div key={i} className={`
                            relative aspect-square flex items-center justify-center text-[8px] font-bold rounded-lg transition-all
                            ${!day ? 'opacity-0' : 'hover:bg-slate-50 cursor-default'}
                            ${isToday ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600'}
                            ${isHoliday ? 'border border-blue-500/30 text-blue-600 bg-blue-50/50' : ''}
                            ${isBirthday ? 'border border-emerald-500/30 text-emerald-600 bg-emerald-50/50' : ''}
                          `}>
                            {day}
                          </div>
                        );
                      })}
                   </div>
                </div>

                <div className="lg:col-span-2 bg-slate-50 p-4 md:p-5 rounded-3xl border border-slate-100 space-y-3">
                   <h3 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-1.5">Próximos Eventos del Mes</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 max-h-[160px] overflow-y-auto custom-scroll pr-1">
                      {monthHolidays.map((h, i) => (
                         <div key={i} className="flex gap-3 items-center bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                            <span className="text-sm">📅</span>
                            <div>
                               <p className="text-[8px] font-black text-slate-900 uppercase leading-none truncate max-w-[120px]">{h.name}</p>
                               <p className="text-[6px] font-bold text-blue-500 uppercase mt-1">Día {h.day}</p>
                            </div>
                         </div>
                      ))}
                      {monthBirthdays.map((e, i) => (
                         <div key={i} className="flex gap-3 items-center bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                            <div className="w-6 h-6 rounded-lg overflow-hidden border bg-slate-100 flex items-center justify-center text-[8px] font-black uppercase text-slate-300">
                               {e.photo ? <img src={e.photo} className="w-full h-full object-cover" /> : <span>{e.name[0]}</span>}
                            </div>
                            <div>
                               <p className="text-[8px] font-black text-slate-900 uppercase leading-none truncate max-w-[120px]">{e.surname} {e.name}</p>
                               <p className="text-[6px] font-bold text-emerald-500 uppercase mt-1">Día {new Date(e.birthDate).getDate()}</p>
                            </div>
                         </div>
                      ))}
                      {monthHolidays.length === 0 && monthBirthdays.length === 0 && (
                        <p className="text-[7px] text-slate-300 font-black uppercase text-center py-6 col-span-full">Sin registros cercanos</p>
                      )}
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-stretch">
                <div className="md:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 flex flex-col justify-center shadow-sm">
                  <div className="flex items-center gap-5 mb-4">
                    <span className="text-3xl p-3 bg-blue-50 rounded-2xl">{activeBreak.icon}</span>
                    <div>
                      <h3 className="text-[11px] font-black text-slate-900 uppercase leading-none">Salud Ocupacional</h3>
                      <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mt-1">Sugerencia de Bienestar</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-[900] text-slate-800 uppercase tracking-tight">{activeBreak.title}</h4>
                    <p className="text-slate-500 text-[10px] md:text-[11px] leading-relaxed font-medium">{activeBreak.description}</p>
                  </div>
                </div>

                <div className="relative overflow-hidden bg-white rounded-3xl shadow-lg border border-slate-100 min-h-[100px] md:min-h-full">
                   <img 
                     src={currentRelaxingImage} 
                     alt="Relajación" 
                     className="w-full h-full object-cover"
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-4">
                      <p className="text-[7px] font-black text-white/50 uppercase tracking-[0.5em]">Ambiente Zen</p>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <NotificationsModule 
              notifications={notifications} 
              onToggleRead={handleDismissNotification}
              onToggleProcessed={handleDismissNotification}
              onClearAll={() => {
                const allIds = notifications.map(n => n.id);
                setDismissedNotificationIds(prev => new Set([...prev, ...allIds]));
                setNotifications([]);
              }}
            />
          )}

          {activeTab === 'company' && <CompanyModule company={company} onUpdate={onUpdateCompany} role={role} />}
          {activeTab === 'employees' && <EmployeeModule employees={employees} onUpdate={onUpdateEmployees} role={role} attendance={attendance} payments={payments} company={company} />}
          {activeTab === 'payroll' && <PayrollModule employees={employees} payments={payments} onUpdatePayments={onUpdatePayments} onUpdateEmployees={onUpdateEmployees} attendance={attendance} company={company} settings={settings} role={role} />}
          {activeTab === 'payments' && <PaymentsModule employees={employees} payments={payments} onUpdate={onUpdatePayments} role={role} company={company} />}
          {activeTab === 'settings' && <SettingsModule settings={settings} onUpdate={onUpdateSettings} role={role} onPurge={handlePurgeData} allData={{ company, employees, attendance, payments, settings }} />}
          {activeTab === 'reports' && <ReportsModule employees={employees} payments={payments} attendance={attendance} company={company} settings={settings} role={role} />}
          {activeTab === 'ai' && <AiAssistant employees={employees} attendance={attendance} payments={payments} role={role} />}
        </div>
      </main>

      <Modal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} title="Modo de Estación" maxWidth="max-w-md">
         <div className="space-y-6">
            <p className="text-[11px] text-slate-500 text-center font-bold uppercase tracking-widest">Seleccione la interfaz para este dispositivo:</p>
            <div className="space-y-3">
               <button onClick={() => { onUpdateAppMode('full'); setShowInstallModal(false); }} className={`w-full p-6 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${appMode === 'full' ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>
                  <div>
                    <p className="font-black text-sm text-slate-900 uppercase">Administrativa Full</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Acceso total a gestión.</p>
                  </div>
               </button>
               <button onClick={() => { onUpdateAppMode('attendance'); setShowInstallModal(false); }} className={`w-full p-6 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${appMode === 'attendance' ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>
                  <div>
                    <p className="font-black text-sm text-slate-900 uppercase">Marcación Only</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Kiosco de asistencia.</p>
                  </div>
               </button>
            </div>
         </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
