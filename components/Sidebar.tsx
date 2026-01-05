import React, { useState, useEffect } from 'react';
import { Role } from '../types.ts';

interface SidebarProps {
  role: Role;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onLogout: () => void;
  companyName?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ role, activeTab, setActiveTab, onLogout, companyName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada o en modo standalone
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }
  }, []);

  const handleInstallClick = async () => {
    const deferredPrompt = (window as any).deferredPrompt;
    
    // 1. Caso: Navegador soporta prompt directo (Chrome, Edge, Android)
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        (window as any).deferredPrompt = null;
      }
      return;
    }

    // 2. Caso: Ya está instalada
    if (isStandalone) {
      alert("La aplicación ya se encuentra instalada en su equipo como aplicación nativa.");
      return;
    }

    // 3. Caso: iOS (Safari)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
      alert("Instalación en iOS:\n\n1. Pulse el botón 'Compartir' (cuadrado con flecha) en la barra inferior de Safari.\n2. Busque y seleccione 'Añadir a la pantalla de inicio'.\n3. Pulse 'Añadir' en la esquina superior derecha.");
      return;
    }

    // 4. Caso: Otros navegadores o evento aún no disparado
    alert("Para instalar la aplicación:\n\n• Si usa Chrome o Edge: Busque el icono de 'Instalar' en la parte derecha de la barra de direcciones.\n• Asegúrese de estar usando una conexión segura (HTTPS).\n• Espere unos segundos a que el sistema reconozca la capacidad de instalación.");
  };

  const menuItems = [
    { id: 'dashboard', label: 'Ecosistema Operativo', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', roles: [Role.SUPER_ADMIN, Role.PARTIAL_ADMIN] },
    { id: 'company', label: 'Institucional', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', roles: [Role.SUPER_ADMIN, Role.PARTIAL_ADMIN] },
    { id: 'employees', label: 'Talento Humano', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', roles: [Role.SUPER_ADMIN, Role.PARTIAL_ADMIN] },
    { id: 'payroll', label: 'Nómina', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', roles: [Role.SUPER_ADMIN] },
    { id: 'payments', label: 'Tesorería', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', roles: [Role.SUPER_ADMIN, Role.PARTIAL_ADMIN] },
    { id: 'reports', label: 'Reportes', icon: 'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2', roles: [Role.SUPER_ADMIN] },
    { id: 'settings', label: 'Ajustes', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', roles: [Role.SUPER_ADMIN] },
  ];

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className="fixed top-6 left-6 z-50 p-4 bg-blue-700 text-white rounded-2xl md:hidden shadow-2xl active:scale-90 transition-all">
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
        )}
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-80 gradient-blue text-white flex flex-col shadow-2xl transition-transform duration-500 md:translate-x-0 md:relative no-print ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-10 flex-1 overflow-y-auto custom-scroll">
          <div className="flex items-center gap-6 mb-16">
            <div className="ring-container scale-[0.45]">
                <div className="ring ring-1"></div>
                <div className="ring ring-2"></div>
                <div className="ring ring-3"></div>
                <div className="w-12 h-12 bg-blue-600 rounded-full"></div>
            </div>
            <div>
              <h2 className="text-2xl font-[950] tracking-tighter leading-none uppercase">ASIST UP</h2>
              <p className="text-[9px] text-blue-500 font-black tracking-[0.4em] mt-2">Enterprise Hub</p>
            </div>
          </div>
          
          <nav className="space-y-3">
            {menuItems.filter(item => item.roles.includes(role)).map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsOpen(false); }}
                className={`w-full flex items-center gap-5 px-6 py-5 rounded-[1.5rem] transition-all duration-300 font-black group ${activeTab === item.id ? 'bg-white text-slate-950 shadow-xl' : 'hover:bg-white/10 text-slate-400 hover:text-white'}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={item.icon}></path></svg>
                <span className="text-[11px] uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
          </nav>

          {!isStandalone && (
            <div className="mt-8 border-t border-white/10 pt-8">
              <button 
                onClick={handleInstallClick}
                className="w-full flex items-center gap-4 px-6 py-4 bg-blue-600/20 text-blue-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all border border-blue-500/30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                <span>Instalar Aplicación</span>
              </button>
            </div>
          )}
        </div>

        <div className="p-10 border-t border-white/5">
          <button 
            onClick={onLogout}
            className="w-full py-5 bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white rounded-[1.5rem] transition-all font-black border border-red-500/30 uppercase text-[11px] tracking-widest"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {isOpen && <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-30 md:hidden" onClick={() => setIsOpen(false)}></div>}
    </>
  );
};

export default Sidebar;