import React from 'react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  cancelLabel?: string;
  type?: 'warning' | 'danger' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  confirmLabel,
  cancelText,
  cancelLabel,
  type = 'warning',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const resolvedConfirmText = confirmLabel || confirmText || 'Sí, Confirmar Acción';
  const resolvedCancelText = cancelLabel || cancelText || 'Cancelar';

  const config = {
    warning: {
      icon: '⚠️',
      iconBg: 'bg-amber-100 text-amber-700 border-amber-300',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/30'
    },
    danger: {
      icon: '🛑',
      iconBg: 'bg-red-100 text-red-700 border-red-300',
      badge: 'bg-red-50 text-red-700 border-red-200',
      confirmBtn: 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
    },
    info: {
      icon: 'ℹ️',
      iconBg: 'bg-blue-100 text-blue-700 border-blue-300',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30'
    }
  }[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border-2 border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6 md:p-8 space-y-6 text-center">
          <div className={`w-16 h-16 ${config.iconBg} border-2 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm`}>
            {config.icon}
          </div>

          <div className="space-y-2">
            <h3 className="text-base sm:text-lg font-[950] text-slate-900 uppercase tracking-tight">
              {title}
            </h3>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase leading-relaxed text-center">
                {message}
              </p>
            </div>
          </div>

          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
            Esta confirmación es requerida antes de aplicar los cambios en el sistema institucional.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl uppercase text-[10px] tracking-wider transition-all cursor-pointer"
            >
              {resolvedCancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 py-3.5 px-5 ${config.confirmBtn} font-black rounded-xl uppercase text-[10px] tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2`}
            >
              <span>✓</span>
              <span>{resolvedConfirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
