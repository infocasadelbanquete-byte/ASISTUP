import React from 'react';
import { Role } from '../types.ts';

interface SidebarProps {
  role: Role;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onLogout: () => void;
  companyName?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ role, activeTab, setActiveTab, onLogout, companyName }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Centro Operativo', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', roles: [Role.SUPER_ADMIN, Role.PARTIAL_ADMIN] },
    { id: 'company', label: 'Perfil de Empresa', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', roles: [Role.SUPER_ADMIN, Role.PARTIAL_ADMIN] },
    { id: 'employees', label: 'Recursos Humanos', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', roles: [Role.SUPER_ADMIN, Role.PARTIAL_ADMIN] },
    { id: 'payroll', label: 'Gestión de Nómina', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', roles: [Role.SUPER_ADMIN] },
    { id: 'payments', label: 'Departamento Financiero', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', roles: [Role.SUPER_ADMIN, Role.PARTIAL_ADMIN] },
    { id: 'reports', label: 'Centro de Reportes', icon: 'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2', roles: [Role.SUPER_ADMIN] },
    { id: 'settings', label: 'Configuración Maestra', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', roles: [Role.SUPER_ADMIN] },
  ];

  return (
    <aside className="w-80 gradient-blue text-white flex flex-col shadow-[15px_0_40px_rgba(0,0,0,0.3)] z-20 border-r border-white/5 relative no-print">
      <div className="p-10">
        <div className="flex items-center gap-5 mb-14">
          {/* Logo Sophisticated Moderno */}
          <div className="w-14 h-14 logo-gradient rounded-2xl flex items-center justify-center shadow-2xl border border-white/20">
            <svg viewBox="0 0 100 100" className="w-8 h-8 fill-none stroke-white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
                <path d="M30 70 L45 55 L55 65 L75 35" />
                <circle cx="75" cy="35" r="5" fill="white" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-[900] tracking-tighter leading-none">ASIST UP</h2>
            <p className="text-[8px] text-blue-400/60 uppercase tracking-[0.4em] font-black mt-1.5">Administrative Suite</p>
          </div>
        </div>
        
        {companyName && (
          <div className="bg-white/5 p-5 rounded-2xl mb-10 border border-white/10 backdrop-blur-md">
            <p className="text-[8px] uppercase text-blue-400/80 mb-1.5 font-black tracking-widest">Organización:</p>
            <p className="text-sm font-black truncate text-white uppercase">{companyName}</p>
          </div>
        )}

        <nav className="space-y-3">
          {menuItems.filter(item => item.roles.includes(role)).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-400 font-bold group ${activeTab === item.id ? 'bg-white text-slate-900 shadow-[0_15px_30px_rgba(0,0,0,0.2)] scale-[1.03]' : 'hover:bg-white/5 text-slate-400 hover:text-white'}`}
            >
              <svg className={`w-5 h-5 transition-transform duration-500 ${activeTab === item.id ? 'scale-110' : 'group-hover:translate-x-1'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={item.icon}></path>
              </svg>
              <span className="text-[13px] tracking-tight">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-10">
        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-4 px-5 py-4 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-2xl transition-all duration-300 font-black border border-red-500/20 uppercase text-[10px] tracking-widest"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          SALIR DEL SISTEMA
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;