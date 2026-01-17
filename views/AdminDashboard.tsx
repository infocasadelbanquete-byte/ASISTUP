
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

  const addNotification = (id: string, title: string, message: string, type: 'info' | 'alert' | 'critical') => {
    if (dismissedNotificationIds.has(id)) return;

    setNotifications(prev => {
      if (prev.some(n => n.id === id)) return prev;
      return [{ id, title, message, timestamp: new Date().toISOString(), type, isRead: false, isProcessed: false }, ...prev];
    });
  };
  
  useEffect(() => {
    if (currentYear < 2026 || (currentYear === 2026 && currentMonth < 1)) return;

    const activeEmployees = employees.filter(e => e.status === 'active');
    
    const markedTodayIds = new Set((attendance || [])
      .filter(a => a.timestamp.includes(todayDateStr))
      .map(a => a.employeeId));
    
    const missingAttendanceCount = activeEmployees.filter(e => !markedTodayIds.has(e.id)).length;
    if (missingAttendanceCount > 0 && activeTab === 'dashboard') {
      addNotification(
        `missing-attendance-${todayDateStr}`,
        "Marcaciones Pendientes", 
        `Hoy faltan ${missingAttendanceCount} registros de ingreso por completar.`, 
        'alert'
      );
    }

    activeEmployees.forEach(emp => {
      if (emp.birthDate) {
        const bDate = new Date(emp.birthDate);
        if (bDate.getMonth() === currentMonth) {
          addNotification(
            `birthday-remind-${emp.id}-${currentMonth}`,
            `Cumpleañero del Mes 🎂🎈`,
            `${emp.name} ${emp.surname} cumple años el ${bDate.getDate() + 1} de ${new Intl.DateTimeFormat('es-EC', {month: 'long'}).format(bDate)}.`,
            'info'
          );
        }
      }
    });
  }, [employees, attendance, todayDateStr, activeTab, dismissedNotificationIds, currentMonth, currentYear]);

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

  const monthHolidays = useMemo(() => {
    const standard = ECUADOR_HOLIDAYS.filter(h => h.month === currentMonth).map(h => ({ day: h.day, name: h.name }));
    const custom = (settings.holidays || [])
      .filter(dateStr => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .map(dateStr => ({
        day: new Date(dateStr + 'T00:00:00').getDate(),
        name: "Feriado Institucional"
      }));
    return [...standard, ...custom].sort((a, b) => a.day - b.day);
  }, [currentMonth, currentYear, settings.holidays]);

  const monthBirthdays = employees.filter(e => {
    if (!e.birthDate || e.status !== 'active') return false;
    return new Date(e.birthDate).getMonth() === currentMonth;
  });

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
      
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-8 scroll-smooth custom-scroll">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 no-print pt-14 md:pt-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
            <h1 className="text-3xl md:text-4xl font-[950] text-slate-900 tracking-tight uppercase leading-none italic">Management Hub</h1>
            <div className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-100 rounded-full shadow-sm w-fit">
               <div className={`w-3 h-3 rounded-full ${isDbConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
               <span className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-500">{isDbConnected ? 'Sincronizado' : 'Modo Offline'}</span>
            </div>
          </div>
        </header>

        <div className="animate-in fade-in duration-500 pb-20 md:pb-0">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="relative overflow-hidden bg-slate-900 rounded-[3.5rem] p-12 md:p-16 text-white shadow-xl min-h-[250px] flex items-center bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.7)), url(${currentRelaxingImage})` }}>
                  <div className="relative z-10 w-full">
                    <p className="text-blue-400 font-black text-[14px] md:text-[16px] uppercase tracking-[0.5em] mb-6 md:mb-8">Estrategia & Visión Diaria</p>
                    <h2 className="text-2xl md:text-5xl font-[900] leading-tight tracking-tighter italic max-w-5xl">"{dailyQuote}"</h2>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                
                <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm flex flex-col min-h-[480px]">
                   <div className="flex justify-between items-center mb-10">
                      <div>
                        <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest leading-none mb-3">Calendario Corporativo</h3>
                        <p className="text-[13px] text-slate-400 font-bold uppercase tracking-widest">{new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(today)}</p>
                      </div>
                      <div className="flex gap-6">
                         <span className="flex items-center gap-2 text-[12px] font-black text-blue-600 uppercase"><div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div> Feriado</span>
                         <span className="flex items-center gap-2 text-[12px] font-black text-emerald-600 uppercase"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div> Cumple</span>
                      </div>
                   </div>
                   <div className="grid grid-cols-7 gap-3 text-center flex-1 items-center">
                      {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => (
                        <div key={d} className="text-[13px] font-black text-slate-300 uppercase py-3">{d}</div>
                      ))}
                      {calendarDays.map((day, i) => {
                        const isHoliday = day && monthHolidays.some(h => h.day === day);
                        const isBirthday = day && monthBirthdays.some(e => new Date(e.birthDate).getDate() + 1 === day);
                        const isToday = day === today.getDate();
                        
                        return (
                          <div key={i} className={`
                            relative aspect-square flex items-center justify-center text-[14px] font-black rounded-3xl transition-all
                            ${!day ? 'opacity-0' : 'hover:bg-slate-50 cursor-pointer'}
                            ${isToday ? 'bg-slate-900 text-white shadow-xl scale-110' : 'text-slate-600'}
                            ${isHoliday ? 'text-blue-600 bg-blue-50/50' : ''}
                            ${isBirthday ? 'text-emerald-600 bg-emerald-50/50' : ''}
                          `}>
                            {day}
                            {(isHoliday || isBirthday) && <div className={`absolute bottom-2 w-2 h-2 rounded-full ${isHoliday ? 'bg-blue-600' : 'bg-emerald-600'}`}></div>}
                          </div>
                        );
                      })}
                   </div>
                </div>

                <div className="bg-slate-50 p-10 rounded-[3.5rem] border border-slate-100 flex flex-col min-h-[480px]">
                   <h3 className="text-[14px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-200 pb-5 mb-8">Agenda de Novedades</h3>
                   <div className="space-y-4 overflow-y-auto custom-scroll flex-1 pr-3">
                      {monthHolidays.map((h, i) => (
                         <div key={i} className="flex gap-5 items-center bg-white p-6 rounded-3xl border border-slate-200/50 shadow-sm">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl">📅</div>
                            <div>
                               <p className="text-[13px] font-black text-slate-900 uppercase leading-none">{h.name}</p>
                               <p className="text-[11px] font-black text-blue-500 uppercase mt-3">Día {h.day}</p>
                            </div>
                         </div>
                      ))}
                      {monthBirthdays.map((e, i) => (
                         <div key={i} className="flex gap-5 items-center bg-white p-6 rounded-3xl border border-slate-200/50 shadow-sm">
                            <div className="w-12 h-12 rounded-2xl overflow-hidden border bg-slate-100 flex items-center justify-center text-[14px] font-black uppercase">
                               {e.photo ? <img src={e.photo} className="w-full h-full object-cover" /> : <span className="text-slate-400">{e.name[0]}</span>}
                            </div>
                            <div>
                               <p className="text-[13px] font-black text-slate-900 uppercase leading-none">{e.surname} {e.name}</p>
                               <p className="text-[11px] font-black text-emerald-500 uppercase mt-3">Natalicio • Día {new Date(e.birthDate).getDate() + 1}</p>
                            </div>
                         </div>
                      ))}
                      {monthHolidays.length === 0 && monthBirthdays.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center py-20 opacity-30">
                          <span className="text-6xl mb-6">🍃</span>
                          <p className="text-[13px] text-slate-400 font-black uppercase tracking-widest">Sin eventos próximos</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 flex flex-col justify-between shadow-sm min-h-[250px]">
                  <div className="flex items-center gap-6 mb-6">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center text-4xl shadow-inner">
                      {activeBreak.icon}
                    </div>
                    <div>
                      <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest leading-none">Cultura & Bienestar</h3>
                      <p className="text-[12px] font-black text-blue-600 uppercase tracking-widest mt-3">Pausa Activa Sugerida</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100/50 flex-1 flex flex-col justify-center">
                    <h4 className="text-[13px] font-black text-slate-800 uppercase mb-3 flex items-center gap-3">
                      <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></span>
                      {activeBreak.title}
                    </h4>
                    <p className="text-slate-500 text-[15px] leading-relaxed font-medium italic">"{activeBreak.description}"</p>
                  </div>
                </div>

                <div className="relative overflow-hidden bg-slate-200 rounded-[3.5rem] shadow-sm border border-slate-100 min-h-[250px]">
                   <img 
                     src={currentRelaxingImage} 
                     alt="Workspace" 
                     className="w-full h-full object-cover transition-transform duration-[20s] hover:scale-110"
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/10 to-transparent flex items-end p-10">
                      <div>
                        <p className="text-[12px] font-black text-blue-400 uppercase tracking-[0.4em] mb-3">Visión Institucional</p>
                        <p className="text-white text-[16px] font-bold uppercase tracking-widest leading-tight italic">Excelencia en la gestión del capital humano ecuatoriano</p>
                      </div>
                   </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <NotificationsModule 
              notifications={notifications} 
              onToggleRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? {...n, isRead: !n.isRead} : n))}
              onToggleProcessed={(id) => setNotifications(prev => prev.map(n => n.id === id ? {...n, isProcessed: !n.isProcessed} : n))}
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

      <Modal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} title="Estación de Trabajo" maxWidth="max-w-md">
         <div className="space-y-4">
            <p className="text-[13px] text-slate-500 text-center font-bold uppercase tracking-widest leading-none">Seleccione modo de funcionamiento</p>
            <div className="grid grid-cols-1 gap-3">
               <button onClick={() => { onUpdateAppMode('full'); setShowInstallModal(false); }} className={`p-8 rounded-2xl border-2 text-left transition-all ${appMode === 'full' ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>
                  <p className="font-black text-base text-slate-900 uppercase">Administrativo Full</p>
                  <p className="text-[13px] text-slate-400 font-bold uppercase mt-3">Gestión completa del sistema institucional.</p>
               </button>
               <button onClick={() => { onUpdateAppMode('attendance'); setShowInstallModal(false); }} className={`p-8 rounded-2xl border-2 text-left transition-all ${appMode === 'attendance' ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>
                  <p className="font-black text-base text-slate-900 uppercase">Kiosco de Asistencia</p>
                  <p className="text-[13px] text-slate-400 font-bold uppercase mt-3">Solo marcación para personal operativo.</p>
               </button>
            </div>
         </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
