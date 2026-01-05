
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
  
  const today = useMemo(() => new Date(), []);
  const todayDateStr = useMemo(() => today.toISOString().split('T')[0], [today]);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const addNotification = (title: string, message: string, type: 'info' | 'alert' | 'critical') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => {
      if (prev.some(n => n.title === title && n.message === message && !n.isRead && !n.isProcessed)) return prev;
      return [{ id, title, message, timestamp: new Date().toISOString(), type, isRead: false, isProcessed: false }, ...prev];
    });
  };
  
  useEffect(() => {
    const activeEmployees = employees.filter(e => e.status === 'active');
    const markedTodayIds = new Set(attendance
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
  }, [employees, attendance, todayDateStr, activeTab]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const dayOfYear = useMemo(() => {
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, [today]);

  const dailyQuote = DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
  const activeBreak = ACTIVE_BREAKS[dayOfYear % ACTIVE_BREAKS.length];

  // Imágenes relajantes (Paisajes y Arte)
  const relaxingImages = [
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=2070",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=2071",
    "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=2070",
    "https://images.unsplash.com/photo-1541450805268-4822a3a774ce?auto=format&fit=crop&q=80&w=2070"
  ];
  const currentRelaxingImage = relaxingImages[dayOfYear % relaxingImages.length];

  // Lógica del Calendario
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
      
      <main className="flex-1 overflow-y-auto px-4 md:px-10 py-6 md:py-10 scroll-smooth custom-scroll">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4 md:gap-6 no-print pt-14 md:pt-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full md:w-auto">
            <h1 className="text-xl md:text-2xl font-[950] text-slate-900 tracking-tight uppercase">Bienvenido</h1>
            <div className="flex items-center gap-3 px-3 py-1.5 md:px-4 md:py-2 bg-white border rounded-xl shadow-sm w-fit">
               <div className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
               <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Sistema Activo</span>
            </div>
          </div>
        </header>

        <div className="animate-in fade-in duration-500 pb-20 md:pb-0">
          {activeTab === 'dashboard' && (
            <div className="space-y-6 md:space-y-10">
              
              {/* Tarjeta de Frase Motivacional Reducida */}
              <div className="relative overflow-hidden bg-slate-900 rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 text-white shadow-xl min-h-[100px] md:min-h-[140px] flex items-center bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.7)), url(${currentRelaxingImage})` }}>
                  <div className="relative z-10 w-full text-center md:text-left">
                    <p className="text-blue-400 font-black text-[7px] md:text-[8px] uppercase tracking-[0.4em] mb-2">Mensaje del día</p>
                    <h2 className="text-lg md:text-2xl font-[800] leading-tight tracking-tight italic">"{dailyQuote}"</h2>
                  </div>
              </div>

              {/* Calendario y Eventos del Mes */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Calendario Institucional - {today.toLocaleString('es-EC', { month: 'long' }).toUpperCase()}</h3>
                      <div className="flex gap-2">
                         <span className="flex items-center gap-1.5 text-[7px] font-black text-blue-600 uppercase"><div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div> Festivo</span>
                         <span className="flex items-center gap-1.5 text-[7px] font-black text-emerald-600 uppercase"><div className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></div> Cumpleaños</span>
                      </div>
                   </div>
                   <div className="grid grid-cols-7 gap-1 md:gap-2 text-center">
                      {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                        <div key={d} className="text-[8px] font-black text-slate-400 uppercase py-2">{d}</div>
                      ))}
                      {calendarDays.map((day, i) => {
                        const isHoliday = day && monthHolidays.some(h => h.day === day);
                        const isBirthday = day && monthBirthdays.some(e => new Date(e.birthDate).getDate() === day);
                        const isToday = day === today.getDate();
                        
                        return (
                          <div key={i} className={`
                            relative aspect-square flex items-center justify-center text-[10px] md:text-xs font-bold rounded-xl md:rounded-2xl transition-all
                            ${!day ? 'opacity-0' : 'hover:bg-slate-50 cursor-default'}
                            ${isToday ? 'bg-slate-900 text-white shadow-lg z-10' : 'text-slate-600'}
                            ${isHoliday ? 'border-2 border-blue-500 text-blue-600' : ''}
                            ${isBirthday ? 'border-2 border-emerald-500 text-emerald-600' : ''}
                          `}>
                            {day}
                            {(isHoliday || isBirthday) && (
                               <div className={`absolute -bottom-1 w-1 h-1 rounded-full ${isHoliday ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                            )}
                          </div>
                        );
                      })}
                   </div>
                </div>

                <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-100 space-y-6">
                   <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-3">Eventos del Mes</h3>
                   <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scroll pr-2">
                      {monthHolidays.map((h, i) => (
                         <div key={i} className="flex gap-3 items-center bg-white p-3 rounded-2xl shadow-sm border border-blue-50">
                            <span className="text-xl">📅</span>
                            <div>
                               <p className="text-[9px] font-black text-slate-900 uppercase leading-none">{h.name}</p>
                               <p className="text-[7px] font-bold text-blue-500 uppercase mt-1">Día {h.day}</p>
                            </div>
                         </div>
                      ))}
                      {monthBirthdays.map((e, i) => (
                         <div key={i} className="flex gap-3 items-center bg-white p-3 rounded-2xl shadow-sm border border-emerald-50">
                            <div className="w-8 h-8 rounded-full overflow-hidden border bg-slate-50 flex items-center justify-center text-[10px]">
                               {e.photo ? <img src={e.photo} className="w-full h-full object-cover" /> : <span>👤</span>}
                            </div>
                            <div>
                               <p className="text-[9px] font-black text-slate-900 uppercase leading-none truncate max-w-[120px]">{e.name} {e.surname}</p>
                               <p className="text-[7px] font-bold text-emerald-500 uppercase mt-1">Cumpleaños: {new Date(e.birthDate).getDate()}</p>
                            </div>
                         </div>
                      ))}
                      {monthHolidays.length === 0 && monthBirthdays.length === 0 && (
                        <p className="text-[8px] text-slate-400 font-bold uppercase text-center py-10">Sin eventos próximos registrados</p>
                      )}
                   </div>
                </div>
              </div>

              {/* Pausas Activas e Imagen Relajante */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                <div className="bg-white p-6 md:p-10 rounded-3xl border border-slate-100 flex flex-col justify-center">
                  <div className="flex items-center gap-5 mb-6">
                    <span className="text-4xl md:text-5xl">{activeBreak.icon}</span>
                    <div>
                      <h3 className="text-base md:text-lg font-black text-slate-900 uppercase">Pausa Saludable</h3>
                      <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Recomendación de Salud Ocupacional</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-sm md:text-base font-[900] text-slate-800 uppercase tracking-tight">{activeBreak.title}</h4>
                    <p className="text-slate-500 text-xs md:text-sm leading-relaxed font-medium">{activeBreak.description}</p>
                  </div>
                </div>

                <div className="relative overflow-hidden bg-white rounded-3xl shadow-lg border border-slate-100 min-h-[200px]">
                   <img 
                     src={currentRelaxingImage} 
                     alt="Inspiración Visual" 
                     className="w-full h-full object-cover transition-transform duration-[20s] hover:scale-125"
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                      <p className="text-[8px] font-black text-white/50 uppercase tracking-[0.5em]">Ambiente Zen Corporativo</p>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <NotificationsModule 
              notifications={notifications} 
              onToggleRead={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
              onToggleProcessed={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
              onClearAll={() => setNotifications([])}
            />
          )}

          {activeTab === 'company' && <CompanyModule company={company} onUpdate={onUpdateCompany} role={role} />}
          {activeTab === 'employees' && <EmployeeModule employees={employees} onUpdate={onUpdateEmployees} role={role} attendance={attendance} payments={payments} company={company} />}
          {activeTab === 'payroll' && <PayrollModule employees={employees} payments={payments} company={company} settings={settings} role={role} />}
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
