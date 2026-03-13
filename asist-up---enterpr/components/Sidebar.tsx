
import React, { useState, useEffect } from 'react';
import { Role } from '../types.ts';
import Modal from './Modal.tsx';

interface SidebarProps {
  role: Role;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onLogout: () => void;
  companyName?: string;
  unreadCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ role, activeTab, setActiveTab, onLogout, companyName, unreadCount = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }
  }, []);

  const triggerPWAInstall = async () => {
    const deferredPrompt = (window as any).deferredPrompt;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        (window as any).deferredPrompt = null;
      }
    } else {
      alert("Para instalar:\n1. Use Chrome/Edge en Android o PC.\n2. En iOS use Safari: 'Compartir' -> 'Añadir a pantalla de inicio'.");
    }
    setShowModeSelection(false);
  };

  const handleInstallClick = () => {
    setShowModeSelection(true);
  };

  const handleInstallProcess = (mode: 'full' | 'attendance') => {
    localStorage.setItem('app_mode', mode);
    triggerPWAInstall();
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', roles: [Role.SUPER_ADMIN, Role.PARTIAL_ADMIN] },
    { id: 'notifications', label: 'Alertas', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', roles: [Role.SUPER_ADMIN, Role.PARTIAL_ADMIN], badge: unreadCount },
    { id: 'company', label: 'Empresa', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', roles: [Role.SUPER_ADMIN, Role.PARTIAL_ADMIN] },
    { id: 'employees', label: 'Personal', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', roles: [Role.SUPER_ADMIN, Role.PARTIAL_ADMIN] },
    { id: 'payroll', label: 'Nómina', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', roles: [Role.SUPER_ADMIN] },
    { id: 'payments', label: 'Tesorería', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', roles: [Role.SUPER_ADMIN, Role.PARTIAL_ADMIN] },
    { id: 'reports', label: 'Reportes', icon: 'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2', roles: [Role.SUPER_ADMIN] },
    { id: 'ai', label: 'IA Asistente', icon: 'M13 10V3L4 14h7v7l9-11h-7z', roles: [Role.SUPER_ADMIN, Role.PARTIAL_ADMIN] },
    { id: 'settings', label: 'Ajustes', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', roles: [Role.SUPER_ADMIN] },
  ];

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="fixed top-4 left-4 z-50 p-3 bg-blue-700 text-white rounded-xl md:hidden shadow-xl active:scale-90 transition-all border border-blue-600"
        aria-label="Abrir menú"
      >
        {isOpen ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
        )}
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-full max-w-[240px] md:max-w-[250px] gradient-blue text-white flex flex-col shadow-2xl transition-transform duration-500 md:translate-x-0 md:relative no-print ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scroll">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">
                  <defs>
                    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{stopColor: '#3b82f6'}} />
                      <stop offset="100%" style={{stopColor: '#1e3a8a'}} />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#logoGradient)" strokeWidth="6" strokeDasharray="15 5" />
                  <circle cx="50" cy="50" r="32" fill="none" stroke="url(#logoGradient)" strokeWidth="5" strokeDasharray="10 4" opacity="0.7" />
                  <circle cx="50" cy="50" r="18" fill="none" stroke="url(#logoGradient)" strokeWidth="4" opacity="0.4" />
                  <circle cx="50" cy="50" r="6" fill="#3b82f6" />
                </svg>
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-[950] tracking-tighter leading-none uppercase">ASIST UP</h2>
              <p className="text-[7px] md:text-[8px] text-blue-500 font-black tracking-[0.4em] mt-1.5">Enterprise</p>
            </div>
          </div>
          
          <nav className="space-y-1.5 md:space-y-2">
            {menuItems.filter(item => item.roles.includes(role)).map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsOpen(false); }}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 md:px-5 md:py-4 rounded-xl md:rounded-2xl transition-all duration-300 font-black group ${activeTab === item.id ? 'bg-white text-slate-950 shadow-lg' : 'hover:bg-white/10 text-slate-400 hover:text-white'}`}
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={item.icon}></path></svg>
                  <span className="text-[9px] md:text-[10px] uppercase tracking-widest text-left">{item.label}</span>
                </div>
                {item.badge ? (
                  <span className="bg-blue-600 text-white text-[7px] px-1.5 py-0.5 rounded-full shadow-[0_0_8px_#3b82f6]">{item.badge}</span>
                ) : null}
              </button>
            ))}
          </nav>

          {!isStandalone && (role === Role.SUPER_ADMIN || role === Role.PARTIAL_ADMIN) && (
            <div className="mt-6 border-t border-white/10 pt-6">
              <button 
                onClick={handleInstallClick}
                className="w-full flex items-center gap-3 px-5 py-3.5 bg-blue-600/20 text-blue-400 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all border border-blue-500/30 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                <span>Instalar</span>
              </button>
            </div>
          )}
        </div>

        <div className="p-6 md:p-8 border-t border-white/5">
          <button 
            onClick={onLogout}
            className="w-full py-3.5 md:py-4 bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white rounded-xl md:rounded-2xl transition-all font-black border border-red-500/30 uppercase text-[9px] md:text-[10px] tracking-widest active:scale-95"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <Modal isOpen={showModeSelection} onClose={() => setShowModeSelection(false)} title="Instalación" maxWidth="max-w-sm">
         <div className="space-y-4">
            <p className="text-[9px] text-slate-500 font-black text-center uppercase tracking-widest">
              Seleccione modo de acceso
            </p>
            <div className="space-y-2">
               {role === Role.SUPER_ADMIN && (
                 <button onClick={() => handleInstallProcess('full')} className="w-full py-4 bg-blue-700 text-white font-black rounded-xl uppercase text-[9px] tracking-widest shadow-lg active:scale-95">Sistema Completo</button>
               )}
               <button onClick={() => handleInstallProcess('attendance')} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[9px] tracking-widest active:scale-95">Marcación Kiosco</button>
            </div>
         </div>
      </Modal>

      {isOpen && <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-30 md:hidden" onClick={() => setIsOpen(false)}></div>}
    </>
  );
};

export default Sidebar;
