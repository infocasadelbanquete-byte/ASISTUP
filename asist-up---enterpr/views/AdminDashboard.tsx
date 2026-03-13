
import React, { useState, useMemo, useEffect } from 'react';
import { Role, CompanyConfig, Employee, AttendanceRecord, Payment, GlobalSettings, NotificationMessage, SavedReport } from '../types.ts';
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
  onUpdateAttendance?: (records: AttendanceRecord[]) => void;
  payments: Payment[];
  onUpdatePayments: (payments: Payment[]) => void;
  savedReports: SavedReport[];
  onUpdateSavedReports: (reports: SavedReport[]) => void;
  settings: GlobalSettings;
  onUpdateSettings: (settings: GlobalSettings) => void;
  onUpdateAppMode: (mode: 'full' | 'attendance') => void;
  appMode: 'full' | 'attendance';
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  role, isDbConnected, onLogout, company, onUpdateCompany, employees, onUpdateEmployees, attendance, onUpdateAttendance, payments, onUpdatePayments, savedReports, onUpdateSavedReports, settings, onUpdateSettings, onUpdateAppMode, appMode 
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'company' | 'employees' | 'payroll' | 'payments' | 'settings' | 'reports' | 'ai' | 'notifications'>('dashboard');
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
    const markedTodayIds = new Set((attendance || []).filter(a => a.timestamp.includes(todayDateStr)).map(a => a.employeeId));
    const missingAttendanceCount = activeEmployees.filter(e => !markedTodayIds.has(e.id)).length;
    if (missingAttendanceCount > 0 && activeTab === 'dashboard') {
      addNotification(`missing-attendance-${todayDateStr}`, "Marcaciones Pendientes", `Hoy faltan ${missingAttendanceCount} registros de ingreso por completar.`, 'alert');
    }
  }, [employees, attendance, todayDateStr, activeTab, dismissedNotificationIds, currentMonth, currentYear]);

  // Cálculos para Calendario y Proximidad
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

  const monthBirthdays = useMemo(() => {
    return employees.filter(e => {
      if (!e.birthDate || e.status !== 'active') return false;
      return new Date(e.birthDate).getMonth() === currentMonth;
    }).sort((a, b) => {
      const dayA = new Date(a.birthDate).getDate() + 1;
      const dayB = new Date(b.birthDate).getDate() + 1;
      return dayA - dayB;
    });
  }, [employees, currentMonth]);

  const pendingApprovals = useMemo(() => {
    return (attendance || []).filter(a => a.status === 'pending_approval').sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [attendance]);

  const handleProcessApproval = (id: string, newStatus: 'confirmed' | 'rejected') => {
    if (!onUpdateAttendance) return;
    const recordsToUpdate = attendance.map(a => a.id === id ? { ...a, status: newStatus, validatedAt: new Date().toISOString() } : a);
    onUpdateAttendance(recordsToUpdate.filter(a => a.id === id));
  };

  const todayMarkings = useMemo(() => {
    return (attendance || [])
      .filter(a => a.timestamp.includes(todayDateStr) && a.status === 'confirmed')
      .sort((a, b) => {
        const empA = employees.find(e => e.id === a.employeeId);
        const empB = employees.find(e => e.id === b.employeeId);
        const nameA = `${empA?.surname || ''} ${empA?.name || ''}`;
        const nameB = `${empB?.surname || ''} ${empB?.name || ''}`;
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return a.timestamp.localeCompare(b.timestamp);
      });
  }, [attendance, todayDateStr, employees]);

  const handlePurgeData = async () => {
    if (role !== Role.SUPER_ADMIN) return;
    onUpdateEmployees([]);
    onUpdatePayments([]);
  };

  const relaxingImages = [
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=2070",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=2071",
    "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=2070",
    "https://images.unsplash.com/photo-1541450805268-4822a3a774ce?auto=format&fit=crop&q=80&w=2070"
  ];

  return (
    <div className="flex h-screen bg-[#fcfdfe] overflow-hidden flex-col md:flex-row">
      <Sidebar role={role} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={onLogout} companyName={company?.name} unreadCount={notifications.filter(n => !n.isRead).length} />
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
              {/* MENSAJE INSPIRACIONAL REDUCIDO */}
              <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-6 md:p-8 text-white shadow-xl min-h-[160px] flex items-center bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.7)), url(${relaxingImages[Math.floor(today.getDate() % 4)]})` }}>
                  <div className="relative z-10 w-full">
                    <p className="text-blue-400 font-black text-[10px] md:text-[12px] uppercase tracking-[0.5em] mb-4">Estrategia & Visión Diaria</p>
                    <h2 className="text-xl md:text-3xl font-[900] leading-tight tracking-tighter italic max-w-4xl">"{DAILY_QUOTES[Math.floor(today.getDate() % DAILY_QUOTES.length)]}"</h2>
                  </div>
              </div>

              {/* AUTORIZACIONES PENDIENTES */}
              {role === Role.SUPER_ADMIN && pendingApprovals.length > 0 && (
                <div className="bg-white p-8 md:p-10 rounded-[3.5rem] border-4 border-blue-100 shadow-xl">
                   <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl">⚖️</div>
                      <div>
                        <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest leading-none mb-1">Autorizaciones Pendientes</h3>
                        <p className="text-[10px] font-black text-blue-500 uppercase">Solicitudes por regularizar</p>
                      </div>
                   </div>
                   <div className="space-y-4">
                      {pendingApprovals.map(req => {
                        const emp = employees.find(e => e.id === req.employeeId);
                        return (
                          <div key={req.id} className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-slate-50 rounded-[2rem] border border-blue-50">
                             <div className="flex items-center gap-4 flex-1">
                                <div className="w-12 h-12 bg-white rounded-2xl border flex items-center justify-center overflow-hidden shrink-0">
                                   {emp?.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : <span className="font-black">{emp?.name[0]}</span>}
                                </div>
                                <div>
                                   <p className="text-xs font-black text-slate-900 uppercase">{emp?.surname} {emp?.name}</p>
                                   <p className="text-[9px] font-bold text-slate-400 uppercase">{req.type === 'in' ? 'Ingreso' : 'Salida'} • {new Date(req.timestamp).toLocaleString('es-EC')}</p>
                                   <p className="text-[9px] font-black text-blue-600 mt-1 italic">"{req.justification}"</p>
                                </div>
                             </div>
                             <div className="flex gap-3">
                                <button onClick={() => handleProcessApproval(req.id, 'rejected')} className="px-6 py-3 bg-white text-red-500 border-2 border-red-100 font-black rounded-xl uppercase text-[9px]">Rechazar</button>
                                <button onClick={() => handleProcessApproval(req.id, 'confirmed')} className="px-6 py-3 bg-emerald-600 text-white font-black rounded-xl uppercase text-[9px] shadow-lg">Aprobar</button>
                             </div>
                          </div>
                        );
                      })}
                   </div>
                </div>
              )}

              {/* MONITOREO DE JORNADA DIARIA REDUCIDO */}
              <div className="bg-white p-6 md:p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                      <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-widest leading-none mb-2">Monitoreo de Jornada Diaria</h3>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Actividad Confirmada • {today.toLocaleDateString('es-EC', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto custom-scroll pr-2">
                    {todayMarkings.length === 0 ? (
                      <div className="col-span-full py-12 flex flex-col items-center justify-center opacity-40">
                         <span className="text-4xl mb-3">⌛</span>
                         <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Esperando marcaciones...</p>
                      </div>
                    ) : (
                      todayMarkings.map((mark) => {
                        const emp = employees.find(e => e.id === mark.employeeId);
                        const empMarksToday = (attendance || []).filter(a => a.employeeId === mark.employeeId && a.timestamp.startsWith(todayDateStr) && a.status === 'confirmed').sort((a, b) => a.timestamp.localeCompare(b.timestamp));
                        let specificLabel = ""; let labelColor = "";
                        if (mark.type === 'half_day') { specificLabel = "Media Jornada"; labelColor = "bg-amber-500 text-white"; }
                        else if (mark.type === 'in') { const inIndex = empMarksToday.filter(m => m.type === 'in').findIndex(m => m.id === mark.id); specificLabel = inIndex === 0 ? "In Mañana" : "In Tarde"; labelColor = inIndex === 0 ? "bg-emerald-600 text-white" : "bg-cyan-600 text-white"; }
                        else if (mark.type === 'out') { const outIndex = empMarksToday.filter(m => m.type === 'out').findIndex(m => m.id === mark.id); specificLabel = outIndex === 0 ? "Out M. Día" : "Out Fin"; labelColor = outIndex === 0 ? "bg-orange-600 text-white" : "bg-pink-600 text-white"; }

                        return (
                          <div key={mark.id} className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100 transition-all hover:shadow-md hover:bg-white group">
                             <div className="w-8 h-8 bg-white rounded-xl border flex items-center justify-center overflow-hidden shrink-0">
                                {emp?.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : <span className="text-[10px] font-black uppercase text-slate-300">{emp?.name[0]}</span>}
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black text-slate-900 uppercase leading-none truncate mb-1">{emp?.surname} {emp?.name}</p>
                                <div className="flex flex-wrap items-center gap-1">
                                   <span className={`text-[6px] font-black uppercase px-1.5 py-0.5 rounded-full ${labelColor}`}>{specificLabel}</span>
                                   {mark.isLate && <span className="text-[6px] font-black uppercase bg-red-100 text-red-600 px-1 py-0.5 rounded-full animate-pulse">Retraso</span>}
                                   {mark.isForgotten && <span className="text-[6px] font-black uppercase bg-blue-100 text-blue-600 px-1 py-0.5 rounded-full">Reg.</span>}
                                </div>
                             </div>
                             <div className="text-right shrink-0">
                                <p className="text-[11px] font-black text-slate-900 tabular-nums leading-none">{new Date(mark.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                             </div>
                          </div>
                        );
                      })
                    )}
                 </div>
              </div>

              {/* CALENDARIO CORPORATIVO Y AGENDA RESTAURADOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col min-h-[450px]">
                   <div className="flex justify-between items-center mb-8">
                      <div>
                        <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-widest leading-none mb-2">Calendario Corporativo</h3>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(today)}</p>
                      </div>
                      <div className="flex gap-4">
                         <span className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> Feriado</span>
                         <span className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Cumple</span>
                      </div>
                   </div>
                   <div className="grid grid-cols-7 gap-2 text-center flex-1 items-center">
                      {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                        <div key={`${d}-${i}`} className="text-[11px] font-black text-slate-300 uppercase py-2">{d}</div>
                      ))}
                      {calendarDays.map((day, i) => {
                        const isHoliday = day && monthHolidays.some(h => h.day === day);
                        const isBirthday = day && monthBirthdays.some(e => new Date(e.birthDate).getDate() + 1 === day);
                        const isToday = day === today.getDate();
                        
                        return (
                          <div key={i} className={`
                            relative aspect-square flex items-center justify-center text-[12px] font-black rounded-2xl transition-all
                            ${!day ? 'opacity-0' : 'hover:bg-slate-50 cursor-pointer'}
                            ${isToday ? 'bg-slate-900 text-white shadow-lg scale-110 z-10' : 'text-slate-600'}
                            ${isHoliday ? 'text-blue-600 bg-blue-50/50' : ''}
                            ${isBirthday ? 'text-emerald-600 bg-emerald-50/50' : ''}
                          `}>
                            {day}
                            {(isHoliday || isBirthday) && <div className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full ${isHoliday ? 'bg-blue-600' : 'bg-emerald-600'}`}></div>}
                          </div>
                        );
                      })}
                   </div>
                </div>

                <div className="bg-slate-50 p-8 md:p-10 rounded-[3rem] border border-slate-100 flex flex-col min-h-[450px]">
                   <h3 className="text-[13px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-200 pb-4 mb-6">Agenda de Novedades (Proximidad)</h3>
                   <div className="space-y-3 overflow-y-auto custom-scroll flex-1 pr-2">
                      {monthHolidays.map((h, i) => (
                         <div key={i} className="flex gap-4 items-center bg-white p-4 rounded-2xl border border-slate-200/50 shadow-sm">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl">📅</div>
                            <div>
                               <p className="text-[11px] font-black text-slate-900 uppercase leading-none">{h.name}</p>
                               <p className="text-[9px] font-black text-blue-500 uppercase mt-2">Día {h.day}</p>
                            </div>
                         </div>
                      ))}
                      {monthBirthdays.map((e, i) => (
                         <div key={i} className="flex gap-4 items-center bg-white p-4 rounded-2xl border border-slate-200/50 shadow-sm">
                            <div className="w-10 h-10 rounded-xl overflow-hidden border bg-slate-100 flex items-center justify-center text-[12px] font-black uppercase">
                               {e.photo ? <img src={e.photo} className="w-full h-full object-cover" /> : <span className="text-slate-400">{e.name[0]}</span>}
                            </div>
                            <div>
                               <p className="text-[11px] font-black text-slate-900 uppercase leading-none">{e.surname} {e.name}</p>
                               <p className="text-[9px] font-black text-emerald-500 uppercase mt-2">Cumpleaños • Día {new Date(e.birthDate).getDate() + 1}</p>
                            </div>
                         </div>
                      ))}
                      {monthHolidays.length === 0 && monthBirthdays.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center py-16 opacity-30">
                          <span className="text-4xl mb-4">🍃</span>
                          <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">Sin eventos próximos</p>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'notifications' && <NotificationsModule notifications={notifications} onToggleRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? {...n, isRead: !n.isRead} : n))} onToggleProcessed={(id) => setNotifications(prev => prev.map(n => n.id === id ? {...n, isProcessed: !n.isProcessed} : n))} onClearAll={() => { setNotifications([]); }} />}
          {activeTab === 'company' && <CompanyModule company={company} onUpdate={onUpdateCompany} role={role} />}
          {activeTab === 'employees' && <EmployeeModule employees={employees} onUpdate={onUpdateEmployees} role={role} attendance={attendance} payments={payments} company={company} />}
          {activeTab === 'payroll' && <PayrollModule employees={employees} payments={payments} onUpdatePayments={onUpdatePayments} onUpdateEmployees={onUpdateEmployees} attendance={attendance} company={company} settings={settings} role={role} onSaveReport={(report) => onUpdateSavedReports([...savedReports, report])} />}
          {activeTab === 'payments' && <PaymentsModule employees={employees} payments={payments} onUpdate={onUpdatePayments} role={role} company={company} />}
          {activeTab === 'settings' && <SettingsModule settings={settings} onUpdate={onUpdateSettings} role={role} onPurge={handlePurgeData} allData={{ company, employees, attendance, payments, settings }} />}
          {activeTab === 'reports' && <ReportsModule employees={employees} payments={payments} attendance={attendance} company={company} settings={settings} role={role} savedReports={savedReports} />}
          {activeTab === 'ai' && <AiAssistant employees={employees} attendance={attendance} payments={payments} role={role} />}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
