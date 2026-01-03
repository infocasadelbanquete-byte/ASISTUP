import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, type = 'info', children, footer, maxWidth }) => {
  if (!isOpen) return null;

  const headerColors = {
    info: 'bg-blue-600',
    warning: 'bg-yellow-500',
    error: 'bg-red-600',
    success: 'bg-emerald-600'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth || 'max-w-2xl'} overflow-hidden animate-in fade-in zoom-in duration-200`}>
        <div className={`${headerColors[type]} p-4 flex justify-between items-center text-white`}>
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;