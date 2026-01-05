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
import { DAILY_QUOTES, ACTIVE_BREAKS } from '../constants.tsx';

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
  
  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const today = useMemo(() => new Date(), []);
  
  // Lógica para detectar empleados que no han marcado hoy
  useEffect(() => {
    if (Notification.permission === "granted") {
      const activeEmployees = employees.filter(e => e.status === 'active');
      const markedTodayIds = new Set(attendance
        .filter(a => a.timestamp.includes(todayDateStr))
        .map(a => a.employeeId));
      
      const missingAttendanceCount = activeEmployees.filter(e => !markedTodayIds.has(e.id)).length;
      
      if (missingAttendanceCount > 0) {
        new Notification("ALERTA DE ASISTENCIA", {
          body: `Hay ${missingAttendanceCount} colaboradores que aún no han registrado su marcación hoy.`,
          icon: "https://cdn-icons-png.flaticon.com/512/3421/3421714.png"
        });
      }
    }
  }, [employees, attendance, todayDateStr]);

  const dayOfYear = useMemo(() => {
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, [today]);

  const birthdayPeeps = useMemo(() => {
    return employees.filter(e => {
      if (!e.birthDate || e.status !== 'active') return false;
      const b = new Date(e.birthDate);
      return b.getMonth() === today.getMonth() && b.getDate() === (today.getDate() + 1);
    });
  }, [employees, today]);

  const dailyQuote = DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
  const activeBreak = ACTIVE_BREAKS[dayOfYear % ACTIVE_BREAKS.length];

  const handlePurgeData = async () => {
    if (role !== Role.SUPER_ADMIN) return;
    onUpdateEmployees([]);
    onUpdatePayments([]);
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
          <div className="flex items-center gap-4">
            <h1 className="text-xl md:text-2xl font-[950] text-slate-900 tracking-tight uppercase">Dashboard Corporativo</h1>
            <div className="flex items-center gap-3 px-4 py-2 bg-white border rounded-2xl shadow-sm">
               <div className={`w-3 h-3 rounded-full ${isDbConnected ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-red-500 animate-pulse'}`}></div>
               <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                 {isDbConnected ? 'Conectado' : 'Sin Red'}
               </span>
            </div>
          </div>
          <div className="flex gap-3">
             {role === Role.SUPER_ADMIN && (
               <button onClick={() => setShowInstallModal(true)} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase border border-slate-900 shadow-xl active:scale-95 transition-all">Estación Kiosco</button>
             )}
          </div>
        </header>

        <div className="animate-in fade-in duration-500">
          {activeTab === 'dashboard' && (
            <div className="space-y-12">
              
              {/* ALERTA CUMPLEAÑOS */}
              {birthdayPeeps.length > 0 && role === Role.SUPER_ADMIN && (
                <div className="bg-emerald-600 p-8 rounded-[3rem] text-white shadow-[0_20px_50px_rgba(16,185,129,0.2)] flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
                   <div className="flex items-center gap-6">
                      <span className="text-5xl">🎂</span>
                      <div>
                         <h3 className="text-xl font-black uppercase tracking-tighter">¡Hoy hay Cumpleaños!</h3>
                         <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1">Recuérdales lo valiosos que son para el equipo</p>
                      </div>
                   </div>
                   <div className="flex -space-x-4">
                      {birthdayPeeps.map(e => (
                         <div key={e.id} className="w-12 h-12 rounded-full border-4 border-emerald-600 bg-white overflow-hidden" title={e.name}>
                            {e.photo ? <img src={e.photo} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-[10px] text-emerald-600 font-black">{e.name[0]}</div>}
                         </div>
                      ))}
                   </div>
                </div>
              )}

              <div className="relative overflow-hidden bg-slate-900 rounded-[3rem] p-12 text-white shadow-2xl min-h-[300px] flex flex-col justify-center">
                  <div className="relative z-10 max-w-2xl">
                    <p className="text-blue-400 font-black text-[10px] uppercase tracking-[0.5em] mb-4">Reflexión Estratégica</p>
                    <h2 className="text-3xl md:text-5xl font-[900] leading-tight tracking-tighter italic">"{dailyQuote}"</h2>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
                  <div className="flex items-center gap-4">
                    <span className="text-5xl">{activeBreak.icon}</span>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase">Pausa Saludable</h3>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Bienestar Laboral</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-lg font-extrabold text-slate-800">{activeBreak.title}</h4>
                    <p className="text-slate-500 leading-relaxed font-medium">{activeBreak.description}</p>
                  </div>
                </div>

                <div className="bg-blue-600 p-10 rounded-[3rem] shadow-xl text-white space-y-4">
                   <h3 className="text-xl font-[950] uppercase tracking-tighter">Resumen Operativo</h3>
                   <div className="grid grid-cols-2 gap-4 pt-4">
                      <div className="bg-white/10 p-4 rounded-2xl">
                         <p className="text-[8px] font-black uppercase opacity-60">Personal Activo</p>
                         <p className="text-3xl font-black">{employees.filter(e => e.status === 'active').length}</p>
                      </div>
                      <div className="bg-white/10 p-4 rounded-2xl">
                         <p className="text-[8px] font-black uppercase opacity-60">Marcaciones Hoy</p>
                         <p className="text-3xl font-black">{attendance.filter(a => a.timestamp.includes(todayDateStr)).length}</p>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'company' && <CompanyModule company={company} onUpdate={onUpdateCompany} role={role} />}
          {activeTab === 'employees' && <EmployeeModule employees={employees} onUpdate={onUpdateEmployees} role={role} attendance={attendance} payments={payments} company={company} />}
          {activeTab === 'payroll' && <PayrollModule employees={employees} payments={payments} company={company} settings={settings} role={role} />}
          {activeTab === 'payments' && <PaymentsModule employees={employees} payments={payments} onUpdate={onUpdatePayments} role={role} />}
          {activeTab === 'settings' && <SettingsModule settings={settings} onUpdate={onUpdateSettings} role={role} onPurge={handlePurgeData} allData={allAppData} />}
          {activeTab === 'reports' && <ReportsModule employees={employees} payments={payments} attendance={attendance} company={company} settings={settings} role={role} />}
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