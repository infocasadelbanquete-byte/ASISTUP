import React from 'react';
import { NotificationMessage } from '../../types.ts';

interface NotificationsModuleProps {
  notifications: NotificationMessage[];
  onToggleRead: (id: string) => void;
  onToggleProcessed: (id: string) => void;
  onClearAll: () => void;
}

const NotificationsModule: React.FC<NotificationsModuleProps> = ({ notifications, onToggleRead, onToggleProcessed, onClearAll }) => {
  const sorted = [...notifications].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className="max-w-4xl mx-auto fade-in pb-20">
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-[950] text-slate-900 tracking-tighter uppercase leading-none">Buzón de Notificaciones</h2>
          <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-2">Alertas y Eventos del Sistema</p>
        </div>
        <button 
          onClick={onClearAll}
          className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-all"
        >
          Limpiar Todo
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white p-20 rounded-[3rem] border-2 border-dashed border-slate-100 text-center">
          <span className="text-5xl opacity-20">📥</span>
          <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mt-6">No hay notificaciones recientes</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map(notif => (
            <div 
              key={notif.id} 
              className={`p-6 rounded-[2.5rem] border transition-all flex flex-col gap-4 ${
                notif.isRead ? 'bg-white border-slate-100 opacity-70' : 'bg-white border-blue-200 shadow-md scale-[1.01]'
              } ${notif.isProcessed ? 'border-emerald-200 bg-emerald-50/20' : ''}`}
            >
              <div className="flex items-start gap-5">
                <div className={`w-3 h-3 rounded-full mt-2 shrink-0 ${
                  notif.type === 'critical' ? 'bg-red-500 shadow-[0_0_10px_red]' : 
                  notif.type === 'alert' ? 'bg-yellow-500 shadow-[0_0_10px_yellow]' : 
                  'bg-blue-500'
                }`}></div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">{notif.title}</h4>
                      {notif.isProcessed && (
                        <span className="px-2 py-0.5 bg-emerald-500 text-white text-[7px] font-black uppercase rounded-full">Completado</span>
                      )}
                    </div>
                    <span className="text-[8px] font-black text-slate-400 uppercase">{new Date(notif.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{notif.message}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase mt-2">{new Date(notif.timestamp).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-50">
                <button 
                  onClick={() => onToggleRead(notif.id)}
                  className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                    notif.isRead 
                      ? 'bg-slate-100 text-slate-500' 
                      : 'bg-blue-50 text-blue-600 border border-blue-200'
                  }`}
                >
                  {notif.isRead ? 'Marcar como No Leído' : 'Marcar como Leído'}
                </button>
                <button 
                  onClick={() => onToggleProcessed(notif.id)}
                  className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                    notif.isProcessed 
                      ? 'bg-emerald-600 text-white shadow-lg' 
                      : 'bg-slate-900 text-white'
                  }`}
                >
                  {notif.isProcessed ? 'Marcar como Pendiente' : 'Marcar como Procesado'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsModule;