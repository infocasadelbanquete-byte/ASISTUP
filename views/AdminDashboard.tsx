import React, { useState, useMemo } from 'react';
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
  
  const today = useMemo(() => new Date(), []);
  const dayOfYear = useMemo(() => {
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, [today]);

  const dailyQuote = DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
  const activeBreak = ACTIVE_BREAKS[dayOfYear % ACTIVE_BREAKS.length];

  const relaxingImages = [
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80"
  ];

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
            <h1 className="text-xl md:text-2xl font-[950] text-slate-900 tracking-tight uppercase">Panel Administrativo</h1>
            <div className="flex items-center gap-2 px-3 py-1 bg-white border rounded-full shadow-sm">
               <div className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 animate-pulse'}`}></div>
               <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                 {isDbConnected ? 'Nube Sincronizada' : 'Sin Conexión'}
               </span>
            </div>
          </div>
          <div className="flex gap-3">
             {role === Role.SUPER_ADMIN && (
               <button onClick={() => setShowInstallModal(true)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase border border-slate-200">Instalar Kiosco</button>
             )}
          </div>
        </header>

        <div className="animate-in fade-in duration-500">
          {activeTab === 'dashboard' && (
            <div className="space-y-12">
              {/* Sección de Bienvenida y Quote */}
              <div className="relative overflow-hidden bg-slate-900 rounded-[3rem] p-12 text-white shadow-2xl min-h-[300px] flex flex-col justify-center">
                  <div className="absolute inset-0 opacity-40">
                    <img src={relaxingImages[0]} className="w-full h-full object-cover" alt="Zen nature" />
                  </div>
                  <div className="relative z-10 max-w-2xl">
                    <p className="text-blue-400 font-black text-[10px] uppercase tracking-[0.5em] mb-4">Inspiración para hoy</p>
                    <h2 className="text-3xl md:text-5xl font-[900] leading-tight tracking-tighter italic">"{dailyQuote}"</h2>
                  </div>
              </div>

              {/* Sección de Pausas Activas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
                  <div className="flex items-center gap-4">
                    <span className="text-5xl">{activeBreak.icon}</span>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase">Pausa Activa del Día</h3>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Bienestar Institucional</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-lg font-extrabold text-slate-800">{activeBreak.title}</h4>
                    <p className="text-slate-500 leading-relaxed font-medium">{activeBreak.description}</p>
                    <div className="pt-4 border-t border-slate-50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tómate un minuto para ti.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[3rem] overflow-hidden shadow-sm border border-slate-100 relative group">
                  <img src={relaxingImages[1]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Relaxing landscape" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-8">
                    <p className="text-white font-black text-xs uppercase tracking-widest">Conéctate con la tranquilidad.</p>
                  </div>
                </div>
              </div>

              {/* Imágenes adicionales y mensajes cortos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-emerald-50 p-8 rounded-[2.5rem] flex flex-col items-center text-center justify-center space-y-4">
                  <span className="text-3xl">🌿</span>
                  <p className="text-emerald-800 font-black text-[10px] uppercase tracking-widest">Mantén la calma y continúa.</p>
                </div>
                <div className="bg-blue-50 p-8 rounded-[2.5rem] flex flex-col items-center text-center justify-center space-y-4">
                  <span className="text-3xl">⚡</span>
                  <p className="text-blue-800 font-black text-[10px] uppercase tracking-widest">Tu energía es vital para el equipo.</p>
                </div>
                <div className="bg-amber-50 p-8 rounded-[2.5rem] flex flex-col items-center text-center justify-center space-y-4">
                  <span className="text-3xl">✨</span>
                  <p className="text-amber-800 font-black text-[10px] uppercase tracking-widest">Crea un ambiente positivo hoy.</p>
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